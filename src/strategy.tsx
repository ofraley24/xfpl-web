// Picks scored against a field of managers: shared by Transfer Strategies and the Overview, so both agree on who is a punt.
import { fixtureKey, POSITIONS } from "./data";
import { atLeast, mean, quantile, sumAll } from "./prob";
import type { Player, Pmf } from "./types";
import type { Elite, Tier } from "./views/EliteTable";

export type Field = Tier | "all";
export type Aim = "all" | "protect" | "steady" | "chase";
export type Cls = "template" | "steady" | "punt";

export interface Row {
  p: Player; pm: Pmf; n: number; xp: number; sd: number; floor: number; ceil: number; haul: number; target: number;
  eo: number;           // the field's effective ownership (a multiplier; can exceed 1)
  gain: number;         // xP x (1 - EO): expected points gained on the field by starting him
  cover: number;        // xP x EO: expected points the field scores on him, i.e. what not owning him costs
  swing: number;        // |1 - EO| x SD: typical size of his effect on your points minus the field's
  idx: number | null;   // SD / typical SD for his xP among same-position players (1 = typical; local fit, linear at sparse ends)
  cls: Cls | null;
}

export const TEMPLATE_EO = 0.5;
export const FIELD_LABEL: Record<Field, string> = { top10k: "top 10k", top100k: "top 100k", all: "all managers" };
export const FIELD_BUTTON: Record<Field, string> = { top10k: "Top 10k", top100k: "Top 100k", all: "All managers" };
export const AIM_BUTTON: Record<Aim, string> = { all: "Best gain", protect: "Protect a lead", steady: "Steady differentials", chase: "Chase upside" };
const CLS_LABEL: Record<Cls, string> = { template: "Template", steady: "Steady differential", punt: "Punt" };
const CLS_STYLE: Record<Cls, React.CSSProperties> = {
  template: { background: "var(--panel-2)", color: "var(--muted)" },
  steady: { background: "color-mix(in srgb, var(--heat) 22%, transparent)", color: "var(--text)" },
  punt: { background: "color-mix(in srgb, var(--heat) 55%, transparent)", color: "var(--text)" },
};
const CLS_SHORT: Record<Cls, string> = { template: "Template", steady: "Steady", punt: "Punt" };
export const ClsChip = ({ c, short = false }: { c: Cls | null; short?: boolean }) =>
  (c ? <span className="chip" style={{ ...CLS_STYLE[c], whiteSpace: "nowrap" }} title={CLS_LABEL[c]}>{(short ? CLS_SHORT : CLS_LABEL)[c]}</span> : <span className="faint">–</span>);
