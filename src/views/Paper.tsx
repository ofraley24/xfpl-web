import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { go } from "../App";
import { HorizonChart, PitChart, RatioChart, ReliabilityChart, ratioOf } from "../charts";
import { useEvidence, type Acc, type EvidenceSet } from "../evidence";

const Eq = ({ tex }: { tex: string }) => {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false }), [tex]);
  return <div className="eq" dangerouslySetInnerHTML={{ __html: html }} />;
};
const pct = (x: number, d = 0) => `${(100 * x).toFixed(d)}%`;

const SECTIONS = [
  ["question", "The question and the rules"],
  ["model", "How the model works"],
  ["testing", "How it was tested"],
  ["results", "Results"],
  ["ahead", "Forecasting weeks ahead"],
  ["benchmark", "What about FPL's own projections?"],
  ["limits", "Limitations"],
] as const;

export default function Paper() {
  const { v: ev, err } = useEvidence();
  if (err) return <div className="panel">The evidence file is missing ({err}).</div>;
  if (!ev) return <div className="muted">Loading…</div>;
  const { dev, sealed, live } = ev.sets;
  const H = (i: number) => <span className="no">{i + 1}</span>;
  return (
    <article className="article">
      <div className="kicker">Method · condensed paper</div>
      <h1>Forecasting Fantasy Premier League points with a calibrated, leakage-audited model</h1>
      <div className="byline">The xFPL project · October 2026 · condensed from the full Results Report and Mathematical Formulation.
        Exact coefficients, hyperparameter values and feature lists are withheld; every result is reported in full.</div>

      <div className="abstract">
        <p><b>Abstract.</b> We forecast the FPL points of every player who starts a Premier League match, using only information
          available at the gameweek deadline. The forecast is built from its parts (team strength, player talent, minutes, every
          scoring event, and bonus ranked within the match) and combined by simulation into a full points distribution per player
          and fixture. Tested walk-forward on six seasons ({dev.starts.toLocaleString()} starts), a sealed 2025-26 season and the
          first six gameweeks of 2026-27, the model ranks players about twice as well as a points-per-start baseline
          (within-gameweek rank correlation {dev.accuracy.model.rank.toFixed(2)} against {dev.accuracy.pps5.rank.toFixed(2)} in development),
          lowers RMSE by about 10%, and is calibrated to within 1.3% overall. Its predictive distributions are honest: the central
          80% contains {pct(dev.pit.c80)} of outcomes. All 15 leakage-audit tests pass. Forecasts made up to eight gameweeks ahead
          are almost as accurate as next-week forecasts.</p>
      </div>
      <nav className="toc" aria-label="Contents">
        {SECTIONS.map(([id, t], i) => <a key={id} href={`#/paper`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }}>{i + 1}. {t}</a>)}
      </nav>

      <h2 id="question">{H(0)}The question and the rules</h2>
      <p>The target is the number of FPL points a player scores in a fixture <i>given that they start</i>. Whether a player starts is a
        separate question — team news, rotation, injuries — that managers judge for themselves; the model answers what a start is worth.</p>
      <p><b>Decision time is the deadline.</b> Every input is computed from records dated strictly before the gameweek deadline.
        That rule removed two subtle leaks during development: a double gameweek's first fixture informing its second, and matches
        kicking off simultaneously informing each other through shared league terms. Prices and ownership are taken from the previous
        gameweek, because the current gameweek's values can be recorded after the deadline.</p>
      <p><b>Data.</b> Understat shots, expected goals and line-ups for six European leagues since 2014-15 (about 25,000 matches,
        so a player's history follows them across leagues); FPL's per-match records since 2016-17; and timestamped snapshots of the
        live FPL API. A crosswalk matches FPL fixtures, teams and players to Understat with 100% fixture coverage.</p>
      <p><b>Evaluation protocol.</b> Every design choice was made on six walk-forward development seasons (2019-20 to 2024-25), each
        fitted only on earlier seasons. 2025-26 was held out, and 2026-27's first gameweeks were held out until late in development.
        Changes to the model were judged by rules written down before each run.</p>

      <h2 id="model">{H(1)}How the model works</h2>
      <p>Points are a deterministic function of match events, so the model is built bottom-up: estimate each event, simulate the
        match many times, and score each simulation with the season's rules. The scoring rules reproduce FPL's official totals from
        the recorded events in 100% of {dev.starts.toLocaleString()} development rows.</p>
      <Architecture />
      <h3>Team strength</h3>
      <p>Each team has an attack and a defence rating, updated after every match from a blend of non-penalty expected goals and
        actual goals, so one fortunate result moves a rating less than its scoreline suggests. Expected goals for a fixture are
        log-linear in the rating gap:</p>
      <Eq tex={String.raw`\log \lambda_{\text{home}} = c_\ell + h + \frac{a_{\text{home}} - d_{\text{away}}}{\sigma}, \qquad \log \mu_{\text{away}} = c_\ell + \frac{a_{\text{away}} - d_{\text{home}}}{\sigma}`} />
      <p>Three terms are learned online from matches already played: home advantage behind closed doors (it roughly halved during
        COVID), and slow drifts in each league's scoring level and in crowd home advantage. Together they improve out-of-sample goal
        prediction significantly over fixed values. Ratings for a fixture are always taken as they stood at the deadline.</p>
      <h3>Player talent</h3>
      <p>A player's attacking role is measured as their share of their team's output while they are on the pitch: shot share, shot quality,
        and expected-assist share, accumulated with time decay across all six leagues. Shares separate the player from their team,
        whose strength enters separately. Each share is shrunk toward the position average by an amount estimated from the data:</p>
      <Eq tex={String.raw`\hat\theta_i = \frac{S_i + k\,m}{T_i + k}, \qquad k = \frac{\text{noise variance}}{\text{talent variance}}`} />
      <p>The two variances come from splitting every player-season into odd and even matches: two independent measurements of the
        same player, whose covariance is talent and whose difference is noise. This split-half empirical Bayes beat both a tuned
        fixed shrinkage and a likelihood-based hierarchical model.</p>
      <h3>Scoring events</h3>
      <table className="plain">
        <thead><tr><th>Event</th><th>Model</th><th>Key structure</th></tr></thead>
        <tbody>
          <tr><td>Open-play goals, assists</td><td>Poisson regression</td><td>team and opponent expected goals, the player's talent shares, minutes exposure</td></tr>
          <tr><td>Penalties</td><td>attempts × conversion</td><td>the player's share of team penalties; Bayesian conversion rate</td></tr>
          <tr><td>Goals conceded, clean sheets</td><td>Poisson, shared within the team</td><td>one team total per simulated match, thinned to each player's minutes</td></tr>
          <tr><td>Saves, penalty saves</td><td>Poisson</td><td>opponent strength, the keeper's save rate</td></tr>
          <tr><td>Yellow, red cards</td><td>binary (cloglog)</td><td>the player's card rate, opponent, league-wide card trend</td></tr>
          <tr><td>Defensive contributions</td><td>negative binomial</td><td>the player's tackle/clearance/recovery rates; 2 points at the threshold</td></tr>
          <tr><td>Minutes given a start</td><td>gradient-boosted classifier, 8-model ensemble</td><td>start history, recent minutes, squad position, fixture congestion</td></tr>
          <tr><td>Bonus</td><td>ranking within the match (Plackett–Luce)</td><td>simulated match events + the player's BPS rate; exactly 3-2-1 per match</td></tr>
        </tbody>
      </table>
      <p>Two design choices matter more than they look. Team-mates share one simulated goals-conceded total, so defenders keep or
        lose clean sheets together, as in reality. And bonus is a ranking, so team-mates compete for the same three, two and one
        points instead of each receiving bonus independently.</p>
      <h3>Simulation and uncertainty</h3>
      <p>For each player and fixture the model draws <i>J</i> = 40 sets of its own parameters (regression coefficients, talent shares,
        team strengths, the minutes model) and plays <i>R</i> = 25 matches with each, 1,000 simulations in all:</p>
      <Eq tex={String.raw`xP_{if} = \frac{1}{JR}\sum_{j=1}^{J}\sum_{r=1}^{R} \phi_s\!\left(E^{(j,r)}_{if}\right), \qquad \operatorname{Var}_{\text{epi}} = \operatorname{Var}_j\!\left(\bar P_j\right) - \frac{\overline{\operatorname{Var}_r}}{R}`} />
      <p>where φ applies the season's scoring rules to the simulated events E. The spread splits into match luck (aleatoric) and
        uncertainty about the model itself (epistemic). Per match the epistemic part is small, about 1% of the variance, but it is
        what makes season-long totals honest: a player's talent error repeats across their fixtures. Finally, goal and assist rates
        pass through a calibration curve fitted only on earlier seasons' out-of-sample forecasts, which corrects a slight
        over-confidence at the extremes.</p>

      <h2 id="testing">{H(2)}How it was tested</h2>
      <p>Each development season is predicted by a model fitted only on the seasons before it, and every number below is out of
        sample. A separate audit recomputes the features of randomly chosen predictions from raw records dated before the deadline
        and checks that they match exactly; it also checks that no single feature predicts the outcome suspiciously well, that every
        fold uses earlier data only, and that the simulator's rules reproduce real FPL totals. <b>All 15 tests pass.</b></p>
      <p>When the first version over-predicted the top-ranked players, the gap was diagnosed component by component under rules
        written before each run. That found two bugs (yellow cards, the bonus budget) and one structural error (clean sheets not
        shared), all fixed. Five further ideas were tested and <b>rejected</b> by the same rules: shorter-memory talent estimates,
        a clean-sheet drift correction, a joint match simulation, a regression on the bonus point system, and season-specific bonus
        rules.</p>

      <h2 id="results">{H(3)}Results</h2>
      <p>The fair comparison for a forecast of a starting player is <b>points per start</b> over their last five starts; a form
        baseline (points in the last five fixtures) is weaker still.</p>
      <AccuracyTable sets={[dev, sealed, live]} />
      <figure className="fig">
        <ReliabilityChart sets={[{ key: "dev", label: dev.label, data: dev.reliability, color: "var(--series-1)" }, { key: "sealed", label: sealed.label, data: sealed.reliability, color: "var(--series-2)" }]} />
        <figcaption><b>Figure 1. Reliability.</b> Starts grouped into 25 bins by predicted xP; each dot is the bin's mean actual
          points with a 95% interval (resampling whole matches). Points on the dashed line are perfectly calibrated. Overall,
          actual points were {dev.high_end.all.ratio.toFixed(3)} of predicted in development, {sealed.high_end.all.ratio.toFixed(3)} in
          2025-26 and {live.high_end.all.ratio.toFixed(3)} in 2026-27.</figcaption>
      </figure>
      <figure className="fig">
        <RatioChart lo={0.8} hi={1.2} rows={(["top5", "top10", "top20", "top40", "all"] as const).map((k) => ({
          label: k === "all" ? "All starters" : `Each GW's top ${k.slice(3)}`,
          series: [{ name: dev.label, color: "var(--series-1)", ...ratioOf(dev.high_end[k]) }, { name: sealed.label, color: "var(--series-2)", ...ratioOf(sealed.high_end[k]) }],
        }))} />
        <figcaption><b>Figure 2. The high end.</b> Actual divided by predicted points for the players the model ranks highest each
          gameweek, with 95% intervals. Development is calibrated at the top; in 2025-26 the top-ranked players fell about 6.5% short,
          mostly in goals, concentrated in a few premium players whose output dropped.</figcaption>
      </figure>
      <figure className="fig">
        <RatioChart lo={0.85} hi={1.15} rows={dev.components.map((c) => ({
          label: c.name,
          series: [{ name: dev.label, color: "var(--series-1)", r: c.ratio }, ...(sealed.components.find((s) => s.name === c.name) ? [{ name: sealed.label, color: "var(--series-2)", r: sealed.components.find((s) => s.name === c.name)!.ratio }] : [])],
        })).concat(sealed.components.filter((c) => !dev.components.some((x) => x.name === c.name)).map((c) => ({ label: c.name, series: [{ name: sealed.label, color: "var(--series-2)", r: c.ratio }] })))} />
        <figcaption><b>Figure 3. Each component, within about 10%.</b> Mean observed divided by mean predicted per start, for each
          scoring mechanism. The largest misses are in 2025-26: goals (6% over-predicted) and goalkeepers' save points (9% over).
          Defensive contributions have scored points only since 2025-26.</figcaption>
      </figure>
      <figure className="fig">
        <PitChart hist={dev.pit.hist} color="var(--series-1)" />
        <figcaption><b>Figure 4. Honest uncertainty.</b> For each start, where the actual score fell within its predicted
          distribution (randomised PIT). A flat histogram means the distributions are neither too narrow nor too wide: the central
          50% held {pct(dev.pit.c50)} of outcomes and the central 80% held {pct(dev.pit.c80)} (2025-26: {pct(sealed.pit.c50)} and {pct(sealed.pit.c80)}).</figcaption>
      </figure>

      <h2 id="ahead">{H(4)}Forecasting weeks ahead</h2>
      <p>Transfers are planned weeks ahead, so every gameweek from 2019-20 to 2025-26 was re-forecast from 1 to 8 gameweeks before
        it, with player features and team ratings frozen at the earlier deadline. The decision rule was fixed before scoring.</p>
      <div className="two" style={{ fontFamily: "var(--sans)" }}>
        <figure className="fig" style={{ margin: 0 }}>
          <HorizonChart pts={ev.horizon.map((x) => ({ h: x.h, v: x.mae }))} label="Mean absolute error by horizon" fmt={(v) => v.toFixed(3)} domain={[2.2, 2.3]} />
          <figcaption><b>Figure 5a.</b> Mean absolute error barely moves.</figcaption>
        </figure>
        <figure className="fig" style={{ margin: 0 }}>
          <HorizonChart pts={ev.horizon.map((x) => ({ h: x.h, v: x.rank }))} label="Rank correlation by horizon" fmt={(v) => v.toFixed(3)} domain={[0.25, 0.35]} />
          <figcaption><b>Figure 5b.</b> Within-gameweek ranking declines only slightly.</figcaption>
        </figure>
      </div>
      <p>Bias stays within ±0.04 points at every horizon, against a pre-registered limit of ±0.10. One part failed: simple
        bell-curve intervals for sums over a few gameweeks were too wide in the middle and slightly short in the tails, because a
        single match's points are lumpy and skewed. The site therefore shows multi-week sums without ranges until intervals built
        from the simulated distributions are validated.</p>

      <h2 id="benchmark">{H(5)}What about FPL's own projections?</h2>
      <p>The archived FPL expected-points field looks far stronger than any pre-deadline forecast — but it is not one. Regressing it on
        our forecast and on the player's actual points shows it depends strongly on the points of the very match it claims to
        forecast, and hardly at all on the next one. The archived value was evidently recorded after the match, so it cannot be used
        as a benchmark.</p>
      <p>A fair comparison needs FPL's projection captured <i>before</i> each deadline. Snapshots began on 11 October 2026, and from
        gameweek 7 every locked forecast is scored against FPL's projection taken at the same moment, and against its last projection
        before the deadline. <a href="#/record" onClick={() => go("record")}>See the live track record.</a></p>

      <h2 id="limits">{H(6)}Limitations</h2>
      <ul>
        <li><b>Starting is given.</b> xP assumes the player starts; picking a team needs your judgement on who will. Substitute appearances are not modelled.</li>
        <li><b>The very top in 2025-26.</b> The highest-ranked players were over-predicted by about 6.5%, mostly in goals.</li>
        <li><b>Bonus rule changes</b> reach the model only as new seasons accumulate; forwards' bonus is under-predicted by 5–10% in some seasons.</li>
        <li><b>Clean sheets drifted</b> in 2023-24 and 2024-25, a league-wide change no earlier data predicted.</li>
        <li><b>Team-mates' attacking returns</b> are simulated independently (they share goals conceded), so correlations between team-mates are not yet usable.</li>
        <li><b>Minutes given a start</b> are only modestly better predicted than simple baselines, because 94% of starts reach 60 minutes anyway.</li>
        <li><b>No clean held-out test remains</b> from before this season: the next one is the gameweeks still to be played, which is what the track record measures.</li>
      </ul>
      <p className="note">This is a condensed version. The full Results Report and Mathematical Formulation include the fitted
        coefficients, hyperparameters, feature definitions, every intermediate experiment and the complete audit tables.</p>
    </article>
  );
}

