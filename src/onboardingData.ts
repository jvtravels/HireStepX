/* ─── Suggestion data for Onboarding autocomplete inputs (India-focused) ─── */

export const ROLE_SUGGESTIONS = [
  // Software Engineering
  "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Principal Engineer", "Lead Software Engineer",
  "Software Developer", "Senior Software Developer", "Application Developer", "Systems Engineer",
  "Frontend Developer", "Senior Frontend Developer", "React Developer", "Angular Developer", "Vue.js Developer",
  "Backend Developer", "Senior Backend Developer", "Java Developer", "Python Developer", "Node.js Developer", "Go Developer", ".NET Developer",
  "Full Stack Developer", "Senior Full Stack Developer", "MERN Stack Developer", "MEAN Stack Developer",
  "Mobile Developer", "iOS Developer", "Android Developer", "React Native Developer", "Flutter Developer",
  "Embedded Software Engineer", "Firmware Engineer", "C++ Developer", "Rust Developer",
  // DevOps & Cloud
  "DevOps Engineer", "Senior DevOps Engineer", "Site Reliability Engineer", "Cloud Engineer", "Cloud Architect",
  "Platform Engineer", "Infrastructure Engineer", "Network Engineer", "Systems Administrator",
  "Kubernetes Engineer", "AWS Solutions Architect", "Azure Engineer",
  // Data & AI/ML
  "Data Engineer", "Senior Data Engineer", "Data Architect",
  "Data Scientist", "Senior Data Scientist", "Research Scientist",
  "Data Analyst", "Senior Data Analyst", "Business Intelligence Analyst", "BI Developer", "MIS Executive",
  "Machine Learning Engineer", "Senior ML Engineer", "AI Engineer", "AI/ML Lead", "NLP Engineer", "Computer Vision Engineer",
  "MLOps Engineer", "AI Product Manager",
  // QA & Testing
  "QA Engineer", "Senior QA Engineer", "QA Lead", "Test Engineer", "SDET", "Automation Engineer", "Performance Engineer",
  "QA Manager", "Test Architect",
  // Security
  "Security Engineer", "Cybersecurity Analyst", "SOC Analyst", "Penetration Tester", "Security Architect", "CISO",
  // Engineering Leadership
  "Tech Lead", "Engineering Manager", "Senior Engineering Manager", "Director of Engineering",
  "VP of Engineering", "Head of Engineering", "CTO", "Co-founder & CTO",
  // Product
  "Associate Product Manager", "Product Manager", "Senior Product Manager", "Lead Product Manager",
  "Group Product Manager", "Director of Product", "VP of Product", "Head of Product", "Chief Product Officer",
  "Technical Product Manager", "Product Owner", "Product Analyst", "Growth Product Manager",
  // Design
  "Product Designer", "Senior Product Designer", "UX Designer", "Senior UX Designer", "UI Designer", "UX/UI Designer",
  "UX Researcher", "Visual Designer", "Motion Designer", "Graphic Designer",
  "Head of Design", "Design Manager", "Design Director",
  // Business Analysis & Consulting
  "Business Analyst", "Senior Business Analyst", "Management Consultant", "Strategy Consultant", "Technology Consultant",
  "SAP Consultant", "Salesforce Consultant", "ERP Consultant", "Functional Consultant", "Domain Consultant",
  // Project & Program Management
  "Project Manager", "Senior Project Manager", "Program Manager", "Technical Program Manager",
  "Scrum Master", "Agile Coach", "Delivery Manager", "Engagement Manager", "Client Partner",
  // Operations & Supply Chain
  "Operations Manager", "Operations Analyst", "Supply Chain Manager", "Logistics Manager",
  "Procurement Manager", "Warehouse Manager", "Planning Manager", "Category Manager",
  // Marketing
  "Marketing Manager", "Digital Marketing Manager", "Performance Marketing Manager",
  "Growth Manager", "Content Strategist", "Content Writer", "Copywriter",
  "SEO Specialist", "SEM Specialist", "Social Media Manager", "Brand Manager",
  "VP of Marketing", "Head of Growth", "Chief Marketing Officer",
  // Sales & BD
  "Sales Executive", "Senior Sales Executive", "Account Executive",
  "Sales Manager", "Regional Sales Manager", "Area Sales Manager", "Zonal Sales Manager",
  "Business Development Manager", "Business Development Executive", "BD Lead",
  "Key Account Manager", "Enterprise Sales Manager", "Inside Sales Representative",
  "Customer Success Manager", "Account Manager", "Solutions Architect", "Pre-Sales Consultant",
  "VP of Sales", "Head of Sales", "Chief Revenue Officer",
  // HR & People
  "HR Executive", "HR Manager", "Senior HR Manager", "HR Business Partner",
  "Recruiter", "Technical Recruiter", "Talent Acquisition Lead", "Talent Acquisition Manager",
  "L&D Manager", "Training Manager", "Compensation & Benefits Manager", "People Operations Manager",
  "Head of HR", "VP of People", "CHRO",
  // Finance & Accounting
  "CA", "Chartered Accountant", "CA Inter", "CA Articleship",
  "Financial Analyst", "Senior Financial Analyst", "Investment Analyst", "Investment Banking Analyst",
  "Auditor", "Internal Auditor", "Statutory Auditor", "Tax Consultant", "GST Consultant",
  "Accounts Executive", "Accounts Manager", "FP&A Analyst", "Treasury Analyst",
  "Risk Analyst", "Credit Analyst", "Compliance Officer",
  "Finance Manager", "Finance Controller", "VP of Finance", "CFO",
  // Banking & Insurance
  "Bank PO", "Bank Clerk", "Relationship Manager", "Branch Manager", "Wealth Manager",
  "Credit Manager", "Loan Officer", "Underwriter", "Claims Manager",
  "Insurance Agent", "Actuarial Analyst",
  // Legal
  "Legal Counsel", "Corporate Lawyer", "Legal Associate", "Company Secretary", "CS", "Compliance Manager",
  // Government & PSU
  "IAS Officer", "IPS Officer", "IFS Officer", "UPSC Aspirant",
  "SSC CGL", "Bank PO (IBPS/SBI)", "RBI Grade B", "SEBI Grade A",
  "PSU Engineer", "GATE Qualified Engineer", "Government Scientist",
  // Teaching & Education
  "Teacher", "Lecturer", "Assistant Professor", "Professor",
  "Academic Coordinator", "Principal", "Education Counselor", "Curriculum Designer",
  "Corporate Trainer", "Subject Matter Expert",
  // Healthcare
  "Doctor", "MBBS", "MD", "Surgeon", "Dentist",
  "Pharmacist", "Medical Representative", "Clinical Research Associate",
  "Hospital Administrator", "Healthcare Manager",
  // Civil & Mechanical Engineering
  "Civil Engineer", "Site Engineer", "Structural Engineer", "Construction Manager",
  "Mechanical Engineer", "Design Engineer", "Manufacturing Engineer", "Production Manager",
  "Quality Engineer", "Quality Manager", "Six Sigma Black Belt",
  // Electrical & Electronics
  "Electrical Engineer", "Electronics Engineer", "VLSI Engineer", "Chip Design Engineer",
  "Control Systems Engineer", "Power Systems Engineer", "Instrumentation Engineer",
  // Media & Content
  "Journalist", "Editor", "Content Creator", "Video Editor", "Social Media Influencer",
  "Public Relations Manager", "Corporate Communications Manager",
  // Executive Leadership
  "CEO", "Co-founder", "Managing Director", "General Manager", "Chief of Staff", "COO",
  // Entry Level & Freshers
  "Software Engineer Intern", "Data Science Intern", "Product Intern", "Design Intern", "Marketing Intern",
  "Associate Software Engineer", "Junior Developer", "Junior Data Analyst",
  "Graduate Engineer Trainee (GET)", "Management Trainee", "Fresher", "Campus Hire",
  "Apprentice", "Trainee Engineer",
  // Freelance & Contract
  "Freelance Developer", "Freelance Designer", "Independent Consultant", "Contract Engineer",
];

