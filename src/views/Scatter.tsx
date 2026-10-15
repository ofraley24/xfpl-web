import { useMemo, useState } from "react";
import { fixturesIn, fmt, pct, POSITIONS, useApp, useStored } from "../data";
import type { Player, Pos } from "../types";
import { placeLabels, POS_SHAPE, PosMarker, RangePicker } from "../ui";

type YKey = "xp" | "value" | "haul";

export default function Scatter() {
  const { d, from, to, excluded, openPlayer } = useApp();
  const [y, setY] = useStored<YKey>("sc:y", "xp");
  const [show, setShow] = useStored<Pos[]>("sc:pos", ["DEF", "MID", "FWD"]);
  const [hover, setHover] = useState<{ p: Player; x: number; y: number; v: number; h: number } | null>(null);

  const pts = useMemo(() => d.players
    .filter((p) => show.includes(p.pos) && p.fixtures.some((f) => f.gw >= from && f.gw <= to && f.xi))
    .map((p) => {
      const fx = fixturesIn(p, from, to, excluded);
      const xp = fx.reduce((s, f) => s + f.xp, 0);
      const haul = 1 - fx.reduce((s, f) => s * (1 - f.p10), 1);
      return { p, xp, value: xp / p.price, haul };
    }), [d, show, from, to, excluded]);

  const W = 900, H = 520, M = { l: 50, r: 24, t: 16, b: 40 };
  const xs = pts.map((r) => r.p.price), ys = pts.map((r) => r[y]);
  const x0 = Math.floor(Math.min(...xs, 4)), x1 = Math.ceil(Math.max(...xs, 6));
  const y0 = 0, y1 = Math.max(...ys, 1) * 1.05;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const yTicks = Array.from({ length: 6 }, (_, i) => y0 + (i * (y1 - y0)) / 5);
  const label = { xp: `xP GW${from}–${to}`, value: "xP per £m", haul: "chance of a 10+ haul" }[y];
  // label the standouts: best in each position on the chosen axis
  const stars = new Set(POSITIONS.flatMap((pos) => pts.filter((r) => r.p.pos === pos).sort((a, b) => b[y] - a[y]).slice(0, 4).map((r) => r.p.id)));

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Haul map</h2>
            <p className="sub">Every probable starter by price. Marker size = ownership, shading = chance of a 10+ haul, shape = position. Hunt the
              big, bright bubbles low on price for value, the small ones for differentials. Click one to open the player.</p>
          </div>
          <RangePicker />
        </div>
        <div className="row">
          <div className="seg">
            {(["xp", "value", "haul"] as const).map((k) => <button key={k} className={y === k ? "on" : ""} onClick={() => setY(k)}>{{ xp: "xP", value: "xP/£m", haul: "haul %" }[k]}</button>)}
          </div>
          <div className="seg">
            {POSITIONS.map((pos) => (
              <button key={pos} className={show.includes(pos) ? "on" : ""}
                onClick={() => setShow(show.includes(pos) ? show.filter((x) => x !== pos) : [...show, pos])}>{pos}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 600, height: "auto" }} role="img" aria-label={`${label} against price`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" />
              <text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{y === "haul" ? pct(t) : fmt(t, y === "value" ? 1 : 0)}</text>
            </g>
          ))}
          {Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).map((t) => (
            <text key={t} x={sx(t)} y={H - M.b + 16} textAnchor="middle">£{t}m</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">price</text>
          <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>{label}</text>
          {pts.map((r) => (
            <PosMarker key={r.p.id} pos={r.p.pos} x={sx(r.p.price)} y={sy(r[y])} r={3 + Math.sqrt(r.p.own) * 1.6}
              opacity={0.2 + 0.7 * Math.min(1, r.haul / 0.6)}
              onMouseEnter={(e) => setHover({ p: r.p, x: e.clientX, y: e.clientY, v: r[y], h: r.haul })}
              onMouseLeave={() => setHover(null)} onClick={() => openPlayer(r.p.id)} />
          ))}
          {placeLabels(pts.filter((r) => stars.has(r.p.id)).sort((a, b) => b[y] - a[y]), (r) => ({ x: sx(r.p.price), y: sy(r[y]), text: r.p.name }), W).map(({ item: r, x, y: ly, anchor }) => (
            <text key={`l${r.p.id}`} x={x} y={ly} textAnchor={anchor} style={{ fill: "var(--text)", fontWeight: 650 }}>{r.p.name}</text>
          ))}
        </svg>
        <div className="legend">{show.map((p) => <span key={p}><span style={{ color: `var(--pos-${p})` }}>{POS_SHAPE[p]}</span> {p}</span>)}
          <span>size = ownership · opacity = haul chance</span></div>
      </div>
      {hover && (
        <div className="tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <b>{hover.p.name}</b> {d.teams.get(hover.p.team)?.short} · £{fmt(hover.p.price)}m · {fmt(hover.p.own)}% owned<br />
          {label}: <b>{y === "haul" ? pct(hover.v) : fmt(hover.v, 2)}</b> · haul chance {pct(hover.h)}
        </div>
      )}
    </div>
  );
}
