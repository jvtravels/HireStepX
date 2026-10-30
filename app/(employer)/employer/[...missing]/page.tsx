import { notFound } from "next/navigation";

// Unknown /employer/* addresses render the employer not-found panel inside the console shell, not the public 404.
export default function EmployerCatchAll() {
  notFound();
}
