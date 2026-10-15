import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia } from "@/components/ui/item";
import { SkillChip, type ChipTone } from "@/employer/_panelParts";

/** Icon-led sentences built on the shared Item; the icon, not just its colour, carries the meaning. */
export function IconList({ items, icon: Icon, iconClassName, label, renderAction }: { items: string[]; icon: LucideIcon; iconClassName: string; label?: string; renderAction?: (text: string) => ReactNode }) {
  return (
    <ItemGroup aria-label={label} className="gap-0.5">
      {items.map((text) => (
        <Item key={text} role="listitem" size="xs" className="items-start px-0 py-1.5">
          <ItemMedia variant="icon">
            <Icon aria-hidden="true" className={iconClassName} />
          </ItemMedia>
          <ItemContent>
            <ItemDescription className="line-clamp-none text-[13px] leading-snug text-hx-coal">{text}</ItemDescription>
            {renderAction?.(text)}
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

export interface ColumnItem { key: string; weight: number; node: ReactNode }

/** Splits panels into two columns of roughly equal height (weight is an estimate of rows), keeping
 *  source order inside each column. Stacks into a single column on small screens. */
export function BalancedColumns({ items }: { items: Array<ColumnItem | false | null | undefined> }) {
  const left: ColumnItem[] = [];
  const right: ColumnItem[] = [];
  let lw = 0;
  let rw = 0;
  for (const item of items) {
    if (!item) continue;
    if (lw <= rw) {
      left.push(item);
      lw += item.weight;
    } else {
      right.push(item);
      rw += item.weight;
    }
  }
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2 lg:items-start">
      {[left, right].map((col, i) => (
        <div key={i} className="grid min-w-0 content-start gap-4 empty:hidden">
          {col.map((c) => (
            <div key={c.key} className="min-w-0">{c.node}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
