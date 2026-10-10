import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Candidate } from "@/employer/mockData";

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
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function ResumeTab({ candidate, shortlistHref }: { candidate: Candidate; shortlistHref: string }) {
  const resume = candidate.resume;
  const unlockLink = <Link href={shortlistHref} className="font-medium text-primary underline-offset-4 hover:underline">Unlock from the shortlist</Link>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Resume summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!candidate.unlocked ? (
            <Muted>This candidate's summary is locked. {unlockLink} to view.</Muted>
          ) : resume?.summary ? (
            <p className="max-w-prose text-sm leading-relaxed">{resume.summary}</p>
          ) : (
            <Muted>No resume summary available for this candidate.</Muted>
          )}
          {!!resume?.keyAchievements.length && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Key achievements</h3>
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-border">
                  {resume.keyAchievements.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employment history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {resume?.experience.length ? (
            <ul className="divide-y divide-border/60">
              {resume.experience.map((e, i) => (
                <li key={`${e.company}-${i}`} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{e.title || "Role"}</p>
                    <p className="text-sm text-muted-foreground">{e.company}</p>
                  </div>
                  {e.period && <p className="shrink-0 text-xs text-muted-foreground">{e.period}</p>}
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
                <h3 className="text-sm font-medium">Industries</h3>
                <Tags items={resume.industries} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tools and skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {candidate.skills.length ? <Tags items={candidate.skills} /> : <Muted>No tools or skills listed on this resume.</Muted>}
          {!!resume?.certifications.length && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Certifications</h3>
                <Tags items={resume.certifications} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio and work samples</CardTitle>
          <CardDescription>Links the candidate chose to share.</CardDescription>
        </CardHeader>
        <CardContent>
          {!candidate.unlocked ? (
            <Muted>Portfolio links are locked until this candidate is unlocked.</Muted>
          ) : candidate.portfolioLinks?.length ? (
            <ul className="flex flex-wrap gap-2">
              {candidate.portfolioLinks.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-sm hover:bg-muted">
                    {link.title}
                    <ExternalLink aria-hidden="true" className="size-3.5 text-muted-foreground" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>No portfolio or project links on file for this candidate.</Muted>
          )}
        </CardContent>
      </Card>
      {(resume?.noticePeriod || resume?.currentCtc) && (
        <Alert>
          <AlertDescription>Notice period and CTC are self-reported on the resume and not verified.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
