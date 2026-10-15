// Figures for the method pages. Thin marks, recessive axes, direct labels, a hover layer on every mark.
import { useState, type ReactNode } from "react";
import type { EvidenceSet, Ratio } from "./evidence";

type Tip = { x: number; y: number; body: ReactNode } | null;
function useTip() {
  const [tip, setTip] = useState<Tip>(null);
  const on = (body: ReactNode) => (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, body });
  const off = () => setTip(null);
  const node = tip && <div className="tooltip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.body}</div>;
  return { on, off, node };
}
const f = (x: number | null | undefined, d = 2) => (x == null ? "–" : x.toFixed(d));

function ticks(lo: number, hi: number, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n)));
  const s = [1, 2, 2.5, 5, 10].map((m) => m * step).find((st) => (hi - lo) / st <= n) ?? step * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(+v.toFixed(6));
  return out;
}

/** Reliability: mean actual points against mean predicted xP per quantile bin, with 95% intervals. */
export function ReliabilityChart({ sets }: { sets: { key: string; label: string; data: EvidenceSet["reliability"]; color: string }[] }) {
  const t = useTip();
  const W = 520, H = 360, M = { l: 46, r: 14, t: 12, b: 40 };
  const all = sets.flatMap((s) => s.data.flatMap((b) => [b.pred, b.lo, b.hi]));
  const lo = Math.floor(Math.min(...all)), hi = Math.ceil(Math.max(...all));
  const sx = (v: number) => M.l + ((v - lo) / (hi - lo)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - lo) / (hi - lo)) * (H - M.t - M.b);
  const tk = ticks(lo, hi, 6);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 560, height: "auto" }} role="img" aria-label="Reliability diagram">
        {tk.map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" />
          <text x={M.l - 6} y={sy(v) + 4} textAnchor="end">{v}</text><text x={sx(v)} y={H - M.b + 16} textAnchor="middle">{v}</text></g>)}
        <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} stroke="var(--faint)" strokeDasharray="5 4" />
        <text x={sx(hi) - 4} y={sy(hi) + 14} textAnchor="end">actual = predicted</text>
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">predicted xP (mean of bin)</text>
        <text x={12} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>actual points (mean of bin)</text>
        {sets.map((s, k) => s.data.map((b, i) => {
          const dx = (k - (sets.length - 1) / 2) * 3;
          return (
            <g key={`${s.key}${i}`} onMouseMove={t.on(<><b>{s.label}</b><br />predicted {f(b.pred)} · actual {f(b.obs)}<br />95% interval {f(b.lo)}–{f(b.hi)} · {b.n.toLocaleString()} starts</>)} onMouseLeave={t.off}>
              <line x1={sx(b.pred) + dx} x2={sx(b.pred) + dx} y1={sy(b.lo)} y2={sy(b.hi)} stroke={s.color} strokeWidth={1.5} opacity={0.55} />
              <circle cx={sx(b.pred) + dx} cy={sy(b.obs)} r={4} fill={s.color} stroke="var(--panel)" strokeWidth={1.5} />
              <circle cx={sx(b.pred) + dx} cy={sy(b.obs)} r={10} fill="transparent" />
            </g>
          );
        }))}
      </svg>
      {sets.length > 1 && <div className="legend">{sets.map((s) => <span key={s.key}><i className="dotkey" style={{ background: s.color }} />{s.label}</span>)}</div>}
      {t.node}
    </div>
  );
}

