/* Autocomplete vocabularies for the employer requirement form. Suggestions only:
   every field still accepts free text, so a niche skill or college is never blocked. */

export const SKILL_SUGGESTIONS: string[] = [
  "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Angular", "Vue.js", "HTML", "CSS", "Tailwind CSS", "Redux",
  "Java", "Spring Boot", "Kotlin", "Python", "Django", "Flask", "FastAPI", "Go", "Rust", "C++", "C#", ".NET", "PHP", "Laravel", "Ruby on Rails", "Swift",
  "React Native", "Flutter", "Android", "iOS",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka", "RabbitMQ", "GraphQL", "REST APIs", "Microservices", "System design",
  "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "Linux", "Git",
  "Machine learning", "Deep learning", "NLP", "Data science", "Data analysis", "Data engineering", "Spark", "Airflow", "Power BI", "Tableau", "Excel", "Statistics",
  "Selenium", "Test automation", "Manual testing", "QA", "Cypress", "Playwright",
  "Cybersecurity", "Penetration testing", "Networking",
  "Product management", "Roadmapping", "Stakeholder management", "Agile", "Scrum", "Jira", "Project management",
  "UI design", "UX design", "Figma", "User research", "Prototyping",
  "Digital marketing", "SEO", "Performance marketing", "Content writing", "Copywriting", "Social media marketing", "Email marketing", "Google Analytics",
  "Sales", "Business development", "Lead generation", "Account management", "Customer success", "Negotiation", "CRM", "Salesforce",
  "Recruitment", "Talent acquisition", "HR operations", "Payroll", "Employee engagement",
  "Accounting", "Financial modelling", "Financial analysis", "GST", "Taxation", "Auditing", "Tally", "SAP",
  "Operations management", "Supply chain", "Logistics", "Procurement", "Process improvement",
  "Customer support", "Communication", "Leadership", "Problem solving", "Team management",
];

export const COLLEGE_SUGGESTIONS: string[] = [
  "IIT Bombay", "IIT Delhi", "IIT Madras", "IIT Kanpur", "IIT Kharagpur", "IIT Roorkee", "IIT Guwahati", "IIT Hyderabad", "Any IIT",
  "NIT Trichy", "NIT Surathkal", "NIT Warangal", "Any NIT",
  "BITS Pilani", "IIIT Hyderabad", "IIIT Bangalore", "IIIT Delhi", "Any IIIT",
  "IISc Bangalore", "DTU", "NSUT", "VIT Vellore", "SRM", "Manipal", "Thapar", "PES University", "RVCE", "COEP Pune", "Jadavpur University", "Anna University",
  "IIM Ahmedabad", "IIM Bangalore", "IIM Calcutta", "IIM Lucknow", "Any IIM", "XLRI", "ISB", "FMS Delhi", "SP Jain", "MDI Gurgaon",
  "St. Stephen's College", "SRCC", "Christ University", "Symbiosis", "NMIMS", "Loyola College",
  "NLSIU", "AIIMS", "ISI Kolkata", "TISS",
];

export const INDUSTRY_SUGGESTIONS: string[] = [
  "Fintech", "SaaS", "E-commerce", "Edtech", "Healthtech", "Logistics", "Travel and hospitality", "Gaming", "Media and entertainment", "Telecom",
  "Banking", "Insurance", "Consulting", "IT services", "Manufacturing", "Automotive", "FMCG", "Retail", "Real estate", "Energy",
  "Pharma", "Agritech", "Cybersecurity", "AI and ML", "Consumer internet", "Food delivery", "Mobility", "Government and public sector",
];

export const DOMAIN_SUGGESTIONS: string[] = [
  "Payments", "Lending", "Growth", "Platform", "Infrastructure", "Data platform", "Search", "Recommendations", "Ads", "Marketplace",
  "Supply chain", "Checkout", "Onboarding and KYC", "Risk and fraud", "Developer tools", "Security", "Analytics", "Mobile apps", "Customer support tech", "Core banking",
];
