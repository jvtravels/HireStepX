import SessionHistoryDesign from "@/SessionHistoryDesign";
import { FEW_SESSIONS } from "./fixtures";

export default function ListFew() {
  return (
    <SessionHistoryDesign initialSessions={FEW_SESSIONS} theme="hirestepx" allowReport />
  );
}
