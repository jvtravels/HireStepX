import { ErrorPanel, PrimaryLink } from "@/employer/_consoleParts";

export default function EmployerNotFound() {
  return (
    <ErrorPanel
      title="We couldn't find that page"
      message="This page doesn't exist or the link is out of date. Head back to your overview to find your jobs."
      action={<PrimaryLink href="/employer">Back to overview</PrimaryLink>}
    />
  );
}
