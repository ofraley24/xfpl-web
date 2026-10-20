import { useEffect, useMemo } from "react";
import { fmtStat, percentile, STAT, statValue, useStats, type RecentMatch, type Window } from "../stats";
import { fixtureKey, fmt, partsInPoints, pct, useApp, useStored } from "../data";
import { PmfBars, PosChip, StatusChip } from "../ui";

const PART_COL: Record<string, string> = {
  app: "var(--line-strong)", goals: "var(--series-2)", assists: "var(--series-1)", cs: "var(--series-3)", bonus: "var(--series-4)",
  saves: "var(--pos-GKP)", dc: "var(--pos-MID)", pen_saved: "var(--series-1)", conceded: "var(--faint)", cards: "var(--faint)", other: "var(--faint)",
};

export default function PlayerDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { d, excluded, toggleFixture, compare, toggleCompare, from, to, mode } = useApp();
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
        {p.news && <div className="newsbox"><b>FPL news</b> · {p.news}</div>}

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

        <RecentForm id={p.id} />
        <SeasonStats id={p.id} />

        <h3 style={{ marginTop: 18 }}>Forecast fixtures</h3>
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
                {f.p_start !== undefined && (
                  <div className="row muted" style={{ fontSize: 12, gap: 12 }}>
                    <span title="Chance he starts (availability model; FPL's injury flags applied as a rule of thumb)">starts {pct(f.p_start)}</span>
                    <span title="Chance he comes off the bench">comes on {pct(f.p_sub ?? 0)}</span>
                    <span title="Chance he does not play (0 points)">doesn't play {pct(Math.max(1 - f.p_start - (f.p_sub ?? 0), 0))}</span>
                    {mode === "full"
                      ? <span title="Expected points if he starts">if he starts: {fmt(f.xp_start ?? f.xp, 2)}</span>
                      : f.full && <span title="Expected points weighted by the chance he starts or comes on">full model: {fmt(f.full.xp, 2)}</span>}
                  </div>
                )}
                {f.probs && (
                  <div className="row muted" style={{ fontSize: 12, gap: 12 }}>
                    <span title="Chance of scoring">goal {pct(f.probs.g)}</span>
                    <span title="Chance of an assist">assist {pct(f.probs.a)}</span>
                    {p.pos !== "FWD" && <span title="Chance of a clean sheet with 60+ minutes">clean sheet {pct(f.probs.cs)}</span>}
                    {p.pos !== "GKP" && <span title="Chance of reaching the defensive-contribution threshold (+2)">def. contribution {pct(f.probs.dc)}</span>}
                    {p.pos === "GKP" && <span title="Chance of 3+ saves">save pts {pct(f.probs.sv)}</span>}
                    <span title="Chance of any bonus">bonus {pct(f.probs.b)}</span>
                  </div>
                )}
                {f.pmf && <PmfBars pmf={f.pmf} width={480} height={46} maxPts={20} />}
              </div>
            );
          })}
        </div>
        <p className="faint" style={{ marginTop: 12 }}>{mode === "start"
          ? "All figures assume the player starts."
          : "Figures are the full model: the chance he starts or comes on times the points in each case; a fixture he misses scores 0."} Distributions come from 1,000 simulated matches per fixture.</p>
      </aside>
    </>
  );
}

/** What actually happened in the player's last six team fixtures (appearances or not), plus the season so far. */
function RecentForm({ id }: { id: number }) {
  const { d } = useApp();
  const { doc } = useStats();
  const sp = doc?.players.find((x) => x.id === id);
  if (!doc) return null;
  if (!sp?.recent?.length) return <p className="faint" style={{ marginTop: 16 }}>No league minutes this season yet.</p>;
  const t = sp.s.season;
  const res = (m: RecentMatch) => {
    if (!m.score) return "";
    const [h, a] = m.score.split("-").map(Number);
    const [f, ag] = m.home ? [h, a] : [a, h];
    return `${f > ag ? "W" : f < ag ? "L" : "D"} ${f}-${ag}`;
  };
  const sum = (k: keyof RecentMatch) => sp.recent!.reduce((s, m) => s + (m[k] as number), 0);
  return (
    <div style={{ marginTop: 18 }}>
      <h3>Recent matches</h3>
      <p className="faint" style={{ margin: "0 0 6px", fontSize: 12 }}>
        Season so far: {t.apps} apps · {t.mins} mins · {t.g} G · {t.a} A · {(t.uxg ?? 0).toFixed(2)} xG · {(t.uxa ?? 0).toFixed(2)} xA · {t.pts} pts
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="plain" style={{ fontSize: 12.5 }}>
          <thead><tr>
            <th>GW</th><th>Opponent</th><th className="r" title="Minutes played">Min</th>
            <th className="r" title="Goals">G</th><th className="r" title="Assists">A</th>
            <th className="r" title="Expected goals (Understat)">xG</th><th className="r" title="Expected assists (Understat)">xA</th>
            <th className="r" title="Shots">Sh</th><th className="r" title="Key passes: shots set up">KP</th>
            <th className="r" title="Bonus points">B</th><th className="r" title="FPL points">Pts</th>
          </tr></thead>
          <tbody>
            {sp.recent.map((m) => (
              <tr key={m.gw + "-" + m.opp} style={{ opacity: m.mins === 0 ? 0.55 : 1 }}>
                <td>{m.gw}</td>
                <td>{m.home ? "" : "@ "}{d.teams.get(m.opp)?.short} <span className="faint">{res(m)}</span></td>
                <td className="r">{m.mins === 0 ? "–" : m.start ? m.mins : <span title="came off the bench">{m.mins}*</span>}</td>
                <td className="r">{m.g || ""}</td><td className="r">{m.a || ""}</td>
                <td className="r">{m.mins ? m.xg.toFixed(2) : ""}</td><td className="r">{m.mins ? m.xa.toFixed(2) : ""}</td>
                <td className="r">{m.mins ? m.shots : ""}</td><td className="r">{m.mins ? m.kp : ""}</td>
                <td className="r">{m.bonus || ""}</td><td className="r"><b>{m.pts}</b></td>
              </tr>
            ))}
            <tr style={{ borderTop: "1.5px solid var(--text)" }}>
              <td colSpan={2} className="muted">Last {sp.recent.length}</td><td className="r">{sum("mins")}</td>
              <td className="r">{sum("g")}</td><td className="r">{sum("a")}</td>
              <td className="r">{sum("xg").toFixed(2)}</td><td className="r">{sum("xa").toFixed(2)}</td>
              <td className="r">{sum("shots")}</td><td className="r">{sum("kp")}</td><td className="r">{sum("bonus")}</td>
              <td className="r"><b>{sum("pts")}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="faint" style={{ margin: "4px 0 0", fontSize: 11.5 }}>* came off the bench · – did not play. xG, xA, shots and key passes from Understat.</p>
    </div>
  );
}

