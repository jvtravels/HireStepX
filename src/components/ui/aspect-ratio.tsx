"use client"

import { AspectRatio as AspectRatioPrimitive } from "radix-ui"

/**
 * The canvas for this component is at
 * tempo/designs/canvases/design-system/index.canvas.tsx.
 * If you adjust this component in any way, ensure the canvas and its
 * asset declaration stay consistent.
 */

function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }
