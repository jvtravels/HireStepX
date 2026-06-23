/* HireStepX — Reference-question retrieval
 *
 * Hierarchical fallback retrieval over the curated question bank
 * (data/interview-question-bank.ts). Returns up to K reference entries
 * for a (company × roleFamily × focus) query, with explicit "tier"
 * metadata so the calling LLM prompt knows how tight the match is and
 * can adjust its instruction accordingly.
 *
 * Tier semantics:
 *   1 = exact (company × roleFamily × focus)
 *   2 = same role + focus, any company
 *   3 = same focus only, any role/company
 *   4 = nothing matched — caller falls through to pure-LLM generation
 *
 * Pure module: no React, no DB, no fetch. The bank is in-memory at edge
 * cold-start; lookups are O(n) over a small list (≤200 entries) so no
 * index needed yet. When we swap to vector RAG (Phase 3), the surface
 * area of this module stays the same — only the implementation behind
 * `retrieveReferenceQuestions` changes.
 */

import {
  QUESTION_BANK,
  type BankEntry,
  type CompanyKey,
  type RoleFamily,
  type FocusArea,
} from "../data/interview-question-bank";

export type RetrievalTier = 1 | 2 | 3 | 4;

export interface RetrievalQuery {
  /** Free-text company name from the user's setup form. Normalised here. */
  company?: string;
  /** Inferred role family (swe / pm / em / data / design / behavioral). */
  roleFamily?: RoleFamily;
  /** Interview focus area (behavioral / technical / case-study / etc). */
  focus?: FocusArea;
  /** How many references to return. Default 5, hard-capped at 8. */
  limit?: number;
}

export interface RetrievalResult {
  entries: BankEntry[];
  tier: RetrievalTier;
  /** True only when entries.length > 0. False is a signal to caller
   *  that no relevant references were found. */
  hasMatches: boolean;
}

/* ─── Company-name normalisation ────────────────────────────────────
   Users write "Flipkart", "FlipKart", "flipkart.com" — collapse to
   the bank's canonical key. Returns null when nothing matches; the
   retrieval then falls through to non-company tiers. */
const COMPANY_ALIASES: Record<string, CompanyKey> = {
  // FAANG / Big Tech
  google: "google", "google india": "google", alphabet: "google",
  amazon: "amazon", "amazon india": "amazon", "aws": "amazon",
  microsoft: "microsoft", "ms": "microsoft", "msft": "microsoft",
  meta: "meta", facebook: "meta", fb: "meta",
  apple: "apple",
  netflix: "netflix",
  uber: "uber",
  atlassian: "atlassian",
  stripe: "stripe",
  linkedin: "linkedin",
  adobe: "adobe",
  // Indian unicorns
  flipkart: "flipkart",
  razorpay: "razorpay",
  swiggy: "swiggy",
  zomato: "zomato",
  phonepe: "phonepe", "phone pe": "phonepe",
  paytm: "paytm",
  cred: "cred",
  zerodha: "zerodha",
  meesho: "meesho",
  oyo: "oyo",
  freshworks: "freshworks",
  zoho: "zoho",
  // IT services
  tcs: "tcs", "tata consultancy services": "tcs", "tata consultancy": "tcs",
  infosys: "infosys",
  wipro: "wipro",
  cognizant: "cognizant",
  accenture: "accenture",
  // Consulting
  mckinsey: "mckinsey", "mckinsey and company": "mckinsey",
  bcg: "bcg", "boston consulting group": "bcg",
  bain: "bain", "bain and company": "bain",
  deloitte: "deloitte",
  // Banking / Quant
  goldman: "goldman", "goldman sachs": "goldman",
  jpmc: "jpmc", "jp morgan": "jpmc", "jpmorgan": "jpmc", "jp morgan chase": "jpmc",
  "morgan stanley": "morgan-stanley",
  "jane street": "jane-street", janestreet: "jane-street",
  "de shaw": "de-shaw", deshaw: "de-shaw",
  citadel: "citadel",
  // AI labs
  openai: "openai",
  anthropic: "anthropic",
  sarvam: "sarvam", "sarvam ai": "sarvam",
  // IT services (campus pipelines)
  ltimindtree: "ltimindtree", "lti mindtree": "ltimindtree",
  hcl: "hcl", "hcl technologies": "hcl",
  capgemini: "capgemini",
  ibm: "ibm",
  // Government / PSU bodies — distinct hiring formats
  upsc: "upsc", "civil services": "upsc", "ias exam": "upsc",
  ssc: "ssc", "staff selection": "ssc", "ssc cgl": "ssc",
  ibps: "ibps", "ibps po": "ibps", "ibps clerk": "ibps",
  rbi: "rbi", "reserve bank of india": "rbi", "rbi grade b": "rbi",
  sebi: "sebi",
  isro: "isro", "indian space research": "isro",
  drdo: "drdo", "defence research": "drdo",
  ssb: "ssb", "services selection board": "ssb",
};

export function normaliseCompany(raw: string | undefined): CompanyKey | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!cleaned) return null;
  if (COMPANY_ALIASES[cleaned]) return COMPANY_ALIASES[cleaned];
  // Loose contains check for things like "Flipkart Internet Pvt Ltd"
  for (const [alias, key] of Object.entries(COMPANY_ALIASES)) {
    if (cleaned.includes(alias)) return key;
  }
  return null;
}

/* ─── Role-family inference ─────────────────────────────────────────
   The LLM prompt receives the user's free-text role ("Senior PM",
   "SDE-3", "Lead UX"). Map to the role family our bank uses. */
