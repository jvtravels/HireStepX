import { ErrorPanel, PrimaryLink } from "@/employer/_consoleParts";

export default function EmployerNotFound() {
  return (
    <ErrorPanel
      title="We couldn't find that page"
      message="The job or page you're looking for may have been removed, or the link is out of date."
      action={<PrimaryLink href="/employer">Back to overview</PrimaryLink>}
    />
  );
}
