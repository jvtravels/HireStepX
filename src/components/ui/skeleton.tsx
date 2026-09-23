import { cn } from "cn"

/**
 * The canvas for this component is at
 * tempo/designs/canvases/design-system/index.canvas.tsx.
 * If you adjust this component in any way, ensure the canvas and its
 * asset declaration stay consistent.
 */

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