export function inferRoleFamily(rawRole: string | undefined): RoleFamily | null {
  if (!rawRole) return null;
  const r = rawRole.toLowerCase();
  // Order matters — more specific patterns must precede generic ones.
  // (e.g. "ML Engineer" must hit "ml" before "engineer" hits "swe".)
  /* Govt/PSU role families. Civil-services covers IAS/IPS/IFS/IRS,
     RBI Grade B; defence covers SSB/Army/Navy/Air Force; scientist
     covers ISRO/DRDO/BARC; campus is fresher/GET/management trainee.
     These must precede the generic "engineer" / "scientist" patterns. */
  /* ─── 2026-Q2 niche-routing patterns (must come BEFORE generic
     patterns — these handle the long tail of specialised titles
     that previously routed to behavioral catch-all). ─── */
  /* Civil Services — full ladder including state cadres, police, BDO,
     Tehsildar, Patwari, Forest Range Officer, Joint/Asst Secretary etc. */
  if (/\b(ias officer|ips officer|ifs officer|irs officer|iaas officer|iis officer|ifoss officer|civil services|civil service|state civil service|pcs officer|mpsc|kpsc|tnpsc|wbpsc|bpsc|rpsc|uppsc|ras officer|kas officer|hcs officer|gpsc|deputy collector|district magistrate|sub-divisional magistrate|sdm|tehsildar|naib tehsildar|tahsildar|patwari|lekhpal|kanungo|block development officer|bdo|joint secretary|additional secretary|secretary to govt|cabinet secretary|principal secretary|joint commissioner|deputy commissioner|additional commissioner|under secretary|joint magistrate|additional district magistrate|city magistrate|revenue officer|land records officer|conservator of forest|forest range officer|range officer|deputy range officer|sub-inspector|police inspector|dsp\b|sp \(police\)|senior sp|dig \(police\)|ig \(police\)|additional dgp|dgp\b|police constable|head constable|asi\b|assistant sub-inspector|deputy commissioner of police|dcp\b|acp\b|assistant commissioner of police|commissioner of police)\b/i.test(r)) return "civil-services";
  /* Defence ranks (full granularity). */
  if (/\b(sepoy|lance naik|havildar|subedar major|junior commissioned officer|honorary lieutenant|honorary captain|lieutenant colonel|field marshal|lieutenant general|major general|wing commander|group captain|air commodore|air vice marshal|air marshal|air chief marshal|commodore|rear admiral|vice admiral|admiral of the fleet|ndrf officer|itbp officer|bsf officer|crpf officer|cisf officer|ssb officer|assam rifles|nsg officer|spg officer|raf officer|indian army|indian navy|indian air force|indian coast guard|squadron leader|flight lieutenant|flying officer|pilot officer|sub lieutenant|lieutenant \(navy\)|lieutenant commander|commander \(navy\)|captain \(navy\))\b/i.test(r)) return "defence";
  /* Healthcare niche — specific clinical specialties and hospital staff. */
  if (/\b(icu nurse|operation theatre nurse|ot nurse|er nurse|pediatric nurse|oncology nurse|ward sister|charge nurse|nursing sister|nursing superintendent|asst nursing superintendent|deputy nursing superintendent|director nursing|director of nursing|school nurse|public health nurse|anm\b|auxiliary nurse midwife|asha worker|anganwadi worker|multi-purpose health worker|nursing officer|staff nurse|registered nurse|nurse practitioner|nursing trainee|nursing intern|ot assistant|ot technologist|ot technician|ward boy|ward helper|health inspector|sanitary inspector|physiotherapy assistant|dental hygienist|dental assistant|medical records officer|medical coding|health information manager|patient relations manager|patient experience officer|x-ray technician|mri technician|ct scan technician|sonographer|cath lab technician|dialysis technician|anesthesia technician|ecg technician|lab technician|medical technologist|junior resident|senior resident|consultant internal medicine|consultant general surgery|consultant pediatrics|consultant ob-gyn|consultant cardiology|interventional cardiologist|pediatric cardiologist|cardiac electrophysiologist|consultant neurology|consultant neurosurgery|consultant orthopedics|joint replacement surgeon|consultant medical oncology|consultant surgical oncology|consultant radiation oncology|consultant hemato-oncology|consultant nephrology|consultant pulmonology|consultant gastroenterology|hepatologist|consultant endocrinology|consultant dermatology|consultant psychiatry|consultant anesthesiology|consultant radiology|interventional radiologist|nuclear medicine|consultant pathology|consultant ophthalmology|cataract surgeon|retina surgeon|cornea surgeon|consultant ent|consultant emergency|trauma surgeon|consultant critical care|intensivist|consultant plastic surgery|cosmetic surgeon|consultant urology|consultant vascular surgery|consultant cardiothoracic|director medical services|medical superintendent|chief of medical staff|chief of surgery|chief of cardiology|hod\s+(?:medicine|surgery|cardiology|neurology|orthopedics|oncology|pathology|radiology|anesthesiology|psychiatry|endocrinology|nephrology|pulmonology|gastroenterology|dermatology|ent|urology)|veterinarian|vet surgeon|optometrist|orthodontist|endodontist|periodontist|prosthodontist|oral surgeon|maxillofacial surgeon|sports physiotherapist)\b/i.test(r)) return "healthcare";
  /* Pharma sales / clinical research — pharmacist-adjacent → healthcare. */
  if (/\b(medical representative|pharmaceutical sales|area business manager.*pharma|brand manager.*pharma|product manager.*pharma|medical science liaison|msl\b|pharmacovigilance|drug safety|regulatory affairs.*pharma|clinical research associate|cra \(clinical\)|clinical research coordinator|clinical trial manager|clinical project manager|formulation scientist|analytical chemist.*pharma|api production chemist|process chemist.*pharma|synthetic chemist|medicinal chemist|qa officer.*pharma|qc chemist|validation officer.*pharma|gmp auditor|glp auditor|biostatistician|toxicologist|virologist|immunologist|bacteriologist)\b/i.test(r)) return "healthcare";
  /* Quant niche — Risk Quant / Quant Risk. */
  if (/\b(risk quant|quant risk|quant strategist|quant developer|systematic strategist|quantitative researcher|quantitative trader|quantitative developer|hft engineer)\b/i.test(r)) return "quant";
  /* AI niche — must precede swe pattern. */
  if (/\b(llm engineer|rag engineer|ai agents engineer|agentic systems|prompt engineer|prompt ops|ai platform engineer|ai infrastructure|ai research scientist|ai research engineer|conversational ai engineer|speech ai engineer|tts engineer|reinforcement learning engineer|rl researcher|ai quality engineer|ai evals engineer|ai safety researcher|responsible ai|ai ethics|ai governance|foundation model|vector database engineer|embeddings engineer|retrieval engineer|agent framework engineer|ai orchestration|mcp engineer|tool-use engineer|multimodal ai|generative vision engineer|diffusion models|ai red teamer|ai penetration tester|ai bias auditor|ai model governance|deepfake forensics|nlp engineer|nlp researcher|computer vision engineer|cv researcher|speech recognition engineer|voice ai engineer|mlops engineer|ml platform engineer|ml infrastructure|generative ai engineer)\b/i.test(r)) return "ml";
  /* Hardware / VLSI / chip design → swe family (closest comp curve). */
  if (/\b(vlsi engineer|rtl design|rtl engineer|physical design engineer|pd engineer|verification engineer|dv engineer|uvm verification|formal verification|asic design|asic engineer|fpga engineer|fpga design|dsp engineer|signal processing engineer|image processing engineer|analog design engineer|mixed signal|rf design engineer|layout engineer|silicon validation|post-silicon validation|pre-silicon validation|chip design|soc design|soc engineer|hardware design engineer|ic design|semiconductor design|wafer process engineer|photonics engineer|hardware engineer|firmware developer|firmware engineer|embedded linux engineer|rtos engineer|embedded systems architect|embedded c developer|autosar engineer|adas engineer|automotive software engineer|bms engineer|ev powertrain|motor controller engineer|power electronics engineer|robotics software engineer|robotics hardware|robot perception|robot motion planning|cobot engineer|robotic process automation|rpa developer|uipath developer|blue prism developer|automation anywhere|pega developer)\b/i.test(r)) return "swe";
  /* Cybersecurity niche → swe family (closest comp curve). */
  if (/\b(soc analyst|threat hunter|threat intelligence|incident response|appsec engineer|appsec architect|cloud security engineer|cloud security architect|network security engineer|endpoint security|edr specialist|iam engineer|iam architect|privileged access management|pam engineer|red team engineer|blue team engineer|purple team engineer|bug bounty hunter|vulnerability management|vulnerability analyst|security architect|deputy ciso|field ciso|forensics investigator|digital forensics|devsecops engineer|devsecops architect|grc analyst|grc manager|security awareness trainer|security researcher|malware analyst|reverse engineer|cryptography engineer|pki engineer|zero trust architect|post-quantum crypto|smart contract auditor|cybersecurity engineer|cybersecurity analyst|information security analyst|infosec engineer|penetration tester|cisco security|ciso\b)\b/i.test(r)) return "swe";
  /* Legal niche — Senior Counsel / Disputes / IP / Patent / Tax / Privacy / Crypto Lawyer etc. */
  if (/\b(senior counsel|principal associate \(law\)|general counsel|deputy general counsel|in-house counsel|head of legal|managing partner \(law\)|litigation lawyer|litigation counsel|disputes lawyer|arbitration specialist|dispute resolution|contract drafting specialist|patent attorney|patent agent|trademark attorney|ip counsel|privacy counsel|data protection officer|regulatory counsel|tax lawyer|tax advisor|real estate lawyer|property lawyer|conveyancing|employment lawyer|labour law|fintech lawyer|crypto lawyer|cybersecurity lawyer|ai\/tech lawyer|anti-bribery officer|fcpa specialist|sanctions officer|trade compliance|legal operations manager|legal ops|legal tech manager|paralegal|environmental lawyer|constitutional lawyer|criminal lawyer|civil rights attorney|family lawyer|divorce lawyer|child custody|adoption attorney|bankruptcy lawyer|insolvency professional|resolution professional|maritime lawyer|aviation lawyer|sports lawyer|entertainment lawyer)\b/i.test(r)) return "legal";
  /* Performing arts / religious / spiritual — these don't have a
     dedicated RoleFamily; behavioral is the right catch-all (concert
     performance / interview prep is generic). Explicitly route to
     behavioral so they don't accidentally hit other patterns. */
  if (/\b(bharatanatyam|kathak|kathakali|kuchipudi|mohiniyattam|odissi|manipuri|sattriya|hindustani vocalist|carnatic vocalist|playback singer|sitar player|sitar guru|tabla player|tabla guru|sarod player|veena player|flute player|sarangi player|mridangam player|harmonium player|shehnai player|santoor player|pakhawaj player|classical dancer|folk dancer|theatre actor|stand-up comedian|stand up comedian|improv performer|mime artist|magician|illusionist|puppeteer|storyteller|sutradhar|performing artist|cultural artist|akademi awardee|padma awardee|hindu priest|pandit|purohit|brahmin priest|vedic scholar|acharya|mahant|swami|shankaracharya|imam|mufti|maulana|maulvi|qari|hafiz|granthi|giani|ragi|pathi|pastor|reverend|bishop|archbishop|cardinal|catholic priest|protestant minister|deacon|catechist|buddhist monk|lama|rinpoche|bhikkhu|bhikkhuni|jain monk|sadhu|sadhvi|astrologer|vedic astrologer|numerologist|palmist|vastu consultant|feng shui consultant|tarot reader|theology professor)\b/i.test(r)) return "behavioral";
  /* Insurance / actuary / claims — finance family. */
  if (/\b(insurance underwriter|underwriter|insurance sales officer|insurance advisor|insurance surveyor|loss adjuster|actuary|pricing actuary|reserving actuary|reinsurance analyst|claims manager|claims adjuster)\b/i.test(r)) return "finance";
  /* Marketing analytics / attribution → marketing family. */
  if (/\b(attribution analyst|mix modeling analyst|mmm analyst|marketing data analyst|web analyst|digital analytics manager|adobe analytics specialist|ga4 specialist|seo manager|seo lead|technical seo|sem manager|paid search manager|paid social manager|email marketing manager|crm marketing manager|lifecycle email manager|marketing automation specialist|hubspot specialist|marketo specialist|salesforce marketing cloud specialist|pardot specialist|klaviyo specialist|content operations manager|head of social|community manager|influencer marketing manager|influencer strategist|affiliate marketing manager|crisis communications manager|investor communications manager|executive communications|abm manager|account-based marketing|demand generation manager|demand gen|pipeline marketing|head of demand gen|head of brand|brand director|brand strategist|director of product marketing|vp product marketing|vp marketing|director marketing|head of growth|head of digital)\b/i.test(r)) return "marketing";
  /* HR / People / Talent — dedicated family added 2026-Q2.
     Captures HRBP, TA, Comp & Benefits, Payroll, L&D, Workday/HRIS,
     People Analytics, Engagement, Talent Acquisition, Diversity. */
  if (/\b(hr executive|hr manager|hr director|hr business partner|hrbp\b|chief human resources officer|chro\b|chief people officer|cpo \(people\)|talent acquisition|ta specialist|ta manager|ta lead|recruiter\b|tech recruiter|technical recruiter|non-tech recruiter|executive recruiter|headhunter|sourcer|sourcing lead|talent sourcer|campus recruitment|campus hiring|university relations|diversity & inclusion|dei manager|dei specialist|compensation & benefits|c&b manager|total rewards|compensation analyst|comp analyst|benefits manager|payroll manager|payroll specialist|payroll executive|learning & development|l&d lead|l&d specialist|l&d manager|training manager|corporate trainer|soft skills trainer|leadership development|od specialist|organizational development|performance management|employee relations|er manager|industrial relations|ir manager|engagement manager \(hr\)|employee engagement|culture lead|hr analyst|people analytics|hr operations|hr ops|hris manager|workday specialist|successfactors specialist|workday implementation|peoplesoft specialist|oracle hcm specialist|chief learning officer|head of people|vp people|vp hr|head of talent|head of l&d)\b/i.test(r)) return "hr";
  /* Procurement / supply chain → ops. */
  if (/\b(procurement executive|procurement manager|procurement director|vp procurement|chief procurement officer|strategic sourcing manager|senior sourcing manager|category manager \(procurement\)|indirect buyer|direct buyer|vendor manager|vendor development|demand planner|supply planner|s&op manager|chief supply chain officer|head of supply chain|s&op|materials manager|mrp specialist|continuous improvement manager|process excellence manager|lean manager|six sigma manager|kaizen lead|customs officer|customs broker|customs compliance|trade compliance manager|import-export manager|exim manager|logistics coordinator|3pl manager|inventory manager|last-mile delivery manager|hub manager)\b/i.test(r)) return "ops";
  /* Real estate / property → sales family. */
  if (/\b(real estate agent|real estate broker|property consultant|channel sales manager \(re\)|property sales manager|real estate investment analyst|reit analyst|reit manager|property manager|facility manager|soft services manager|hard services manager|mall manager|retail property manager)\b/i.test(r)) return "sales";
  /* Hospitality F&B / kitchen / spa / wedding planner — ops. */
  if (/\b(hotel general manager|hotel manager|resident manager|front office manager|reception manager|reservations manager|concierge|f&b manager|f and b manager|banquet manager|restaurant manager|bar manager|mixologist|bartender|sommelier|executive chef|sous chef|chef de partie|demi chef de partie|commis chef|pastry chef|bakery chef|banquet chef|continental chef|indian chef|tandoor chef|chinese chef|asian chef|housekeeping manager|executive housekeeper|floor supervisor|spa manager|spa director|spa therapist|massage therapist|wellness consultant|revenue manager \(hotel\)|director of revenue \(hotel\)|wedding coordinator|wedding planner|event coordinator \(hotel\)|florist|floral designer|event decorator|set stylist)\b/i.test(r)) return "ops";
  /* Aviation pilots / cabin crew / ATC / AME — ops. */
  if (/\b(trainee pilot|cadet pilot|co-pilot|first officer|type-rated first officer|type-rated captain|line check captain|designated examiner|chief pilot|director of flight operations|vp flight operations|cabin crew|lead cabin crew|cabin manager|inflight service manager|purser|aircraft mechanic|avionics mechanic|engine mechanic|ame \((airframe|engine|avionics|electrical|instrumentation)\)|quality inspector \(aviation\)|dgca inspector|air traffic controller|atco|watch supervisor \(atc\)|atc manager|airport operations manager|airport manager|station manager|ramp agent|airline customer service agent|airline reservations agent)\b/i.test(r)) return "ops";
  /* Retail / store ops → ops. */
  if (/\b(store manager|department manager \(retail\)|retail manager|retail operations manager|retail director|visual merchandiser|vm lead|window display designer|merchandiser|buyer \(retail\)|planner \(retail\)|allocation analyst|inventory planner|demand planner \(retail\)|marketplace manager|e-commerce manager|catalog manager|listing specialist|pricing manager \(retail\)|discount strategy manager|cashier|floor associate|sales associate|customer service associate \(retail\)|loss prevention officer)\b/i.test(r)) return "ops";
  /* Trades / skilled labour — ops (closest comp curve). */
  if (/\b(electrician|plumber|carpenter|welder|tig welder|mig welder|pipe welder|structural welder|mason|construction worker|tile layer|painter \(construction\)|auto mechanic|diesel mechanic|heavy equipment mechanic|two-wheeler mechanic|air conditioner mechanic|refrigeration mechanic|tailor|master tailor|sewing machine operator|goldsmith|jeweler|beautician|hair stylist|salon manager|makeup artist|bridal makeup artist|celebrity makeup artist|nail technician|eyebrow specialist|boiler operator|crane operator|heavy vehicle driver|jcb operator|earthmover operator|lineman|cable joiner|tower lineman|survey engineer|total station operator|gis surveyor|dgps surveyor|gis analyst)\b/i.test(r)) return "ops";
  /* Government Group C/D / clerical → behavioral. */
  if (/\b(multi-tasking staff|mts\b|group d employee|group c employee|lower division clerk|ldc\b|upper division clerk|udc\b|stenographer|section officer \(govt\)|office superintendent|head clerk|office assistant \(govt\)|data entry operator \(govt\)|junior translator|senior translator|junior hindi translator|senior hindi translator)\b/i.test(r)) return "ops";
  /* Manufacturing / production / civil engineering field roles → ops. */
  if (/\b(mechanical design engineer|cad engineer|cad designer|autocad engineer|solidworks engineer|catia engineer|ptc creo engineer|production engineer|manufacturing engineer|industrial engineer|process engineer|quality engineer \(mfg\)|six sigma black belt|lean manufacturing engineer|maintenance engineer|reliability engineer \(mfg\)|plant engineer|plant manager|project engineer \(mech\)|tooling engineer|jigs & fixtures engineer|stamping engineer|chemical engineer|process engineer \(chemical\)|petroleum engineer|reservoir engineer|drilling engineer|production engineer \(oil & gas\)|petrochemical engineer|refinery engineer|pipeline engineer|subsea engineer|mining engineer|geologist|exploration geologist|metallurgical engineer|metallurgist|foundry engineer|heat treatment engineer|materials engineer|materials scientist|polymer engineer|composite materials engineer|coating engineer|corrosion engineer|environmental engineer|ehs engineer|ehs manager|industrial safety engineer|hvac engineer|plumbing engineer|mep engineer|mep designer|mep project manager|site engineer|structural engineer|geotechnical engineer|highway engineer|bridge engineer|tunnel engineer|dam engineer|construction engineer|construction manager \(civil\)|quantity surveyor|qs engineer|estimation engineer|tender engineer|contracts engineer|contracts manager|planning engineer|primavera engineer|msp planning engineer)\b/i.test(r)) return "ops";
  /* Aerospace / defence engineering → defence. */
  if (/\b(aerospace engineer|aircraft maintenance engineer|aircraft design engineer|avionics engineer|flight test engineer|aerodynamics engineer|propulsion engineer|stress engineer|aircraft structural engineer|composite engineer \(aero\)|spacecraft engineer|satellite systems engineer|mission operations engineer|launch vehicle engineer|payload engineer|ground systems engineer|defense systems engineer|naval architect|marine engineer|submarine engineer|weapon systems engineer|radar engineer|sonar engineer|ew engineer)\b/i.test(r)) return "defence";
  /* PSU engineer ladder. */
  if (/\b(junior engineer \(psu\)|assistant engineer \(psu\)|executive engineer \(psu\)|superintending engineer|chief engineer \(psu\)|agm \(psu\)|dgm \(psu\)|gm \(psu\)|ed \(psu\)|director \(psu\)|isro scientist\/engineer|bhel engineer|ntpc engineer|ongc engineer|gail engineer|iocl engineer|bpcl engineer|hpcl engineer|coal india engineer|nmdc engineer|sail engineer|rvnl engineer|dmrc engineer)\b/i.test(r)) return "psu-engineer";
  /* Architecture / urban design / interior — design family. */
  if (/\b(architect\b|design architect|project architect|lead architect|architectural designer|interior architect|interior designer|interior decorator|interior stylist|set designer|urban designer|urban planner|town planner|master planner|transport planner|landscape architect|landscape designer|bim manager|bim coordinator|bim modeler|revit specialist)\b/i.test(r)) return "design";
  /* Photography / content creator / videographer → writer (closest creative-IC). */
  if (/\b(wedding photographer|fashion photographer|product photographer|food photographer|wildlife photographer|photojournalist|studio photographer|travel photographer|lifestyle photographer|photo editor|picture editor|videographer|wedding videographer|corporate videographer|content creator|reels creator|youtube creator|instagram influencer|tiktok creator|twitch streamer|live streamer)\b/i.test(r)) return "writer";
  /* Sports coaching / fitness / esports — behavioral catch-all is fine. */
  if (/\b(sports coach|cricket coach|football coach|tennis coach|badminton coach|athletic coach|strength & conditioning coach|fitness trainer|personal trainer|group fitness instructor|yoga instructor|yoga trainer|pilates instructor|zumba instructor|crossfit coach|calisthenics coach|sports physiotherapist|sports nutritionist|sports psychologist|sports manager|sports marketing manager|sports sponsorship manager|athlete manager|talent manager \(sports\)|sports agent|sports journalist|cricket writer|football writer|sports broadcaster|match commentator|sports anchor|esports player|pro gamer|esports coach|esports manager|esports caster|esports analyst|esports production manager)\b/i.test(r)) return "behavioral";
  /* Agriculture / forestry / NGO / policy / lab research → consultant
     (closest comp-curve match for advisory/research roles). */
  if (/\b(agriculture officer|agricultural engineer|agronomist|crop scientist|soil scientist|plant pathologist|entomologist|horticulturist|floriculturist|tea planter|coffee planter|dairy manager|animal husbandry officer|livestock manager|poultry manager|aquaculture manager|fisheries officer|marine biologist|forest officer\b|dfo\b|forester|wildlife warden|wildlife biologist|conservationist|naturalist|park ranger|agritech field manager|crop advisory officer|farm advisor|mandi operations manager|fpo coordinator|program manager \(ngo\)|program director \(ngo\)|country director \(ngo\)|project coordinator \(ngo\)|project officer \(ngo\)|field officer \(ngo\)|community mobilizer|monitoring & evaluation specialist|m&e manager|m&e specialist|m&e director|fundraising manager|director fundraising|donor relations manager|grant writer|grants manager|csr manager|director csr|csr lead|sustainability manager|esg analyst|esg manager|director esg|vp sustainability|climate risk analyst|carbon markets analyst|carbon markets specialist|voluntary carbon trader|policy analyst|public policy manager|government affairs manager|public affairs director|lobbyist|government relations lead|researcher \(think tank\)|fellow\b|senior fellow|resident scholar)\b/i.test(r)) return "consultant";
  /* Lab / research / scientist roles. */
  if (/\b(research scholar|phd scholar|postdoctoral researcher|research fellow|jrf\b|srf\b|research associate|principal investigator|lab manager|lab director|bench chemist|synthesis chemist|polymer chemist|biochemist|cell biologist|molecular biologist|geneticist|virologist|immunologist|bacteriologist|bioinformatics analyst|computational biologist|genomics scientist|proteomics scientist|metabolomics scientist|material scientist|nanomaterials researcher|energy researcher|battery researcher|solar cell researcher|climate scientist|atmospheric scientist|oceanographer|hydrologist|geophysicist|seismologist|quantum computing researcher|quantum software engineer|quantum hardware engineer|quantum algorithm engineer|post-quantum crypto engineer|quantum cryptography researcher|bci engineer|brain-computer interface researcher|neurotechnology engineer|bioprinting engineer|tissue engineer|synthetic biology engineer|synthetic biology designer|longevity researcher|biohacker|cell therapy scientist|gene therapy researcher|mrna therapeutics researcher|crispr engineer|genomic editing researcher|drone pilot|drone operator|uav engineer|drone designer|space operations engineer|satellite constellation manager|lunar mission engineer|mars mission researcher|asteroid mining researcher)\b/i.test(r)) return "scientist";
  /* Web3 / DAO / crypto operations → swe (closest engineering ladder). */
  if (/\b(dao steward|dao treasury manager|crypto tax analyst|crypto compliance officer|tokenomics designer|liquidity pool manager|defi engineer|web3 product manager|dao operations lead|smart contract auditor|token engineer|blockchain architect|blockchain developer)\b/i.test(r)) return "swe";
  /* Travel / tourism → ops. */
  if (/\b(travel consultant|travel agent|travel manager|tour operator|tour manager|tour designer|trip planner|visa specialist|visa counselor|immigration consultant|tourism manager|destination manager|mice manager|corporate travel manager)\b/i.test(r)) return "ops";
  /* AR/VR/XR/Metaverse — design (closest creative-IC). */
  if (/\b(ar\/vr engineer|xr developer|spatial computing engineer|metaverse engineer|metaverse designer|virtual world designer)\b/i.test(r)) return "swe";
  /* Game design / development. */
  if (/\b(game developer|unity developer|unreal developer|game engine developer|game ai programmer|graphics programmer|shader programmer|mobile game developer|game designer|level designer|technical game designer|game producer|game director|game tester|game artist|concept artist|environment artist|character artist|texture artist|lighting artist|look dev artist)\b/i.test(r)) return "swe";
  /* Animation / VFX → design. */
  if (/\b(animator|2d animator|3d animator|character animator|vfx artist|vfx supervisor|vfx producer|compositor|roto artist|match move artist|motion designer|motion graphics artist|industrial designer)\b/i.test(r)) return "design";
  /* Cleantech / EV / renewables / battery → ops (factory) or scientist (R&D)
     based on role wording. Default ops. */
  if (/\b(sustainability engineer|carbon accounting specialist|esg reporting specialist|climate tech engineer|cleantech product manager|hydrogen engineer|carbon capture engineer|electrolyzer engineer|battery engineer|battery pack designer|cell engineer|renewable energy engineer|solar energy engineer|wind energy engineer)\b/i.test(r)) return "ops";
  /* Founders / executive / VC / PE → consultant (closest case-study comp). */
  if (/\b(co-founder|founder\b|managing director|executive director|group ceo|country head|regional head|vertical head|head of strategy|chief strategy officer|chief of staff|office of ceo|ea to ceo|board director|board advisor|independent director|non-executive director|advisor\b|strategic advisor|operating partner|venture partner|investment partner|principal \(vc\)|senior associate \(vc\)|associate \(vc\)|analyst \(vc\)|investment director|managing director \(vc\)|investment manager|portfolio manager \(vc\)|private equity analyst|pe associate|pe senior associate|pe vice president|pe director|pe managing director|operating partner \(pe\)|family office analyst|family office director|wealth manager \(family office\)|investment strategist \(family office\))\b/i.test(r)) return "consultant";
  /* ─── End of 2026-Q2 niche-routing patterns ─── */
  if (/\b(ias|ips|ifs|irs|civil services|upsc aspirant|rbi grade)\b/i.test(r)) return "civil-services";
  if (/\b(army officer|navy officer|air force|nda cadet|cds officer|afcat|defence)\b/i.test(r)) return "defence";
  if (/\b(isro scientist|drdo scientist|government scientist|barc|tifr|defence scientist)\b/i.test(r)) return "scientist";
  if (/\b(bank po|ibps po|ibps clerk|psu engineer|gate qualified engineer)\b/i.test(r)) return "psu-engineer";
  if (/\b(fresher|campus hire|graduate engineer trainee|management trainee|trainee engineer|apprentice)\b/i.test(r)) return "campus";
  if (/\b(ml engineer|ai engineer|llm engineer|genai|machine learning engineer|applied scientist|research engineer)\b/.test(r)) return "ml";
  if (/\b(quant|quantitative researcher|quantitative trader|quantitative developer|trader|systematic)\b/.test(r)) return "quant";
  // Consulting-specific titles only — exclude generic "partner" / "manager"
  // which over-trigger on "HR Partner", "Account Manager", etc.
  if (/\b(consultant|management consultant|strategy consultant|associate consultant|engagement manager)\b/.test(r)) return "consultant";
  if (/\b(writer|copywriter|editor|technical writer|ux writer|content designer|screenwriter|journalist|reporter|columnist|stringer|correspondent|sub-editor|ghostwriter|author|novelist|poet|translator|interpreter|subtitler|content strategist|content marketing|seo content|content operations|content director|editorial director|managing editor|copy editor|line editor|developmental editor|proofreader|fact-checker|content reviewer|content moderator|content producer|content curator|technical editor|content writer|blog writer|article writer|feature writer|email copywriter|grant writer|book editor|manuscript editor|brand voice writer|narrative writer|story designer|worldbuilder|quest writer|lore writer|microcopy writer|voice & tone|conversational ai writer|voice ui writer|chatbot writer|story editor|dialogue writer|head writer|showrunner|screenplay|narrative designer|comic book writer|graphic novel writer|podcast writer|audio drama writer|youtube scriptwriter|reels scriptwriter|video script|voiceover script|annual report writer|investor communications|press release writer|crisis communications|speechwriter|internal communications|executive communications|research writer|academic writer|academic editor|thesis writer|dissertation editor|grant proposal writer|white paper writer|case study writer|report writer|policy writer|rfp writer|bid writer|tender writer|literature review writer|legal writer|legal editor|contract drafter|compliance writer|regulatory writer|privacy policy writer|medical writer|scientific writer|clinical writer|pharma content writer|cme writer|financial writer|investment research writer|equity research writer|fintech content writer|crypto writer|customer story writer|sales enablement writer|product marketing writer|solution writer|demo script writer|localization writer|localization specialist|localization manager|hindi translator|tamil translator|telugu translator|marathi translator|bengali translator|multilingual content writer|social media writer|social media copywriter|twitter copywriter|linkedin ghostwriter|instagram copywriter|influencer content writer|reel caption writer|thread writer|resume writer|linkedin profile writer|bio writer|ai content editor|ai prompt writer|ai training writer|synthetic data writer|conversation designer|aso writer|asoc writer)\b/.test(r)) return "writer";
  /* Sales — dedicated bank family (was defaulting to behavioral).
     Banking RM and BFSI sales get their own bfsi-sales family below. */
  if (/\b(account executive|key account manager|enterprise sales manager|inside sales|presales consultant|pre-sales consultant|solutions consultant|sales operations manager|revops manager|deal desk manager|channel manager|partner manager|strategic account manager|field sales|telesales|sdr|bdr|mdr|outbound sdr|customer success manager|customer onboarding specialist|renewals manager|customer retention manager|implementation manager|onboarding manager|territory manager|business development manager|business development executive|bd lead|sales manager|sales executive|area sales manager|regional sales manager|zonal sales manager|head of sales|vp of sales|chief revenue officer|cro\b)\b/.test(r)) return "sales";
  /* BFSI sales — banking RM / wealth manager / loan officer have
     distinct probes (KYC, product-mix, AUM-growth) vs SaaS sales. */
  if (/\b(relationship manager|bank po|ibps po|sbi po|loan officer|insurance agent|wealth manager|private banker|branch manager|credit manager|family office associate)\b/.test(r)) return "bfsi-sales";
  /* Marketing & brand — dedicated family. */
  if (/\b(marketing manager|digital marketing|brand manager|brand director|brand strategist|product marketing manager|growth manager|content strategist|seo specialist|sem specialist|social media manager|performance marketing|email marketing|martech|abm manager|field marketing|influencer marketing|affiliate manager|partnerships manager|community manager|customer marketing|marketing analyst|growth analyst|events manager|trade marketing|management trainee|brand executive|brand solutions manager|head of growth|chief marketing officer|cmo|mt\b|public relations manager|pr manager|corporate communications manager)\b/.test(r)) return "marketing";
  /* Operations / hospitality / aviation / retail / category — ops family. */
  if (/\b(operations manager|operations executive|supply chain|logistics manager|warehouse|fleet manager|front office|f&b manager|housekeeping manager|ground staff|cabin crew|flight attendant|airport operations|production manager|delivery manager|shift manager|plant head|plant manager|process engineer|quality manager|quality engineer|industrial engineer|ehs manager|safety officer|lean manager|continuous improvement|maintenance engineer|reliability engineer|estimation engineer|tender manager|planning engineer|quantity surveyor|category manager|store manager|retail manager|buyer|merchandiser|visual merchandiser|hotel manager|chef|sommelier|bartender|tour operator|travel consultant|pricing analyst|pricing manager|catalog manager|listing specialist|marketplace manager|ecommerce manager|amazon account manager|flipkart account manager|customs broker|import-export|trade compliance|pilot|first officer|captain|cabin crew|aircraft maintenance engineer|ame|tourism manager)\b/.test(r)) return "ops";
  /* Healthcare specialists → healthcare family. */
  if (/\b(nurse|physiotherapist|occupational therapist|speech therapist|audiologist|radiologist|pathologist|microbiologist|biochemist|dietician|nutritionist|anesthesiologist|cardiologist|oncologist|neurologist|psychiatrist|pediatrician|gynecologist|orthopedic surgeon|ent specialist|dermatologist|psychologist|counselor|therapist|clinical psychologist|medical officer|resident doctor|junior resident|senior resident|clinical research manager|regulatory affairs manager|bioinformatics analyst|health informatics manager|clinical data manager|pharmacovigilance officer|drug safety associate|medical coder|hospital administrator|healthcare manager|dentist|doctor|mbbs|surgeon|md\b|pharmacist|medical representative)\b/.test(r)) return "healthcare";
  /* Finance / audit / accounting → finance family. */
  if (/\b(statutory auditor|internal auditor|auditor|audit manager|tax consultant|gst consultant|chartered accountant|financial analyst|investment analyst|investment banking analyst|equity research analyst|m&a analyst|private equity analyst|venture capital analyst|investment associate|quant trader|equity trader|fixed income analyst|derivatives analyst|cost accountant|icwa|forensic accountant|management accountant|aml analyst|kyc analyst|wealth management associate|equity sales|debt capital markets|credit risk analyst|market risk analyst|operational risk analyst|model risk analyst|compliance officer|finance manager|finance controller|fp&a analyst|treasury analyst|risk analyst|credit analyst|underwriter|claims manager|actuarial analyst|forex trader|trader|systematic trader|cfo|ca\b|cs\b)\b/.test(r)) return "finance";
  /* Legal sub-roles → legal family. */
  if (/\b(legal counsel|corporate lawyer|legal associate|company secretary|compliance manager|ip lawyer|patent attorney|trademark attorney|ip analyst|litigation associate|tax lawyer|m&a lawyer|real estate lawyer|banking lawyer|privacy counsel|data protection officer|paralegal|legal operations manager|contract manager|arbitration specialist)\b/.test(r)) return "legal";
  /* Education / teaching → behavioral (no dedicated bank-family,
     pedagogical content covers it). */
  if (/\b(teacher|lecturer|professor|assistant professor|associate professor|principal|education counselor|academic counselor|curriculum designer|curriculum developer|corporate trainer|subject matter expert|instructional designer|learning experience designer|edtech content developer|education researcher|pre-school teacher|special educator|tutor)\b/.test(r)) return "behavioral";
  if (/\b(pm|product manager|product owner|apm|gpm|cpo|product lead|product analyst)\b/.test(r)) return "pm";
  if (/\b(em|engineering manager|tech lead|staff engineer|principal engineer|director)\b/.test(r)) return "em";
  if (/\b(data scientist|data engineer|data analyst|ds|business intelligence|analytics engineer)\b/.test(r)) return "data";
  if (/\b(senior designer|design lead|design manager|design director|head of design|principal designer)\b/.test(r)) return "designer-senior";
  if (/\b(designer|ux|ui|product designer)\b/.test(r)) return "design";
  if (/\b(swe|sde|software engineer|developer|programmer|engineer|backend|frontend|fullstack|full stack)\b/.test(r)) return "swe";
  // Default: behavioral applies to most non-technical generic roles.
  return "behavioral";
}

