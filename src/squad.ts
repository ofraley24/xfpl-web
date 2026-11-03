import solver from "javascript-lp-solver";
import { BUDGET, POSITIONS, SQUAD_SHAPE, XI_MAX, XI_MIN, fixturesIn, gwXp, rangeXp } from "./data";
import { mean } from "./prob";
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
  riskWeight?: number; // points of objective per point² of excess variance: < 0 prefers steady players, > 0 boom-or-bust
  maxPool?: number;
}

/**
 * Squad Optimiser: 15 players (2/5/5/3, <= 3 per club, within budget) maximising the starting XI's expected points over
 * the range + benchWeight x the bench's. One XI is chosen for the whole range (a simplification: real managers
 * re-pick weekly). Integer program solved in the browser.
 * With riskWeight λ the objective is xP + λ × excess variance per player: his variance minus the typical variance for his
 * xP in his position (least squares on xP across the candidates). Raw variance rises with xP, so weighting it directly mostly
 * buys or sells xP; the excess picks steadier or more boom-or-bust players at similar xP. Treating players and fixtures as
 * independent, the XI's variance is the sum of its players', so the objective stays linear (team-mates' correlation is ignored).
 */
export function optimise(o: OptimiseOptions): { squad: Player[]; xi: Player[]; value: number; variance: number } | null {
  const lam = o.riskWeight ?? 0;
  const xp = new Map(o.players.map((p) => [p.id, rangeXp(p, o.from, o.to, o.excluded)]));
  const vr = new Map(o.players.map((p) => [p.id, rangeVariance(p, o.from, o.to, o.excluded)]));
  const excess = new Map<number, number>();
  for (const pos of POSITIONS) {
    const ps = o.players.filter((p) => p.pos === pos);
    const n = ps.length, mx = ps.reduce((s, p) => s + xp.get(p.id)!, 0) / n, my = ps.reduce((s, p) => s + vr.get(p.id)!, 0) / n;
    const sxy = ps.reduce((s, p) => s + (xp.get(p.id)! - mx) * (vr.get(p.id)! - my), 0), sxx = ps.reduce((s, p) => s + (xp.get(p.id)! - mx) ** 2, 0);
    const b = sxx > 0 ? sxy / sxx : 0;
    for (const p of ps) excess.set(p.id, vr.get(p.id)! - (my + b * (xp.get(p.id)! - mx)));
  }
  const val = new Map(o.players.map((p) => [p.id, xp.get(p.id)! + lam * excess.get(p.id)!]));
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
  return { squad, xi, value: xi.reduce((s, p) => s + xp.get(p.id)!, 0), variance: xi.reduce((s, p) => s + vr.get(p.id)!, 0) };
}

/** Variance of a player's points over [from, to]: the sum of each fixture's simulated-distribution variance. */
export function rangeVariance(p: Player, from: number, to: number, excluded: Set<string>) {
  return fixturesIn(p, from, to, excluded).reduce((s, f) => {
    if (!f.pmf) return s;
    const m = mean(f.pmf);
    return s + f.pmf.p.reduce((a, q, i) => a + q * (f.pmf!.lo + i - m) ** 2, 0);
  }, 0);
}
