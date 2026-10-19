import { useApp } from "../data";
import { useTrack, type TrackMetrics } from "../evidence";

const snapTime = (s: string) => new Date(s.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
const when = (d: Date) => d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const COLS: [keyof TrackMetrics, string, string, number][] = [
  ["mae", "MAE ↓", "mean absolute error, points", 3], ["rmse", "RMSE ↓", "root mean squared error", 3],
  ["rank", "Rank corr. ↑", "within-gameweek Spearman correlation with actual points", 3],
  ["top10", "Top 10 ↑", "mean actual points of each method's ten highest forecasts", 2],
  ["bias", "Bias", "mean actual minus forecast", 2], ["ratio", "Actual / forecast", "1 is calibrated", 3],
];

export default function TrackRecord() {
  const { d } = useApp();
  const { v: tr, err } = useTrack();
  const fc = d.fc;
  return (
    <div className="grid" style={{ gap: 22 }}>
      <header>
        <div className="kicker">Method · live</div>
        <h1>Track record</h1>
        <p className="lede">Every forecast is locked before the deadline and scored once the gameweek is over, next to FPL's own
          projection. Nothing here is back-filled or re-run.</p>
      </header>

      {err && <div className="panel">No track record file yet ({err}).</div>}
      {tr && !tr.overall && (
        <div className="panel">
          <h3>The first results arrive after gameweek {tr.locked[0]?.gw ?? fc.deadline_gw}</h3>
          <p className="sub" style={{ marginBottom: 8 }}>Locked so far:</p>
          <table className="plain">
            <thead><tr><th>Gameweek</th><th>Forecast locked</th><th>Deadline</th><th>Status</th></tr></thead>
            <tbody>{tr.locked.map((l) => (
              <tr key={l.gw}><td>GW{l.gw}</td><td>{when(snapTime(l.snapshot))}</td><td>{when(new Date(l.deadline))}</td><td>{l.scored ? "scored" : "waiting for the final whistle"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {tr?.overall && (
        <section className="grid">
          <h2>{tr.overall.gws} gameweek{tr.overall.gws > 1 ? "s" : ""} scored</h2>
          <h3>Starters · xP if he starts</h3>
          <p className="sub">{tr.overall.n.toLocaleString()} player-gameweeks in which the player started every fixture.</p>
          <Compare rows={[["xFPL model", tr.overall.model, true], ["FPL, same moment", tr.overall.fpl_same, false], ["FPL, at the deadline", tr.overall.fpl_deadline, false]]} />
          {tr.full_overall && (
            <>
              <h3>Every player · full model</h3>
              <p className="sub">{tr.full_overall.n.toLocaleString()} player-gameweeks: every registered player, whether he played or not
                (0 points if not), scored with the full model. FPL's projection also prices the chance of not playing, so this is the
                like-for-like comparison.</p>
              <Compare rows={[["xFPL full model", tr.full_overall.model, true], ["FPL, same moment", tr.full_overall.fpl_same, false], ["FPL, at the deadline", tr.full_overall.fpl_deadline, false]]} />
            </>
          )}
          <h3>By gameweek</h3>
          {tr.gameweeks.slice().reverse().map((g) => (
            <div key={g.gw} className="panel">
              <div className="row" style={{ justifyContent: "space-between" }}><b className="serif" style={{ fontSize: 18 }}>Gameweek {g.gw}</b>
                <span className="faint">{g.n} starters · forecast locked {when(snapTime(g.forecast_snapshot))}</span></div>
              <Compare rows={[["xFPL model", g.model, true], ["FPL, same moment", g.fpl_same, false], ["FPL, at the deadline", g.fpl_deadline, false]]} />
              {(() => {
                const f = tr.full_gameweeks?.find((x) => x.gw === g.gw);
                return f && (
                  <>
                    <div className="faint" style={{ margin: "10px 0 4px" }}>Every player · full model · {f.n} players, {f.played} played</div>
                    <Compare rows={[["xFPL full model", f.model, true], ["FPL, same moment", f.fpl_same, false], ["FPL, at the deadline", f.fpl_deadline, false]]} />
                  </>
                );
              })()}
            </div>
          ))}
        </section>
      )}

      <section className="two">
        <div className="panel">
          <h3>How it is scored</h3>
          <ul className="sub" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Rows are players who <b>started</b> every fixture of the gameweek, because xP is the expected score of a starter.
              Double gameweeks are summed.</li>
            <li><b>FPL, same moment:</b> FPL's projected points (ep_next) from the very snapshot the forecast was built from —
              the same information.</li>
            <li><b>FPL, at the deadline:</b> FPL's last projection before the deadline, which has seen later team news. A tougher test.</li>
            <li>FPL's projection also prices in the chance of not playing; restricting to starters removes most of that difference,
              but not all of it.</li>
            <li><b>Every player · full model</b> (from the forecasts that carry it): every registered player, played or not, scored with
              P(start) × xP if he starts + P(sub) × xP if he comes on, against the same two FPL projections.</li>
          </ul>
        </div>
        <div className="panel">
          <h3>This week's forecast</h3>
          <table className="plain">
            <tbody>
              <tr><td className="muted">Decision time</td><td>GW{fc.deadline_gw} deadline, {when(new Date(fc.deadline_utc))}</td></tr>
              <tr><td className="muted">FPL data as of</td><td>{when(snapTime(fc.snapshot_utc))}</td></tr>
              <tr><td className="muted">Gameweeks</td><td>{fc.gameweeks[0]}–{fc.gameweeks[fc.gameweeks.length - 1]}</td></tr>
              <tr><td className="muted">Model</td><td>fitted on seasons before {fc.model.season} · code {fc.model.code_commit} · data {fc.model.train_hash.slice(0, 8)}</td></tr>
              <tr><td className="muted">Quality gates</td><td>{fc.gates.filter((g) => g.pass).length} of {fc.gates.length} passed</td></tr>
            </tbody>
          </table>
          <details style={{ marginTop: 8 }}>
            <summary className="muted" style={{ cursor: "pointer" }}>Show the gates</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
              {fc.gates.map((g) => <li key={g.name} style={{ color: g.pass ? undefined : "var(--bad)" }}>{g.pass ? "✓" : "✗"} {g.name.replace(/^G\d /, "")}</li>)}
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}

function Compare({ rows }: { rows: [string, TrackMetrics, boolean][] }) {
  const best = Object.fromEntries(COLS.map(([k]) => {
    const vals = rows.map((r) => r[1][k]);
    if (k === "bias") return [k, Math.min(...vals.map(Math.abs))];
    if (k === "ratio") return [k, Math.min(...vals.map((v) => Math.abs(v - 1)))];
    return [k, k === "mae" || k === "rmse" ? Math.min(...vals) : Math.max(...vals)];
  }));
  const isBest = (k: keyof TrackMetrics, v: number) => (k === "bias" ? Math.abs(v) === best[k] : k === "ratio" ? Math.abs(v - 1) === best[k] : v === best[k]);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="plain">
        <thead><tr><th>Method</th>{COLS.map(([k, l, t]) => <th key={k} className="r" title={t}>{l}</th>)}</tr></thead>
        <tbody>{rows.map(([name, m, ours]) => (
          <tr key={name} className={ours ? "ours" : ""}><td>{name}</td>
            {COLS.map(([k, , , dp]) => <td key={k} className="r" style={{ color: isBest(k, m[k]) ? "var(--accent)" : undefined, fontWeight: isBest(k, m[k]) ? 700 : undefined }}>{m[k]?.toFixed(dp)}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
