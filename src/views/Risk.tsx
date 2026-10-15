import { Tooltip } from "../Tooltip";
import { useMemo, useState } from "react";
import { fixtureKey, fmt, pct, POSITIONS, useApp, useStored } from "../data";
import { atLeast, mean, quantile, sumAll } from "../prob";
import type { Player, Pmf, Pos } from "../types";
import { placeLabels, PlayerName, PlayerSearch, PmfBars, POS_SHAPE, PosChip, PosMarker, StatusChip, TeamShort } from "../ui";

type Mode = "protect" | "average" | "chase";

interface Row { p: Player; pm: Pmf; xp: number; sd: number; floor: number; blank: number; ceil: number; haul: number; target: number; n: number }

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

export default function Risk() {
  const { d, excluded } = useApp();
  const first = d.gws[0];
  const [span, setSpan] = useStored<number>("rk:span", 1);
  const [mode, setMode] = useStored<Mode>("rk:mode", "chase");
  const [pos, setPos] = useStored<Pos | "ALL">("rk:pos", "ALL");
  const [maxPrice, setMaxPrice] = useStored<number>("rk:maxprice", 16);
  const to = Math.min(d.gws[d.gws.length - 1], first + span - 1);
  const haulLine = 10 * span;                      // a "haul" scaled to the window: 10 per gameweek
  const [targetRaw, setTarget] = useStored<number>("rk:target", 10);
  const target = Math.max(2, Math.min(targetRaw, 15 * span));

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const p of d.players) {
      if ((pos !== "ALL" && p.pos !== pos) || p.price > maxPrice + 1e-9) continue;
      if (!p.fixtures.some((f) => f.gw >= first && f.gw <= to && f.xi)) continue;   // probable starters
      if (p.status !== "a" && !(p.status === "d" && (p.chance_next ?? 0) >= 75)) continue;
      const r = rangePmf(p, first, to, excluded);
      if (!r) continue;
      out.push({ p, pm: r.pm, n: r.n, xp: mean(r.pm), sd: sdOf(r.pm), floor: quantile(r.pm, 0.2), blank: 1 - atLeast(r.pm, 3 * r.n),
        ceil: quantile(r.pm, 0.9), haul: atLeast(r.pm, haulLine), target: atLeast(r.pm, target) });
    }
    return out;
  }, [d, pos, maxPrice, first, to, excluded, haulLine, target]);

  const metric = (r: Row) => (mode === "chase" ? r.target : mode === "protect" ? 1 - r.blank : r.haul);
  const typical = useMemo(() => trend(rows, metric).typ, [rows, mode, target]); // eslint-disable-line
  const sorted = useMemo(() => {
    const key = (r: Row) => (mode === "protect" ? r.floor + r.xp / 100 : mode === "average" ? r.xp : r.target);   // protect: best bad week (20th pct), ties by xP
    return [...rows].sort((a, b) => key(b) - key(a));
  }, [rows, mode]);

  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="panel">
        <h2>Risk & upside</h2>
        <p className="sub">xP is an average. Every forecast here is a full distribution of points, so you can see how a player
          gets there: steady returns or boom-or-bust. Protect a lead with players whose bad weeks are still decent; chase a rival with upside, and see exactly how
          much expected value that costs.</p>
        <div className="row">
          <div className="seg" title="Strategy">
            {([["protect", "Protect a lead"], ["average", "Expected points"], ["chase", "Chase upside"]] as const).map(([k, l]) =>
              <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
          </div>
          <div className="seg" title="Window">
            {[1, 2, 3, 4, 6].filter((n) => first + n - 1 <= d.gws[d.gws.length - 1]).map((n) =>
              <button key={n} className={span === n ? "on" : ""} onClick={() => setSpan(n)}>{n === 1 ? `GW${first}` : `GW${first}–${first + n - 1}`}</button>)}
          </div>
          <div className="seg">{(["ALL", ...POSITIONS] as const).map((x) => <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>)}</div>
          <label className="row" style={{ gap: 6 }}><span className="muted">max £{fmt(maxPrice)}m</span>
            <input type="range" min={4} max={16} step={0.1} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} /></label>
        </div>
        {mode === "chase" && (
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">Target: at least</span>
            <input type="range" min={2} max={15 * span} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: 220 }} />
            <b className="num">{target} pts</b><span className="muted">{span > 1 ? `over ${span} gameweeks` : "this gameweek"}</span>
          </div>
        )}
        {span > 1 && <p className="faint" style={{ margin: "8px 0 0", fontSize: 12 }}>Multi-gameweek totals add each fixture's distribution, treating fixtures as
          independent; single-gameweek probabilities are the validated ones (see the paper).</p>}
      </div>

      <Frontier rows={rows} mode={mode} target={target} span={span} haulLine={haulLine} />

      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>Player</th><th>Team</th><th className="r">£m</th><th className="r">Own</th>
              <th className="r" title="Expected points if the player starts">xP</th>
              <th className="r" title="Spread of outcomes (standard deviation)">Volatility</th>
              <th className="r" title="20th percentile of the simulated points: four weeks in five the player scores at least this">Bad week<div className="metric-note">20th pct</div></th>
              <th className="r" title={`Chance of ${span > 1 ? "averaging" : "scoring"} 2 or fewer points per fixture`}>Blank risk</th>
              <th className="r" title="90th percentile of the simulated points: one week in ten the player scores at least this">Good week<div className="metric-note">90th pct</div></th>
              <th className="r" title={`Chance of ${haulLine}+ points`}>P({haulLine}+)</th>
              {mode === "chase" && <th className="r sorted" title={`Chance of at least ${target} points`}>P({target}+)</th>}
              <th className="r" title="Above (+) or below (−) the typical value for players with similar xP">{mode === "protect" ? "Safety" : "Upside"} vs typical</th>
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 40).map((r) => (
              <tr key={r.p.id}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><StatusChip p={r.p} /></div></td>
                <td><TeamShort id={r.p.team} /></td>
                <td className="r num">{fmt(r.p.price)}</td>
                <td className="r num muted">{fmt(r.p.own)}%</td>
                <td className="r num"><b>{fmt(r.xp, 2)}</b></td>
                <td className="r num">{fmt(r.sd)}</td>
                <td className="r num">{r.floor}</td>
                <td className="r num">{pct(r.blank)}</td>
                <td className="r num">{r.ceil}</td>
                <td className="r num">{pct(r.haul)}</td>
                {mode === "chase" && <td className="r num"><b>{pct(r.target)}</b></td>}
                {(() => {
                  const t = typical.get(r.p.id);
                  if (t == null) return <td className="r num faint" title="Too few players with similar xP to compare">–</td>;
                  const v = 100 * (metric(r) - t);
                  return <td className="r num" style={{ color: v > 0.5 ? "var(--accent)" : undefined }}>{`${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`}</td>;
                })()}
                <td style={{ paddingTop: 2, paddingBottom: 0 }}><PmfBars pmf={r.pm} width={150} height={22} maxPts={Math.max(20, 12 * span)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="two">
        <Swaps rows={rows} haulLine={haulLine} />
        <ChaseCaptains rows={span === 1 ? rows : null} />
      </div>
    </div>
  );
}

/** Typical value of f at each xP: leave-one-out local linear regression on xP (Gaussian kernel, bandwidth h).
 *  Undefined (null) where fewer than 5 other players lie within 2h, so sparse extremes get no comparison. */
function trend(rows: Row[], f: (r: Row) => number, h = 0.35) {
  const xs = rows.map((r) => r.xp), ys = rows.map(f);
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
  rows.forEach((r, i) => typ.set(r.p.id, at(r.xp, i)));
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const line: { x: number; y: number }[] = [];
  for (let x = lo; x <= hi; x += (hi - lo) / 60) { const y = at(x, -1); if (y !== null) line.push({ x, y: Math.max(0, y) }); }
  return { typ, line };
}

/** Risk-reward map: upside against xP, with the typical upside at each xP; above the line = more upside than xP suggests. */
function Frontier({ rows, mode, target, span, haulLine }: { rows: Row[]; mode: Mode; target: number; span: number; haulLine: number }) {
  const { openPlayer } = useApp();
  const [tip, setTip] = useState<{ r: Row; x: number; y: number } | null>(null);
  const up = (r: Row) => (mode === "chase" ? r.target : mode === "protect" ? 1 - r.blank : r.haul);
  const upLabel = mode === "chase" ? `P(${target}+ pts)` : mode === "protect" ? "chance of avoiding a blank" : `P(${haulLine}+ pts)`;
  const quality = mode === "protect" ? "safety" : "upside";
  const { typ, line } = useMemo(() => trend(rows, up), [rows, mode, target]); // eslint-disable-line
  const resid = (r: Row) => { const t = typ.get(r.p.id); return t == null ? null : up(r) - t; };
  const W = 900, H = 440, M = { l: 56, r: 24, t: 14, b: 42 };
  const xs = rows.map((r) => r.xp), ys = rows.map(up);
  const x0 = Math.floor(Math.min(...xs, 2)), x1 = Math.ceil(Math.max(...xs, 3));
  const y0 = mode === "protect" ? Math.max(0, Math.floor(Math.min(...ys) * 10) / 10) : 0;
  const y1 = Math.min(1, Math.max(...ys, 0.05) * 1.08);
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const ranked = rows.filter((r) => resid(r) !== null).sort((a, b) => resid(b)! - resid(a)!);
  const picks = ranked.slice(0, 7), steady = ranked.slice(-4).reverse();
  const pickSet = new Set(picks.map((r) => r.p.id)), steadySet = new Set(steady.map((r) => r.p.id));
  const labels = placeLabels([...picks, ...steady], (r) => ({ x: sx(r.xp), y: sy(up(r)), text: r.p.name }), W);
  const yt = Array.from({ length: 6 }, (_, i) => y0 + (i * (y1 - y0)) / 5);
  const fmtP = (v: number) => `${(100 * v).toFixed(y1 - y0 < 0.25 ? 1 : 0)}%`;
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>{mode === "protect" ? "Safety" : "Upside"} for the expected points{span > 1 ? `, ${span} gameweeks` : ""}</h3>
        <span className="metric-note">x: expected points · y: {upLabel}</span>
      </div>
      <p className="sub" style={{ margin: "4px 0 8px", fontSize: 13 }}>The dashed line is the typical {quality} for each level of expected
        points. Players above it offer more {quality} than their xP suggests ({mode === "protect" ? "steady earners to protect a lead with" : "boom-or-bust profiles to chase with"});
        a small step left along the axis is the expected points you give up for it.</p>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 600, height: "auto" }} role="img" aria-label={`${upLabel} against expected points`}>
          {yt.map((t) => <g key={t}><line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" /><text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{fmtP(t)}</text></g>)}
          {Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).map((t) => <text key={t} x={sx(t)} y={H - M.b + 16} textAnchor="middle">{t}</text>)}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">expected points{span > 1 ? " (total over the window)" : ""}</text>
          <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>{upLabel}</text>
          {rows.map((r) => {
            const hot = pickSet.has(r.p.id), cool = steadySet.has(r.p.id);
            return <PosMarker key={r.p.id} pos={r.p.pos} x={sx(r.xp)} y={sy(up(r))} r={hot || cool ? 6 : 4} opacity={hot || cool ? 0.95 : 0.22}
              onMouseEnter={(e) => setTip({ r, x: e.clientX, y: e.clientY })} onMouseLeave={() => setTip(null)} onClick={() => openPlayer(r.p.id)} />;
          })}
          <polyline fill="none" stroke="var(--text)" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.7} points={line.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")} />
          {labels.map(({ item: r, x, y, anchor }) => <text key={`l${r.p.id}`} x={x} y={y} textAnchor={anchor} style={{ fill: pickSet.has(r.p.id) ? "var(--accent)" : "var(--text)", fontWeight: 650 }}>{r.p.name}</text>)}
        </svg>
      </div>
      <div className="legend">{(["GKP", "DEF", "MID", "FWD"] as const).map((p) => <span key={p}><span style={{ color: `var(--pos-${p})` }}>{POS_SHAPE[p]}</span> {p}</span>)}
        <span><i style={{ background: "var(--text)", opacity: 0.7 }} />typical {quality} for the xP</span>
        <span style={{ color: "var(--accent)", fontWeight: 650 }}>green names: most {quality} above typical</span></div>
      {tip && (
        <Tooltip x={tip.x} y={tip.y}>
          <b>{tip.r.p.name}</b> · £{fmt(tip.r.p.price)}m · {fmt(tip.r.p.own)}% owned<br />
          xP {fmt(tip.r.xp, 2)} · {upLabel} <b>{pct(up(tip.r))}</b>{resid(tip.r) === null ? " (too few comparable players)" : ` (${resid(tip.r)! >= 0 ? "+" : "−"}${(100 * Math.abs(resid(tip.r)!)).toFixed(1)} pts vs typical)`}<br />
          bad week (20th pct) {tip.r.floor} · good week (90th pct) {tip.r.ceil} · blank risk {pct(tip.r.blank)}
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
        {` ${haulLine}+`} haul, and what each costs in expected points.</p>
      <div className="row"><PlayerSearch onPick={(p) => setId(p.id)} placeholder="Choose a player…" filter={(p) => rows.some((r) => r.p.id === p.id)} />
        {base && <span><b>{base.p.name}</b> <span className="muted">xP {fmt(base.xp, 2)} · P({haulLine}+) {pct(base.haul)}</span></span>}</div>
      {base && (alts.length ? (
        <table className="plain" style={{ marginTop: 10 }}>
          <thead><tr><th>Instead</th><th className="r">£ diff</th><th className="r">xP cost</th><th className="r">Haul chance</th><th className="r">Blank risk</th></tr></thead>
          <tbody>{alts.map((r) => (
            <tr key={r.p.id}>
              <td><PlayerName p={r.p} /> <span className="faint"><TeamShort id={r.p.team} /></span></td>
              <td className="r">{r.p.price - base.p.price >= 0 ? "+" : "−"}{fmt(Math.abs(r.p.price - base.p.price))}</td>
              <td className="r">{r.xp >= base.xp ? "+" : "−"}{fmt(Math.abs(r.xp - base.xp), 2)}</td>
              <td className="r" style={{ color: "var(--accent)", fontWeight: 650 }}>+{fmt(100 * (r.haul - base.haul), 0)} pts</td>
              <td className="r">{r.blank >= base.blank ? "+" : "−"}{fmt(100 * Math.abs(r.blank - base.blank), 0)} pts</td>
            </tr>))}</tbody>
        </table>
      ) : <p className="muted" style={{ marginTop: 10 }}>No one in that price band offers more upside.</p>)}
    </div>
  );
}

/** Captains for a chase: the chance of a 20+ captain score. */
function ChaseCaptains({ rows }: { rows: Row[] | null }) {
  if (!rows) return <div className="panel"><h3>Captains for a chase</h3><p className="muted">Pick a single gameweek to compare captains.</p></div>;
  const top = [...rows].sort((a, b) => b.haul - a.haul).slice(0, 6);
  return (
    <div className="panel">
      <h3>Captains for a chase</h3>
      <p className="sub" style={{ fontSize: 13 }}>Ranked by the chance of a 20+ captain score (10+ doubled), with their expected
        captain points beside it. When you need to catch up, the top of this list can differ from the top by xP.</p>
      <table className="plain"><thead><tr><th>Player</th><th className="r">P(20+ as captain)</th><th className="r">Captain xP</th></tr></thead>
        <tbody>{top.map((r) => (
          <tr key={r.p.id}><td><PosChip pos={r.p.pos} /> <PlayerName p={r.p} /></td><td className="r"><b>{pct(r.haul)}</b></td><td className="r">{fmt(2 * r.xp, 1)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}
