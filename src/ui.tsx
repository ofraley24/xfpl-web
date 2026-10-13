import { useMemo, useState } from "react";
import { fmt, useApp } from "./data";
import type { Player, Pos } from "./types";

/** Background for an xP value: pink (poor) -> neutral -> green (great), on a lo..hi scale. */
export function heat(x: number, hi: number, lo = 2) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t >= 0.4
    ? `color-mix(in srgb, var(--accent) ${Math.round(((t - 0.4) / 0.6) * 80)}%, var(--heat-0))`
    : `color-mix(in srgb, var(--pink) ${Math.round(((0.4 - t) / 0.4) * 55)}%, var(--heat-0))`;
}

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

/** Tiny bar histogram of a points distribution. */
export function PmfBars({ pmf, width = 220, height = 60, maxPts = 20 }: { pmf: { lo: number; p: number[] }; width?: number; height?: number; maxPts?: number }) {
  const lo = Math.min(0, pmf.lo);
  const vals: number[] = [];
  for (let x = lo; x <= maxPts; x++) {
    const i = x - pmf.lo;
    vals.push(i >= 0 && i < pmf.p.length ? pmf.p[i] : 0);
  }
  // fold the tail into the last bar
  const tail = pmf.p.slice(Math.max(0, maxPts + 1 - pmf.lo)).reduce((s, p) => s + p, 0);
  vals[vals.length - 1] += tail;
  const top = Math.max(...vals, 1e-9);
  const w = width / vals.length;
  return (
    <svg width={width} height={height + 14} role="img" aria-label="points distribution">
      {vals.map((v, i) => {
        const x = lo + i;
        const h = (v / top) * height;
        const col = x >= 10 ? "var(--gold)" : x >= 5 ? "var(--accent)" : "var(--cyan)";
        return <rect key={i} x={i * w + 0.5} y={height - h} width={Math.max(1, w - 1)} height={h} fill={col} rx={1}><title>{`${x}${i === vals.length - 1 ? "+" : ""} pts: ${(100 * v).toFixed(1)}%`}</title></rect>;
      })}
      {[0, 2, 5, 10, 15, 20].filter((x) => x >= lo && x <= maxPts).map((x) => (
        <text key={x} x={(x - lo) * w + w / 2} y={height + 12} textAnchor="middle">{x}</text>
      ))}
    </svg>
  );
}
