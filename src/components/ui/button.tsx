import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

/**
 * The canvas for this component is at
 * tempo/designs/canvases/design-system/index.canvas.tsx.
 * If you adjust this component in any way, ensure the canvas and its
 * asset declaration stay consistent.
 */

const buttonVariants = cva(
  "group/button appearance-none inline-flex shrink-0 items-center justify-center rounded-[8px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--btn-primary)] text-[var(--btn-primary-foreground)] hover:bg-[var(--btn-primary-hover)] border-[var(--btn-primary)] hover:border-[var(--btn-primary-hover)] rounded-[8px] shadow-none",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-[color-mix(in_oklch,var(--btn-destructive),transparent_90%)] text-[var(--btn-destructive)] hover:bg-[color-mix(in_oklch,var(--btn-destructive),transparent_80%)]",
        link: "text-[var(--btn-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3.5 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[8px] px-2.5 text-xs in-data-[slot=button-group]:rounded-[8px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[8px] px-3 text-[13px] in-data-[slot=button-group]:rounded-[8px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs":
          "size-7 rounded-[8px] in-data-[slot=button-group]:rounded-[8px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[8px] in-data-[slot=button-group]:rounded-[8px]",
        "icon-lg": "size-11",
      },
    },
    compoundVariants: [
      { variant: "link", class: "h-auto min-h-0 px-0 py-0.5" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
