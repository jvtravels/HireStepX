import { CandidatesPage } from "./Candidates";
import { EmployersPage } from "./Pages";

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
