import { useMemo, useState } from "react";
import { BUDGET, fmt, POSITIONS, rangeXp, SQUAD_SHAPE, useApp } from "../data";
import { bestLineup, squadProblems, type GwLineup } from "../squad";
import type { Player } from "../types";
import { PlayerName, PlayerSearch, PosChip, RangePicker, StatusChip, TeamShort } from "../ui";

export default function Squad() {
  const { d, from, to, excluded, squad: ids, setSquad, bank, setBank } = useApp();
  const squad = ids.map((id) => d.byId.get(id)!).filter(Boolean);
  const gws = d.gws.filter((g) => g >= from && g <= to);
  const [gw, setGw] = useState(gws[0]);
  const shownGw = gws.includes(gw) ? gw : gws[0];
  const lineups = useMemo(() => gws.map((g) => bestLineup(squad, g, excluded)), [squad, gws, excluded]); // eslint-disable-line
  const total = lineups.reduce((s, l) => s + l.points, 0);
  const cost = squad.reduce((s, p) => s + p.price, 0);
  const problems = squadProblems(squad, bank);
  const full = squad.length === 15;

  const add = (p: Player) => {
    if (ids.includes(p.id)) return;
    if (squad.filter((x) => x.pos === p.pos).length >= SQUAD_SHAPE[p.pos]) return alert(`Already ${SQUAD_SHAPE[p.pos]} ${p.pos}`);
    setSquad([...ids, p.id]);
  };
  const remove = (id: number) => setSquad(ids.filter((x) => x !== id));

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>My squad</h2>
            <p className="sub">Build your 15 (or load one from the Dream team tab). Each gameweek the best XI and captain are picked automatically.</p>
          </div>
          <RangePicker />
        </div>
        <div className="kpis">
          <div className="kpi"><div className="v num">{fmt(total)}</div><div className="l">expected points GW{from}–{to} (XI + captain)</div></div>
          <div className="kpi"><div className="v num">£{fmt(cost)}m</div><div className="l">squad value · £{fmt(BUDGET + bank - cost)}m left</div></div>
          <div className="kpi"><div className="v num">{squad.length}/15</div><div className="l">{problems.length ? problems.join(" · ") : "valid squad"}</div></div>
          <div className="kpi">
            <div className="row" style={{ gap: 6 }}>
              <span className="l">bank above £100m</span>
              <input type="number" step={0.1} min={0} max={20} value={bank} onChange={(e) => setBank(Number(e.target.value))} style={{ width: 80 }} />
            </div>
            <div className="l">your team value gains / money in the bank</div>
          </div>
        </div>
      </div>

      <div className="two">
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Best XI</h3>
            <div className="seg">
              {gws.map((g) => <button key={g} className={shownGw === g ? "on" : ""} onClick={() => setGw(g)}>GW{g}</button>)}
            </div>
          </div>
          {squad.length ? <Pitch lineup={lineups[gws.indexOf(shownGw)]} /> : <p className="muted">Add players to see your XI.</p>}
          <div className="row" style={{ marginTop: 10, gap: 6 }}>
            {lineups.map((l) => (
              <span key={l.gw} className="chip" style={{ background: "var(--panel-2)", color: "var(--text)" }}>
                GW{l.gw}: <b className="num">{fmt(l.points)}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Squad</h3>
            <div className="row">
              <PlayerSearch onPick={add} placeholder="Add a player…" filter={(p) => !ids.includes(p.id)} />
              {squad.length > 0 && <button className="btn small" onClick={() => confirm("Clear the squad?") && setSquad([])}>clear</button>}
            </div>
          </div>
          {POSITIONS.map((pos) => (
            <div key={pos} style={{ marginTop: 8 }}>
              {squad.filter((p) => p.pos === pos).map((p) => (
                <div key={p.id} className="row" style={{ gap: 6, padding: "3px 0" }}>
                  <PosChip pos={p.pos} /><PlayerName p={p} /><StatusChip p={p} /><TeamShort id={p.team} />
                  <span className="spacer" />
                  <span className="num muted">£{fmt(p.price)}</span>
                  <span className="num" style={{ width: 52, textAlign: "right" }}><b>{fmt(rangeXp(p, from, to, excluded))}</b></span>
                  <button className="btn small" onClick={() => remove(p.id)} title="Remove">✕</button>
                </div>
              ))}
              {Array.from({ length: SQUAD_SHAPE[pos] - squad.filter((p) => p.pos === pos).length }).map((_, i) => (
                <div key={i} className="row faint" style={{ gap: 6, padding: "3px 0" }}><PosChip pos={pos} /> empty slot</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {full && <TransferFinder squad={squad} />}
    </div>
  );
}

function Pitch({ lineup }: { lineup: GwLineup }) {
  const { d, excluded } = useApp();
  const shirt = (p: Player, out = false) => {
    const fx = p.fixtures.filter((f) => f.gw === lineup.gw);
    const xp = fx.filter((f) => !excluded.has(`${p.id}:${f.fixture}`)).reduce((s, f) => s + f.xp, 0);
    const opp = fx.map((f) => (f.home ? d.teams.get(f.opp)?.short : d.teams.get(f.opp)?.short.toLowerCase())).join(", ") || "blank";
    return <Shirt key={p.id} p={p} xp={xp} opp={opp} cap={lineup.captain?.id === p.id} out={out} />;
  };
  return (
    <div className="pitch">
      {(["GKP", "DEF", "MID", "FWD"] as const).map((pos) => (
        <div key={pos} className="line">{lineup.xi.filter((p) => p.pos === pos).map((p) => shirt(p))}</div>
      ))}
      <div className="line benchline">{lineup.bench.map((p) => shirt(p, true))}</div>
      <div style={{ textAlign: "center", fontWeight: 800 }}>GW{lineup.gw} expected: {fmt(lineup.points)} pts</div>
    </div>
  );
}

function Shirt({ p, xp, opp, cap, out }: { p: Player; xp: number; opp: string; cap: boolean; out: boolean }) {
  const { openPlayer } = useApp();
  return (
    <div className={`shirt ${out ? "out" : ""}`} onClick={() => openPlayer(p.id)} title={p.news || p.full_name}>
      {cap && <span className="cap">C</span>}
      <div className="nm">{p.name}</div>
      <div className="xp num">{fmt(cap ? 2 * xp : xp)}</div>
      <div className="op">{opp}{p.status !== "a" ? " ⚠" : ""}</div>
    </div>
  );
}

function TransferFinder({ squad }: { squad: Player[] }) {
  const { d, from, to, excluded, bank, setSquad } = useApp();
  const ids = new Set(squad.map((p) => p.id));
  const val = useMemo(() => new Map(d.players.map((p) => [p.id, rangeXp(p, from, to, excluded)])), [d, from, to, excluded]);
  const moves = useMemo(() => {
    const cost = squad.reduce((s, p) => s + p.price, 0);
    const clubs = new Map<number, number>();
    squad.forEach((p) => clubs.set(p.team, (clubs.get(p.team) ?? 0) + 1));
    const out: { sell: Player; buy: Player; gain: number; team: number }[] = [];
    for (const sell of squad) {
      const budget = BUDGET + bank - cost + sell.price;
      for (const buy of d.players) {
        if (buy.pos !== sell.pos || ids.has(buy.id) || buy.price > budget + 1e-9) continue;
        if (buy.team !== sell.team && (clubs.get(buy.team) ?? 0) >= 3) continue;
        if (!buy.fixtures.some((f) => f.xi)) continue; // probable starters only
        out.push({ sell, buy, gain: val.get(buy.id)! - val.get(sell.id)!, team: 0 });
      }
    }
    // effect on the squad: best XI + captain each gameweek, with and without the swap (bench upgrades count little)
    const gws = d.gws.filter((g) => g >= from && g <= to);
    const base = gws.reduce((s, g) => s + bestLineup(squad, g, excluded).points, 0);
    const top = out.sort((a, b) => b.gain - a.gain).slice(0, 150);
    for (const m of top) {
      const sq = squad.map((p) => (p.id === m.sell.id ? m.buy : p));
      m.team = gws.reduce((s, g) => s + bestLineup(sq, g, excluded).points, 0) - base;
    }
    return top.sort((a, b) => b.team - a.team).slice(0, 12);
  }, [squad, d, bank, val, from, to, excluded]); // eslint-disable-line
  return (
    <div className="panel">
      <h3>Best single transfers for GW{from}–{to}</h3>
      <p className="sub">Legal swaps (same position, within budget, max 3 per club) among probable starters, ranked by what they add to
        your squad: best XI + captain each gameweek, with and without the swap. A −4 hit pays off only if the squad gain is above 4.</p>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>Out</th><th>In</th><th className="r">£ diff</th><th className="r">player xP gain</th><th className="r">squad gain</th><th></th></tr></thead>
          <tbody>
            {moves.map(({ sell, buy, gain, team }) => (
              <tr key={`${sell.id}-${buy.id}`}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={sell.pos} /><PlayerName p={sell} /> <TeamShort id={sell.team} /></div></td>
                <td><div className="row" style={{ gap: 6 }}><PlayerName p={buy} /><StatusChip p={buy} /> <TeamShort id={buy.team} /></div></td>
                <td className="r num muted">{signed(buy.price - sell.price)}</td>
                <td className="r num muted">{signed(gain)}</td>
                <td className="r num"><b style={{ color: team > 4 ? "var(--accent)" : team < 0 ? "var(--pink)" : undefined }}>{signed(team)}</b></td>
                <td><button className="btn small" onClick={() => setSquad(squad.map((p) => (p.id === sell.id ? buy.id : p.id)))}>make it</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const signed = (x: number) => `${x > 0.05 ? "+" : x < -0.05 ? "−" : "±"}${fmt(Math.abs(x))}`;
