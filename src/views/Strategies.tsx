import { Tooltip } from "../Tooltip";
import { useMemo, useState } from "react";
import { fmt, pct, POSITIONS, useApp, useStored, XP_TITLE } from "../data";
import { useJson } from "../evidence";
import { AIM_BUTTON, ClsChip, FIELD_BUTTON, FIELD_LABEL, forAim, scorePool, signed, TEMPLATE_EO, vsTypical, type Aim, type Cls, type Field, type Row } from "../strategy";
import type { Pos } from "../types";
import { placeLabels, PlayerName, PlayerSearch, PmfBars, POS_SHAPE, PosChip, PosMarker, StatusChip, TeamShort } from "../ui";
import { EliteTable, type Elite } from "./EliteTable";

export default function Strategies() {
  const { d, excluded, mode: xpMode } = useApp();
  const { v: el, err } = useJson<Elite>("./data/elite_ownership.json");
  const first = d.gws[0];
  const [span, setSpan] = useStored<number>("rk:span", 1);
  const [mode, setMode] = useStored<Aim>("ts:mode", "all");
  const [fieldRaw, setField] = useStored<Field>("ts:field", "top10k");
  const [pos, setPos] = useStored<Pos | "ALL">("rk:pos", "ALL");
  const [maxPrice, setMaxPrice] = useStored<number>("rk:maxprice", 16);
  const to = Math.min(d.gws[d.gws.length - 1], first + span - 1);
  const haulLine = 10 * span;                      // a "haul" scaled to the window: 10 per gameweek
  const [targetRaw, setTarget] = useStored<number>("rk:target", 10);
  const target = Math.max(2, Math.min(targetRaw, 15 * span));
  const field: Field = el ? fieldRaw : "all";

  const pool = useMemo(() => scorePool({ players: d.players, el, field, from: first, to, excluded, haulLine, target }),
    [d, el, field, first, to, excluded, haulLine, target]);

  const rows = useMemo(() => pool.filter((r) => (pos === "ALL" || r.p.pos === pos) && r.p.price <= maxPrice + 1e-9), [pool, pos, maxPrice]);
  const shown = useMemo(() => forAim(rows, mode), [rows, mode]);

  const fieldName = FIELD_LABEL[field];
  const stale = el && el.gw < d.fc.deadline_gw;
  const tpl = Math.round(100 * TEMPLATE_EO);
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="panel">
        <h2>Transfer Strategies</h2>
        <p className="sub">Your rank moves on the gap between your points and everyone else's, so how risky a player is depends on who else owns him.
          A boom-or-bust player the whole field owns barely moves you; the same player at 5% ownership is a real bet. Every pick here is
          scored against the {fieldName}: what he gains you on average, and how spread out his points are compared with players of the same position and xP.</p>
        <div className="row">
          <div className="seg" title="Who you are competing with">
            {(["top10k", "top100k", "all"] as const).map((k) => (
              <button key={k} className={field === k ? "on" : ""} disabled={k !== "all" && !el} onClick={() => setField(k)}>{FIELD_BUTTON[k]}</button>))}
          </div>
          <div className="seg" title="Window">
            {[1, 2, 3, 4, 6].filter((n) => first + n - 1 <= d.gws[d.gws.length - 1]).map((n) =>
              <button key={n} className={span === n ? "on" : ""} onClick={() => setSpan(n)}>{n === 1 ? `GW${first}` : `GW${first}–${first + n - 1}`}</button>)}
          </div>
          <div className="seg">{(["ALL", ...POSITIONS] as const).map((x) => <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>)}</div>
          <label className="row" style={{ gap: 6 }}><span className="muted">max £{fmt(maxPrice)}m</span>
            <input type="range" min={4} max={16} step={0.1} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} /></label>
        </div>
        <p className="faint" style={{ margin: "8px 0 0", fontSize: 12 }}>
          {field === "all"
            ? <>Against all managers, EO is FPL's overall ownership (no captaincy or bench data){err ? "; the elite ownership file is missing" : ""}.</>
            : <>EO is from gameweek {el!.gw} {fieldName} teams{stale ? ", entered at the last deadline (FPL hides picks until the deadline)" : ""}{span > 1 ? ", held fixed across the window" : ""}.</>}
          {span > 1 && <> Multi-gameweek totals add each fixture's distribution, treating fixtures as independent; single-gameweek probabilities are the validated ones (see the paper).</>}
        </p>
      </div>

      <DiffMap rows={rows} span={span} fieldName={fieldName} />

      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="seg" title="Strategy">
            {(["all", "protect", "steady", "chase"] as const).map((k) =>
              <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{AIM_BUTTON[k]}</button>)}
          </div>
          <span className="muted">{shown.length} players</span>
        </div>
        <p className="sub" style={{ margin: "8px 0 0", fontSize: 13 }}>
          {mode === "all" && <>Every probable starter, by expected points gained on the {fieldName}.</>}
          {mode === "protect" && <>Template players ({tpl}%+ EO), by the expected points the {fieldName} scores on each: the cost of not owning him.
            Owning the template keeps your points close to the field's, which is what a lead needs.</>}
          {mode === "steady" && <>Under {tpl}% EO, with less spread than usual for their position and xP, by gain: ground made up without much added risk.</>}
          {mode === "chase" && <>Under {tpl}% EO, with more spread than usual for their position and xP, by the chance of {target}+ points
            weighted by how little of the {fieldName} shares it: P({target}+) × (1 − EO).</>}
        </p>
        {mode === "chase" && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">Target: at least</span>
            <input type="range" min={2} max={15 * span} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: 220 }} />
            <b className="num">{target} pts</b><span className="muted">{span > 1 ? `over ${span} gameweeks` : "this gameweek"}</span>
          </div>
        )}
      </div>

      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>Player</th><th>Team</th><th className="r">£m</th>
              <th className="r" title={`Effective ownership in the ${fieldName}: the average multiplier on his points across those teams`}>EO</th>
              <th className="r" title={XP_TITLE[xpMode]}>xP</th>
              <th className={`r ${mode === "all" || mode === "steady" ? "sorted" : ""}`} title="xP × (1 − EO): expected points gained on the field by starting him">Gain</th>
              {mode === "protect" && <th className="r sorted" title="xP × EO: expected points the field scores on him, which you miss without him">Cost if not owned</th>}
              <th className="r" title="Spread of outcomes (standard deviation)">Volatility</th>
              <th className="r" title="Volatility relative to the typical volatility for his xP among players in his position (local regression); + is more spread than usual">Spread vs typical</th>
              <th title={`Template: ${tpl}%+ EO. Below that: Punt if more spread than typical, Steady differential if less`}>Class</th>
              <th className="r" title="|1 − EO| × volatility: the typical size of his effect on your points minus the field's">Rank swing</th>
              <th className="r" title="20th percentile of the simulated points: four weeks in five he scores at least this">Bad week<div className="metric-note">20th pct</div></th>
              <th className="r" title="90th percentile of the simulated points: one week in ten he scores at least this">Good week<div className="metric-note">90th pct</div></th>
              {mode === "chase" && <th className="r sorted" title={`Chance of at least ${target} points`}>P({target}+)</th>}
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {shown.slice(0, 40).map((r) => (
              <tr key={r.p.id}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><StatusChip p={r.p} /></div></td>
                <td><TeamShort id={r.p.team} /></td>
                <td className="r num">{fmt(r.p.price)}</td>
                <td className="r num">{fmt(100 * r.eo)}%</td>
                <td className="r num">{fmt(r.xp, 2)}</td>
                <td className="r num"><b>{signed(r.gain)}</b></td>
                {mode === "protect" && <td className="r num"><b>{fmt(r.cover, 2)}</b></td>}
                <td className="r num">{fmt(r.sd)}</td>
                <td className="r num">{r.idx == null ? <span className="faint" title="Too few players with similar xP to compare">–</span> : vsTypical(r.idx)}</td>
                <td><ClsChip c={r.cls} /></td>
                <td className="r num">{fmt(r.swing)}</td>
                <td className="r num">{r.floor}</td>
                <td className="r num">{r.ceil}</td>
                {mode === "chase" && <td className="r num"><b>{pct(r.target)}</b></td>}
                <td style={{ paddingTop: 2, paddingBottom: 0 }}><PmfBars pmf={r.pm} width={150} height={22} maxPts={Math.max(20, 12 * span)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="two">
        <Swaps rows={rows} haulLine={haulLine} />
        <Captains rows={span === 1 ? rows : null} fieldName={fieldName} />
      </div>

      {el ? <EliteTable el={el} tier={field === "all" ? "top10k" : field} />
        : <div className="panel muted">{err ? `No elite ownership file yet (${err}).` : "Loading elite ownership…"}</div>}
    </div>
  );
}

/** Differential map: expected gain on the field against spread relative to position and xP. */
function DiffMap({ rows, span, fieldName }: { rows: Row[]; span: number; fieldName: string }) {
  const { openPlayer } = useApp();
  const [tip, setTip] = useState<{ r: Row; x: number; y: number } | null>(null);
  const pts = rows.filter((r) => r.idx != null);
  if (!pts.length) return null;
  const W = 900, H = 440, M = { l: 56, r: 24, t: 14, b: 42 };
  const xs = pts.map((r) => r.gain), ys = pts.map((r) => r.idx!);
  const x0 = Math.min(0, Math.floor(Math.min(...xs))), x1 = Math.ceil(Math.max(...xs, 1));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) * 10) / 10), y1 = Math.ceil(Math.max(...ys, 1.1) * 10) / 10;
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const byGain = (c: Cls) => pts.filter((r) => r.cls === c).sort((a, b) => b.gain - a.gain).slice(0, 5);
  const punts = byGain("punt"), steady = byGain("steady");
  const hot = new Set([...punts, ...steady].map((r) => r.p.id));
  const labels = placeLabels([...punts, ...steady], (r) => ({ x: sx(r.gain), y: sy(r.idx!), text: r.p.name }), W);
  const yt = Array.from({ length: 6 }, (_, i) => y0 + (i * (y1 - y0)) / 5);
  const xStep = x1 - x0 > 12 ? 2 : 1;
  const xt = Array.from({ length: Math.floor((x1 - x0) / xStep) + 1 }, (_, i) => x0 + i * xStep);
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Differential map{span > 1 ? `, ${span} gameweeks` : ""}</h3>
        <span className="metric-note">x: expected gain on the {fieldName} · y: spread vs typical for position and xP</span>
      </div>
      <p className="sub" style={{ margin: "4px 0 8px", fontSize: 13 }}>Further right gains more on the field on average. Above the dashed line a player's
        points are more spread out than usual for his position and xP (a punt); below it, steadier (a steady differential). Players the field mostly owns sit
        near zero gain whatever their spread.</p>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 600, height: "auto" }} role="img" aria-label="expected gain against relative spread">
          {yt.map((t) => <g key={t}><line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" /><text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{vsTypical(t)}</text></g>)}
          {xt.map((t) => <text key={t} x={sx(t)} y={H - M.b + 16} textAnchor="middle">{t > 0 ? `+${t}` : t}</text>)}
          <line x1={M.l} x2={W - M.r} y1={sy(1)} y2={sy(1)} stroke="var(--text)" strokeDasharray="6 4" opacity={0.6} />
          {x0 < 0 && <line x1={sx(0)} x2={sx(0)} y1={M.t} y2={H - M.b} stroke="var(--line-strong)" />}
          <text x={W - M.r - 4} y={M.t + 14} textAnchor="end" style={{ fill: "var(--faint)", fontWeight: 650 }}>punts</text>
          <text x={W - M.r - 4} y={H - M.b - 8} textAnchor="end" style={{ fill: "var(--faint)", fontWeight: 650 }}>steady differentials</text>
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">expected points gained on the {fieldName}: xP × (1 − EO)</text>
          <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>spread vs typical</text>
          {pts.map((r) => {
            const on = hot.has(r.p.id);
            return <PosMarker key={r.p.id} pos={r.p.pos} x={sx(r.gain)} y={sy(r.idx!)} r={on ? 6 : 4} opacity={on ? 0.95 : 0.22}
              onMouseEnter={(e) => setTip({ r, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)} onClick={() => openPlayer(r.p.id)} />;
          })}
          {labels.map(({ item: r, x, y, anchor }) => <text key={`l${r.p.id}`} x={x} y={y} textAnchor={anchor} style={{ fill: r.cls === "punt" ? "var(--accent)" : "var(--text)", fontWeight: 650 }}>{r.p.name}</text>)}
        </svg>
      </div>
      <div className="legend">{(["GKP", "DEF", "MID", "FWD"] as const).map((p) => <span key={p}><span style={{ color: `var(--pos-${p})` }}>{POS_SHAPE[p]}</span> {p}</span>)}
        <span><i style={{ background: "var(--text)", opacity: 0.6 }} />typical spread for the position and xP</span>
        <span>labelled: top 5 by gain of <span style={{ color: "var(--accent)", fontWeight: 650 }}>punts</span> and of steady differentials</span></div>
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          <b>{tip.r.p.name}</b> · £{fmt(tip.r.p.price)}m · EO {fmt(100 * tip.r.eo)}%<br />
          xP {fmt(tip.r.xp, 2)} · gain {signed(tip.r.gain)} · volatility {fmt(tip.r.sd)} ({vsTypical(tip.r.idx!)} vs typical)<br />
          bad week (20th pct) {tip.r.floor} · good week (90th pct) {tip.r.ceil}
          <PmfBars pmf={tip.r.pm} width={220} height={40} maxPts={Math.max(20, 12 * span)} />
        </Tooltip>
      )}
    </div>
  );
}

/** Trade expected points for upside: same-position alternatives in a similar price band. */
function Swaps({ rows, haulLine }: { rows: Row[]; haulLine: number }) {
  const [id, setId] = useState<number | null>(null);
  const base = rows.find((r) => r.p.id === id) ?? null;
  const alts = base ? rows.filter((r) => r.p.pos === base.p.pos && r.p.id !== base.p.id && Math.abs(r.p.price - base.p.price) <= 1.0 && r.haul > base.haul)
    .sort((a, b) => (b.haul - base.haul) / Math.max(0.05, base.xp - b.xp) - (a.haul - base.haul) / Math.max(0.05, base.xp - a.xp)).slice(0, 8) : [];
  return (
    <div className="panel">
      <h3>Upside swaps</h3>
      <p className="sub" style={{ fontSize: 13 }}>Pick a player; see same-position alternatives within £1m that raise the chance of a
        {` ${haulLine}+`} haul, what each costs in expected points, and how their EO compares.</p>
      <div className="row"><PlayerSearch onPick={(p) => setId(p.id)} placeholder="Choose a player…" filter={(p) => rows.some((r) => r.p.id === p.id)} />
        {base && <span><b>{base.p.name}</b> <span className="muted">xP {fmt(base.xp, 2)} · P({haulLine}+) {pct(base.haul)} · EO {fmt(100 * base.eo)}%</span></span>}</div>
      {base && (alts.length ? (
        <table className="plain" style={{ marginTop: 10 }}>
          <thead><tr><th>Instead</th><th className="r">£ diff</th><th className="r">xP cost</th><th className="r">Haul chance</th><th className="r">EO</th></tr></thead>
          <tbody>{alts.map((r) => (
            <tr key={r.p.id}>
              <td><PlayerName p={r.p} /> <span className="faint"><TeamShort id={r.p.team} /></span></td>
              <td className="r">{signed(r.p.price - base.p.price, 1)}</td>
              <td className="r">{signed(r.xp - base.xp)}</td>
              <td className="r" style={{ color: "var(--accent)", fontWeight: 650 }}>+{fmt(100 * (r.haul - base.haul), 0)} pts</td>
              <td className="r">{fmt(100 * r.eo)}%</td>
            </tr>))}</tbody>
        </table>
      ) : <p className="muted" style={{ marginTop: 10 }}>No one in that price band offers more upside.</p>)}
    </div>
  );
}

/** Captains: the chance of a 20+ captain score, and the expected gain on the field from the armband. */
function Captains({ rows, fieldName }: { rows: Row[] | null; fieldName: string }) {
  if (!rows) return <div className="panel"><h3>Captains</h3><p className="muted">Pick a single gameweek to compare captains.</p></div>;
  const top = [...rows].sort((a, b) => b.haul - a.haul).slice(0, 8);
  return (
    <div className="panel">
      <h3>Captains</h3>
      <p className="sub" style={{ fontSize: 13 }}>Ranked by the chance of a 20+ captain score (10+ doubled). Gain is xP × (2 − EO): the expected points
        the armband gains you on the {fieldName}, so a widely captained player can be the likeliest haul and still gain little.</p>
      <table className="plain"><thead><tr><th>Player</th><th className="r">P(20+ as captain)</th><th className="r">Captain xP</th><th className="r">EO</th><th className="r">Gain</th></tr></thead>
        <tbody>{top.map((r) => (
          <tr key={r.p.id}><td><PosChip pos={r.p.pos} /> <PlayerName p={r.p} /></td><td className="r"><b>{pct(r.haul)}</b></td><td className="r">{fmt(2 * r.xp, 1)}</td>
            <td className="r">{fmt(100 * r.eo)}%</td><td className="r">{signed(r.xp * (2 - r.eo))}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
