import { useMemo, useState } from "react";
import { fixtureKey, fmt, POSITIONS, useApp, useStored, XP_LABEL } from "../data";
import { useJson } from "../evidence";
import type { Player, Pos } from "../types";
import { PlayerName, PosChip, StatusChip, TeamShort } from "../ui";

// Shape of public/data/elite_ownership.json, written by xFPL/pipeline/12_fetch_elite_ownership.py (schema 1).
// Fractions throughout (0.5 = 50%); EO is a mean multiplier (captain 2, triple captain 3), so it can exceed 1.
interface ElitePlayer {
  id: number;
  web_name: string;
  overall_own: number;
  top10k_own: number; top10k_start: number; top10k_captain: number; top10k_eo: number;
  top100k_own: number; top100k_start: number; top100k_captain: number; top100k_eo: number;
  top100k_own_moe: number; top100k_start_moe: number; top100k_captain_moe: number; top100k_eo_moe: number;
}
interface Elite {
  schema: number;
  season: string;
  gw: number;
  run_utc: string;
  standings_last_updated: string | null;
  top10k_managers: number;
  top100k_sample_managers: number;
  top10k_chips: Record<string, number>;
  players: ElitePlayer[];
}

type Tier = "top10k" | "top100k";
type SortKey = "eo" | "own" | "captain" | "start" | "overall" | "xp" | "gain" | "capgain";

const pc = (x: number, d = 1) => (100 * x).toFixed(d);
const CHIP: Record<string, string> = { "3xc": "triple captain", bboost: "bench boost", freehit: "free hit", wildcard: "wildcard" };

