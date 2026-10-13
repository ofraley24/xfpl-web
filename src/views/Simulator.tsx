import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, pct, useApp, useStored } from "../data";
import { atLeast, convolve, mean, quantile, sample, scale, sumAll } from "../prob";
import { bestLineup } from "../squad";
import type { Player, Pmf } from "../types";
import { gwPmf } from "./Captaincy";

export default function Simulator() {
  const { d, excluded, squad: ids, from, to } = useApp();
  const squad = ids.map((id) => d.byId.get(id)!).filter(Boolean);
  const [gw, setGw] = useState(d.gws[0]);
  const [target, setTarget] = useStored<number>("sim:target", 60);
  const lineup = useMemo(() => (squad.length >= 11 ? bestLineup(squad, gw, excluded) : null), [squad, gw, excluded]); // eslint-disable-line

  // each starter's distribution this gameweek (captain doubled); blanks score 0
  const parts = useMemo(() => {
    if (!lineup) return null;
    return lineup.xi.map((p) => {
      const pm = gwPmf(p, gw, excluded) ?? { lo: 0, p: [1] };
      return { p, pm: lineup.captain?.id === p.id ? scale(pm, 2) : pm, cap: lineup.captain?.id === p.id };
    });
  }, [lineup, gw, excluded]);
  const missing = lineup?.xi.some((p) => p.fixtures.some((f) => f.gw === gw && !f.pmf));
  const total = useMemo(() => (parts ? sumAll(parts.map((x) => x.pm)) : null), [parts]);

  if (!lineup || !parts || !total) {
    return <div className="panel"><h2>Gameweek simulator</h2><p className="muted">Build a squad first (My squad or Dream team tab), then come back to roll the dice.</p></div>;
  }
  if (missing) return <div className="panel"><h2>Gameweek simulator</h2><p className="muted">This forecast file has no points distributions (pmf); re-export it with the current forecast script.</p></div>;

  return (
    <div className="grid">
      <div className="panel">
        <h2>Gameweek simulator</h2>
        <p className="sub">Your best XI and captain, played out by the model. Each spin draws every starter's score from his simulated points
          distribution. Just for fun: team-mates are drawn independently and everyone is assumed to start.</p>
        <div className="seg">{d.gws.map((g) => <button key={g} className={gw === g ? "on" : ""} onClick={() => setGw(g)}>GW{g}</button>)}</div>
      </div>
      <div className="two">
        <Spinner parts={parts} total={total} />
        <div className="panel">
          <h3>Every possible gameweek</h3>
          <Hist pmf={total} target={target} />
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">Target</span>
            <input type="range" min={20} max={120} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            <b className="num">{target}</b>
            <span className="spacer" />
            <span>Chance to reach it: <b className="num" style={{ color: "var(--accent)" }}>{pct(atLeast(total, target))}</b></span>
          </div>
          <div className="kpis" style={{ marginTop: 10 }}>
            <div className="kpi"><div className="v num">{fmt(mean(total))}</div><div className="l">expected</div></div>
            <div className="kpi"><div className="v num">{quantile(total, 0.1)}–{quantile(total, 0.9)}</div><div className="l">80% of gameweeks</div></div>
            <div className="kpi"><div className="v num">{pct(atLeast(total, 100), 1)}</div><div className="l">a 100-point week</div></div>
          </div>
        </div>
      </div>
      <RangeOutlook squad={squad} from={from} to={to} />
    </div>
  );
}

