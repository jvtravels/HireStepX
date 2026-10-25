import { CandidatesPage } from "./Candidates";
import { EmployersPage } from "./Pages";
import { PricingPage } from "./PricingPage";
import { ContactPage } from "./Contact";
import { AboutPage } from "./About";
import { GlobalErrorPage, NotFoundPage, ServerErrorPage } from "./ErrorPages";
import { ResourcesPage } from "./Resources";
import { LegalDocPage } from "./LegalCanvas";
import { ArticleTemplate, SalaryTemplate, QuestionSetTemplate } from "./SeoTemplates";
import { articlePost, articleProps, salaryProps, questionsModel } from "./seoData";

const ARTICLE = articlePost("top-10-google-interview-questions")!;
const SALARY = salaryProps("google")!;
const QUESTIONS = questionsModel("flipkart-pm-interview-questions")!;

export function CandidatesDesktop() {
  return <div style={{ width: 1728 }}><CandidatesPage /></div>;
}
export function CandidatesMobile() {
  return <div style={{ width: 390 }}><CandidatesPage /></div>;
}
export function EmployersDesktop() {
  return <div style={{ width: 1728 }}><EmployersPage /></div>;
}
export function EmployersMobile() {
  return <div style={{ width: 390 }}><EmployersPage /></div>;
}
export function PricingCandidatesDesktop() {
  return <div style={{ width: 1728 }}><PricingPage initial="cand" /></div>;
}
export function PricingEmployersDesktop() {
  return <div style={{ width: 1728 }}><PricingPage initial="emp" /></div>;
}
export function PricingCandidatesMobile() {
  return <div style={{ width: 390 }}><PricingPage initial="cand" /></div>;
}
export function PricingEmployersMobile() {
  return <div style={{ width: 390 }}><PricingPage initial="emp" /></div>;
}
export function ContactDesktop() {
  return <div style={{ width: 1728 }}><ContactPage /></div>;
}
export function ContactMobile() {
  return <div style={{ width: 390 }}><ContactPage /></div>;
}
export function ResourcesDesktop() {
  return <div style={{ width: 1728 }}><ResourcesPage /></div>;
}
export function ResourcesMobile() {
  return <div style={{ width: 390 }}><ResourcesPage /></div>;
}
export function LegalCookiesDesktop() {
  return <div style={{ width: 1728 }}><LegalDocPage slug="cookies" /></div>;
}
export function LegalCookiesMobile() {
  return <div style={{ width: 390 }}><LegalDocPage slug="cookies" /></div>;
}

export function ResourcesDesktopFiltered() {
  return <div style={{ width: 1728 }}><ResourcesPage initial={{ sheet: true, kinds: ["guide", "question"], companies: ["Flipkart"] }} /></div>;
}
export function ResourcesMobileSheet() {
  return <div style={{ width: 390 }}><ResourcesPage initial={{ sheet: true, kinds: ["question"] }} /></div>;
}

export function ResourcesDesktopSearch() {
  return <div style={{ width: 1728 }}><ResourcesPage initial={{ search: true }} /></div>;
}

export function SeoArticleDesktop() {
  return <div style={{ width: 1728 }}><ArticleTemplate {...articleProps(ARTICLE)} /></div>;
}
export function SeoArticleMobile() {
  return <div style={{ width: 390 }}><ArticleTemplate {...articleProps(ARTICLE)} /></div>;
}
export function SeoSalaryDesktop() {
  return <div style={{ width: 1728 }}><SalaryTemplate {...SALARY} /></div>;
}
export function SeoSalaryMobile() {
  return <div style={{ width: 390 }}><SalaryTemplate {...SALARY} /></div>;
}
export function SeoQuestionsDesktop() {
  return <div style={{ width: 1728 }}><QuestionSetTemplate model={QUESTIONS} /></div>;
}
export function SeoQuestionsMobile() {
  return <div style={{ width: 390 }}><QuestionSetTemplate model={QUESTIONS} /></div>;
}

export function AboutDesktop() {
  return <div style={{ width: 1728 }}><AboutPage /></div>;
}
export function AboutMobile() {
  return <div style={{ width: 390 }}><AboutPage /></div>;
}

export function NotFoundDesktop() {
  return <div style={{ width: 1728 }}><NotFoundPage /></div>;
}
export function NotFoundMobile() {
  return <div style={{ width: 390 }}><NotFoundPage /></div>;
}
export function ServerErrorDesktop() {
  return <div style={{ width: 1728 }}><ServerErrorPage /></div>;
}
export function ServerErrorMobile() {
  return <div style={{ width: 390 }}><ServerErrorPage /></div>;
}
export function GlobalErrorDesktop() {
  return <div style={{ width: 1728 }}><GlobalErrorPage /></div>;
}
