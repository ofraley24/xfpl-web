import { useMemo, useState } from "react";
import { fixtureKey, POSITIONS, useApp, useStored, XP_LABEL } from "../data";
import type { Player, Pos, Probs } from "../types";
import { PlayerName, PosChip, StatusChip, TeamShort, tint } from "../ui";

type Key = keyof Probs;
const COLS: { k: Key; label: string; title: string; only?: Pos[]; not?: Pos[] }[] = [
  { k: "g", label: "Goal", title: "Chance of scoring at least once" },
  { k: "g2", label: "2+ goals", title: "Chance of a brace or better" },
  { k: "a", label: "Assist", title: "Chance of at least one assist" },
  { k: "cs", label: "Clean sheet", title: "Chance of a clean sheet with 60+ minutes on the pitch (the FPL rule)", not: ["FWD"] },
  { k: "dc", label: "Def. contribution", title: "Chance of reaching the defensive-contribution threshold (DEF 10, MID/FWD 12): +2 points", not: ["GKP"] },
  { k: "b", label: "Any bonus", title: "Chance of at least one bonus point" },
  { k: "b3", label: "3 bonus", title: "Chance of the maximum 3 bonus points" },
  { k: "sv", label: "Save points", title: "Chance of 3+ saves (at least one save point)", only: ["GKP"] },
  { k: "yc", label: "Yellow", title: "Chance of a yellow card (−1)" },
];
const LEADERS: { k: Key; title: string; not?: Pos[] }[] = [
  { k: "g", title: "Most likely to score" }, { k: "a", title: "Most likely to assist" },
  { k: "cs", title: "Clean sheet", not: ["MID", "FWD"] }, { k: "dc", title: "Defensive contribution", not: ["GKP"] },
];

/** Chance of each event for a player in a gameweek: one fixture as is; a double gameweek as "at least once". */
function gwProbs(p: Player, gw: number, excluded: Set<string>) {
  const fx = p.fixtures.filter((f) => f.gw === gw && !excluded.has(fixtureKey(p.id, f.fixture)) && f.probs);
  if (!fx.length) return null;
  const out = {} as Probs;
  for (const c of COLS) out[c.k] = 1 - fx.reduce((s, f) => s * (1 - (f.probs![c.k] ?? 0)), 1);
  return { probs: out, fx };
}

