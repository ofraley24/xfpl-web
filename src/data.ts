import { createContext, useContext, useEffect, useState } from "react";
import type { Forecast, Player, PlayerFixture, Pos, Team, Fixture, XpMode, Pmf } from "./types";

export const POSITIONS: Pos[] = ["GKP", "DEF", "MID", "FWD"];
export const SQUAD_SHAPE: Record<Pos, number> = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };
export const XI_MIN: Record<Pos, number> = { GKP: 1, DEF: 3, MID: 2, FWD: 1 };
export const XI_MAX: Record<Pos, number> = { GKP: 1, DEF: 5, MID: 5, FWD: 3 };
export const BUDGET = 100;

// 2026-27 scoring (goalkeeper goal = 10). Converts the forecast's expected COUNTS into expected POINTS.
const GOAL: Record<Pos, number> = { GKP: 10, DEF: 6, MID: 5, FWD: 4 };
const CS: Record<Pos, number> = { GKP: 4, DEF: 4, MID: 1, FWD: 0 };

export interface PartPts {
  label: string;
  key: string;
  pts: number;
}

export function partsInPoints(pos: Pos, parts: Record<string, number>): PartPts[] {
  const g = (k: string) => parts[k] ?? 0;
  const rows: PartPts[] = [
    { key: "app", label: "Appearance", pts: g("app") },
    { key: "goals", label: "Goals", pts: g("goals") * GOAL[pos] },
    { key: "assists", label: "Assists", pts: g("assists") * 3 },
    { key: "cs", label: "Clean sheet", pts: g("cs") * CS[pos] },
    { key: "bonus", label: "Bonus", pts: g("bonus") },
    { key: "saves", label: "Saves", pts: g("saves_pts") },
    { key: "dc", label: "Def. contribution", pts: g("dc") * 2 },
    { key: "pen_saved", label: "Pen. saves", pts: g("pen_saved") * 5 },
    { key: "conceded", label: "Goals conceded", pts: g("gc_pts") },
    { key: "cards", label: "Cards", pts: -g("yellow") - 3 * g("red") },
    { key: "other", label: "Own goals, pen. misses", pts: -2 * g("og") - 2 * g("pen_miss") },
    { key: "sub", label: "Substitute appearances", pts: g("sub") }, // full model only (points, not a count)
  ];
  return rows.filter((r) => Math.abs(r.pts) >= 0.005);
}

export const fixtureKey = (pid: number, fixture: number) => `${pid}:${fixture}`;

export interface Derived {
  fc: Forecast;
  teams: Map<number, Team>;
  players: Player[];
  byId: Map<number, Player>;
  fixtures: Map<number, Fixture>;
  gws: number[];
}

export function derive(fc: Forecast): Derived {
  return {
    fc,
    teams: new Map(fc.teams.map((t) => [t.id, t])),
    players: fc.players,
    byId: new Map(fc.players.map((p) => [p.id, p])),
    fixtures: new Map(fc.fixtures.map((f) => [f.id, f])),
    gws: fc.gameweeks,
  };
}

// ---------------------------------------------------------------- xP mode: if he starts / full model
export const hasFullModel = (fc: Forecast) => fc.players.some((p) => p.fixtures.some((f) => f.full));

function pmfMoments(pm: Pmf) {
  let m = 0, m2 = 0;
  pm.p.forEach((q, i) => { const x = pm.lo + i; m += q * x; m2 += q * x * x; });
  return { mean: m, variance: Math.max(m2 - m * m, 0) };
}

/** The forecast as the views see it. "start": unchanged (xP given a start). "full": every fixture's xP,
 *  quantiles, P(5+), P(10+) and distribution replaced by the full model's (start / substitute / no appearance
 *  mixture); the points breakdown becomes P(start) x each start-conditional part plus one "substitute
 *  appearances" part, P(sub) x xP|sub, so it still adds up to the full xP. The epistemic sd is scaled by
 *  P(start) (an approximation: the export has no epistemic split for the mixture); the rest of the mixture's
 *  variance is treated as match luck. */
