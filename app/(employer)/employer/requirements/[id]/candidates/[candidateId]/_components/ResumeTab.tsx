import Link from "next/link";
import { Briefcase, ExternalLink, FileText, GraduationCap, Link2, Wrench } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Candidate } from "@/employer/mockData";
import { CARD, TITLE, MAIN_SIDE, candidateLinks } from "./helpers";
import { ResumeDownload } from "./ResumeDownload";

function Tags({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((s) => (
        <li key={s}><Badge variant="secondary" className="h-6 px-2.5">{s}</Badge></li>
      ))}
    </ul>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-md text-muted-foreground">{children}</p>;
}

export function ResumeTab({
  candidate,
  shortlistHref,
  resumeFileName,
}: {
  candidate: Candidate;
  shortlistHref: string;
  resumeFileName: string | null;
}) {
  const resume = candidate.resume;
  const links = candidateLinks(candidate);
  const unlockLink = <Link href={shortlistHref} className="font-semibold text-primary underline-offset-4 hover:underline">Unlock from the shortlist</Link>;

  return (
    <div className="flex flex-col gap-4">
      <div className={MAIN_SIDE}>
        <div className="flex min-w-0 flex-col gap-4">
      <Card className={CARD}>
        <CardHeader>
          <CardTitle className={TITLE}><FileText aria-hidden="true" className="size-4 text-primary" />Summary and achievements</CardTitle>
          <CardDescription className="text-md">As written on the resume.</CardDescription>
          {candidate.unlocked && resumeFileName && (
            <CardAction><ResumeDownload matchId={candidate.id} fileName={resumeFileName} size="sm" /></CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!candidate.unlocked ? (
            <Muted>Locked. {unlockLink} to read the resume and download the original file.</Muted>
          ) : (
            <>
              {resume?.summary ? <p className="text-md leading-relaxed text-muted-foreground">{resume.summary}</p> : <Muted>No summary on this resume.</Muted>}
              {!!resume?.keyAchievements.length && (
                <>
                  <Separator />
                  <ul className="list-disc space-y-1.5 pl-5 text-md leading-relaxed text-muted-foreground marker:text-border">
                    {resume.keyAchievements.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader>
          <CardTitle className={TITLE}><Briefcase aria-hidden="true" className="size-4 text-primary" />Employment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resume?.experience.length ? (
            <ul className="divide-y divide-border">
              {resume.experience.map((e, i) => (
                <li key={`${e.company}-${i}`} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-md font-semibold">{e.title || "Role"}</p>
                    <p className="text-md text-muted-foreground">{e.company}</p>
                  </div>
                  {e.period && <p className="shrink-0 text-sm text-muted-foreground">{e.period}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Muted>No structured employment history extracted from this resume.</Muted>
          )}
          {!!resume?.industries.length && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Industries</h3>
                <Tags items={resume.industries} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

        </div>
        <div className="flex min-w-0 flex-col gap-4">
      <Card className={CARD}>
        <CardHeader>
          <CardTitle className={TITLE}><Link2 aria-hidden="true" className="size-4 text-primary" />Links shared by the candidate</CardTitle>
          <CardDescription className="text-md">Shown exactly as the candidate provided them.</CardDescription>
        </CardHeader>
        <CardContent>
          {!candidate.unlocked ? (
            <Muted>Links are locked until this candidate is unlocked.</Muted>
          ) : links.length ? (
            <ul className="grid gap-2">
              {links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-md hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{l.label}</span>
                      <span className="block truncate text-sm text-muted-foreground">{l.host}</span>
                    </span>
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>This candidate shared no portfolio or profile links.</Muted>
          )}
        </CardContent>
      </Card>

      {!!resume?.education.length && (
        <Card className={CARD}>
          <CardHeader><CardTitle className={TITLE}><GraduationCap aria-hidden="true" className="size-4 text-primary" />Education</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {resume.education.map((ed, i) => (
                <li key={`${ed.school}-${i}`} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-md font-semibold">{ed.degree}</p>
                    <p className="text-md text-muted-foreground">{ed.school}</p>
                  </div>
                  {ed.year && <p className="shrink-0 text-sm text-muted-foreground">{ed.year}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className={CARD}>
        <CardHeader>
          <CardTitle className={TITLE}><Wrench aria-hidden="true" className="size-4 text-primary" />Tools and skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {candidate.skills.length ? <Tags items={candidate.skills} /> : <Muted>No tools or skills listed on this resume.</Muted>}
          {!!resume?.certifications.length && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-base font-semibold">Certifications</h3>
                <Tags items={resume.certifications} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

        </div>
      </div>
      {(resume?.noticePeriod || resume?.currentCtc) && (
        <Alert>
          <AlertDescription>Notice period and CTC are self-reported on the resume and not verified.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