export const signed = (x: number, dp = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(dp)}`;
export const vsTypical = (idx: number) => `${idx >= 1 ? "+" : "−"}${Math.abs(100 * (idx - 1)).toFixed(0)}%`;

/** A player's points distribution over gameweeks [from, to] (fixtures summed; independent across fixtures). */
function rangePmf(p: Player, from: number, to: number, excluded: Set<string>): { pm: Pmf; n: number } | null {
  const fx = p.fixtures.filter((f) => f.gw >= from && f.gw <= to && !excluded.has(fixtureKey(p.id, f.fixture)) && f.pmf);
  if (!fx.length) return null;
  return { pm: sumAll(fx.map((f) => f.pmf!)), n: fx.length };
}
const sdOf = (d: Pmf) => {
  const m = mean(d);
  return Math.sqrt(d.p.reduce((s, q, i) => s + q * (d.lo + i - m) ** 2, 0));
};

/** Typical value of f at each x: leave-one-out local linear regression (Gaussian kernel, bandwidth h), keyed by player id.
 *  Undefined (null) where fewer than 5 other rows lie within 2h, so sparse extremes get no comparison. */
export function trend<T extends { p: Player }>(rows: T[], x: (r: T) => number, f: (r: T) => number, h = 0.35) {
  const xs = rows.map(x), ys = rows.map(f);
  const at = (x0: number, skip: number) => {
    let sw = 0, swx = 0, swy = 0, swxx = 0, swxy = 0, near = 0;
    for (let i = 0; i < xs.length; i++) {
      if (i === skip) continue;
      const dx = xs[i] - x0;
      if (Math.abs(dx) <= 2 * h) near++;
      const w = Math.exp(-0.5 * (dx / h) ** 2);
      sw += w; swx += w * dx; swy += w * ys[i]; swxx += w * dx * dx; swxy += w * dx * ys[i];
    }
    if (near < 5 || sw <= 0) return null;
    const det = sw * swxx - swx * swx;
    return det > 1e-12 ? (swxx * swy - swx * swxy) / det : swy / sw;   // intercept at x0
  };
  const typ = new Map<number, number | null>();
  rows.forEach((r, i) => typ.set(r.p.id, at(xs[i], i)));
  return typ;
}

/** Every probable, fit starter over [from, to], scored against the field. Spread is normalised within position across this
 *  whole pool, so filter by price or position afterwards. Without the elite file, or with field "all", EO is overall ownership. */
export function scorePool(o: { players: Player[]; el: Elite | null; field: Field; from: number; to: number; excluded: Set<string>; haulLine: number; target: number }): Row[] {
  const eoOf = new Map<number, number>();
  if (o.el && o.field !== "all") for (const e of o.el.players) eoOf.set(e.id, e[`${o.field}_eo`]);
  const out: Row[] = [];
  for (const p of o.players) {
    if (!p.fixtures.some((f) => f.gw >= o.from && f.gw <= o.to && f.xi)) continue;   // probable starters
    if (p.status !== "a" && !(p.status === "d" && (p.chance_next ?? 0) >= 75)) continue;
    const r = rangePmf(p, o.from, o.to, o.excluded);
    if (!r) continue;
    const xp = mean(r.pm), sd = sdOf(r.pm);
    const eo = o.field === "all" || !o.el ? p.own / 100 : eoOf.get(p.id) ?? 0;   // absent from the elite file: nobody there owns him
    out.push({ p, pm: r.pm, n: r.n, xp, sd, floor: quantile(r.pm, 0.2), ceil: quantile(r.pm, 0.9), haul: atLeast(r.pm, o.haulLine),
      target: atLeast(r.pm, o.target), eo, gain: xp * (1 - eo), cover: xp * eo, swing: Math.abs(1 - eo) * sd, idx: null, cls: null });
  }
  for (const ps of POSITIONS) {
    const rs = out.filter((r) => r.p.pos === ps);
    const typ = trend(rs, (r) => r.xp, (r) => r.sd);
    // where too few players have a similar xP (the top end), fall back to a straight-line fit of SD on xP in the position
    const n = rs.length, mx = rs.reduce((s, r) => s + r.xp, 0) / n, my = rs.reduce((s, r) => s + r.sd, 0) / n;
    const sxx = rs.reduce((s, r) => s + (r.xp - mx) ** 2, 0), b = sxx > 0 ? rs.reduce((s, r) => s + (r.xp - mx) * (r.sd - my), 0) / sxx : 0;
    for (const r of rs) {
      const t = typ.get(r.p.id) ?? (n >= 5 ? my + b * (r.xp - mx) : null);
      r.idx = t != null && t > 0 ? r.sd / t : null;
      r.cls = r.eo >= TEMPLATE_EO ? "template" : r.idx == null ? null : r.idx > 1 ? "punt" : "steady";
    }
  }
  return out;
}

/** The rows an aim shows, in its order: protect = template players by the cost of not owning them; steady / chase = that
 *  class only, by gain / by the chance of the target weighted by how few of the field share it; all = everyone by gain. */
export function forAim(rows: Row[], aim: Aim): Row[] {
  const keep = aim === "protect" ? (r: Row) => r.cls === "template" : aim === "steady" ? (r: Row) => r.cls === "steady"
    : aim === "chase" ? (r: Row) => r.cls === "punt" : () => true;
  const key = aim === "protect" ? (r: Row) => r.cover : aim === "chase" ? (r: Row) => r.target * (1 - r.eo) : (r: Row) => r.gain;
  return rows.filter(keep).sort((a, b) => key(b) - key(a));
}