/* ─── Focus normalisation ───────────────────────────────────────────
   Map the user-facing focus value to the bank's FocusArea. */
const FOCUS_MAP: Record<string, FocusArea> = {
  behavioral: "behavioral", general: "general",
  technical: "technical", "system-design": "system-design",
  "case-study": "case-study", "campus-placement": "campus-placement",
  /* "hr" is the bank's FocusArea; "hr-round" is the type/focus string the
     interview surface emits (SessionSetup forwards ?focus=hr-round). Alias it
     so HR rounds retrieve the company-specific HR reference questions (tcs,
     infosys, wipro, paytm) instead of falling through to the generic pool. */
  hr: "hr", "hr-round": "hr", panel: "panel", "salary-negotiation": "salary-negotiation",
  leadership: "leadership",
  /* Strategic now has its own retrieval bucket (was aliased to
     case-study). Strategic = defending a position to senior
     stakeholders; case-study = framework-driven analysis under
     interviewer guidance. Different question shapes; should not
     share a pool. Falls back to case-study at tier 2 if strategic
     doesn't have a tier-1 hit for the (company × role) combo. */
  strategic: "strategic",
  /* Management gets its own focus bucket (was silently falling back
     to behavioral). EM-level probes — scaling, hiring/firing, perf
     mgmt, x-functional alignment — surface in tier-1 retrieval. */
  management: "management", "engineering management": "management",
  /* Government / PSU is a distinct retrieval bucket — UPSC PT,
     SSB, RBI Grade B, ISRO/DRDO viva have nothing in common with
     private-sector behavioral so they need their own pool. */
  "government-psu": "government-psu", government: "government-psu",
  psu: "government-psu", "civil-services": "government-psu",
};
export function normaliseFocus(raw: string | undefined): FocusArea | null {
  if (!raw) return null;
  return FOCUS_MAP[raw.toLowerCase()] || null;
}

