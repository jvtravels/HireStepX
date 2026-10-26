import type { ReactNode } from "react";
import { SECTION_VISUALS_1 } from "./visuals/part1";
import { SECTION_VISUALS_2 } from "./visuals/part2";
import { SECTION_VISUALS_3 } from "./visuals/part3";
import { SECTION_VISUALS_4 } from "./visuals/part4";
import { SECTION_VISUALS_5 } from "./visuals/part5";
import { SECTION_VISUALS_6 } from "./visuals/part6";

/* Keyed by "slug||Section Heading"; each value renders after the prose for that section. Split into parts to keep files reviewable. */
export const SECTION_VISUALS: Record<string, ReactNode> = {
  ...SECTION_VISUALS_1,
  ...SECTION_VISUALS_2,
  ...SECTION_VISUALS_3,
  ...SECTION_VISUALS_4,
  ...SECTION_VISUALS_5,
  ...SECTION_VISUALS_6,
};