export default function Events() {
  const { d, excluded, mode } = useApp();
  const [gw, setGw] = useState(d.gws[0]);
  const [pos, setPos] = useStored<Pos | "ALL">("ev:pos", "ALL");
  const [team, setTeam] = useStored<number>("ev:team", 0);
  const [starters, setStarters] = useStored<boolean>("ev:starters", true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: Key; desc: boolean }>({ k: "g", desc: true });
  const [limit, setLimit] = useState(50);
  const hasProbs = d.players.some((p) => p.fixtures.some((f) => f.probs));

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.players
      .filter((p) => (pos === "ALL" || p.pos === pos) && (!team || p.team === team) && (!s || p.name.toLowerCase().includes(s)))
      .filter((p) => !starters || p.fixtures.some((f) => f.gw === gw && f.xi))
      .map((p) => ({ p, r: gwProbs(p, gw, excluded) }))
      .filter((x): x is { p: Player; r: NonNullable<ReturnType<typeof gwProbs>> } => !!x.r);
  }, [d, gw, pos, team, starters, q, excluded]);
  const colMax = useMemo(() => Object.fromEntries(COLS.map((c) => [c.k, Math.max(0.01, ...rows.map((x) => x.r.probs[c.k]))])), [rows]);
  const sorted = useMemo(() => [...rows].sort((a, b) => (sort.desc ? b.r.probs[sort.k] - a.r.probs[sort.k] : a.r.probs[sort.k] - b.r.probs[sort.k])), [rows, sort]);
  const pct = (v: number) => (v >= 0.995 ? ">99%" : v < 0.005 ? "<1%" : `${Math.round(100 * v)}%`);
  const shade = (v: number, k: Key) => tint(v / colMax[k]);
  const applies = (c: (typeof COLS)[number], p: Player) => (!c.only || c.only.includes(p.pos)) && (!c.not || !c.not.includes(p.pos));

  if (!hasProbs) return <div className="panel">This forecast predates event probabilities; they arrive with the next forecast.</div>;
  return (
    <div className="grid">
      <div className="panel">
        <h2>Player Props</h2>
        <p className="sub">Every way of scoring has its own model: goals, assists, clean sheets, defensive contributions, bonus,
          saves and cards. These are the chances each one happens, player by player and fixture by fixture, from the same
          simulated matches as xP ({XP_LABEL[mode]}).</p>
        <div className="row">
          <div className="seg">{d.gws.map((g) => <button key={g} className={gw === g ? "on" : ""} onClick={() => setGw(g)}>GW{g}</button>)}</div>
          <div className="seg">{(["ALL", ...POSITIONS] as const).map((x) => <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>)}</div>
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
            <option value={0}>All teams</option>
            {[...d.teams.values()].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={starters} onChange={(e) => setStarters(e.target.checked)} /> probable starters</label>
          <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        {LEADERS.map((L) => {
          const top = rows.filter((x) => !L.not || !L.not.includes(x.p.pos)).sort((a, b) => b.r.probs[L.k] - a.r.probs[L.k]).slice(0, 5);
          return (
            <div key={L.k} className="panel">
              <h3>{L.title}</h3>
              <table className="plain"><tbody>
                {top.map((x, i) => (
                  <tr key={x.p.id}><td className="faint num" style={{ width: 18, paddingRight: 0 }}>{i + 1}</td>
                    <td><PlayerName p={x.p} /> <span className="faint" style={{ fontSize: 11.5 }}>{opps(d, x.r.fx)}</span></td>
                    <td className="r serif" style={{ fontSize: 17, fontWeight: 600 }}>{pct(x.r.probs[L.k])}</td></tr>
                ))}
              </tbody></table>
            </div>
          );
        })}
      </section>

      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>Player</th><th>Team</th><th>Opp</th>
              {mode === "full" && <th className="r" title="Chance of starting">Start</th>}
              {COLS.map((c) => (
                <th key={c.k} className={`r ${sort.k === c.k ? "sorted" : ""}`} title={c.title} onClick={() => setSort((o) => ({ k: c.k, desc: o.k === c.k ? !o.desc : true }))}>
                  {c.label}{sort.k === c.k ? (sort.desc ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map(({ p, r }) => (
              <tr key={p.id}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={p.pos} /><PlayerName p={p} /><StatusChip p={p} /></div></td>
                <td><TeamShort id={p.team} /></td>
                <td className="muted">{opps(d, r.fx)}</td>
                {mode === "full" && <td className="r num muted">{pct(r.fx[0].p_start ?? 1)}</td>}
                {COLS.map((c) => applies(c, p)
                  ? <td key={c.k} className="r num" style={shade(r.probs[c.k], c.k)}>{pct(r.probs[c.k])}</td>
                  : <td key={c.k} className="r faint">–</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && <div className="row" style={{ justifyContent: "center" }}><button className="btn" onClick={() => setLimit((l) => l + 50)}>Show more ({sorted.length - limit} left)</button></div>}
      <p className="faint" style={{ fontSize: 12.5 }}>{mode === "full"
        ? "Full model: each chance mixes a start, a substitute appearance and no appearance, so rotation risk lowers it."
        : "If starting: each chance assumes the player starts. Switch to the full model to include rotation risk."}
        {" "}Double gameweeks show the chance of at least once across both fixtures.</p>
    </div>
  );
}

function opps(d: ReturnType<typeof useApp>["d"], fx: { opp: number; home: boolean }[]) {
  return fx.map((f) => (f.home ? d.teams.get(f.opp)?.short : d.teams.get(f.opp)?.short.toLowerCase())).join(", ");
}