export function withMode(d: Derived, mode: XpMode): Derived {
  if (mode === "start" || !hasFullModel(d.fc)) return d;
  const players = d.fc.players.map((p) => ({
    ...p,
    fixtures: p.fixtures.map((f): PlayerFixture => {
      if (!f.full) return f;
      const ps = f.p_start ?? 1, pb = f.p_sub ?? 0;
      const parts: Record<string, number> = {};
      for (const [k, v] of Object.entries(f.parts)) parts[k] = ps * v;
      parts.sub = pb * (f.xp_sub ?? 0);
      const sd_epi = ps * f.sd_epi;
      const v = pmfMoments(f.full.pmf).variance;
      // event probabilities: P(start) x P(event | start) + P(sub) x P(event | sub); no appearance contributes nothing
      let probs = f.probs;
      if (f.probs) {
        const sub = f.probs_sub ?? {};
        probs = Object.fromEntries(Object.entries(f.probs).map(([k, v]) => [k, ps * v + pb * ((sub as Record<string, number>)[k] ?? 0)])) as unknown as typeof f.probs;
      }
      return { ...f, probs, xp_start: f.xp, xp: f.full.xp, q10: f.full.q10, q50: f.full.q50, q90: f.full.q90, p5: f.full.p5,
               p10: f.full.p10, pmf: f.full.pmf, parts, sd_epi, var_ale: Math.max(v - sd_epi * sd_epi, 0) };
    }),
  }));
  return derive({ ...d.fc, players });
}

export const XP_LABEL: Record<XpMode, string> = { start: "if starts", full: "full model" };
export const XP_TITLE: Record<XpMode, string> = {
  start: "Expected FPL points if the player starts",
  full: "Expected FPL points over start, substitute appearance and no appearance: P(start) × xP if he starts + P(sub) × xP if he comes on",
};

/** A player's fixtures in [from, to], excluding switched-off fixtures. */
export function fixturesIn(p: Player, from: number, to: number, excluded: Set<string>): PlayerFixture[] {
  return p.fixtures.filter((f) => f.gw >= from && f.gw <= to && !excluded.has(fixtureKey(p.id, f.fixture)));
}

export const rangeXp = (p: Player, from: number, to: number, excluded: Set<string>) =>
  fixturesIn(p, from, to, excluded).reduce((s, f) => s + f.xp, 0);

export const gwXp = (p: Player, gw: number, excluded: Set<string>) => rangeXp(p, gw, gw, excluded);

// ---------------------------------------------------------------- persistent state (per browser)
export function useStored<T>(key: string, initial: T): [T, (v: T | ((old: T) => T)) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`xfpl:${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`xfpl:${key}`, JSON.stringify(v));
    } catch {
      /* storage unavailable: state lives for this visit only */
    }
  }, [key, v]);
  return [v, setV];
}

// ---------------------------------------------------------------- app-wide context
export interface AppState {
  d: Derived;
  from: number;
  to: number;
  setRange: (from: number, to: number) => void;
  excluded: Set<string>;
  toggleFixture: (pid: number, fixture: number) => void;
  openPlayer: (id: number) => void;
  compare: number[];
  toggleCompare: (id: number) => void;
  squad: number[];
  setSquad: (ids: number[]) => void;
  bank: number;
  setBank: (b: number) => void;
  mode: XpMode;
  setMode: (m: XpMode) => void;
  fullAvailable: boolean;
}

export const AppCtx = createContext<AppState | null>(null);
export const useApp = () => {
  const s = useContext(AppCtx);
  if (!s) throw new Error("AppCtx missing");
  return s;
};

export const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "–");
export const pct = (x: number, d = 0) => `${(100 * x).toFixed(d)}%`;