/* ─── Recency weight ────────────────────────────────────────────────
   Older quarters get downweighted so 2024 questions don't outrank a
   fresh 2026 entry on a tie. Decay is mild — interview formats
   evolve gradually, not abruptly. */
function recencyWeight(addedQuarter: string): number {
  const m = addedQuarter.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return 0.5;
  const yearVal = parseInt(m[1], 10) + (parseInt(m[2], 10) - 1) * 0.25;
  const nowYear = new Date().getFullYear() + Math.floor(new Date().getMonth() / 3) * 0.25;
  const ageYears = Math.max(0, nowYear - yearVal);
  return 1 / (1 + ageYears * 0.4);
}

/* ─── The retrieval ────────────────────────────────────────────────
   Run the four tiers in order; return the first that gives ≥1 match.
   Within a tier, sort by recencyWeight DESC. */
export function retrieveReferenceQuestions(query: RetrievalQuery): RetrievalResult {
  const limit = Math.min(query.limit ?? 5, 8);
  const company = normaliseCompany(query.company);
  const roleFamily = query.roleFamily ?? null;
  const focus = query.focus ?? null;

  const sortByRecency = (a: BankEntry, b: BankEntry) =>
    recencyWeight(b.addedQuarter) - recencyWeight(a.addedQuarter);

  /* Tier 1: exact match */
  if (company && roleFamily && focus) {
    const exact = QUESTION_BANK.filter(e =>
      e.company === company && e.roleFamily === roleFamily && e.focus === focus,
    ).sort(sortByRecency).slice(0, limit);
    if (exact.length > 0) return { entries: exact, tier: 1, hasMatches: true };
  }

  /* Tier 2: same role + focus, any company */
  if (roleFamily && focus) {
    const t2 = QUESTION_BANK.filter(e =>
      e.roleFamily === roleFamily && e.focus === focus,
    ).sort(sortByRecency).slice(0, limit);
    if (t2.length > 0) return { entries: t2, tier: 2, hasMatches: true };
  }

  /* Tier 3: same focus only */
  if (focus) {
    const t3 = QUESTION_BANK.filter(e => e.focus === focus)
      .sort(sortByRecency).slice(0, limit);
    if (t3.length > 0) return { entries: t3, tier: 3, hasMatches: true };
  }

  /* Tier 4: no match — caller should fall through to pure LLM generation */
  return { entries: [], tier: 4, hasMatches: false };
}

