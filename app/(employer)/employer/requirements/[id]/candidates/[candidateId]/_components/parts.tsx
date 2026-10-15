import { Children, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia } from "@/components/ui/item";
import { SkillChip, type ChipTone } from "@/employer/_panelParts";

/** Icon-led sentences built on the shared Item; the icon, not just its colour, carries the meaning. */
export function IconList({ items, icon: Icon, iconClassName, label }: { items: string[]; icon: LucideIcon; iconClassName: string; label?: string }) {
  return (
    <ItemGroup aria-label={label} className="gap-0.5">
      {items.map((text) => (
        <Item key={text} role="listitem" size="xs" className="items-start px-0 py-1.5">
          <ItemMedia variant="icon">
            <Icon aria-hidden="true" className={iconClassName} />
          </ItemMedia>
          <ItemContent>
            <ItemDescription className="line-clamp-none text-[13px] leading-snug text-hx-coal">{text}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}

export function ChipList({ items, tone = "neutral", label }: { items: string[]; tone?: ChipTone; label: string }) {
  return (
    <ul aria-label={label} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {items.map((s) => (
        <li key={s}>
          <SkillChip tone={tone}>{s}</SkillChip>
        </li>
      ))}
    </ul>
  );
}

export function MutedText({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[13px] leading-relaxed text-hx-ink-soft">{children}</p>;
}

/** Panels flow top to bottom through two balanced columns, so a short panel never leaves a hole beside a tall one. */
export function Masonry({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-4 lg:block lg:columns-2 lg:gap-4">
      {Children.toArray(children).map((child, i) => (
        <div key={i} className="min-w-0 break-inside-avoid empty:hidden lg:mb-4">{child}</div>
      ))}
    </div>
  );
}
