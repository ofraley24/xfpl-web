import { useState } from "react";
import { BUDGET, fmt, POSITIONS, rangeXp, useApp, useStored, XP_TITLE } from "../data";
import { optimise } from "../squad";
import type { Player } from "../types";
import { PlayerName, PlayerSearch, PosChip, RangePicker, StatusChip, TeamShort } from "../ui";

type Risk = "averse" | "neutral" | "seeking";
// objective weight per point² of excess variance (over the typical for the player's position and xP; see optimise)
const LAMBDA: Record<Risk, number> = { averse: -0.2, neutral: 0, seeking: 0.2 };

export default function Optimiser() {
  const { d, from, to, excluded, setSquad, squad, bank } = useApp();
  const [budget, setBudget] = useStored<number>("opt:budget", BUDGET);
  const [benchW, setBenchW] = useStored<number>("opt:bench", 0.1);
  const [locked, setLocked] = useStored<number[]>("opt:locked", []);
  const [banned, setBanned] = useStored<number[]>("opt:banned", []);
  const [startersOnly, setStartersOnly] = useStored<boolean>("opt:starters", true);
  const [fitOnly, setFitOnly] = useStored<boolean>("opt:fit", true);
  const [risk, setRisk] = useStored<Risk>("opt:risk", "neutral");
  const [res, setRes] = useState<ReturnType<typeof optimise> | "none" | null>(null);
  const [base, setBase] = useState<ReturnType<typeof optimise>>(null);   // the neutral solution, to show what the variance setting costs
  const [busy, setBusy] = useState(false);

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const players = d.players.filter((p) => locked.includes(p.id) || (
        (!startersOnly || p.fixtures.some((f) => f.gw >= from && f.gw <= to && f.xi)) &&
        (!fitOnly || p.status === "a" || (p.status === "d" && (p.chance_next ?? 0) >= 75))));
      const opts = { players, from, to, excluded, budget, locked: new Set(locked), banned: new Set(banned), benchWeight: benchW };
      const r = optimise({ ...opts, riskWeight: LAMBDA[risk] });
      setRes(r ?? "none");
      setBase(r && risk !== "neutral" ? optimise(opts) : null);
      setBusy(false);
    }, 20);
  };

  const ok = res && res !== "none" ? res : null;
  const list = (ids: number[], set: (v: number[]) => void, label: string) => (
    <div className="row" style={{ gap: 6 }}>
      <span className="muted">{label}:</span>
      {ids.map((id) => d.byId.get(id)).filter(Boolean).map((p) => (
        <span key={p!.id} className="chip" style={{ background: "var(--panel-2)", color: "var(--text)" }}>
          {p!.name} <button className="btn small" style={{ padding: "0 4px" }} onClick={() => set(ids.filter((x) => x !== p!.id))}>✕</button>
        </span>
      ))}
      <PlayerSearch onPick={(p) => set([...ids.filter((x) => x !== p.id), p.id])} placeholder={`${label}…`} />
    </div>
  );

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Squad Optimiser</h2>
            <p className="sub">The 15 that maximise the starting XI's expected points over the range (plus a little for bench cover), under FPL's
              rules: 2/5/5/3, at most 3 per club, within budget. Solved exactly with an integer program, right here in your browser.
              The variance setting trades expected points for steadier (Low) or more boom-or-bust (High) players than usual for their xP.
              Low can cut the XI's spread noticeably; High adds little, because the highest-xP XI is already close to the most volatile.</p>
          </div>
          <RangePicker />
        </div>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>budget £<input type="number" step={0.1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} style={{ width: 80 }} />m</label>
          <button className="btn small" onClick={() => setBudget(BUDGET + bank)}>use my budget (£{fmt(BUDGET + bank)}m)</button>
          <label className="row" style={{ gap: 6 }} title="How much a bench player's xP counts, relative to a starter's">
            bench weight <input type="range" min={0} max={0.5} step={0.05} value={benchW} onChange={(e) => setBenchW(Number(e.target.value))} /> <span className="num">{benchW.toFixed(2)}</span>
          </label>
          <div className="row" style={{ gap: 6 }} title="Objective: xP + λ × each player's variance above the typical for his position and xP (λ = −0.2, 0, +0.2); players treated as independent">
            <span className="muted">variance</span>
            <div className="seg">{(["averse", "neutral", "seeking"] as const).map((k) =>
              <button key={k} className={risk === k ? "on" : ""} onClick={() => setRisk(k)}>{k === "averse" ? "Low" : k === "neutral" ? "Neutral" : "High"}</button>)}</div>
          </div>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={startersOnly} onChange={(e) => setStartersOnly(e.target.checked)} /> probable starters</label>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={fitOnly} onChange={(e) => setFitOnly(e.target.checked)} /> fit only</label>
        </div>
        <div className="grid" style={{ marginTop: 10, gap: 8 }}>
          {list(locked, setLocked, "Must include")}
          {list(banned, setBanned, "Never pick")}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={run} disabled={busy}>{busy ? "Solving…" : "Optimise my squad"}</button>
          {ok && <button className="btn" onClick={() => setSquad(ok.squad.map((p) => p.id))}>Load into My squad{squad.length ? " (replaces it)" : ""}</button>}
          {res === "none" && <span style={{ color: "var(--pink)" }}>No squad satisfies those constraints.</span>}
        </div>
      </div>

      {ok && <Result squad={ok.squad} xi={ok.xi} value={ok.value} variance={ok.variance} base={base} />}
    </div>
  );
}

function Result({ squad, xi, value, variance, base }: { squad: Player[]; xi: Player[]; value: number; variance: number; base: ReturnType<typeof optimise> }) {
  const { from, to, excluded, mode } = useApp();
  const cost = squad.reduce((s, p) => s + p.price, 0);
  return (
    <div className="panel">
      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi"><div className="v num">{fmt(value)}</div><div className="l">XI expected points GW{from}–{to} (fixed XI, no captain)</div></div>
        <div className="kpi"><div className="v num">±{fmt(Math.sqrt(variance))}</div><div className="l">XI spread (SD; players independent)</div></div>
        <div className="kpi"><div className="v num">£{fmt(cost)}m</div><div className="l">squad cost</div></div>
        {base && <div className="kpi"><div className="v num">{value - base.value >= 0 ? "+" : "−"}{fmt(Math.abs(value - base.value), 2)}</div>
          <div className="l">xP vs the neutral XI (SD {fmt(Math.sqrt(base.variance))} → {fmt(Math.sqrt(variance))})</div></div>}
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Player</th><th>Team</th><th className="r">£m</th><th className="r" title={XP_TITLE[mode]}>xP</th><th className="r">xP/£m</th><th></th></tr></thead>
          <tbody>
            {POSITIONS.flatMap((pos) => squad.filter((p) => p.pos === pos)
              .sort((a, b) => Number(xi.includes(b)) - Number(xi.includes(a)) || rangeXp(b, from, to, excluded) - rangeXp(a, from, to, excluded)))
              .map((p) => {
                const v = rangeXp(p, from, to, excluded);
                return (
                  <tr key={p.id} style={{ opacity: xi.includes(p) ? 1 : 0.6 }}>
                    <td><div className="row" style={{ gap: 6 }}><PosChip pos={p.pos} /><PlayerName p={p} /><StatusChip p={p} /></div></td>
                    <td><TeamShort id={p.team} /></td>
                    <td className="r num">{fmt(p.price)}</td>
                    <td className="r num"><b>{fmt(v)}</b></td>
                    <td className="r num">{fmt(v / p.price, 2)}</td>
                    <td className="muted">{xi.includes(p) ? "XI" : "bench"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
