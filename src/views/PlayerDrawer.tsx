import { useEffect } from "react";
import { fixtureKey, fmt, partsInPoints, pct, useApp } from "../data";
import { PmfBars, PosChip, StatusChip } from "../ui";

const PART_COL: Record<string, string> = {
  app: "#8a7896", goals: "var(--pink)", assists: "var(--cyan)", cs: "var(--pos-DEF)", bonus: "var(--gold)", saves: "var(--pos-GKP)",
  dc: "var(--pos-MID)", pen_saved: "#c77dff", conceded: "#666", cards: "#444", other: "#444",
};

export default function PlayerDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { d, excluded, toggleFixture, compare, toggleCompare, from, to } = useApp();
  const p = d.byId.get(id)!;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const team = d.teams.get(p.team);
  const inRange = p.fixtures.filter((f) => f.gw >= from && f.gw <= to && !excluded.has(fixtureKey(p.id, f.fixture)));
  const sum = inRange.reduce((s, f) => s + f.xp, 0);
  // average points breakdown over the range
  const agg = new Map<string, { label: string; pts: number }>();
  inRange.forEach((f) => partsInPoints(p.pos, f.parts).forEach((r) => {
    const o = agg.get(r.key) ?? { label: r.label, pts: 0 };
    o.pts += r.pts;
    agg.set(r.key, o);
  }));
  const parts = [...agg.entries()].sort((a, b) => b[1].pts - a[1].pts);
  const pos = parts.filter(([, v]) => v.pts > 0), posTotal = pos.reduce((s, [, v]) => s + v.pts, 0);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={p.full_name}>
        <button className="btn small close" onClick={onClose}>✕</button>
        <div className="row" style={{ gap: 8 }}><PosChip pos={p.pos} /><span className="muted">{team?.name}</span><StatusChip p={p} /></div>
        <h2 style={{ marginTop: 6 }}>{p.full_name}</h2>
        <div className="row muted">£{fmt(p.price)}m · owned by {fmt(p.own)}% ·
          <button className="btn small" onClick={() => toggleCompare(p.id)}>{compare.includes(p.id) ? "remove from compare" : "add to compare"}</button>
        </div>
        {p.news && <div className="banner" style={{ marginTop: 10 }}><span>📰</span><span>{p.news}</span></div>}

        <div className="kpis" style={{ marginTop: 12 }}>
          <div className="kpi"><div className="v num">{fmt(sum)}</div><div className="l">xP GW{from}–{to} ({inRange.length} fixtures)</div></div>
          <div className="kpi"><div className="v num">{fmt(sum / p.price, 2)}</div><div className="l">xP per £m</div></div>
        </div>

        {posTotal > 0 && (
          <div style={{ marginTop: 14 }}>
            <h3>Where the points come from (GW{from}–{to})</h3>
            <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden" }}>
              {pos.map(([k, v]) => <div key={k} title={`${v.label}: ${v.pts.toFixed(2)}`} style={{ width: `${(100 * v.pts) / posTotal}%`, background: PART_COL[k] ?? "#888" }} />)}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 6, fontSize: 12 }}>
              {parts.map(([k, v]) => (
                <span key={k}><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: PART_COL[k] ?? "#888" }} /> {v.label} <b className="num">{v.pts >= 0 ? "" : "−"}{fmt(Math.abs(v.pts))}</b></span>
              ))}
            </div>
          </div>
        )}

        <h3 style={{ marginTop: 18 }}>Fixtures</h3>
        <div className="grid" style={{ gap: 8 }}>
          {p.fixtures.map((f) => {
            const off = excluded.has(fixtureKey(p.id, f.fixture));
            const opp = d.teams.get(f.opp);
            return (
              <div key={f.fixture} className="kpi" style={{ opacity: off ? 0.45 : 1 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span><b>GW{f.gw}</b> {f.home ? "vs" : "@"} {opp?.name} <span className="faint">{new Date(f.kickoff).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></span>
                  <span className="row" style={{ gap: 6 }}>
                    <b className="num" style={{ fontSize: 18 }}>{fmt(f.xp, 2)}</b>
                    <button className="btn small" onClick={() => toggleFixture(p.id, f.fixture)}>{off ? "switch on" : "switch off"}</button>
                  </span>
                </div>
                <div className="row muted" style={{ fontSize: 12, gap: 12 }}>
                  <span>middle 80%: {fmt(f.q10, 0)}–{fmt(f.q90, 0)} pts</span>
                  <span>5+: {pct(f.p5)}</span><span>10+: {pct(f.p10)}</span>
                  {!f.xi && <span title="Not in the probable XI used for the bonus simulation">bench risk</span>}
                </div>
                {f.pmf && <PmfBars pmf={f.pmf} width={480} height={46} maxPts={20} />}
              </div>
            );
          })}
        </div>
        <p className="faint" style={{ marginTop: 12 }}>All figures assume he starts. Distributions come from 1,000 simulated matches per fixture.</p>
      </aside>
    </>
  );
}
