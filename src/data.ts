import { createContext, useContext, useEffect, useState } from "react";
import type { Forecast, Player, PlayerFixture, Pos, Team, Fixture } from "./types";

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
}

export const AppCtx = createContext<AppState | null>(null);
export const useApp = () => {
  const s = useContext(AppCtx);
  if (!s) throw new Error("AppCtx missing");
  return s;
};

export const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "–");
export const pct = (x: number, d = 0) => `${(100 * x).toFixed(d)}%`;
