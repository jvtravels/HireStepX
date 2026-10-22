import RedirectNotice from "@/RedirectNotice";

// Calendar is hidden for candidates for now; DashboardCalendar is kept for when it returns.
export default function Page() {
  return (
    <RedirectNotice
      to="/dashboard"
      fullScreen={false}
      title="Calendar isn't available yet"
      message="Taking you back to your dashboard."
    />
  );
}
