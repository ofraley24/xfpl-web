// Stats sheet (public/data/stats.json, written by xFPL/analysis/27_export_stats.py) and stat definitions.
import { useEffect, useState } from "react";
import type { Pos } from "./types";

export type Window = "season" | "last4";
export type Totals = Record<string, number | null>;

export interface StatPlayer {
  id: number; name: string; team: number; pos: Pos; price: number; own: number; status: string; form: number;
  s: Record<Window, Totals>;
  shots: [number, number, number, string, number, number, boolean][]; // x, y, xG, result (G/S/M/B/P), minute, gw, penalty
}
export interface StatTeam {
  id: number; name: string; short: string;
  s: Record<Window, Totals>;
  ratings: { gw: number; att: number; def: number; xgf: number; xga: number; next?: boolean }[];
}
export interface StatsDoc {
  season: string; through_gw: number; windows: Record<Window, number[]>; generated_utc: string;
  notes: Record<string, string>; players: StatPlayer[]; teams: StatTeam[];
}

export function useStats() {
  const [doc, setDoc] = useState<StatsDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("./data/stats.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setDoc).catch((e) => setErr(String(e)));
  }, []);
  return { doc, err };
}

export interface StatDef {
  key: string;
  label: string;
  desc: string;
  per90?: boolean; // a count that can be shown per 90 minutes
  dp?: number;
  low?: boolean; // lower is better (for shading)
  get?: (t: Totals, p?: StatPlayer) => number | null; // derived stats
  pct?: boolean;
}

