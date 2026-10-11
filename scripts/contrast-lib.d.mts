export interface ContrastResult { fg: string; bg: string; min: number; why: string; ratio: number; pass: boolean }
export type ContrastPair = readonly [string, string, number, string];
export function parseColor(input: string): { rgb: number[]; a: number };
export function composite(fg: string, bg: string): number[];
export function luminance(rgb: number[]): number;
export function contrast(fg: string, bg: string): number;
export function parseTokens(source: string): Record<string, string>;
export const EXTRA_SURFACES: Record<string, string>;
export const CONTRAST_PAIRS: readonly ContrastPair[];
export function evaluatePairs(tokens: Record<string, string>, pairs?: readonly ContrastPair[]): ContrastResult[];
