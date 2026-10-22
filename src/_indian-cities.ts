/* Shared by the resume parser and the employer candidate-location filter. Kept
   in its own file so edge handlers can import it without pulling in the parser. */
export const INDIAN_CITIES: ReadonlySet<string> = new Set([
  "bangalore", "bengaluru", "mumbai", "bombay", "delhi", "new delhi", "delhi ncr",
  "gurgaon", "gurugram", "noida", "greater noida", "ghaziabad", "faridabad",
  "hyderabad", "pune", "chennai", "madras", "kolkata", "calcutta",
  "ahmedabad", "jaipur", "chandigarh", "mohali", "kochi", "cochin",
  "thiruvananthapuram", "trivandrum", "lucknow", "indore", "coimbatore",
  "nagpur", "visakhapatnam", "vizag", "bhubaneswar", "mysore", "mysuru",
  "mangalore", "mangaluru", "vadodara", "baroda", "surat",
  "bhopal", "patna", "ranchi", "dehradun", "raipur", "guwahati",
  "agra", "varanasi", "amritsar", "jodhpur", "udaipur", "kanpur",
  "allahabad", "prayagraj", "nashik", "aurangabad", "rajkot", "hubli",
  "belgaum", "belagavi", "salem", "tiruchirappalli", "trichy", "madurai",
  "vijayawada", "guntur", "warangal", "navi mumbai", "thane",
  "pimpri-chinchwad", "gandhinagar", "shimla", "srinagar", "jammu",
  "panaji", "imphal", "shillong", "aizawl", "kohima", "agartala",
  "itanagar", "gangtok", "pondicherry", "puducherry",
  "nellore", "tirupati", "kakinada", "rajahmundry",
  "jalandhar", "ludhiana", "patiala", "bathinda",
  "meerut", "aligarh", "bareilly", "moradabad",
  "jamshedpur", "dhanbad", "bokaro",
  "cuttack", "rourkela", "sambalpur",
  "siliguri", "durgapur", "asansol",
  "kozhikode", "calicut", "thrissur", "kollam",
  "tiruvallur", "vellore", "erode", "tirunelveli",
  "belgaum", "dharwad", "gulbarga", "kalaburagi",
  "kolhapur", "solapur", "sangli", "satara",
  /* OA-B49: Devanagari spellings for the major metros so a Hindi resume's
   * location line ("मुंबई", "नई दिल्ली") is detected. toLowerCase() is a
   * no-op on Devanagari, so the includes()/has() checks match as-is. */
  "मुंबई", "मुम्बई", "दिल्ली", "नई दिल्ली", "बेंगलुरु", "बैंगलोर", "बंगलौर",
  "हैदराबाद", "पुणे", "चेन्नई", "कोलकाता", "अहमदाबाद", "जयपुर", "चंडीगढ़",
  "गुरुग्राम", "गुड़गांव", "नोएडा", "लखनऊ", "इंदौर", "नागपुर", "भोपाल",
  "कोच्चि", "सूरत", "वडोदरा", "ठाणे", "नवी मुंबई", "पटना", "कानपुर",

]);
