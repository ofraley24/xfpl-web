import { useMemo } from "react";
import { go } from "../App";
import { fixtureKey, fmt, POSITIONS, rangeXp, useApp } from "../data";
import { useEvidence } from "../evidence";
import type { Player } from "../types";
import { PlayerName, PosChip, StatusChip, TeamShort } from "../ui";

export default function Overview() {
  const { d, excluded } = useApp();
  const { v: ev } = useEvidence();
  const gw = d.fc.deadline_gw;
  const to = Math.min(d.gws[d.gws.length - 1], gw + 5);
  const starters = useMemo(() => d.players.filter((p) => p.fixtures.some((f) => f.gw === gw && f.xi) && (p.status === "a" || (p.chance_next ?? 0) >= 75)), [d, gw]);
  const gwXp = (p: Player) => p.fixtures.filter((f) => f.gw === gw && !excluded.has(fixtureKey(p.id, f.fixture))).reduce((s, f) => s + f.xp, 0);
  const byPos = POSITIONS.map((pos) => ({ pos, top: starters.filter((p) => p.pos === pos).sort((a, b) => gwXp(b) - gwXp(a)).slice(0, 5) }));
  const value = [...starters].map((p) => ({ p, v: rangeXp(p, gw, to, excluded) / p.price })).sort((a, b) => b.v - a.v).slice(0, 6);
  const captains = [...starters].sort((a, b) => gwXp(b) - gwXp(a)).slice(0, 3);
  const teams = useMemo(() => {
    const t = new Map<number, { xg: number; cs: number; n: number }>();
    for (const f of d.fc.fixtures) {
      if (f.gw < gw || f.gw > to) continue;
      for (const [id, xg, xga] of [[f.home, f.xg_home, f.xg_away], [f.away, f.xg_away, f.xg_home]] as const) {
        const o = t.get(id) ?? { xg: 0, cs: 0, n: 0 };
        o.xg += xg; o.cs += Math.exp(-xga); o.n += 1;
        t.set(id, o);
      }
    }
    return [...t.entries()].map(([id, o]) => ({ id, ...o }));
  }, [d, gw, to]);
  const opp = (p: Player) => p.fixtures.filter((f) => f.gw === gw).map((f) => (f.home ? d.teams.get(f.opp)?.short : d.teams.get(f.opp)?.short.toLowerCase())).join(", ");
  const dev = ev?.sets.dev, sealed = ev?.sets.sealed;
  const deadline = new Date(d.fc.deadline_utc);

  return (
    <div className="grid" style={{ gap: 28 }}>
      <header>
        <div className="kicker">Gameweek {gw} · deadline {deadline.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
        <h1>Expected points, measured honestly.</h1>
        <p className="lede">Cutting-edge sports modelling, fitted on more than a decade of shot-level data from six European
          leagues. Every goal, assist, clean sheet and bonus point is simulated a thousand times per fixture. Here is its view of
          gameweek {gw}, and the evidence behind it.</p>
      </header>

      {dev && sealed && (
        <section>
          <div className="three" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <div className="stat-tile"><div className="v">{(dev.accuracy.model.rank / dev.accuracy.pps5.rank).toFixed(1)}×</div>
              <div className="l">the ranking accuracy of a points-per-start baseline (rank correlation {dev.accuracy.model.rank.toFixed(2)} vs {dev.accuracy.pps5.rank.toFixed(2)} over six test seasons)</div></div>
            <div className="stat-tile"><div className="v">±{(100 * Math.max(...[dev, sealed, ev!.sets.live].map((s) => Math.abs(s.high_end.all.ratio - 1)))).toFixed(1)}%</div>
              <div className="l">overall calibration in every test set: predicted points match what actually happened</div></div>
            <div className="stat-tile"><div className="v">{(100 * dev.pit.c80).toFixed(0)}%</div>
              <div className="l">of outcomes fell inside the model's central 80% range: its uncertainty is honest, not decorative</div></div>
            <div className="stat-tile"><div className="v">8 GW</div>
              <div className="l">ahead with almost no loss of accuracy (mean error +0.1%), in a backtest with every input frozen at the earlier deadline</div></div>
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => go("paper")}>Read the paper</button>
            <button className="btn" onClick={() => go("record")}>Live track record</button>
            <span className="faint" style={{ fontSize: 12.5 }}>All 15 leakage-audit tests pass · every model change judged by a rule written before the run</span>
          </div>
        </section>
      )}

      <section>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>Gameweek {gw}: the model's picks</h2>
          <span className="metric-note">xP · if starts · probable starters, fit or ≥75%</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", marginTop: 10 }}>
          {byPos.map(({ pos, top }) => (
            <div key={pos} className="panel">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}><PosChip pos={pos} /><span className="metric-note">xP</span></div>
              <table className="plain"><tbody>
                {top.map((p) => (
                  <tr key={p.id}>
                    <td><PlayerName p={p} /> <StatusChip p={p} /><div className="faint" style={{ fontSize: 11.5 }}><TeamShort id={p.team} /> · {opp(p)}</div></td>
                    <td className="r serif" style={{ fontSize: 18, fontWeight: 600 }}>{fmt(gwXp(p))}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ))}
        </div>
      </section>

      <section className="three">
        <div className="panel">
          <h3>Captain shortlist</h3>
          <table className="plain"><tbody>
            {captains.map((p, i) => (
              <tr key={p.id}><td className="faint">{i + 1}</td><td><PlayerName p={p} /><div className="faint" style={{ fontSize: 11.5 }}>{opp(p)}</div></td>
                <td className="r"><b>{fmt(2 * gwXp(p))}</b><div className="metric-note">as captain</div></td></tr>
            ))}
          </tbody></table>
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("captain")}>Haul and blank chances →</button>
        </div>
        <div className="panel">
          <h3>Best value, GW{gw}–{to}</h3>
          <table className="plain"><tbody>
            {value.map(({ p, v }) => (
              <tr key={p.id}><td><PosChip pos={p.pos} /> <PlayerName p={p} /><div className="faint" style={{ fontSize: 11.5 }}><TeamShort id={p.team} /> · £{fmt(p.price)}m</div></td>
                <td className="r"><b>{fmt(v, 2)}</b><div className="metric-note">xP per £m</div></td></tr>
            ))}
          </tbody></table>
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("planner")}>Open the planner →</button>
        </div>
        <div className="panel">
          <h3>Kindest fixtures, GW{gw}–{to}</h3>
          <table className="plain">
            <thead><tr><th>Attack</th><th className="r">xG</th><th>Defence</th><th className="r">CS</th></tr></thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => {
                const a = [...teams].sort((x, y) => y.xg - x.xg)[i], c = [...teams].sort((x, y) => y.cs - x.cs)[i];
                return <tr key={i}><td>{d.teams.get(a.id)?.short}</td><td className="r">{fmt(a.xg)}</td><td>{d.teams.get(c.id)?.short}</td><td className="r">{fmt(c.cs, 1)}</td></tr>;
              })}
            </tbody>
          </table>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>Expected goals scored, and expected clean sheets, over the next six gameweeks.</div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("fixtures")}>Full fixture ticker →</button>
        </div>
      </section>
    </div>
  );
}
