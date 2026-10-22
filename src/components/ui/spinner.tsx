import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

// The canvas for this component is at tempo/designs/canvases/design-system/index.canvas.tsx.
// If you adjust this component in any way, ensure the canvas and its asset
// declaration stay consistent.

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