const SEASON_GROUPS: Record<string, string[]> = {
  Attack: ["g", "uxg", "npxg", "shots", "sot", "big", "xgps"],
  Creation: ["a", "uxa", "kp", "xgchain", "xgbuildup", "cre"],
  Defence: ["dc", "dc_hits", "cbi", "tkl", "rec", "cs", "fxgc"],
  FPL: ["pts", "bonus", "bps", "ict", "yc"],
};
const GK_GROUPS: Record<string, string[]> = {
  Goalkeeping: ["saves", "gp", "gc", "fxgc", "cs", "pen_saved"],
  FPL: ["pts", "bonus", "bps", "ict", "yc"],
};
const MIN_MINS = 270;

/** Season (or last-four) totals or per-90 rates, each with its percentile among players in the same position. */
function SeasonStats({ id }: { id: number }) {
  const { doc } = useStats();
  const [w, setW] = useStored<Window>("drawer:window", "season");
  const [per90, setPer90] = useStored<boolean>("drawer:per90", true);
  const sp = doc?.players.find((x) => x.id === id);
  const peers = useMemo(() => (doc && sp ? doc.players.filter((x) => x.pos === sp.pos && (x.s[w].mins ?? 0) >= MIN_MINS) : []), [doc, sp, w]);
  if (!doc || !sp || !(sp.s.season.mins ?? 0)) return null;
  const groups = sp.pos === "GKP" ? GK_GROUPS : SEASON_GROUPS;
  const enough = (sp.s[w].mins ?? 0) >= MIN_MINS;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Underlying stats</h3>
        <span className="row" style={{ gap: 6 }}>
          <span className="seg">{(["season", "last4"] as const).map((x) => <button key={x} className={w === x ? "on" : ""} onClick={() => setW(x)}>{x === "season" ? "season" : "last 4 GWs"}</button>)}</span>
          <span className="seg"><button className={!per90 ? "on" : ""} onClick={() => setPer90(false)}>total</button><button className={per90 ? "on" : ""} onClick={() => setPer90(true)}>per 90</button></span>
        </span>
      </div>
      <p className="faint" style={{ margin: "4px 0 8px", fontSize: 12 }}>
        {sp.s[w].mins ?? 0} minutes. Bars show the percentile among {sp.pos === "GKP" ? "goalkeepers" : sp.pos === "DEF" ? "defenders" : sp.pos === "MID" ? "midfielders" : "forwards"} with {MIN_MINS}+ minutes{enough ? "" : " (too few minutes to rank him)"}.
      </p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {Object.entries(groups).map(([g, keys]) => (
          <div key={g}>
            <div className="nav-label" style={{ margin: "0 0 4px" }}>{g}</div>
            {keys.map((k) => {
              const def = STAT.get(k)!;
              const x = statValue(sp, w, k, per90);
              const pc = enough && x !== null ? percentile(peers.map((q) => statValue(q, w, k, per90)).filter((y): y is number => y !== null), x, def.low) : null;
              return (
                <div key={k} title={def.desc} style={{ display: "grid", gridTemplateColumns: "1fr 54px 60px", alignItems: "center", gap: 6, fontSize: 12.5, padding: "1px 0" }}>
                  <span className="muted">{def.label}{per90 && def.per90 ? <span className="faint">/90</span> : ""}</span>
                  <span className="r num">{fmtStat(k, x, per90)}</span>
                  <span style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }} title={pc === null ? undefined : `${Math.round(100 * pc)}th percentile`}>
                    {pc !== null && <span style={{ display: "block", height: "100%", width: `${Math.max(3, 100 * pc)}%`, background: "var(--seq-4)" }} />}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="faint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>xG, xA, shots, key passes, xGChain and xGBuildup from Understat; the rest from FPL. These are what happened; the forecast above is what the model expects.</p>
    </div>
  );
}