/* ─── Prompt-injection formatter ────────────────────────────────────
   Render retrieved entries as a section the LLM prompt can include.
   The CRITICAL instruction — "use as STYLE inspiration, do NOT copy
   verbatim" — is part of the rendered block so it can never be
   accidentally omitted by callers. */
export function formatReferencesForPrompt(result: RetrievalResult): string {
  if (!result.hasMatches) {
    /* Tier 4: zero references. Tell the LLM explicitly so it knows
       it's flying blind on this combo and shouldn't fabricate
       company/role specifics. */
    return [
      "",
      "REAL-WORLD REFERENCE QUESTIONS (tier 4 — no direct match in our verified bank):",
      "GROUNDING NOTE: We have no verified reference questions for this exact (company × role × focus) combination. Stay with universally applicable questions for the focus area. DO NOT invent company-specific facts, scale numbers, product names, founders, or recent news. Use anonymous framings (\"a major Indian unicorn\", \"a high-scale payments product\") if you must reference the company at all.",
      "",
    ].join("\n");
  }
  const tierDescription =
    result.tier === 1 ? "exact match for this company, role, and focus"
    : result.tier === 2 ? "same role + focus at peer companies"
    : result.tier === 3 ? "same focus area, broader role pool"
    : "no direct match";
  const lines: string[] = [];
  lines.push("");
  lines.push(`REAL-WORLD REFERENCE QUESTIONS (tier ${result.tier} — ${tierDescription}):`);
  lines.push("These are HAND-CURATED, VERIFIED questions from real recent interviews. Use them as STYLE and DEPTH anchors. DO NOT copy them verbatim — generate fresh questions that match the format, specificity, and tone but use different wording, scenarios, or angles. The candidate must not see these literal strings.");
  /* Tier-aware grounding warning. The further from exact match, the
     less the LLM can rely on these references for company-specific
     fact grounding. Make the limit explicit so it doesn't improvise. */
  if (result.tier === 2) {
    lines.push("GROUNDING NOTE: These references are tier-2 (same role + focus, but at PEER companies, not the candidate's actual target). Use them for FORMAT and DEPTH calibration only. DO NOT carry over company-specific details (scale numbers, product names, internal processes) from these references — those belong to the peer company, not the candidate's target.");
  } else if (result.tier === 3) {
    lines.push("GROUNDING NOTE: These references are tier-3 (same focus area, different role family). Use them ONLY to calibrate the focus-area question style. DO NOT carry over the role-specific or company-specific specifics — they belong to a different interview context. Ground every company/role mention in the candidate's stated target, in generic terms if no verified facts are available.");
  }
  lines.push("");
  for (const e of result.entries) {
    /* Confidence stamp surfaces verified vs inferred. The LLM is
       instructed to anchor harder on verified specifics; treat
       inferred entries as directional only. Default = verified. */
    const confidence = e.confidence ?? "verified";
    const confidenceTag = confidence === "verified" ? "" : ` [confidence: inferred]`;
    lines.push(`  - ${e.text}${confidenceTag}`);
    if (e.styleNote) lines.push(`    [pattern: ${e.styleNote}]`);
  }
  lines.push("");
  lines.push("CONFIDENCE NOTE: Entries marked [confidence: inferred] are pattern extrapolations from public job descriptions, NOT cross-source-verified candidate post-mortems. Treat them as directional style guides only — do NOT anchor specific fact claims to them. Unmarked entries are verified from 2+ independent candidate sources.");
  lines.push("");
  return lines.join("\n");
}
