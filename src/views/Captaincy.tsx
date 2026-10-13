import { Fragment, useMemo, useState } from "react";
import { fixtureKey, fmt, pct, useApp, useStored } from "../data";
import { atLeast, beats, sumAll } from "../prob";
import type { Player, Pmf } from "../types";
import { PlayerName, PlayerSearch, PmfBars, PosChip, StatusChip, TeamShort } from "../ui";

/** A player's points distribution for one gameweek (doubles convolved), or null. */
export function gwPmf(p: Player, gw: number, excluded: Set<string>): Pmf | null {
  const fx = p.fixtures.filter((f) => f.gw === gw && !excluded.has(fixtureKey(p.id, f.fixture)));
  if (!fx.length || fx.some((f) => !f.pmf)) return null;
  return sumAll(fx.map((f) => f.pmf!));
}

export default function Captaincy() {
  const { d, excluded, squad } = useApp();
  const [gw, setGw] = useState(d.gws[0]);
  const [scope, setScope] = useStored<"all" | "squad">("cap:scope", "all");
  const [open, setOpen] = useState<number | null>(null);
  const rows = useMemo(() => {
    const pool = scope === "squad" ? squad.map((id) => d.byId.get(id)!).filter(Boolean)
      : d.players.filter((p) => p.fixtures.some((f) => f.gw === gw && f.xi));
    return pool.map((p) => {
      const pm = gwPmf(p, gw, excluded);
      const fx = p.fixtures.filter((f) => f.gw === gw && !excluded.has(fixtureKey(p.id, f.fixture)));
      const xp = fx.reduce((s, f) => s + f.xp, 0);
      return { p, pm, xp, fx, p10: pm ? atLeast(pm, 10) : 1 - fx.reduce((s, f) => s * (1 - f.p10), 1),
        p15: pm ? atLeast(pm, 15) : NaN, blank: pm ? 1 - atLeast(pm, 3) : NaN };
    }).filter((r) => r.fx.length).sort((a, b) => b.xp - a.xp).slice(0, 25);
  }, [d, gw, scope, squad, excluded]);

  return (
    <div className="grid">
      <div className="panel">
        <h2>Captaincy</h2>
        <p className="sub">Who to give the armband. Captain points are double the player's score, so a 10-point haul becomes 20.</p>
        <div className="row">
          <div className="seg">{d.gws.map((g) => <button key={g} className={gw === g ? "on" : ""} onClick={() => setGw(g)}>GW{g}</button>)}</div>
          <div className="seg">
            <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>all probable starters</button>
            <button className={scope === "squad" ? "on" : ""} onClick={() => setScope("squad")}>my squad</button>
          </div>
        </div>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr><th>#</th><th>Player</th><th>Opp</th><th className="r">xP</th><th className="r">as captain</th>
              <th className="r" title="Chance of 10+ points (20+ as captain)">haul 10+</th><th className="r">15+</th>
              <th className="r" title="Chance of 2 points or fewer">blank ≤2</th><th className="r">Own</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Fragment key={r.p.id}>
                <tr>
                  <td className="muted">{i + 1}</td>
                  <td><div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><StatusChip p={r.p} /><TeamShort id={r.p.team} /></div></td>
                  <td>{r.fx.map((f) => (f.home ? d.teams.get(f.opp)?.short : d.teams.get(f.opp)?.short.toLowerCase())).join(", ")}</td>
                  <td className="r num"><b>{fmt(r.xp, 2)}</b></td>
                  <td className="r num">{fmt(2 * r.xp)}</td>
                  <td className="r num">{pct(r.p10)}</td>
                  <td className="r num">{Number.isFinite(r.p15) ? pct(r.p15) : "–"}</td>
                  <td className="r num muted">{Number.isFinite(r.blank) ? pct(r.blank) : "–"}</td>
                  <td className="r num muted">{fmt(r.p.own)}%</td>
                  <td>{r.pm && <button className="btn small" onClick={() => setOpen(open === r.p.id ? null : r.p.id)}>{open === r.p.id ? "hide" : "spread"}</button>}</td>
                </tr>
                {open === r.p.id && r.pm && (
                  <tr><td colSpan={10}><PmfBars pmf={r.pm} width={420} height={70} maxPts={22} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Duel gw={gw} />
    </div>
  );
}

function Duel({ gw }: { gw: number }) {
  const { d, excluded } = useApp();
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const pa = a ? d.byId.get(a) : undefined, pb = b ? d.byId.get(b) : undefined;
  const da = pa ? gwPmf(pa, gw, excluded) : null, db = pb ? gwPmf(pb, gw, excluded) : null;
  const w = da && db ? beats(da, db) : null;
  return (
    <div className="panel">
      <h3>Captain duel, GW{gw}</h3>
      <p className="sub">Chance that one player outscores the other (ties split), from each player's simulated points distribution, assuming both start.</p>
      <div className="row">
        <PlayerSearch onPick={(p) => setA(p.id)} placeholder="Player A…" /> <b>{pa?.name ?? "–"}</b>
        <span className="muted">vs</span>
        <PlayerSearch onPick={(p) => setB(p.id)} placeholder="Player B…" /> <b>{pb?.name ?? "–"}</b>
      </div>
      {w !== null && pa && pb && (
        <div style={{ marginTop: 12 }}>
          <div className="row" style={{ fontWeight: 800, fontSize: 18 }}>
            <span style={{ color: "var(--accent)" }}>{pa.name} {pct(w)}</span>
            <span className="spacer" />
            <span style={{ color: "var(--pink)" }}>{pct(1 - w)} {pb.name}</span>
          </div>
          <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", marginTop: 6 }}>
            <div style={{ width: `${100 * w}%`, background: "var(--accent)" }} />
            <div style={{ flex: 1, background: "var(--pink)" }} />
          </div>
        </div>
      )}
      {(pa || pb) && (!da || !db) && <p className="faint">One of them has no fixture in GW{gw}.</p>}
    </div>
  );
}