function AccuracyTable({ sets }: { sets: EvidenceSet[] }) {
  const rows: [string, (s: EvidenceSet) => Acc, boolean][] = [["xFPL model", (s) => s.accuracy.model, true], ["Points per start (last 5)", (s) => s.accuracy.pps5, false], ["Form (last 5 fixtures)", (s) => s.accuracy.form5, false]];
  return (
    <figure className="fig" style={{ overflowX: "auto" }}>
      <table className="plain">
        <thead>
          <tr><th>Test set</th><th>Method</th><th className="r">RMSE ↓</th><th className="r">Rank correlation ↑</th><th className="r">Top 10 actual pts ↑</th></tr>
        </thead>
        <tbody>
          {sets.flatMap((s) => rows.map(([name, get, ours], i) => (
            <tr key={s.label + name} className={ours ? "ours" : ""}>
              <td>{i === 0 ? <>{s.label}<div className="faint" style={{ fontSize: 11.5 }}>{s.starts.toLocaleString()} starts</div></> : ""}</td>
              <td>{name}</td>
              <td className="r">{get(s).rmse.toFixed(3)}</td>
              <td className="r">{get(s).rank.toFixed(3)}</td>
              <td className="r">{get(s).top10.toFixed(2)}</td>
            </tr>
          )))}
        </tbody>
      </table>
      <figcaption><b>Table 1. Accuracy among starters.</b> Rank correlation is the mean within-gameweek Spearman correlation
        between forecast and actual points; "top 10" is the mean actual score of each gameweek's ten highest forecasts.</figcaption>
    </figure>
  );
}

