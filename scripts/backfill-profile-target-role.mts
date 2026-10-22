/* One-time backfill: profiles.target_role is empty for profiles that never
   finished onboarding (pre-dating the required-target-role fix in
   Onboarding.tsx / Panels.tsx) but already have completed sessions carrying
   their own target_role. Those profiles can never surface in an employer's
   Top Matches / Strong Match columns (roleOverlap is 55% of the fit score,
   see _requirement-match-helpers.ts) even though real signal exists for
   them in sessions. This backfills profiles.target_role from each such
   profile's most recent session that has a non-empty target_role.

   Defaults to a dry run (reports what it would update, writes nothing).
   Pass --apply to actually write.

   Usage:
     npx tsx scripts/backfill-profile-target-role.mts            # dry run
     npx tsx scripts/backfill-profile-target-role.mts --apply     # writes

   Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.prod (prod-only
   creds; not present in .env.local). */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.prod") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (expected in .env.prod)");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { data: emptyProfiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, target_role")
    .or("target_role.is.null,target_role.eq.");
  if (profilesErr) throw profilesErr;
  if (!emptyProfiles || emptyProfiles.length === 0) {
    console.log("No profiles with an empty target_role. Nothing to do.");
    return;
  }
  console.log(`Found ${emptyProfiles.length} profile(s) with empty target_role.`);

  let candidates = 0;
  let updated = 0;
  let skippedNoSession = 0;

  for (const profile of emptyProfiles) {
    const { data: sessions, error: sessionsErr } = await supabase
      .from("sessions")
      .select("target_role, created_at")
      .eq("user_id", profile.id)
      .not("target_role", "is", null)
      .neq("target_role", "")
      .order("created_at", { ascending: false })
      .limit(1);
    if (sessionsErr) throw sessionsErr;

    const latest = sessions?.[0];
    if (!latest?.target_role) {
      skippedNoSession++;
      continue;
    }

    candidates++;
    console.log(`${apply ? "Updating" : "[dry-run] Would update"} profile ${profile.id} -> target_role="${latest.target_role}"`);
    if (apply) {
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ target_role: latest.target_role })
        .eq("id", profile.id);
      if (updateErr) throw updateErr;
      updated++;
    }
  }

  console.log("---");
  console.log(`Profiles with empty target_role: ${emptyProfiles.length}`);
  console.log(`Candidates with a session target_role to backfill: ${candidates}`);
  console.log(`Skipped (no session with a target_role): ${skippedNoSession}`);
  console.log(apply ? `Updated: ${updated}` : `Dry run only — rerun with --apply to write these ${candidates} update(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
