/* HireStepX — Design System / Conversational (AI-chat)
   Bubble, Message, Message Scroller, Attachment, Questionnaire, Marker —
   genuinely relevant here: the Interview screen's core surface is a
   live AI-interviewer conversation. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from "@/components/ui/message-scroller";
import {
  Attachment,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireTitle,
  QuestionnaireChoices,
  QuestionnaireChoice,
  QuestionnaireActions,
  QuestionnaireSkip,
  QuestionnaireNext,
} from "@/components/ui/questionnaire";
import { FileTextIcon, XIcon } from "lucide-react";

export default function DesignSystemChat() {
  return (
    <PageShell>
      <PageHeader
        title="Conversational."
        description="Bubble, Message, Message Scroller, Attachment, Questionnaire, Marker — the Interview screen's live AI-interviewer transcript is built from these."
      />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="Message & Bubble in a Message Scroller" desc="Align-aware turns in an auto-stick-to-bottom transcript container." />
          <div className="h-72 w-[520px] rounded-lg border border-border bg-background">
            <MessageScrollerProvider>
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-3">
                    <MessageScrollerItem>
                      <Message align="start">
                        <MessageContent>
                          <Bubble>
                            <BubbleContent>
                              Tell me about a time you managed a conflict with a teammate.
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    <MessageScrollerItem>
                      <Message align="end">
                        <MessageContent>
                          <Bubble variant="tinted">
                            <BubbleContent>
                              Sure — on my last project, a designer and I disagreed on scope...
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    <MessageScrollerItem>
                      <Message align="start">
                        <MessageContent>
                          <Bubble>
                            <BubbleContent>
                              Good{" "}
                              <Marker asChild>
                                <span className="inline text-[var(--copper)] font-medium">
                                  <MarkerContent>STAR structure</MarkerContent>
                                </span>
                              </Marker>{" "}
                              so far — what was the outcome?
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    <MessageScrollerItem>
                      <Message align="end">
                        <MessageContent>
                          <Bubble variant="tinted">
                            <BubbleContent>
                              We shipped on time and the designer became my go-to reviewer.{" "}
                              <Marker asChild>
                                <span className="inline text-emerald-600 font-medium dark:text-emerald-400">
                                  <MarkerContent>Strong close</MarkerContent>
                                </span>
                              </Marker>
                              .
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="02" title="Attachment" desc="Inline file chip — a resume uploaded mid-conversation, or a coached-answer export." />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Attachment className="relative">
              <AttachmentMedia>
                <FileTextIcon />
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>Riddhi_Resume.pdf</AttachmentTitle>
                <AttachmentDescription>212 KB</AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction aria-label="Remove attachment">
                  <XIcon />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
            <AttachmentTrigger
              aria-label="Attach file"
              className="static flex size-9 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground"
            >
              +
            </AttachmentTrigger>
          </div>
        </section>

        <section>
          <SectionHead num="03" title="Questionnaire" desc="A structured question presented inline in the conversation, not as a separate page." />
          <div className="max-w-sm">
            <Questionnaire defaultItem="round">
              <QuestionnaireItem name="round">
                <QuestionnaireTitle>Which round would you like to practice?</QuestionnaireTitle>
                <QuestionnaireChoices>
                  <QuestionnaireChoice value="behavioral">Behavioral</QuestionnaireChoice>
                  <QuestionnaireChoice value="technical">Technical</QuestionnaireChoice>
                  <QuestionnaireChoice value="negotiation">Salary negotiation</QuestionnaireChoice>
                </QuestionnaireChoices>
              </QuestionnaireItem>
              <QuestionnaireActions>
                <QuestionnaireSkip />
                <QuestionnaireNext />
              </QuestionnaireActions>
            </Questionnaire>
          </div>
        </section>
      </div>
      <Footer section="Conversational" tagline="Pick an option in the questionnaire." />
    </PageShell>
  );
}