export default function Elite() {
  const { d, excluded, mode } = useApp();
  const { v: el, err } = useJson<Elite>("./data/elite_ownership.json");
  const [tier, setTier] = useStored<Tier>("el:tier", "top10k");
  const [pos, setPos] = useStored<Pos | "ALL">("el:pos", "ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: "eo", desc: true });
  const [limit, setLimit] = useState(50);
  const gw = d.fc.deadline_gw;

  const rows = useMemo(() => {
    if (!el) return [];
    const s = q.trim().toLowerCase();
    const xpNext = (p: Player) => p.fixtures.filter((f) => f.gw === gw && !excluded.has(fixtureKey(p.id, f.fixture))).reduce((a, f) => a + f.xp, 0);
    return el.players.flatMap((e) => {
      const p = d.byId.get(e.id);
      if (!p || (pos !== "ALL" && p.pos !== pos)) return [];
      if (s && !p.name.toLowerCase().includes(s) && !p.full_name.toLowerCase().includes(s)) return [];
      const eo = e[`${tier}_eo`];
      const xp = xpNext(p);
      return [{
        p, e, xp, eo,
        own: e[`${tier}_own`], start: e[`${tier}_start`], captain: e[`${tier}_captain`],
        moe: tier === "top100k" ? { own: e.top100k_own_moe, eo: e.top100k_eo_moe, captain: e.top100k_captain_moe, start: e.top100k_start_moe } : null,
        // points gained on the average elite manager: you score m x xP, they score EO x xP on average
        gain: xp * (1 - eo),
        capgain: xp * (2 - eo),
      }];
    });
  }, [el, d, tier, pos, q, gw, excluded]);

  const sorted = useMemo(() => {
    const key = (r: (typeof rows)[number]) => (sort.k === "overall" ? r.e.overall_own : r[sort.k]);
    return [...rows].sort((a, b) => (sort.desc ? key(b) - key(a) : key(a) - key(b)));
  }, [rows, sort]);

  const th = (k: SortKey, label: string, title?: string) => (
    <th key={k} className={`r ${sort.k === k ? "sorted" : ""}`} title={title} onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : true }))}>
      {label}{sort.k === k ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );
  const withMoe = (x: number, moe: number | undefined) => (
    <>{pc(x)}{moe !== undefined && moe >= 0.0005 ? <span className="faint" style={{ fontSize: 11 }}> ±{pc(moe)}</span> : null}</>
  );

  if (err) return <div className="panel">No elite ownership file yet ({err}).</div>;
  if (!el) return <div className="muted">Loading elite ownership…</div>;
  const chips = Object.entries(el.top10k_chips).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => { const x = 100 * n / el.top10k_managers; return `${x < 1 ? "<1" : x.toFixed(0)}% ${CHIP[k] ?? k}`; }).join(", ");
  const stale = el.gw < gw;

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <h2>Elite ownership</h2>
            <p className="sub">What the top 10,000 and top 100,000 managers own, start and captain, and their effective ownership (EO):
              the average multiplier on a player's points across those teams (starter 1, captain 2, triple captain 3, bench 0).</p>
          </div>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>
          <b>Gameweek {el.gw} teams{stale ? `, not gameweek ${gw}'s` : ""}.</b>{" "}
          {stale && <>FPL hides everyone's picks until the deadline, so these are the teams entered at the last deadline:
            they miss this week's transfers and captain changes. </>}
          Top 10k: all {el.top10k_managers.toLocaleString()} managers. Top 100k: those plus a random sample of {el.top100k_sample_managers.toLocaleString()} from
          ranks 10,001–100,000; ± is the 95% sampling margin. Top-10k chips in GW{el.gw}: {chips || "none"}.
        </p>
        <div className="row">
          <div className="seg">
            <button className={tier === "top10k" ? "on" : ""} onClick={() => setTier("top10k")}>Top 10k</button>
            <button className={tier === "top100k" ? "on" : ""} onClick={() => setTier("top100k")}>Top 100k</button>
          </div>
          <div className="seg">
            {(["ALL", ...POSITIONS] as const).map((x) => (
              <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>
            ))}
          </div>
          <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{rows.length} players</span>
        </div>
      </div>

      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              {th("overall", "All %", "Share of all FPL managers who own him (FPL, now)")}
              {th("own", "Own %", `Share of the ${tier === "top10k" ? "top 10k" : "top 100k"} with him in their 15`)}
              {th("start", "Start %", "Share with him in the starting XI")}
              {th("captain", "Capt %", "Share who captained him (triple captain included)")}
              {th("eo", "EO %", "Effective ownership: average multiplier on his points across these teams")}
              {th("xp", `xP GW${gw}`, `Expected points, ${XP_LABEL[mode]}`)}
              {th("gain", "Gain if owned", "xP × (1 − EO): expected points gained on the average elite manager by starting him (negative: you still lose ground on those who captain him)")}
              {th("capgain", "Gain if captained", "xP × (2 − EO): expected points gained on the average elite manager by captaining him")}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((r) => (
              <tr key={r.p.id}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><StatusChip p={r.p} /></div></td>
                <td><TeamShort id={r.p.team} /></td>
                <td className="r num muted">{pc(r.e.overall_own)}</td>
                <td className="r num">{withMoe(r.own, r.moe?.own)}</td>
                <td className="r num">{withMoe(r.start, r.moe?.start)}</td>
                <td className="r num">{withMoe(r.captain, r.moe?.captain)}</td>
                <td className="r num"><b>{withMoe(r.eo, r.moe?.eo)}</b></td>
                <td className="r num">{fmt(r.xp)}</td>
                <td className="r num" style={{ color: r.gain < 0 ? "var(--neg, #c0392b)" : undefined }}>{r.gain >= 0 ? "+" : ""}{fmt(r.gain, 2)}</td>
                <td className="r num" style={{ color: r.capgain < 0 ? "var(--neg, #c0392b)" : undefined }}>{r.capgain >= 0 ? "+" : ""}{fmt(r.capgain, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => setLimit((l) => l + 50)}>Show more ({sorted.length - limit} left)</button>
        </div>
      )}
      <p className="faint" style={{ fontSize: 12 }}>
        Rank moves on the difference between your points and the field's. If a player scores x points, you gain x × (your multiplier − EO) on the
        average elite manager: starting a player whose EO is 30% gains 0.7 x, and a player at 130% EO (widely captained) costs you 0.3 x
        even if you start him, unless you captain him too. The gain columns apply this to the gameweek {gw} xP; they are averages, and the
        same xP can come from very different spreads of points (see Risk & upside). EO is from gameweek {el.gw} teams.
      </p>
    </div>
  );
}