/* COMPANY_SUGGESTIONS — exhaustive Indian-market index.
 *
 * ~500+ entries spanning: global tech (with India offices), Indian IT
 * services + GCCs, every meaningful Indian unicorn / DPIIT-recognised
 * startup, banks (public + private + small finance + payments), NBFCs,
 * insurance (life + general + health), AMCs, regulators, conglomerates,
 * PSUs, defence + aerospace, pharma, FMCG, telecom, automotive,
 * aviation, hotels, real estate, retail, healthcare chains, media,
 * D2C brands, AI / SaaS startups, gaming, crypto/web3, GCCs.
 *
 * Maintenance principles:
 *   • Newer additions go in the matching section, not at the bottom.
 *   • De-dup is by exact-match string. "TCS" and "Tata Consultancy
 *     Services" are deliberately separate so users find either.
 *   • Stay broad on Indian content — competitors' lists run 100-200
 *     companies; ours runs 500+ on purpose, that's a positioning moat.
 *   • Rough size limit ~600 entries before autocomplete latency starts
 *     mattering. Currently ~510 (room to grow). */
// Raw entries — section duplication is intentional (e.g. Big 4 fits
// "IT services" AND "Consulting"; we keep both placements for
// readability). Final export dedups via Set so the autocomplete sees
// each company exactly once.
const COMPANY_SUGGESTIONS_RAW = [
  // ─── Global Tech (with India offices / candidates target heavily) ───
  "Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix",
  "Adobe", "Oracle", "SAP", "Salesforce", "ServiceNow", "Workday", "Intuit", "Atlassian",
  "IBM", "Cisco", "Intel", "NVIDIA", "AMD", "Qualcomm", "Samsung", "Dell Technologies", "HP", "HPE", "VMware", "Lenovo",
  "LinkedIn", "Uber", "Lyft", "Spotify", "Twitter (X)", "Airbnb", "Shopify", "DoorDash", "Instacart",
  "Snowflake", "Databricks", "MongoDB", "Elastic", "Cloudflare", "Datadog", "HashiCorp", "PagerDuty", "Splunk",
  "Stripe", "PayPal", "Visa", "Mastercard", "American Express", "Block (Square)", "Plaid",
  "GitHub", "GitLab", "JetBrains", "Figma", "Notion", "Linear", "Twilio", "Asana", "Slack",
  "OpenAI", "Anthropic", "Google DeepMind", "Scale AI", "Cohere", "Hugging Face", "Mistral AI", "Perplexity AI",
  "ByteDance", "TikTok", "Pinterest", "Snap Inc", "Reddit", "Discord",
  "Coursera", "Udemy", "Khan Academy", "Duolingo",
  // ─── Investment Banks / Bulge Bracket ───
  "Goldman Sachs", "JP Morgan", "Morgan Stanley", "Deutsche Bank", "Barclays", "Citi", "HSBC", "UBS", "Credit Suisse",
  "Bank of America", "Wells Fargo", "BNP Paribas", "Societe Generale", "Standard Chartered", "Nomura", "Macquarie",
  // ─── Quant / HFT / Asset Managers (huge India hiring) ───
  "BlackRock", "Two Sigma", "Citadel", "Citadel Securities", "Jane Street", "DE Shaw", "Tower Research Capital",
  "WorldQuant", "Millennium Management", "Point72", "Hudson River Trading", "IMC Trading", "Optiver", "Jump Trading",
  "Bridgewater Associates", "Renaissance Technologies", "AQR Capital", "Vanguard", "Fidelity", "State Street",
  // ─── GCCs (Global Capability Centres in India — major hirers) ───
  "Walmart Global Tech (Walmart Labs)", "Target India", "Lowe's India", "Tesco Bengaluru", "Sainsbury's India",
  "Wells Fargo India", "JPMC India", "Goldman Sachs India", "Morgan Stanley India", "Bank of America India",
  "Standard Chartered GBS", "American Express India", "Mastercard India", "Visa India",
  "Allstate India", "Cigna India", "AIG India", "Liberty Mutual India",
  "GE India", "Honeywell India", "Caterpillar India", "Cummins India", "ABB India", "Siemens India", "Schneider Electric India",
  "Boeing India", "Airbus India", "Lockheed Martin India", "Rolls-Royce India",
  "Western Digital India", "Texas Instruments India", "Analog Devices India", "Marvell India", "Synopsys India", "Cadence India",
  "Applied Materials India", "Lam Research India", "KLA India",
  "Ericsson India", "Nokia India", "Juniper Networks India",
  // ─── Indian IT Services ───
  "TCS", "Tata Consultancy Services", "Infosys", "Wipro", "HCL Technologies", "Tech Mahindra", "LTIMindtree",
  "Persistent Systems", "Mphasis", "Coforge", "L&T Technology Services", "Cyient", "KPIT Technologies",
  "Mindtree", "Hexaware", "Zensar Technologies", "Sonata Software", "Birlasoft", "NIIT Technologies",
  "Cognizant", "Capgemini", "Accenture", "Deloitte", "PwC", "EY", "KPMG",
  "ThoughtWorks", "Publicis Sapient", "Mu Sigma", "Fractal Analytics", "Tiger Analytics", "AbsolutData", "LatentView Analytics",
  "Happiest Minds", "iGate", "Sasken Technologies", "Tata Elxsi", "Amdocs", "DXC Technology", "NTT Data", "Atos", "CGI", "Unisys",
  "Bahwan CyberTek", "Rolta India", "Polaris Consulting", "Saksoft", "Datamatics", "Subex",
  // ─── Indian Unicorns + late-stage startups: E-commerce & Consumer ───
  "Flipkart", "Myntra", "Jabong", "Meesho", "Nykaa", "Lenskart", "FirstCry", "Purplle",
  "BigBasket", "Blinkit", "JioMart", "Swiggy Instamart", "Zepto", "Dunzo Daily", "Country Delight", "Otipy",
  "Mamaearth", "boAt", "Sugar Cosmetics", "Bewakoof", "Licious", "FreshToHome", "Wakefit",
  "The Souled Store", "Bombay Shaving Company", "Beardo", "WOW Skin Science", "Plum Goodness", "MyGlamm", "Sleepy Owl",
  "Ustraa", "Bodywise", "Mensa Brands", "GlobalBees", "GoKwik", "Toplyne",
  "Snitch", "FreakIns", "Pepperfry", "Urban Ladder", "FabIndia", "Chumbak",
  // ─── Indian Startups: Food & Delivery ───
  "Swiggy", "Zomato", "Dunzo", "EatSure (Rebel Foods)", "Box8", "FreshMenu", "Behrouz Biryani", "Faasos",
  "Curefoods", "EatClub", "Ki Si Mi (Inner Be)", "Bombay Sweet Shop",
  // ─── Indian Startups: Fintech ───
  "Razorpay", "PhonePe", "Paytm", "CRED", "Zerodha", "Groww",
  "Slice", "Jupiter", "Fi Money", "Uni Cards", "KreditBee", "Lendingkart",
  "INDmoney", "Smallcase", "Niyo", "Open Financial", "Cashfree", "Instamojo",
  "BharatPe", "MobiKwik", "Freecharge", "LazyPay", "ZestMoney", "Rupeek",
  "Pine Labs", "Mswipe", "Razorpay POS", "PayU", "Juspay", "Simpl",
  "Paytm Money", "Upstox", "Angel One", "5paisa", "Motilal Oswal", "ICICI Direct", "Kuvera",
  "DhanHQ", "Stable Money", "Setu", "Decentro", "M2P Fintech",
  "ClearTax", "Khatabook", "OkCredit", "Kashflow",
  // ─── Indian Startups: Mobility & Logistics ───
  "Ola", "Rapido", "Uber India", "BluSmart",
  "Ather Energy", "Ola Electric", "Revolt Motors", "Yulu", "Bounce", "Vida (Hero MotoCorp)",
  "Delhivery", "Shiprocket", "Ecom Express", "XpressBees", "Shadowfax", "Porter", "Rivigo", "Loadshare",
  "BlackBuck", "Vahak", "Blowhorn", "FreightTiger",
  "redBus", "Chalo", "Quick Ride", "Ridlr",
  // ─── Indian Startups: EdTech ───
  "Byju's", "Unacademy", "upGrad", "Physics Wallah", "Vedantu", "Scaler", "Coding Ninjas",
  "Simplilearn", "Great Learning", "WhiteHat Jr", "Toppr", "Doubtnut",
  "Allen Digital", "Testbook", "Adda247", "Gradeup", "PrepLadder",
  "Eruditus", "BlueLearn", "Cuemath", "LEAD School", "Camp K12", "Vedantu Online",
  "Stoa School", "Masai School", "Newton School", "Kraftshala",
  // ─── Indian Startups: HealthTech & Healthcare ───
  "Practo", "PharmEasy", "Tata 1mg", "NetMeds", "MFine", "Pristyn Care",
  "HealthifyMe", "CureFit (cult.fit)", "Innovaccer", "Niramai",
  "Apollo 24/7", "MediBuddy", "DocsApp", "Lybrate", "Tata Health",
  "PharmEasy Diagnostics", "Healthians", "Thyrocare", "Dr Lal PathLabs", "Metropolis Healthcare",
  // Hospital chains (top employers for medical / admin candidates)
  "Apollo Hospitals", "Fortis Healthcare", "Max Healthcare", "Manipal Hospitals",
  "Narayana Health", "Aster DM Healthcare", "Medanta", "Kokilaben Hospital",
  "AIIMS", "Tata Memorial Hospital", "PGIMER", "JIPMER", "CMC Vellore",
  "HCG (Healthcare Global)", "Rainbow Children's Hospitals", "MGM Healthcare",
  // ─── Indian Startups: SaaS & Dev Tools ───
  "Freshworks", "Zoho", "Postman", "BrowserStack", "Chargebee", "Druva", "Icertis",
  "CleverTap", "WebEngage", "MoEngage", "Haptik", "Yellow.ai", "Gupshup",
  "Leadsquared", "Whatfix", "Mindtickle", "Darwinbox", "GreyTip", "Keka HR", "PeopleStrong",
  "Uniphore", "Observe.AI", "Hasura", "Appsmith", "ToolJet", "Zluri", "AccelData",
  "InMobi", "Glance", "Apna", "Pratilipi", "Koo", "ShareChat",
  "Spotdraft", "Leegality", "Signzy", "Veris", "Plivo", "Exotel",
  "Atlan", "Vymo", "BrowserStack", "MarianaTek", "Locus.sh",
  // ─── Indian AI / GenAI Startups (booming category) ───
  "Sarvam AI", "Krutrim (Ola)", "Niki.ai", "Mad Street Den", "Glance AI",
  "Wadhwani AI", "Nfinite Nanotech", "Skit.ai", "Neysa Networks",
  // ─── Indian Startups: Social, Media & Content ───
  "ShareChat", "Dailyhunt", "Josh", "Kuku FM", "Pocket FM", "Stage", "Roposo",
  "Audible India", "Spotify India",
  // ─── Indian Startups: Real Estate & PropTech ───
  "Housing.com", "99acres", "MagicBricks", "NoBroker", "Square Yards",
  "Lodha Group", "Prestige Group", "Godrej Properties", "Sobha", "DLF",
  "Oberoi Realty", "Brigade Group", "Phoenix Mills", "Embassy Group", "RMZ Corp",
  "Mahindra Lifespaces", "Tata Realty", "Piramal Realty", "K Raheja Corp", "Hiranandani",
  "Shapoorji Pallonji", "Macrotech Developers",
  // ─── Indian Startups: Travel & Hospitality ───
  "MakeMyTrip", "Goibibo", "OYO Rooms", "Yatra", "Cleartrip",
  "EaseMyTrip", "ixigo", "RedBus", "Treebo", "FabHotels",
  // Hotel chains
  "Indian Hotels (Taj)", "ITC Hotels", "EIH (Oberoi)", "Lemon Tree Hotels",
  "The Leela", "Marriott India", "Hyatt India", "Hilton India", "Accor India",
  "Radisson India", "Park Hotels", "Sarovar Hotels",
  // ─── Aviation ───
  "IndiGo", "SpiceJet", "Air India", "Vistara", "Akasa Air", "AirAsia India",
  "Air India Express", "Alliance Air", "Star Air", "Pawan Hans",
  "GMR Airports", "Adani Airports", "DIAL (Delhi Airport)", "MIAL (Mumbai Airport)", "BIAL (Bangalore Airport)",
  // ─── Indian Startups: Insurance ───
  "PolicyBazaar", "Acko", "Digit Insurance", "Star Health", "Turtlemint", "Plum",
  "Onsurity", "Coverfox", "RenewBuy", "InsuranceDekho", "Probus Insurance",
  // ─── Indian Startups: Auto & Classifieds ───
  "Cars24", "CarDekho", "Spinny", "Droom", "CarTrade", "OLX India", "Quikr",
  "OLX Autos", "Cartwale", "Truebil",
  // ─── Indian Startups: Gaming & Sports ───
  "Dream11", "MPL (Mobile Premier League)", "Games24x7", "JetSynthesys", "Nazara Technologies",
  "Gameskraft", "Junglee Games", "Nodwin Gaming", "Octro", "Hike Messenger (Rush Gaming)",
  "Rooter", "FanCode", "Sports24x7", "Stupa Sports Analytics",
  // ─── Indian Startups: Crypto / Web3 ───
  "CoinDCX", "CoinSwitch Kuber", "WazirX", "ZebPay", "Vauld", "Mudrex", "Bitbns",
  "Polygon (Indian-origin)", "Dharma Labs",
  // ─── Indian Public Sector Banks (PSBs) ───
  "State Bank of India (SBI)", "Punjab National Bank", "Bank of Baroda", "Canara Bank",
  "Union Bank of India", "Indian Bank", "Bank of India", "Central Bank of India",
  "Indian Overseas Bank", "UCO Bank", "Punjab & Sind Bank", "Bank of Maharashtra",
  // ─── Indian Private Banks ───
  "HDFC Bank", "ICICI Bank", "Kotak Mahindra Bank", "Axis Bank",
  "Yes Bank", "IndusInd Bank", "Federal Bank", "RBL Bank", "IDFC First Bank", "Bandhan Bank",
  "South Indian Bank", "City Union Bank", "Karur Vysya Bank", "DCB Bank", "CSB Bank",
  "Tamilnad Mercantile Bank", "Nainital Bank", "Karnataka Bank", "Dhanlaxmi Bank",
  // ─── Small Finance Banks ───
  "AU Small Finance Bank", "Equitas Small Finance Bank", "Ujjivan Small Finance Bank",
  "ESAF Small Finance Bank", "Suryoday Small Finance Bank", "Capital Small Finance Bank",
  "Fincare Small Finance Bank", "Jana Small Finance Bank", "Utkarsh Small Finance Bank",
  // ─── Payments Banks ───
  "Airtel Payments Bank", "Paytm Payments Bank", "India Post Payments Bank", "Fino Payments Bank", "Jio Payments Bank",
  // ─── NBFCs ───
  "Bajaj Finance", "Bajaj Finserv", "HDFC Ltd", "L&T Finance", "Shriram Finance",
  "Muthoot Finance", "Manappuram Finance", "Mahindra Finance", "IIFL Finance",
  "Cholamandalam Finance", "Sundaram Finance", "Tata Capital", "Aditya Birla Capital",
  "Piramal Finance", "Hero FinCorp", "Edelweiss Financial Services", "Religare Finance",
  // ─── Insurance (Life) ───
  "LIC of India", "HDFC Life", "ICICI Prudential", "SBI Life", "Max Life", "Tata AIA",
  "Bajaj Allianz Life", "Kotak Mahindra Life", "Aditya Birla Sun Life",
  "PNB MetLife", "Reliance Nippon Life", "Canara HSBC Life",
  // ─── Insurance (General + Health) ───
  "GIC Re", "New India Assurance", "United India Insurance", "Oriental Insurance", "National Insurance",
  "Bajaj Allianz General", "ICICI Lombard", "Tata AIG General", "HDFC ERGO",
  "Reliance General Insurance", "Cholamandalam MS General", "Future Generali India",
  "Niva Bupa", "Star Health Insurance", "Care Health Insurance",
  // ─── AMCs / Mutual Funds ───
  "HDFC AMC", "ICICI Prudential AMC", "SBI Mutual Fund", "Nippon India AMC", "Kotak AMC",
  "Aditya Birla Sun Life AMC", "Axis AMC", "DSP Mutual Fund", "UTI AMC", "Mirae Asset",
  "Tata Mutual Fund", "Franklin Templeton India", "L&T Mutual Fund", "PPFAS Mutual Fund", "Quant Mutual Fund",
  // ─── Stock Exchanges & Regulators ───
  "NSE", "BSE", "MCX", "NCDEX",
  "SEBI", "RBI", "IRDAI", "PFRDA", "NABARD", "SIDBI", "EXIM Bank",
  "NSDL", "CDSL", "CRISIL", "ICRA", "CARE Ratings", "Brickwork Ratings",
  // ─── Strategy Consulting ───
  "McKinsey", "BCG", "Bain", "Deloitte", "Accenture", "PwC", "EY", "KPMG",
  "Oliver Wyman", "ZS Associates", "Strategy&", "Kearney", "Roland Berger",
  "Alvarez & Marsal", "Grant Thornton", "BDO India", "RSM India",
  "Frost & Sullivan", "L.E.K Consulting", "Arthur D. Little", "Parthenon EY",
  // ─── Pharma & Healthcare Companies ───
  "Sun Pharma", "Dr. Reddy's", "Cipla", "Lupin", "Aurobindo Pharma", "Biocon",
  "Divis Labs", "Torrent Pharma", "Zydus Lifesciences", "Glenmark", "Alkem Labs",
  "Mankind Pharma", "Ipca Labs", "Natco Pharma", "Piramal Pharma",
  "Pfizer India", "Novartis India", "AstraZeneca India", "Abbott India", "GSK India",
  "Sanofi India", "Eli Lilly India", "Merck India", "Roche India", "Johnson & Johnson India",
  "Bharat Biotech", "Serum Institute of India", "Panacea Biotec", "Wockhardt", "Cadila Healthcare",
  "Strides Pharma", "Granules India", "Laurus Labs", "Suven Pharmaceuticals",
  // ─── FMCG ───
  "Hindustan Unilever (HUL)", "ITC", "Nestle India", "P&G India", "Colgate-Palmolive India",
  "Dabur", "Marico", "Godrej Consumer Products", "Emami", "Britannia",
  "Parle Products", "Amul (GCMMF)", "Haldiram's", "Tata Consumer Products",
  "Patanjali", "Bisleri", "Paperboat", "Raw Pressery", "PepsiCo India", "Coca-Cola India",
  "Mondelez India", "McCain India", "United Breweries", "Pernod Ricard India", "Diageo India",
  "Reckitt Benckiser India", "Kellogg India", "Adani Wilmar (Fortune)",
  // ─── Telecom ───
  "Jio (Reliance)", "Airtel (Bharti)", "Vodafone Idea (Vi)", "BSNL", "MTNL",
  "Jio Platforms", "Airtel Digital", "Tata Communications", "Sterlite Technologies",
  "Tejas Networks", "Indus Towers", "Bharti Hexacom", "Nokia Siemens Networks India",
  // ─── Automotive (OEM + Tier 1 + EV) ───
  "Tata Motors", "Mahindra & Mahindra", "Maruti Suzuki", "Hyundai India", "Kia India",
  "Hero MotoCorp", "Bajaj Auto", "TVS Motor", "Royal Enfield (Eicher)",
  "Ashok Leyland", "Force Motors", "MG Motor India", "Skoda-VW India",
  "Toyota India", "Honda India", "Mercedes-Benz India", "BMW India", "Audi India",
  "Volvo India", "Renault India", "Nissan India", "Stellantis India", "Jaguar Land Rover India",
  "Tata Technologies", "Bosch India", "Continental India", "Mahle Behr India", "Schaeffler India",
  "Sundaram Clayton", "Sundaram Fasteners", "Bharat Forge", "Motherson Sumi", "Endurance Technologies",
  "Minda Industries", "JBM Auto",
  // ─── Conglomerates & Holdings ───
  "Tata Group", "Reliance Industries", "Adani Group", "Mahindra Group",
  "Godrej Group", "Aditya Birla Group", "Bharti Enterprises", "Vedanta", "JSW Group",
  "L&T (Larsen & Toubro)", "Hinduja Group", "Murugappa Group", "Wadia Group", "RP-Sanjiv Goenka Group",
  "Essar Group", "Birla Corporation",
  // ─── PSUs (Central) ───
  "BHEL", "ONGC", "NTPC", "Indian Oil (IOCL)",
  "GAIL", "BPCL", "HPCL", "Coal India", "Power Grid", "SAIL",
  "NMDC", "NALCO", "MMTC", "STC", "NHPC", "NLC India", "RITES",
  "Container Corporation (CONCOR)", "IRCTC", "RailTel", "IRFC", "RVNL", "IRCON", "Dedicated Freight Corridor (DFCC)",
  "Indian Railways", "Mumbai Metro", "Delhi Metro (DMRC)", "Bangalore Metro (BMRCL)", "Chennai Metro",
  "Kolkata Metro", "Hyderabad Metro", "Kochi Metro", "NMRC (Noida Metro)",
  // ─── Defence & Aerospace ───
  "HAL", "BEL", "DRDO", "ISRO", "BDL", "BEML", "GRSE", "Mazagon Dock", "Cochin Shipyard",
  "Mishra Dhatu Nigam (MIDHANI)", "Ordnance Factory Board (OFB)", "Munitions India Limited",
  // ─── Power, Energy & Renewables ───
  "Tata Power", "Adani Power", "Adani Green", "Adani Transmission",
  "ReNew Power", "Suzlon Energy", "Inox Wind", "Greenko Group",
  "Azure Power", "JSW Energy", "Torrent Power", "Reliance Power",
  "CESC", "Tata Renewable Energy", "Avaada Energy", "Hero Future Energies",
  "Ola Electric", "Tata Passenger Electric Mobility",
  // ─── Steel, Cement, Paints ───
  "Tata Steel", "JSW Steel", "JSPL (Jindal Steel)", "Hindalco", "Jindal Stainless",
  "UltraTech Cement", "ACC", "Ambuja Cements", "Shree Cement", "Dalmia Bharat", "Ramco Cements",
  "Asian Paints", "Berger Paints", "Kansai Nerolac", "Akzo Nobel India", "JSW Paints", "Indigo Paints", "Birla Opus",
  // ─── Engineering, Construction, Capital Goods ───
  "L&T Construction", "Shapoorji Pallonji", "Hindustan Construction Co (HCC)",
  "Punj Lloyd", "GMR Infrastructure", "GVK Power & Infrastructure", "IRB Infrastructure",
  "ABB India", "Siemens India", "Schneider Electric India", "Crompton Greaves",
  "Havells India", "Polycab", "Finolex", "Voltas", "Blue Star",
  "Cummins India", "Thermax", "AIA Engineering", "Ion Exchange",
  // ─── Media & Entertainment ───
  "Star India (Disney+Hotstar)", "Sony India", "Zee Entertainment", "Viacom18 (JioCinema)",
  "Times Group (BCCL)", "HT Media", "NDTV", "Network18", "ABP Group", "India Today Group",
  "T-Series", "Yash Raj Films", "Dharma Productions", "Excel Entertainment", "Red Chillies Entertainment",
  "Eros International", "PVR INOX", "Saregama", "Tips Industries",
  "Republic TV", "News18", "CNBC-TV18", "Bloomberg Quint",
  // ─── E-commerce & Retail (India) ───
  "Amazon India", "Reliance Retail", "Tata CLiQ", "Snapdeal", "Ajio",
  "DMart (Avenue Supermarts)", "Reliance Trends", "Shoppers Stop", "Lifestyle", "Pantaloons",
  "Decathlon India", "IKEA India", "H&M India", "Zara India", "Marks & Spencer India",
  "Croma", "Vijay Sales", "Poorvika", "Reliance Digital",
  "Future Retail", "Trent (Westside)", "Spencer's Retail", "More Retail",
  "V-Mart", "V2 Retail", "Liberty Shoes", "Bata India", "Khadim's", "Relaxo Footwears",
  "Titan", "Tanishq", "Kalyan Jewellers", "Senco Gold", "Joyalukkas", "PC Jeweller",
  // ─── Audit / Tax / Law (large hirers in India) ───
  "Cyril Amarchand Mangaldas", "AZB & Partners", "Khaitan & Co", "J Sagar Associates",
  "Trilegal", "Shardul Amarchand Mangaldas", "Luthra & Luthra", "S&R Associates",
  "Nishith Desai Associates", "DSK Legal", "ANB Legal", "Argus Partners",
  // ─── Audit firms (mid-tier, top hirers for CA/finance candidates) ───
  "Walker Chandiok", "S.R. Batliboi & Co", "Lodha & Co", "Khimji Kunverji & Co",
  "MGB & Co", "BSR & Co", "Aneja Associates", "RSM Astute", "Nangia Andersen",
  // ─── Government & Civil Services landing spots ───
  "UPSC (Indian Administrative Service)", "Indian Foreign Service", "Indian Police Service",
  "Indian Revenue Service", "Indian Forest Service", "State Public Service Commission",
  "IBPS PO/Clerk", "SBI PO", "RBI Grade B", "NABARD Grade A", "SIDBI Grade A",
  "SSC CGL", "SSC CHSL", "Indian Railways (RRB)",
  "ISRO Scientist", "DRDO Scientist", "BARC Scientist", "TIFR",
  "Reserve Bank of India (Direct)", "NPCI", "UIDAI",
  // ─── Universities & Research (academia track) ───
  "IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Kanpur", "IIT Kharagpur",
  "IIT Roorkee", "IIT Guwahati", "IIT Hyderabad", "IIT BHU", "IIT Indore",
  "IISc Bangalore", "IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta",
  "ISB Hyderabad", "XLRI Jamshedpur", "FMS Delhi", "MDI Gurgaon",
  "BITS Pilani", "VIT Vellore", "Manipal University", "Amity University",
  // ─── Design Agencies — Global (product, brand, UX, service design) ───
  "IDEO", "frog design", "Pentagram", "Landor", "Wolff Olins", "Interbrand",
  "FutureBrand", "Siegel+Gale", "Method", "Smart Design", "Ziba Design",
  "fjord (Accenture Song)", "Accenture Song", "R/GA", "AKQA", "Huge Inc",
  "Work & Co", "Ueno", "MetaLab", "Ustwo", "Hyper Island", "Ramotion",
  "Clay Global", "Instrument", "Big Spaceship", "Code and Theory",
  "Designit", "Argodesign", "Lunar (McKinsey Design)", "McKinsey Design",
  "BCG BrightHouse", "Deloitte Digital", "EY-Seren", "Capgemini Invent (Frog)",
  "Pentagram London", "Sagmeister & Walsh", "&Walsh", "Collins NYC",
  "Mother Design", "Mucca Design", "Manual Creative", "MetaDesign",
  "DesignStudio", "Bulletproof", "Jones Knowles Ritchie (JKR)",
  "Saffron Brand Consultants", "Prophet", "BrandOpus", "Coley Porter Bell",
  "ThoughtMatter", "Base Design", "Paula Scher Studio",
  // Global digital / experience agencies (additions)
  "DEPT", "Media.Monks", "S4 Capital", "Jam3", "Active Theory", "Resn",
  "B-Reel", "Stink Studios", "Hello Monday", "North Kingdom",
  "Critical Mass", "Razorfish", "VML", "VMLY&R", "DigitasLBi", "Digitas",
  "Possible", "Wpromote", "Mutual Mobile", "EPAM Continuum", "EPAM",
  "Rightpoint", "Pivotal Labs", "Bottle Rocket", "Jack Morton",
  "Carbon Five", "ThirteenTwentyThree", "Hello Group",
  // Global brand / identity studios (additions)
  "Lippincott", "Moving Brands", "Turner Duckworth", "Pearlfisher",
  "Chermayeff & Geismar & Haviv", "Vault49", "Gretel", "Order",
  "Athletics NYC", "Porto Rocha", "2x4", "Sub Rosa", "Carbone Smolan",
  "VSA Partners", "Studio Dumbar", "Standards Manual", "Stranger & Stranger",
  "Hugo & Marie", "High Tide", "Smith & Diction", "Anagrama",
  "Bibliothèque Design", "Spin London", "Made Thought",
  "North Design", "Multistorey", "Apartamento Studios",
  // Service design / strategy firms (additions)
  "Doblin (Deloitte)", "Doblin", "Livework", "Engine Service Design",
  "Engine Group", "?What If! Innovation", "Adaptive Path", "Continuum Innovation",
  "Lextant", "Peer Insight", "Stone Mantel", "Reach Advisors",
  // ─── Design Agencies — India (product, UX, brand, service design) ───
  "Lollypop Design Studio", "ItsDart (Dart Design)", "Tutams", "Studio Nudge",
  "Nilenso", "Obvious", "ChaiOne India", "ThinkDesign India",
  "Lemon Yellow", "Codewave", "Maddy's Mind", "DesignStringer",
  "Umbrella Design", "Elephant Design", "Codesign", "Tessella",
  "Ticket Design", "Beardesign", "Onio Design", "Ideogram Design",
  "Indi Design", "TernUp Research Labs", "Ruchi Sanghi Design",
  "Kalakaari Haath", "Locopopo Studio", "Studio ABD", "Studio Lotus",
  "Foley Designs", "DY Works", "Landor & Fitch India",
  "Ogilvy Design India", "Wieden+Kennedy Delhi", "Wieden+Kennedy India",
  "Animal (Future Group Design)", "Future Factory", "Plus91 Foundry",
  "Briefcase (Lollypop)", "Karya UX", "FourPlus Studio", "Algorythm",
  "Ennoble IP", "PSi Design", "Geometry Encompass", "Quicksand Design Studio",
  "Final Mile Consulting", "DesignAware", "Studio Carbon",
  "ReDesign (KPMG India)", "Tata Elxsi Design", "Infosys Wongdoody",
  "Mindtree Design Studio (NxT)", "ThoughtWorks Design",
  // India design studios (additions)
  "Idiom Design", "Almond Branch", "DesignSutra", "Furrow", "Mobikasa",
  "HUEMN", "Robosoft Design", "Plinth", "DesignBoat", "Studio Tilt",
  "Mind The Gap", "Spring Marketing Capital", "Niveus Solutions",
  "Sideways Consulting", "Rangframework", "Almond Solutions",
  "Borderless Access", "Lattice India", "DesignQandA", "Whitelight Studio",
  "Studio Bigfat", "Threadsol", "Saralee Designs", "Prophets Inc India",
  "Browser Stack Design", "InVideo Design", "Postman Design",
  "Razorpay Design", "Zomato Design", "Swiggy Design",
  // ─── Advertising / Creative Agencies — India ───
  "Ogilvy India", "Leo Burnett India", "JWT India (Wunderman Thompson)",
  "McCann Worldgroup India", "DDB Mudra Group", "BBDO India",
  "Dentsu Webchutney", "Dentsu Creative India", "Famous Innovations",
  "Lowe Lintas", "FCB India", "FCB Ulka", "Havas India", "Publicis India",
  "Grey Group India", "TBWA India", "Saatchi & Saatchi India",
  "Scarecrow M&C Saatchi", "BC Web Wise", "iProspect India",
  "Mirum India", "Schbang", "WATConsult", "Tonic Worldwide",
  "Isobar India", "Foxymoron", "Logicserve Digital", "Kinnect",
  "Performics India", "GroupM India", "Madison World",
  // India advertising (additions)
  "Mullen Lintas", "Rediffusion", "Cheil India", "Cheil Worldwide",
  "Contract Advertising", "Bates CHI&Partners", "Crayons Communications",
  "VMLY&R India", "22Feet Tribal Worldwide", "DigitasLBi India",
  "MediaCom India", "Wavemaker India", "Zenith India", "Carat India",
  "OMD India", "Mindshare India", "Initiative India", "Starcom India",
  "Spark Foundry", "Triton Communications", "Quotient Ventures",
  "Talented", "The Womb", "Dentsu Impact", "Dentsu Aegis Network",
  "Enormous Brands", "Spring Marketing", "L&K Saatchi & Saatchi",
  "Lemon Communications", "Bombay Design Centre",
  // ─── Animation / Motion / Film Studios ───
  "Buck", "ManvsMachine", "Giant Ant", "Oddfellows", "Golden Wolf",
  "Animade", "Aardman Animations", "Cartoon Saloon",
  "Green Gold Animation", "Toonz Media Group", "Reliance Animation",
  "Prana Studios", "DQ Entertainment", "Maya Digital Studios",
  "Technicolor India", "MPC India", "Double Negative (DNEG)",
  // VFX / animation (additions)
  "Industrial Light & Magic (ILM)", "ILM", "Weta FX", "Weta Digital",
  "Framestore", "Framestore India", "Method Studios", "Cinesite",
  "Animal Logic", "Prime Focus", "Red Chillies VFX", "BOT VFX",
  "Phantom FX", "Makuta VFX", "Anibrain", "Rhythm & Hues",
  "NY VFXWAALA", "Yash Raj Films VFX", "Tau Films",
  "Pixion Studios", "Famous Studios", "Assemblage Entertainment",
  "Cosmos-Maya", "Crest Animation", "UTV Toonz",
  "Trace VFX", "Electric Theatre Collective",
  // ─── Misc — global product / consumer companies hiring in India ───
  "Coupa", "Procore", "DocuSign", "Box", "Dropbox", "Asana",
  "Zendesk", "HubSpot", "Mailchimp", "Pipedrive", "Klaviyo",
  "Coursera", "Udacity", "edX", "Pluralsight",
  "Roblox", "Unity Technologies", "Epic Games", "Riot Games", "EA", "Activision Blizzard", "Take-Two",
  // ─── Startup Stages (placeholder bucket) ───
  "Pre-seed / Seed Startup", "Series A Startup", "Series B Startup", "Series C+ Startup",
  "Bootstrapped Startup", "Enterprise / MNC", "Government / PSU",
];

// Dedup while preserving first-seen order (autocomplete relevance is
// driven by string-prefix matching, so order matters less than hit
// rate — but keeping deterministic order helps testing).
export const COMPANY_SUGGESTIONS = Array.from(new Set(COMPANY_SUGGESTIONS_RAW));

/* Sample diverse suggestions by picking evenly spaced items */
export function sampleDiverse(arr: string[], count: number): string[] {
  if (arr.length <= count) return arr;
  const step = arr.length / count;
  return Array.from({ length: count }, (_, i) => arr[Math.floor(i * step)]);
}
