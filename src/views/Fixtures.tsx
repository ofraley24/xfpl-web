import { useMemo } from "react";
import { fmt, pct, useApp, useStored } from "../data";
import { RangePicker } from "../ui";

type Mode = "attack" | "defence" | "overall";

interface TeamFx { gw: number; opp: number; home: boolean; xgf: number; xga: number }

export default function Fixtures() {
  const { d, from, to } = useApp();
  const [mode, setMode] = useStored<Mode>("fx:mode", "attack");
  const gws = d.gws.filter((g) => g >= from && g <= to);

  const rows = useMemo(() => {
    const byTeam = new Map<number, TeamFx[]>();
    for (const f of d.fc.fixtures) {
      if (f.gw < from || f.gw > to) continue;
      const add = (t: number, x: TeamFx) => byTeam.set(t, [...(byTeam.get(t) ?? []), x]);
      add(f.home, { gw: f.gw, opp: f.away, home: true, xgf: f.xg_home, xga: f.xg_away });
      add(f.away, { gw: f.gw, opp: f.home, home: false, xgf: f.xg_away, xga: f.xg_home });
    }
    const metric = (x: TeamFx) => (mode === "attack" ? x.xgf : mode === "defence" ? Math.exp(-x.xga) : x.xgf - x.xga);
    return [...d.teams.values()].map((t) => {
      const fx = byTeam.get(t.id) ?? [];
      return { t, fx, total: fx.reduce((s, x) => s + metric(x), 0), metric };
    }).sort((a, b) => b.total - a.total);
  }, [d, from, to, mode]);

  const colour = (v: number) => {
    const [lo, hi] = mode === "attack" ? [0.7, 2.4] : mode === "defence" ? [0.1, 0.55] : [-1.5, 1.5];
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return t >= 0.5
      ? `color-mix(in srgb, var(--good) ${Math.round((t - 0.5) * 150)}%, var(--mid))`
      : `color-mix(in srgb, var(--bad) ${Math.round((0.5 - t) * 140)}%, var(--mid))`;
  };
  const ink = (v: number) => {
    const [lo, hi] = mode === "attack" ? [0.7, 2.4] : mode === "defence" ? [0.1, 0.55] : [-1.5, 1.5];
    const t = (v - lo) / (hi - lo);
    return t > 0.85 || t < 0.12 ? "#ffffff" : "var(--text)";
  };
  const show = (v: number) => (mode === "defence" ? pct(v) : fmt(v, 2));

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Fixture ticker</h2>
            <p className="sub">
              Team strength from the model's attack/defence ratings, frozen at the deadline. {mode === "attack" && "Expected goals scored."}
              {mode === "defence" && "Clean-sheet chance, exp(−expected goals conceded)."}
              {mode === "overall" && "Expected goal difference."} Teams sorted by the range total.
            </p>
          </div>
          <RangePicker />
        </div>
        <div className="seg">
          {(["attack", "defence", "overall"] as const).map((m) => (
            <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>#</th><th>Team</th>
              <th className="r">{mode === "attack" ? "Σ xG" : mode === "defence" ? "Σ CS" : "Σ xGD"}</th>
              {gws.map((g) => <th key={g} style={{ textAlign: "center" }}>GW{g}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, fx, total, metric }, i) => (
              <tr key={t.id}>
                <td className="muted num">{i + 1}</td>
                <td><b>{t.name}</b></td>
                <td className="r num"><b>{mode === "defence" ? fmt(total, 2) : fmt(total, 2)}</b></td>
                {gws.map((g) => {
                  const here = fx.filter((x) => x.gw === g);
                  return (
                    <td key={g} style={{ textAlign: "center" }}>
                      {!here.length ? <span className="cell blank">–</span> : (
                        <span className="multi">
                          {here.map((x, j) => {
                            const opp = d.teams.get(x.opp)?.short ?? "?";
                            return (
                              <span key={j} className="cell" style={{ background: colour(metric(x)), color: ink(metric(x)), cursor: "default" }}
                                title={`${opp} ${x.home ? "(H)" : "(A)"}: xG ${x.xgf.toFixed(2)} – ${x.xga.toFixed(2)}, clean sheet ${(100 * Math.exp(-x.xga)).toFixed(0)}%`}>
                                <b>{x.home ? opp : opp.toLowerCase()}</b>
                                <span className="o num">{show(metric(x))}</span>
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint">Upper case = home, lower case = away. Clean-sheet chance assumes Poisson goals.</p>
    </div>
  );
}
