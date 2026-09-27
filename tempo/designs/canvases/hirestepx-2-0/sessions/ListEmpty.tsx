import SessionHistoryDesign from "@/SessionHistoryDesign";

export default function ListEmpty() {
  return (
    <SessionHistoryDesign initialSessions={[]} theme="hirestepx" allowReport />
  );
}
