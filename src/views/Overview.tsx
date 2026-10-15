import { useMemo } from "react";
import { go } from "../App";
import { fixtureKey, fmt, POSITIONS, rangeXp, useApp } from "../data";
import { atLeast } from "../prob";
import type { Player, Pmf } from "../types";
import { PlayerName, PmfBars, PosChip, StatusChip, TeamShort } from "../ui";

const PILLARS = [
  { title: "Team strength that moves", anchor: "team-strength",
    body: "Every club carries an attack and a defence rating, updated after each match from the chances it created and allowed, not just the scoreline. Home advantage and league scoring levels are learned as the seasons change." },
  { title: "Talent, separated from the team", anchor: "player-talent",
    body: "Each player is measured by their share of their team's attack — shots, shot quality, chances created — across six leagues, with lucky streaks filtered out statistically before they reach a forecast." },
  { title: "Built from the bottom up", anchor: "scoring-events",
    body: "Goals, assists, clean sheets, saves, cards, defensive work and bonus are each modelled on their own, then combined in a thousand simulated matches, where team-mates share clean sheets and compete for bonus as they do on the pitch." },
];

export default function Overview() {
  const { d, excluded } = useApp();
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
  const deadline = new Date(d.fc.deadline_utc);

  return (
    <div className="grid" style={{ gap: 28 }}>
      <header>
        <div className="kicker">Gameweek {gw} · deadline {deadline.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
        <h1>Expected points, measured honestly.</h1>
        <p className="lede">xFPL is a points model built from the ground up: dynamic team-strength ratings, player talent
          separated from team quality, and every goal, assist, clean sheet and bonus point played out a thousand times per
          fixture, on more than a decade of shot-level data.</p>
      </header>

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

      <SameXp starters={starters} gw={gw} />

      <section aria-label="How it's built">
        <div className="three" style={{ gap: 22 }}>
          {PILLARS.map((p, i) => (
            <div key={p.title} className="pillar">
              <div className="pillar-no">{String(i + 1).padStart(2, "0")}</div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <a href={`#/paper/${p.anchor}`} className="pillar-link">How it works →</a>
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
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("planner")}>Open player analysis →</button>
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

/** Two probable starters with almost the same xP but very different distributions: why the full distribution matters. */
function SameXp({ starters, gw }: { starters: Player[]; gw: number }) {
  const pick = useMemo(() => {
    const one = starters.map((p) => {
      const fx = p.fixtures.filter((f) => f.gw === gw);
      return fx.length === 1 && fx[0].pmf ? { p, xp: fx[0].xp, pm: fx[0].pmf as Pmf, haul: atLeast(fx[0].pmf, 10), blank: 1 - atLeast(fx[0].pmf, 3) } : null;
    }).filter((x): x is NonNullable<typeof x> => !!x && x.xp >= 4);
    let best: [typeof one[0], typeof one[0]] | null = null, gap = 0;
    for (let i = 0; i < one.length; i++) for (let j = i + 1; j < one.length; j++) {
      const a = one[i], b = one[j];
      if (a.p.pos !== b.p.pos || Math.abs(a.xp - b.xp) > 0.1) continue;   // like for like: same position, same xP
      const g = Math.abs(a.haul - b.haul);
      if (g > gap) { gap = g; best = a.haul > b.haul ? [a, b] : [b, a]; }
    }
    return best;
  }, [starters, gw]);
  if (!pick) return null;
  const [hi, lo] = pick;
  const card = (x: typeof hi, tag: string) => (
    <div className="panel" style={{ flex: 1, minWidth: 260 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><PosChip pos={x.p.pos} /> <PlayerName p={x.p} /> <span className="faint"><TeamShort id={x.p.team} /></span></span>
        <span className="metric-note">{tag}</span></div>
      <div className="row" style={{ gap: 18, margin: "8px 0 4px" }}>
        <span><span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>{fmt(x.xp, 1)}</span> <span className="muted">xP</span></span>
        <span><b>{(100 * x.haul).toFixed(0)}%</b> <span className="muted">chance of 10+</span></span>
        <span><b>{(100 * x.blank).toFixed(0)}%</b> <span className="muted">blank risk</span></span>
      </div>
      <PmfBars pmf={x.pm} width={300} height={56} maxPts={20} />
    </div>
  );
  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>Same xP, different stories</h2>
        <span className="metric-note">two {({ GKP: "goalkeepers", DEF: "defenders", MID: "midfielders", FWD: "forwards" } as const)[hi.p.pos]} · gameweek {gw} · full points distributions</span>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>Expected points are only the average. Every xFPL forecast is a full distribution of
        points, so you can see whether a player is a steady earner or a boom-or-bust bet, and choose the one that suits your rank.</p>
      <div className="row" style={{ alignItems: "stretch", gap: 16 }}>{card(hi, "more upside")}{card(lo, "steadier")}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={() => go("risk")}>Explore risk & upside →</button>
        <span className="faint" style={{ fontSize: 12.5 }}>Protect a lead with players whose bad weeks are still decent, or chase a rival with upside, and see what it costs in xP.</span>
      </div>
    </section>
  );
}
