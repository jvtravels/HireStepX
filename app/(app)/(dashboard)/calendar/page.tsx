import { redirect } from "next/navigation";

// Calendar is hidden for candidates for now; DashboardCalendar is kept for when it returns.
export default function Page() {
  redirect("/dashboard");
}
