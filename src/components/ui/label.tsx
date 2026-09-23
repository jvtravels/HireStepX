import * as React from "react"
import { cn } from "cn"
import { Label as LabelPrimitive } from "radix-ui"

// The canvas for this component is at tempo/designs/canvases/design-system/index.canvas.tsx.
// If you adjust this component in any way, ensure the canvas and its asset
// declaration stay consistent.

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
