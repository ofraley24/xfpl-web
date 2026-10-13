import solver from "javascript-lp-solver";
import { BUDGET, POSITIONS, SQUAD_SHAPE, XI_MAX, XI_MIN, gwXp, rangeXp } from "./data";
import type { Player, Pos } from "./types";

export interface GwLineup {
  gw: number;
  xi: Player[];
  bench: Player[];
  captain: Player | null;
  points: number; // XI + captain bonus
}

/** Best XI for one gameweek (FPL formation rules) and captain, by expected points given a start. */
export function bestLineup(squad: Player[], gw: number, excluded: Set<string>, benchedOut = new Set<number>()): GwLineup {
  const val = (p: Player) => (benchedOut.has(p.id) ? 0 : gwXp(p, gw, excluded));
  const byPos = Object.fromEntries(
    POSITIONS.map((pos) => [pos, squad.filter((p) => p.pos === pos).sort((a, b) => val(b) - val(a))]),
  ) as Record<Pos, Player[]>;
  const xi: Player[] = [];
  for (const pos of POSITIONS) xi.push(...byPos[pos].slice(0, XI_MIN[pos]));
  const rest = POSITIONS.filter((p) => p !== "GKP")
    .flatMap((pos) => byPos[pos].slice(XI_MIN[pos], XI_MAX[pos]))
    .sort((a, b) => val(b) - val(a));
  xi.push(...rest.slice(0, 11 - xi.length));
  const bench = squad.filter((p) => !xi.includes(p));
  const captain = xi.reduce<Player | null>((c, p) => (!c || val(p) > val(c) ? p : c), null);
  const points = xi.reduce((s, p) => s + val(p), 0) + (captain ? val(captain) : 0);
  return { gw, xi, bench, captain, points };
}

export function squadProblems(squad: Player[], bank: number): string[] {
  const out: string[] = [];
  for (const pos of POSITIONS) {
    const n = squad.filter((p) => p.pos === pos).length;
    if (n !== SQUAD_SHAPE[pos]) out.push(`${pos}: ${n} of ${SQUAD_SHAPE[pos]}`);
  }
  const clubs = new Map<number, number>();
  squad.forEach((p) => clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1));
  if ([...clubs.values()].some((n) => n > 3)) out.push("more than 3 players from one club");
  const cost = squad.reduce((s, p) => s + p.price, 0);
  if (cost > BUDGET + bank + 1e-9) out.push(`over budget by £${(cost - BUDGET - bank).toFixed(1)}m`);
  return out;
}

export interface OptimiseOptions {
  players: Player[];
  from: number;
  to: number;
  excluded: Set<string>;
  budget: number;
  locked: Set<number>;
  banned: Set<number>;
  benchWeight: number; // value of a bench player's xP relative to a starter's (bench cover)
  maxPool?: number;
}

/**
 * Dream team: 15 players (2/5/5/3, <= 3 per club, within budget) maximising the starting XI's expected points over
 * the range + benchWeight x the bench's. One XI is chosen for the whole range (a simplification: real managers
 * re-pick weekly). Integer program solved in the browser.
 */
export function optimise(o: OptimiseOptions): { squad: Player[]; xi: Player[]; value: number } | null {
  const val = new Map(o.players.map((p) => [p.id, rangeXp(p, o.from, o.to, o.excluded)]));
  // candidate pool: locked players + the best by value and by value per £m in each position
  const pool = new Set<number>(o.locked);
  const per = o.maxPool ?? 30;
  for (const pos of POSITIONS) {
    const ps = o.players.filter((p) => p.pos === pos && !o.banned.has(p.id));
    [...ps].sort((a, b) => val.get(b.id)! - val.get(a.id)!).slice(0, per).forEach((p) => pool.add(p.id));
    [...ps].sort((a, b) => val.get(b.id)! / b.price - val.get(a.id)! / a.price).slice(0, per).forEach((p) => pool.add(p.id));
    [...ps].sort((a, b) => a.price - b.price).slice(0, 4).forEach((p) => pool.add(p.id)); // cheapest bench fodder
  }
  const cand = o.players.filter((p) => pool.has(p.id));
  const constraints: Record<string, { min?: number; max?: number; equal?: number }> = {
    budget: { max: o.budget },
    xi: { equal: 11 },
  };
  for (const pos of POSITIONS) {
    constraints[`n_${pos}`] = { equal: SQUAD_SHAPE[pos] };
    constraints[`xi_${pos}`] = { min: XI_MIN[pos], max: XI_MAX[pos] };
  }
  const variables: Record<string, Record<string, number>> = {};
  const ints: Record<string, 1> = {};
  for (const p of cand) {
    const club = `club_${p.team}`;
    constraints[club] = { max: 3 };
    const v = val.get(p.id)!;
    const one = `one_${p.id}`;
    constraints[one] = o.locked.has(p.id) ? { equal: 1 } : { max: 1 };
    variables[`s_${p.id}`] = { value: v, budget: p.price, xi: 1, [`n_${p.pos}`]: 1, [`xi_${p.pos}`]: 1, [club]: 1, [one]: 1 };
    variables[`b_${p.id}`] = { value: v * o.benchWeight, budget: p.price, [`n_${p.pos}`]: 1, [club]: 1, [one]: 1 };
    ints[`s_${p.id}`] = 1;
    ints[`b_${p.id}`] = 1;
  }
  const res = solver.Solve({ optimize: "value", opType: "max", constraints, variables, ints });
  if (!res.feasible) return null;
  const pick = (prefix: string) => cand.filter((p) => Number(res[`${prefix}_${p.id}`] ?? 0) > 0.5);
  const xi = pick("s");
  const squad = [...xi, ...pick("b")];
  return { squad, xi, value: xi.reduce((s, p) => s + val.get(p.id)!, 0) };
}
