// Club colours (primary, secondary) by FPL short name, 2026-27 clubs. `tint` is the colour used to wash a row:
// the primary, or the secondary for clubs whose primary is white or near-black.
export const CLUB: Record<string, { primary: string; secondary: string; ink: string; tint?: string }> = {
  ARS: { primary: "#EF0107", secondary: "#FFFFFF", ink: "#FFFFFF" },
  AVL: { primary: "#670E36", secondary: "#95BFE5", ink: "#FFFFFF" },
  BOU: { primary: "#DA291C", secondary: "#000000", ink: "#FFFFFF" },
  BRE: { primary: "#E30613", secondary: "#FFFFFF", ink: "#FFFFFF" },
  BHA: { primary: "#0057B8", secondary: "#FFFFFF", ink: "#FFFFFF" },
  CHE: { primary: "#034694", secondary: "#FFFFFF", ink: "#FFFFFF" },
  COV: { primary: "#6CB4E4", secondary: "#002B5C", ink: "#002B5C" },
  CRY: { primary: "#1B458F", secondary: "#C4122E", ink: "#FFFFFF" },
  EVE: { primary: "#003399", secondary: "#FFFFFF", ink: "#FFFFFF" },
  FUL: { primary: "#111111", secondary: "#FFFFFF", ink: "#FFFFFF", tint: "#8a8a8a" },
  HUL: { primary: "#F5A12D", secondary: "#000000", ink: "#000000" },
  IPS: { primary: "#0044A9", secondary: "#FFFFFF", ink: "#FFFFFF" },
  LEE: { primary: "#1D428A", secondary: "#FFCD00", ink: "#FFFFFF" },
  LIV: { primary: "#C8102E", secondary: "#00B2A9", ink: "#FFFFFF" },
  MCI: { primary: "#6CABDD", secondary: "#1C2C5B", ink: "#1C2C5B" },
  MUN: { primary: "#DA291C", secondary: "#FBE122", ink: "#FFFFFF" },
  NEW: { primary: "#241F20", secondary: "#FFFFFF", ink: "#FFFFFF", tint: "#8a8a8a" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF", ink: "#FFFFFF" },
  TOT: { primary: "#132257", secondary: "#FFFFFF", ink: "#FFFFFF" },
  SUN: { primary: "#EB172B", secondary: "#FFFFFF", ink: "#FFFFFF" },
};
const FALLBACK: { primary: string; secondary: string; ink: string; tint?: string } = { primary: "#8a8a8a", secondary: "#ffffff", ink: "#ffffff" };
export const club = (short: string | undefined) => (short && CLUB[short]) || FALLBACK;
