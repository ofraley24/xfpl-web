import { useMemo, useState } from "react";
import { fmt, useApp } from "./data";
import type { Player, Pos } from "./types";

/** Sequential (one hue, light -> dark) background for an xP value on a lo..hi scale, with a readable ink. */
export function heat(x: number, hi: number, lo = 2) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return `color-mix(in srgb, var(--seq-5) ${Math.round(t * 100)}%, var(--seq-0))`;
}
export const heatInk = (x: number, hi: number, lo = 2) => ((x - lo) / (hi - lo) > 0.55 ? "#ffffff" : "var(--text)");

/** Position marker: colour plus a shape, so position never depends on colour alone. */
export function PosMarker({ pos, x, y, r, opacity = 0.7, ...rest }: { pos: Pos; x: number; y: number; r: number; opacity?: number } & React.SVGProps<SVGPathElement>) {
  const c = `var(--pos-${pos})`;
  const d = pos === "DEF" ? `M ${x} ${y} m ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
    : pos === "MID" ? `M ${x - r * 0.88} ${y - r * 0.88} h ${1.76 * r} v ${1.76 * r} h ${-1.76 * r} z`
    : pos === "FWD" ? `M ${x} ${y - r * 1.15} L ${x + r * 1.05} ${y + r * 0.75} L ${x - r * 1.05} ${y + r * 0.75} z`
    : `M ${x} ${y - r * 1.15} L ${x + r * 1.05} ${y} L ${x} ${y + r * 1.15} L ${x - r * 1.05} ${y} z`;
  return <path d={d} fill={c} fillOpacity={opacity} stroke={c} strokeWidth={1.2} className="dot" {...rest} />;
}
export const POS_SHAPE: Record<Pos, string> = { GKP: "◆", DEF: "●", MID: "■", FWD: "▲" };

export const PosChip = ({ pos }: { pos: Pos }) => <span className={`chip pos pos-${pos}`}>{pos}</span>;

const STATUS: Record<string, string> = { d: "doubtful", i: "injured", s: "suspended", n: "unavailable", u: "left" };
export function StatusChip({ p }: { p: Player }) {
  if (p.status === "a") return null;
  const label = STATUS[p.status] ?? p.status;
  return (
    <span className={`chip status-${p.status}`} title={p.news || label}>
      {p.chance_next != null ? `${p.chance_next}%` : label}
    </span>
  );
}

export function RangePicker() {
  const { d, from, to, setRange } = useApp();
  const [anchor, setAnchor] = useState<number | null>(null);
  return (
    <div className="range" title="Click a start and an end gameweek">
      <span className="muted">GW</span>
      {d.gws.map((g) => (
        <button
          key={g}
          className={`gwpill ${g >= from && g <= to ? "in" : ""}`}
          onClick={() => {
            if (anchor === null) {
              setAnchor(g);
              setRange(g, g);
            } else {
              setRange(Math.min(anchor, g), Math.max(anchor, g));
              setAnchor(null);
            }
          }}
        >
          {g}
        </button>
      ))}
      <button className="btn small" onClick={() => { setRange(d.gws[0], d.gws[d.gws.length - 1]); setAnchor(null); }}>
        all
      </button>
    </div>
  );
}

export function PlayerName({ p }: { p: Player }) {
  const { openPlayer } = useApp();
  return (
    <span className="pname" onClick={() => openPlayer(p.id)}>
      {p.name}
    </span>
  );
}

export function TeamShort({ id }: { id: number }) {
  const { d } = useApp();
  return <span className="muted">{d.teams.get(id)?.short ?? "?"}</span>;
}

/** Search box returning a player id. */
export function PlayerSearch({ onPick, filter, placeholder = "Search player…" }:
  { onPick: (p: Player) => void; filter?: (p: Player) => boolean; placeholder?: string }) {
  const { d } = useApp();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return d.players
      .filter((p) => (!filter || filter(p)) && (p.name.toLowerCase().includes(s) || p.full_name.toLowerCase().includes(s)
        || (d.teams.get(p.team)?.short.toLowerCase() === s)))
      .slice(0, 12);
  }, [q, d, filter]);
  return (
    <div style={{ position: "relative" }}>
      <input type="text" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} style={{ width: 230 }} />
      {hits.length > 0 && (
        <div className="panel" style={{ position: "absolute", zIndex: 30, top: 36, left: 0, width: 300, padding: 4, boxShadow: "var(--shadow)" }}>
          {hits.map((p) => (
            <div key={p.id} className="row" style={{ padding: "4px 6px", cursor: "pointer", gap: 6 }}
              onClick={() => { onPick(p); setQ(""); }}>
              <PosChip pos={p.pos} /> <b>{p.name}</b> <TeamShort id={p.team} />
              <span className="spacer" /> <span className="num muted">£{fmt(p.price)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Interactive bar histogram of a points distribution: hover a bar for P(exactly x) and P(at least x). */
export function PmfBars({ pmf, width = 220, height = 60, maxPts = 20 }: { pmf: { lo: number; p: number[] }; width?: number; height?: number; maxPts?: number }) {
  const [hover, setHover] = useState<{ i: number; cx: number; cy: number } | null>(null);
  const lo = Math.min(0, pmf.lo);
  const vals: number[] = [];
  for (let x = lo; x <= maxPts; x++) {
    const i = x - pmf.lo;
    vals.push(i >= 0 && i < pmf.p.length ? pmf.p[i] : 0);
  }
  // fold the tail into the last bar
  const tail = pmf.p.slice(Math.max(0, maxPts + 1 - pmf.lo)).reduce((s, p) => s + p, 0);
  vals[vals.length - 1] += tail;
  const atLeast = vals.map((_, i) => vals.slice(i).reduce((s, v) => s + v, 0));
  const top = Math.max(...vals, 1e-9);
  const w = width / vals.length;
  const last = vals.length - 1;
  const pc = (v: number) => (v >= 0.0995 ? `${(100 * v).toFixed(0)}%` : v >= 0.001 ? `${(100 * v).toFixed(1)}%` : "<0.1%");
  const ticks = [0, 2, 5, ...Array.from({ length: Math.floor(maxPts / 5) }, (_, k) => 5 * (k + 2))].filter((x) => x >= lo && x <= maxPts);
  return (
    <span style={{ display: "inline-block", position: "relative" }}>
      <svg width={width} height={height + 14} role="img" aria-label="points distribution" onMouseLeave={() => setHover(null)}>
        {vals.map((v, i) => {
          const x = lo + i;
          const h = (v / top) * height;
          const col = x >= 10 ? "var(--series-4)" : x >= 5 ? "var(--series-3)" : "var(--series-1)";
          const dim = hover !== null && hover.i !== i;
          return (
            <g key={i} onMouseMove={(e) => setHover({ i, cx: e.clientX, cy: e.clientY })}>
              <rect x={i * w} y={0} width={w} height={height} fill="transparent" />
              <rect x={i * w + 0.5} y={height - h} width={Math.max(1, w - 1)} height={Math.max(h, v > 0 ? 1 : 0)} fill={col} rx={1}
                opacity={dim ? 0.45 : 1} />
            </g>
          );
        })}
        {hover && <line x1={hover.i * w + w / 2} x2={hover.i * w + w / 2} y1={0} y2={height} stroke="var(--text)" strokeWidth={0.75} strokeDasharray="2 2" opacity={0.5} pointerEvents="none" />}
        {ticks.map((x) => <text key={x} x={(x - lo) * w + w / 2} y={height + 12} textAnchor="middle">{x}</text>)}
      </svg>
      {hover && (
        <div className="tooltip" style={{ left: hover.cx + 14, top: hover.cy + 14 }}>
          <b>{lo + hover.i}{hover.i === last ? "+" : ""} pts</b>: {pc(vals[hover.i])}
          {hover.i > 0 && hover.i < last && <><br /><span className="muted">{lo + hover.i} or more: {pc(atLeast[hover.i])}</span></>}
        </div>
      )}
    </span>
  );
}

/** Greedy label placement: keep a label only if its box does not overlap one already placed (priority order). */
export function placeLabels<T>(items: T[], pos: (t: T) => { x: number; y: number; text: string }, W: number) {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const out: { item: T; x: number; y: number; anchor: "start" | "end" }[] = [];
  for (const it of items) {
    const p = pos(it);
    const w = p.text.length * 6.4 + 4;
    const right = p.x + 7 + w < W - 8;
    const x0 = right ? p.x + 6 : p.x - 8 - w, x1 = x0 + w, y0 = p.y - 20, y1 = p.y - 6;
    if (boxes.some((b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0)) continue;
    boxes.push({ x0, x1, y0, y1 });
    out.push({ item: it, x: right ? p.x + 6 : p.x - 8, y: p.y - 8, anchor: right ? "start" : "end" });
  }
  return out;
}
