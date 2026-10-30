import type { PublicOpening } from "./_public-openings-helpers";

/* Roles listed straight from code, with no database or admin step. Same rule as
 * the database path: never name the employer in any field here. A role hides
 * itself at expiresAt; remove the entry when it is filled. */
export const STATIC_OPENINGS: PublicOpening[] = [
  {
    slug: "sales-development-representative-international-saas",
    title: "Sales Development Representative (International SaaS)",
    summary:
      "Build a qualified sales pipeline across India, the US, UK, Europe, Middle East and ANZ. Research prospects, run email, LinkedIn and call outreach, and book meetings for the sales team. Remote, full-time, 1-2 years in SDR, BDR or inside sales.",
    location: "Remote (India)",
    workMode: "remote",
    experienceMin: 1,
    experienceMax: 2,
    skills: ["LinkedIn Sales Navigator", "Apollo", "HubSpot", "Salesforce", "Email sequencing"],
    employmentType: "full-time",
    department: "sales",
    details: {
      about:
        "An expanding SaaS business is looking for an SDR to build a qualified sales pipeline in India and international markets. You will identify potential customers, start conversations across email, LinkedIn and calls, qualify opportunities, and arrange meetings for the sales team. The role suits someone who enjoys outbound sales, thoughtful research and learning how different markets buy software.",
      responsibilities: [
        "Research relevant companies and decision-makers across assigned markets and build high-quality prospect lists.",
        "Run personalised outbound sequences using email, LinkedIn and calls.",
        "Follow up promptly on inbound enquiries, demo requests and other relevant leads.",
        "Hold initial discovery conversations to understand prospect needs, fit and buying readiness.",
        "Book qualified meetings and hand over clear notes and context to the sales team.",
        "Keep accurate CRM records, outreach activity and pipeline updates.",
        "Share recurring customer objections, competitor insights and messaging feedback.",
        "Test outreach approaches by segment, market and channel, and help build a repeatable sales playbook.",
      ],
      requirements: [
        "1 to 2 years of experience in SDR, BDR, inside sales or software business development.",
        "Experience generating qualified meetings or pipeline. International prospecting experience is preferred.",
        "Strong spoken and written English, and confidence engaging founders and senior decision-makers.",
        "Hands-on familiarity with tools such as LinkedIn Sales Navigator, Apollo, HubSpot, Salesforce or email sequencing platforms.",
        "Organised, resilient and self-directed, with the flexibility to overlap with international time zones.",
      ],
      goodToHave: [
        "Exposure to SaaS for e-commerce, D2C brands, marketing technology or analytics.",
        "Understanding of Shopify, Amazon, digital advertising or common e-commerce business metrics.",
        "Experience at an early-stage startup, or building outbound outreach for a new market.",
      ],
      success: [
        { label: "First 30 days", text: "Learn the offering, target customers and competitive landscape. Build prospect lists and launch the first sequences." },
        { label: "By 60 days", text: "Run an organised outreach rhythm and consistently generate qualified sales conversations." },
        { label: "By 90 days", text: "Improve meeting quality and conversion, refine messaging and document what works by region." },
      ],
      offers: [
        "Fully remote working arrangement.",
        "Competitive compensation, with details shared during the selection process.",
        "Exposure to international sales and a path towards larger account responsibilities.",
        "Close collaboration with sales leadership in a growing business.",
      ],
    },
    listedAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-12-14T00:00:00.000Z",
  },
  {
    slug: "wordpress-developer-block-themes-fse",
    title: "Contract WordPress Developer (Block Themes / FSE)",
    summary:
      "Build pages, templates, reusable block patterns and custom blocks on a large-scale WordPress site. Turn Figma designs into responsive builds and troubleshoot across themes, plugins and environments. Remote contract.",
    location: "Remote",
    workMode: "remote",
    experienceMin: null,
    experienceMax: null,
    skills: ["WordPress", "Block Themes", "Full Site Editing", "PHP", "JavaScript", "Git"],
    employmentType: "contract",
    department: "engineering",
    details: {
      about:
        "An employer on HireStepX is looking for an experienced WordPress Developer with strong hands-on experience in Block Themes and Full Site Editing (FSE). You will work on a large-scale WordPress website, building reusable components, translating Figma designs into responsive pages, and solving technical issues across themes, plugins and environments.",
      responsibilities: [
        "Build pages, templates and reusable block patterns.",
        "Develop custom blocks and theme functionality.",
        "Translate Figma designs into responsive WordPress builds.",
        "Improve accessibility, performance and consistency.",
        "Work with Git, code reviews and ticket-based workflows.",
        "Troubleshoot WordPress issues independently.",
      ],
      requirements: [
        "Strong WordPress development experience.",
        "Hands-on experience with Block Themes and Full Site Editing.",
        "Strong working knowledge of PHP, HTML, CSS and JavaScript.",
        "Experience translating Figma designs into responsive WordPress builds.",
        "Comfortable using Git and GitHub.",
        "Strong problem-solving skills and the ability to troubleshoot independently.",
        "Comfortable working remotely across time zones.",
      ],
      goodToHave: [
        "Enterprise or multisite WordPress experience.",
        "SEO, accessibility or performance optimisation experience.",
        "Experience with AI-assisted development tools.",
      ],
    },
    listedAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-12-14T00:00:00.000Z",
  },
  {
    slug: "frontend-developer-react-typescript",
    title: "Frontend Developer (React, TypeScript)",
    summary:
      "Build responsive, accessible web interfaces in React and TypeScript. Turn designs into reusable components, connect them to APIs, and keep the product fast and reliable. Remote, full-time, 1-3 years of frontend experience.",
    location: "Remote (India)",
    workMode: "remote",
    experienceMin: 1,
    experienceMax: 3,
    skills: ["React", "TypeScript", "JavaScript", "HTML and CSS", "REST APIs", "Git"],
    employmentType: "full-time",
    department: "engineering",
    details: {
      about:
        "An employer on HireStepX is looking for a Frontend Developer with 1 to 3 years of experience to build and improve the web product people use every day. You will turn designs into responsive, accessible interfaces in React and TypeScript, connect them to backend APIs, and work closely with designers and backend engineers. The role suits someone who cares about how an interface feels as well as how it is built.",
      responsibilities: [
        "Build and maintain responsive web interfaces using React and TypeScript.",
        "Turn design files into clean, reusable components that follow the team's design system.",
        "Integrate REST APIs and handle loading, error and empty states properly.",
        "Write unit and component tests for the code you ship.",
        "Improve accessibility, page speed and cross-browser behaviour.",
        "Take part in code reviews, and fix bugs reported by users and teammates.",
        "Work with designers, product managers and backend engineers to scope and deliver features.",
      ],
      requirements: [
        "1 to 3 years of professional experience building web interfaces.",
        "Solid JavaScript and TypeScript, including modern ES features.",
        "Hands-on experience with React, including hooks and state management.",
        "Strong HTML and CSS, and experience building responsive layouts.",
        "Comfortable using Git and GitHub, and working through code review.",
        "A portfolio or GitHub profile with projects you have built and deployed.",
        "Clear written and spoken English, and comfort working remotely.",
      ],
      goodToHave: [
        "Experience with Next.js or another React framework.",
        "Experience with Tailwind CSS or a component library.",
        "Knowledge of accessibility standards (WCAG) and web performance tuning.",
        "Experience writing tests with Jest, React Testing Library or Playwright.",
        "Experience with AI-assisted development tools.",
      ],
    },
    listedAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-12-14T00:00:00.000Z",
  },
];

export function liveStaticOpenings(now: Date = new Date()): PublicOpening[] {
  return STATIC_OPENINGS.filter((o) => Date.parse(o.expiresAt) > now.getTime());
}