function Architecture() {
  const box = (x: number, y: number, w: number, label: string, sub: string, strong = false) => (
    <g>
      <rect x={x} y={y} width={w} height={46} rx={8} fill={strong ? "var(--accent-soft)" : "var(--panel)"} stroke={strong ? "var(--accent)" : "var(--line-strong)"} />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" style={{ fill: "var(--text)", fontWeight: 650, fontSize: 12.5 }}>{label}</text>
      <text x={x + w / 2} y={y + 36} textAnchor="middle" style={{ fontSize: 10.5 }}>{sub}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--faint)" strokeWidth={1.3} markerEnd="url(#ah)" />;
  return (
    <figure className="fig">
      <svg viewBox="0 0 700 250" style={{ width: "100%", height: "auto" }} role="img" aria-label="Model architecture">
        <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--faint)" /></marker></defs>
        <text x={80} y={14} textAnchor="middle" style={{ fontSize: 10.5, letterSpacing: ".08em" }}>INPUTS</text>
        <text x={290} y={14} textAnchor="middle" style={{ fontSize: 10.5, letterSpacing: ".08em" }}>SUB-MODELS</text>
        <text x={520} y={14} textAnchor="middle" style={{ fontSize: 10.5, letterSpacing: ".08em" }}>SIMULATION</text>
        {box(10, 26, 140, "Match results & xG", "6 leagues, since 2014")}
        {box(10, 98, 140, "Player histories", "Understat + FPL")}
        {box(10, 170, 140, "Fixture list", "known at the deadline")}
        {box(210, 26, 160, "Team strength", "attack & defence ratings")}
        {box(210, 98, 160, "Player talent", "shrunk shares of team output")}
        {box(210, 170, 160, "Minutes & events", "one model per scoring event")}
        {box(430, 98, 180, "1,000 simulated matches", "events → bonus ranking → points", true)}
        {box(450, 182, 140, "Points distribution", "xP, ranges, haul chance")}
        {arrow(150, 49, 210, 49)}{arrow(150, 121, 210, 121)}{arrow(150, 193, 210, 193)}{arrow(150, 121, 210, 193)}
        {arrow(370, 49, 430, 112)}{arrow(370, 121, 430, 121)}{arrow(370, 193, 430, 130)}
        {arrow(520, 144, 520, 182)}
      </svg>
      <figcaption><b>Figure 0. Architecture.</b> Team strength, player talent and minutes are estimated separately and meet only
        inside the simulation, where events are drawn, bonus is ranked given the events, and points are scored.</figcaption>
    </figure>
  );
}