/** Randomised PIT histogram: flat at 1 means the predictive distributions are calibrated. */
export function PitChart({ hist, color }: { hist: number[]; color: string }) {
  const t = useTip();
  const W = 460, H = 220, M = { l: 40, r: 10, t: 12, b: 36 };
  const top = Math.max(1.4, ...hist);
  const bw = (W - M.l - M.r) / hist.length;
  const sy = (v: number) => H - M.b - (v / top) * (H - M.t - M.b);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 500, height: "auto" }} role="img" aria-label="PIT histogram">
        {[0, 0.5, 1].map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" /><text x={M.l - 6} y={sy(v) + 4} textAnchor="end">{v}</text></g>)}
        {hist.map((h, i) => (
          <g key={i} onMouseMove={t.on(<>PIT {(i / 10).toFixed(1)}–{((i + 1) / 10).toFixed(1)}: density <b>{h.toFixed(3)}</b> (ideal 1)</>)} onMouseLeave={t.off}>
            <rect x={M.l + i * bw + 1} y={sy(h)} width={bw - 2} height={sy(0) - sy(h)} rx={3} fill={color} opacity={0.85} />
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={sy(1)} y2={sy(1)} stroke="var(--text)" strokeDasharray="5 4" />
        <text x={W - M.r} y={sy(1) - 6} textAnchor="end">ideal</text>
        {[0, 0.5, 1].map((v) => <text key={`x${v}`} x={M.l + v * (W - M.l - M.r)} y={H - M.b + 16} textAnchor="middle">{v}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">where the actual score fell in its predicted distribution</text>
      </svg>
      {t.node}
    </div>
  );
}

/** Ratios (actual / predicted) as dots on a log-free linear scale around 1, with optional 95% intervals. */
export function RatioChart({ rows, lo = 0.8, hi = 1.2 }: { rows: { label: string; series: { name: string; color: string; r: number; lo?: number | null; hi?: number | null }[] }[]; lo?: number; hi?: number }) {
  const t = useTip();
  const names = [...new Set(rows.flatMap((r) => r.series.map((s) => s.name)))];
  const colors = Object.fromEntries(rows.flatMap((r) => r.series.map((s) => [s.name, s.color])));
  const rowH = 30, W = 560, L = 170, R = 20, H = rows.length * rowH + 34;
  const sx = (v: number) => L + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (W - L - R);
  const tk = ticks(lo, hi, 4);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, height: "auto" }} role="img" aria-label="Calibration ratios">
        {tk.map((v) => <g key={v}><line x1={sx(v)} x2={sx(v)} y1={4} y2={H - 26} stroke={v === 1 ? "var(--text)" : "var(--line)"} strokeDasharray={v === 1 ? "5 4" : undefined} />
          <text x={sx(v)} y={H - 10} textAnchor="middle">{v === 1 ? "1 = calibrated" : v.toFixed(2)}</text></g>)}
        {rows.map((r, i) => {
          const y = 18 + i * rowH;
          return (
            <g key={r.label}>
              <text x={L - 10} y={y + 4} textAnchor="end" style={{ fill: "var(--text)", fontSize: 12 }}>{r.label}</text>
              {r.series.map((s, k) => {
                const yy = y + (k - (r.series.length - 1) / 2) * 7;
                return (
                  <g key={s.name} onMouseMove={t.on(<><b>{r.label}</b> · {s.name}<br />actual / predicted <b>{s.r.toFixed(3)}</b>{s.lo != null && s.hi != null ? <> (95%: {s.lo.toFixed(3)}–{s.hi.toFixed(3)})</> : null}</>)} onMouseLeave={t.off}>
                    {s.lo != null && s.hi != null && <line x1={sx(s.lo)} x2={sx(s.hi)} y1={yy} y2={yy} stroke={s.color} strokeWidth={2} opacity={0.45} strokeLinecap="round" />}
                    <circle cx={sx(s.r)} cy={yy} r={4.5} fill={s.color} stroke="var(--panel)" strokeWidth={1.5} />
                    <rect x={L} y={yy - 7} width={W - L - R} height={14} fill="transparent" />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {names.length > 1 && <div className="legend">{names.map((n) => <span key={n}><i className="dotkey" style={{ background: colors[n] }} />{n}</span>)}</div>}
      {t.node}
    </div>
  );
}

/** One measure over horizons 1..8 (single series, direct-labelled ends). */
export function HorizonChart({ pts, label, fmt, domain }: { pts: { h: number; v: number }[]; label: string; fmt: (v: number) => string; domain: [number, number] }) {
  const t = useTip();
  const W = 420, H = 200, M = { l: 50, r: 16, t: 14, b: 34 };
  const sx = (h: number) => M.l + ((h - 1) / 7) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - domain[0]) / (domain[1] - domain[0])) * (H - M.t - M.b);
  const tk = ticks(domain[0], domain[1], 4);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 460, height: "auto" }} role="img" aria-label={label}>
        {tk.map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--line)" /><text x={M.l - 6} y={sy(v) + 4} textAnchor="end">{fmt(v)}</text></g>)}
        {pts.map((p) => <text key={`x${p.h}`} x={sx(p.h)} y={H - M.b + 16} textAnchor="middle">{p.h}</text>)}
        <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">gameweeks ahead of the deadline</text>
        <polyline fill="none" stroke="var(--series-1)" strokeWidth={2} points={pts.map((p) => `${sx(p.h)},${sy(p.v)}`).join(" ")} />
        {pts.map((p) => (
          <g key={p.h} onMouseMove={t.on(<>{p.h} gameweek{p.h > 1 ? "s" : ""} ahead: <b>{fmt(p.v)}</b></>)} onMouseLeave={t.off}>
            <circle cx={sx(p.h)} cy={sy(p.v)} r={4} fill="var(--series-1)" stroke="var(--panel)" strokeWidth={1.5} />
            <circle cx={sx(p.h)} cy={sy(p.v)} r={12} fill="transparent" />
          </g>
        ))}
        <text x={sx(1) + 6} y={sy(pts[0].v) - 8} style={{ fill: "var(--text)", fontWeight: 600 }}>{fmt(pts[0].v)}</text>
        <text x={sx(8)} y={sy(pts[pts.length - 1].v) - 8} textAnchor="end" style={{ fill: "var(--text)", fontWeight: 600 }}>{fmt(pts[pts.length - 1].v)}</text>
      </svg>
      {t.node}
    </div>
  );
}

export const ratioOf = (r: Ratio) => ({ r: r.ratio, lo: r.lo, hi: r.hi });
