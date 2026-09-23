"use client"

/**
 * Not declared as a design-system asset: pure RTL-context plumbing with no
 * visual output of its own (see design-system/layout-advanced/index.canvas.tsx
 * for the rest of this batch's components and reasoning).
 */

import * as React from "react"
import { Direction } from "radix-ui"

function DirectionProvider({
  dir,
  direction,
  children,
}: React.ComponentProps<typeof Direction.DirectionProvider> & {
  direction?: React.ComponentProps<typeof Direction.DirectionProvider>["dir"]
}) {
  return (
    <Direction.DirectionProvider dir={direction ?? dir}>
      {children}
    </Direction.DirectionProvider>
  )
}

const useDirection = Direction.useDirection

export { DirectionProvider, useDirection }