function Spinner({ parts, total }: { parts: { p: Player; pm: Pmf; cap: boolean }[]; total: Pmf }) {
  const [scores, setScores] = useState<number[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => { setScores(null); setHistory([]); }, [parts]);
  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      n++;
      const s = parts.map((x) => sample(x.pm));
      setScores(s);
      if (n >= 14) {
        clearInterval(timer.current!);
        setSpinning(false);
        setHistory((h) => [s.reduce((a, b) => a + b, 0), ...h].slice(0, 12));
      }
    }, 70);
  };
  const sum = scores?.reduce((a, b) => a + b, 0);
  const pctile = sum !== undefined ? 1 - atLeast(total, sum + 1) : null;
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Spin the gameweek</h3>
        <button className="btn primary" onClick={spin} disabled={spinning}>{spinning ? "Playing…" : "🎲 Play it out"}</button>
      </div>
      <div className={`score-big num ${spinning ? "spin" : ""}`} style={{ margin: "14px 0 4px" }}>{sum ?? "?"}</div>
      <div className="muted">{pctile !== null && !spinning ? `better than ${pct(pctile)} of simulated gameweeks` : "points"}</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6, marginTop: 12 }}>
        {parts.map((x, i) => {
          const s = scores?.[i];
          const big = s !== undefined && s >= (x.cap ? 20 : 10);
          return (
            <div key={x.p.id} className="kpi" style={{ padding: "6px 8px", outline: big ? "2px solid var(--gold)" : undefined }}>
              <div className="l">{x.p.name}{x.cap ? " (C)" : ""}</div>
              <div className="v num" style={{ fontSize: 18 }}>{s ?? "–"}{big ? " 🔥" : ""}</div>
            </div>
          );
        })}
      </div>
      {history.length > 0 && <p className="muted" style={{ marginTop: 10 }}>Last spins: {history.join(", ")} · average {fmt(history.reduce((a, b) => a + b, 0) / history.length)}</p>}
    </div>
  );
}

function Hist({ pmf, target }: { pmf: Pmf; target: number }) {
  const lo = quantile(pmf, 0.001), hi = quantile(pmf, 0.999);
  const vals = Array.from({ length: hi - lo + 1 }, (_, i) => pmf.p[lo + i - pmf.lo] ?? 0);
  const top = Math.max(...vals);
  const W = 520, H = 160, P = 12, w = (W - 2 * P) / vals.length;
  return (
    <svg viewBox={`${-P} 0 ${W} ${H + 18}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="team points distribution">
      {vals.map((v, i) => (
        <rect key={i} x={i * w} y={H - (v / top) * H} width={Math.max(1, w - 0.6)} height={(v / top) * H}
          fill={lo + i >= target ? "var(--accent)" : "var(--cyan)"} fillOpacity={lo + i >= target ? 0.95 : 0.45}>
          <title>{`${lo + i} pts: ${(100 * v).toFixed(2)}%`}</title>
        </rect>
      ))}
      {Array.from({ length: 8 }, (_, i) => Math.round(lo + (i * (hi - lo)) / 7)).map((x) => (
        <text key={x} x={(x - lo) * w + w / 2} y={H + 14} textAnchor="middle">{x}</text>
      ))}
    </svg>
  );
}

function RangeOutlook({ squad, from, to }: { squad: Player[]; from: number; to: number }) {
  const { excluded } = useApp();
  const dist = useMemo(() => {
    let acc: Pmf = { lo: 0, p: [1] };
    for (let g = from; g <= to; g++) {
      const l = bestLineup(squad, g, excluded);
      for (const p of l.xi) {
        const pm = gwPmf(p, g, excluded);
        if (pm) acc = convolve(acc, l.captain?.id === p.id ? scale(pm, 2) : pm);
      }
    }
    return acc;
  }, [squad, from, to, excluded]);
  if (to === from) return null;
  return (
    <div className="panel">
      <h3>GW{from}–{to} outlook</h3>
      <p className="sub">Total for the whole range if you keep this squad and pick the best XI each week (change the range in the Planner).</p>
      <div className="kpis">
        <div className="kpi"><div className="v num">{fmt(mean(dist))}</div><div className="l">expected total</div></div>
        <div className="kpi"><div className="v num">{quantile(dist, 0.1)}–{quantile(dist, 0.9)}</div><div className="l">80% range (independent draws, for fun)</div></div>
        <div className="kpi"><div className="v num">{quantile(dist, 0.99)}</div><div className="l">dream scenario (top 1%)</div></div>
      </div>
    </div>
  );
}
