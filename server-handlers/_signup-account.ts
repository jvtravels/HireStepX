import { validatePasswordServer } from "./_disposable-emails";

export type CreateUserResult =
  | { kind: "created"; id: string }
  | { kind: "exists" }
  | { kind: "error"; status: number };

export interface CreateUserInput {
  supabaseUrl: string;
  serviceKey: string;
  email: string;
  password: string;
  name: string;
  consentKey: string;
  consentVersion: string;
  /** Employer signup only: carried in user_metadata so an email confirmed on another
   *  device (where the localStorage stash is absent) can still prefill onboarding. */
  companyName?: string;
  companyWebsite?: string;
}

export const PENDING_COMPANY_NAME_KEY = "pending_company_name";
export const PENDING_COMPANY_WEBSITE_KEY = "pending_company_website";

/** Trimmed and length-capped; anything that is not a non-empty string is dropped. */
export function cleanPendingCompanyField(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

export function validateSignupFields(name: unknown, password: unknown): string | null {
  const pw = validatePasswordServer(typeof password === "string" ? password : "");
  if (!pw.ok) return pw.error;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 48) {
    return "Name is required (max 48 characters).";
  }
  return null;
}

export function isExistingUserResponse(status: number, body: unknown): boolean {
  if (status !== 422 && status !== 409) return false;
  if (!body || typeof body !== "object") return status === 409;
  const { error_code, msg, message } = body as { error_code?: unknown; msg?: unknown; message?: unknown };
  if (error_code === "email_exists" || error_code === "user_already_exists") return true;
  const text = `${typeof msg === "string" ? msg : ""} ${typeof message === "string" ? message : ""}`.toLowerCase();
  return text.includes("already") && (text.includes("registered") || text.includes("exists"));
}

/* email_confirm:false means GoTrue sends no mail of its own, so the Resend
   verification mail is the only one the user receives. */
export async function createUnconfirmedUser(
  input: CreateUserInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CreateUserResult> {
  const res = await fetchImpl(`${input.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: input.serviceKey,
      Authorization: `Bearer ${input.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: false,
      user_metadata: {
        name: input.name.trim(),
        custom_email_verified: false,
        ...(cleanPendingCompanyField(input.companyName, 120) ? { [PENDING_COMPANY_NAME_KEY]: cleanPendingCompanyField(input.companyName, 120) } : {}),
        ...(cleanPendingCompanyField(input.companyWebsite, 200) ? { [PENDING_COMPANY_WEBSITE_KEY]: cleanPendingCompanyField(input.companyWebsite, 200) } : {}),
        ...(input.consentVersion ? { [input.consentKey]: input.consentVersion } : {}),
      },
    }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const id = body && typeof body === "object" ? (body as { id?: unknown }).id : undefined;
    return typeof id === "string" && id ? { kind: "created", id } : { kind: "error", status: 502 };
  }
  if (isExistingUserResponse(res.status, body)) return { kind: "exists" };
  return { kind: "error", status: res.status };
}
