import { useApp } from "../data";

export default function About() {
  const { d } = useApp();
  const fc = d.fc;
  const when = (s: string) => new Date(s).toLocaleString();
  const snap = fc.snapshot_utc.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z");
  return (
    <div className="grid" style={{ maxWidth: 900 }}>
      <div className="panel">
        <h2>What the numbers are</h2>
        <p><b>xP is expected FPL points if the player starts.</b> For every player and fixture the model simulates the match 1,000 times
          (40 draws of its own uncertainty × 25 match simulations): minutes once on the pitch, goals, assists, clean sheets and goals
          conceded, saves, cards, defensive contributions, and bonus ranked within the match. xP is the average; the bars in a
          player's card show the full spread.</p>
        <p>It does <b>not</b> estimate whether a player will start. Rotation, injuries and backup goalkeepers are your call: the status
          chips show FPL's flags, "probable starters" uses recent starts and availability, and you can switch any fixture off.</p>
        <p>Everything is frozen at the next deadline: no information after it is used. Team strengths come from attack/defence
          ratings updated after every match in six leagues; player form from Understat and FPL histories.</p>
      </div>
      <div className="panel">
        <h2>How far ahead can you trust it?</h2>
        <p>Checked by predicting every gameweek of 2019-20 to 2025-26 from 1 to 8 gameweeks before it (features and team ratings
          frozen at the earlier deadline):</p>
        <ul>
          <li>Average bias stays under ±0.04 points per player-fixture at every horizon.</li>
          <li>Accuracy barely moves: mean absolute error 2.255 one week ahead, 2.258 eight weeks ahead; within-gameweek ranking
            correlation 0.31 → 0.30.</li>
          <li>Single-fixture ranges are honest, but simple ±σ ranges for <i>sums</i> of a few fixtures were not, so the planner shows sums
            without ranges. The simulator's ranges are for fun.</li>
        </ul>
      </div>
      <div className="panel">
        <h2>This forecast</h2>
        <table className="t wrap">
          <tbody>
            <tr><td className="muted">Season</td><td>{fc.season}</td></tr>
            <tr><td className="muted">Decision time</td><td>GW{fc.deadline_gw} deadline, {when(fc.deadline_utc)}</td></tr>
            <tr><td className="muted">Gameweeks</td><td>{fc.gameweeks[0]}–{fc.gameweeks[fc.gameweeks.length - 1]}</td></tr>
            <tr><td className="muted">FPL data snapshot</td><td>{when(snap)}</td></tr>
            <tr><td className="muted">Generated</td><td>{when(fc.generated_utc)}</td></tr>
            <tr><td className="muted">Model</td><td>{fc.model.tag} {fc.model.season}, fitted on earlier seasons (code {fc.model.code_commit}, data {fc.model.train_hash})</td></tr>
            <tr><td className="muted">Players</td><td>{fc.players.length}</td></tr>
          </tbody>
        </table>
        <h3 style={{ marginTop: 14 }}>Quality gates ({fc.gates.filter((g) => g.pass).length}/{fc.gates.length} passed)</h3>
        <ul style={{ margin: 0 }}>
          {fc.gates.map((g) => <li key={g.name} style={{ color: g.pass ? undefined : "var(--pink)" }}>{g.pass ? "✓" : "✗"} {g.name} <span className="faint">{g.detail}</span></li>)}
        </ul>
      </div>
    </div>
  );
}
