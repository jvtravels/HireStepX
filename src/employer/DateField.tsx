"use client";

import type { InputHTMLAttributes, MouseEvent } from "react";

/** Click handler that opens the native picker. Exported for design-system
    inputs (shadcn <Input type="date">) that can't be swapped for DateField. */
export function openDatePicker(e: MouseEvent<HTMLInputElement>): void {
  if (e.defaultPrevented || e.currentTarget.disabled || e.currentTarget.readOnly) return;
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // showPicker throws when the document isn't focused/user-activated (e.g. some embeds); native behaviour still works.
  }
}

/* A native date input whose whole surface opens the picker. Browsers only open
   it from the small calendar glyph by default, so clicking the text segments
   felt dead; showPicker() makes the entire field a target while keyboard entry
   into the day/month/year segments keeps working. */
export default function DateField(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const { onClick, style, ...rest } = props;
  return (
    <input
      {...rest}
      type="date"
      onClick={(e) => {
        onClick?.(e);
        openDatePicker(e);
      }}
      style={{ cursor: "pointer", ...style }}
    />
  );
}