const v = (t: Totals, k: string) => t[k] ?? 0;
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export const PLAYER_STATS: StatDef[] = [
  { key: "mins", label: "Mins", desc: "Minutes played", dp: 0 },
  { key: "apps", label: "Apps", desc: "Appearances", dp: 0 },
  { key: "starts", label: "Starts", desc: "Starts", dp: 0 },
  { key: "pts", label: "Pts", desc: "FPL points", per90: true, dp: 0 },
  { key: "ppg", label: "Pts/app", desc: "FPL points per appearance", dp: 2, get: (t) => ratio(v(t, "pts"), v(t, "apps")) },
  { key: "g", label: "G", desc: "Goals", per90: true, dp: 0 },
  { key: "a", label: "A", desc: "Assists (FPL)", per90: true, dp: 0 },
  { key: "gi", label: "G+A", desc: "Goals + assists", per90: true, dp: 0, get: (t) => v(t, "g") + v(t, "a") },
  { key: "uxg", label: "xG", desc: "Expected goals (Understat)", per90: true, dp: 2 },
  { key: "npxg", label: "npxG", desc: "Non-penalty expected goals (Understat)", per90: true, dp: 2 },
  { key: "uxa", label: "xA", desc: "Expected assists (Understat)", per90: true, dp: 2 },
  { key: "uxgi", label: "xGI", desc: "xG + xA (Understat)", per90: true, dp: 2, get: (t) => v(t, "uxg") + v(t, "uxa") },
  { key: "gmxg", label: "G−xG", desc: "Goals minus expected goals: finishing over/under-performance", dp: 2, get: (t) => v(t, "g") - v(t, "uxg") },
  { key: "shots", label: "Shots", desc: "Shots (Understat)", per90: true, dp: 0 },
  { key: "sot", label: "SoT", desc: "Shots on target (goals + saved)", per90: true, dp: 0 },
  { key: "sotp", label: "SoT%", desc: "Share of shots on target", pct: true, get: (t) => ratio(v(t, "sot"), v(t, "shots")) },
  { key: "conv", label: "Conv%", desc: "Goals per shot", pct: true, get: (t) => ratio(v(t, "g"), v(t, "shots")) },
  { key: "xgps", label: "xG/shot", desc: "Average shot quality (non-penalty xG per shot)", dp: 3, get: (t) => ratio(v(t, "npxg"), v(t, "shots")) },
  { key: "big", label: "Big ch.", desc: "Shots with xG ≥ 0.3", per90: true, dp: 0 },
  { key: "kp", label: "KP", desc: "Key passes: shots set up (Understat)", per90: true, dp: 0 },
  { key: "xgchain", label: "xGChain", desc: "xG of every attack the player was involved in", per90: true, dp: 2 },
  { key: "xgbuildup", label: "xGBuildup", desc: "xGChain without the shot and the key pass", per90: true, dp: 2 },
  { key: "fxg", label: "FPL xG", desc: "FPL's expected goals (Opta)", per90: true, dp: 2 },
  { key: "fxa", label: "FPL xA", desc: "FPL's expected assists (Opta)", per90: true, dp: 2 },
  { key: "cs", label: "CS", desc: "Clean sheets (FPL, 60+ minutes)", dp: 0 },
  { key: "gc", label: "GC", desc: "Goals conceded while on the pitch", per90: true, dp: 0, low: true },
  { key: "fxgc", label: "xGC", desc: "Expected goals conceded while on the pitch (FPL)", per90: true, dp: 2, low: true },
  { key: "cbi", label: "CBI", desc: "Clearances, blocks, interceptions", per90: true, dp: 0 },
  { key: "tkl", label: "Tkl", desc: "Tackles", per90: true, dp: 0 },
  { key: "rec", label: "Rec", desc: "Ball recoveries", per90: true, dp: 0 },
  { key: "dc", label: "DefCon", desc: "Defensive contributions (FPL count)", per90: true, dp: 0 },
  { key: "dc_hits", label: "DC hits", desc: "Matches reaching the defensive-contribution threshold (DEF 10, MID/FWD 12) = 2 pts", dp: 0 },
  { key: "saves", label: "Saves", desc: "Saves", per90: true, dp: 0 },
  { key: "gp", label: "G prevented", desc: "xGC minus goals conceded (keepers: shot-stopping above expectation)", dp: 2, get: (t) => v(t, "fxgc") - v(t, "gc") },
  { key: "pen_saved", label: "Pen sv", desc: "Penalties saved", dp: 0 },
  { key: "bonus", label: "Bonus", desc: "Bonus points", per90: true, dp: 0 },
  { key: "bps", label: "BPS", desc: "Bonus points system score", per90: true, dp: 0 },
  { key: "ict", label: "ICT", desc: "FPL ICT index", per90: true, dp: 1 },
  { key: "inf", label: "Influence", desc: "FPL influence", per90: true, dp: 1 },
  { key: "cre", label: "Creativity", desc: "FPL creativity", per90: true, dp: 1 },
  { key: "thr", label: "Threat", desc: "FPL threat", per90: true, dp: 1 },
  { key: "yc", label: "YC", desc: "Yellow cards", dp: 0, low: true },
  { key: "rc", label: "RC", desc: "Red cards", dp: 0, low: true },
  { key: "price", label: "£m", desc: "Current price", dp: 1, get: (_t, p) => p?.price ?? null },
  { key: "own", label: "Own%", desc: "Selected by % of managers", dp: 1, get: (_t, p) => p?.own ?? null },
  { key: "form", label: "Form", desc: "FPL form (average points over the last 30 days)", dp: 1, get: (_t, p) => p?.form ?? null },
];
export const STAT = new Map(PLAYER_STATS.map((s) => [s.key, s]));

export const GROUPS: Record<string, string[]> = {
  Overview: ["mins", "apps", "pts", "ppg", "g", "a", "uxg", "uxa", "bonus", "price", "own"],
  Shooting: ["shots", "sot", "sotp", "big", "g", "npxg", "uxg", "gmxg", "xgps", "conv"],
  Creating: ["a", "uxa", "fxa", "kp", "xgchain", "xgbuildup", "cre"],
  Defending: ["mins", "cs", "gc", "fxgc", "cbi", "tkl", "rec", "dc", "dc_hits"],
  Goalkeeping: ["mins", "saves", "gc", "fxgc", "gp", "cs", "pen_saved", "bonus"],
  FPL: ["pts", "ppg", "bonus", "bps", "ict", "inf", "cre", "thr", "fxg", "fxa", "yc", "price", "own", "form"],
};

/** Value of a stat for a player in a window, optionally per 90 minutes. */
export function statValue(p: StatPlayer, w: Window, key: string, per90: boolean): number | null {
  const d = STAT.get(key)!;
  const t = p.s[w];
  const x = d.get ? d.get(t, p) : t[key] ?? null;
  if (x === null || !Number.isFinite(x)) return null;
  if (per90 && d.per90) {
    const m = t.mins ?? 0;
    return m > 0 ? (x * 90) / m : null;
  }
  return x;
}

export function fmtStat(key: string, x: number | null, per90: boolean) {
  if (x === null) return "–";
  const d = STAT.get(key);
  if (d?.pct) return `${(100 * x).toFixed(0)}%`;
  const dp = per90 && d?.per90 ? Math.max(2, d?.dp ?? 2) : d?.dp ?? 2;
  return x.toFixed(dp);
}

export interface TeamStatDef { key: string; label: string; desc: string; dp: number; low?: boolean; get?: (t: Totals) => number | null; perGame?: boolean }
export const TEAM_STATS: TeamStatDef[] = [
  { key: "mp", label: "MP", desc: "Matches played", dp: 0 },
  { key: "pts", label: "Pts", desc: "League points", dp: 0, perGame: true },
  { key: "xpts", label: "xPts", desc: "Expected points from the chances created and conceded (Understat)", dp: 1, perGame: true },
  { key: "luck", label: "Pts−xPts", desc: "Points above expectation", dp: 1, get: (t) => v(t, "pts") - v(t, "xpts") },
  { key: "gf", label: "GF", desc: "Goals for", dp: 0, perGame: true },
  { key: "xg", label: "xG", desc: "Expected goals for", dp: 1, perGame: true },
  { key: "ga", label: "GA", desc: "Goals against", dp: 0, low: true, perGame: true },
  { key: "xga", label: "xGA", desc: "Expected goals against", dp: 1, low: true, perGame: true },
  { key: "npxgd", label: "npxGD", desc: "Non-penalty expected goal difference", dp: 1, perGame: true, get: (t) => v(t, "npxg") - v(t, "npxga") },
  { key: "cs", label: "CS", desc: "Clean sheets", dp: 0 },
  { key: "ppda", label: "PPDA", desc: "Opponent passes per defensive action: lower = more pressing", dp: 1, low: true },
  { key: "oppda", label: "PPDA allowed", desc: "Own passes per opponent defensive action: higher = pressed less", dp: 1 },
  { key: "deep", label: "Deep", desc: "Passes completed within ~20 m of goal", dp: 0, perGame: true },
  { key: "deep_allowed", label: "Deep allowed", desc: "Opponent deep completions", dp: 0, low: true, perGame: true },
];

export function teamValue(t: StatTeam, w: Window, key: string, perGame: boolean): number | null {
  const d = TEAM_STATS.find((s) => s.key === key)!;
  const x = d.get ? d.get(t.s[w]) : t.s[w][key] ?? null;
  if (x === null) return null;
  const mp = t.s[w].mp ?? 0;
  return perGame && d.perGame && mp > 0 ? x / mp : x;
}

/** Percentile rank (0..1) of x among values (higher = better unless low). */
export function percentile(values: number[], x: number, low = false) {
  if (!values.length) return 0.5;
  let below = 0, eq = 0;
  for (const y of values) { if (y < x) below++; else if (y === x) eq++; }
  const p = (below + 0.5 * eq) / values.length;
  return low ? 1 - p : p;
}
