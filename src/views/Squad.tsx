import { useMemo, useState } from "react";
import { FPL_PICK_TEAM_URL, FPL_TRANSFERS_URL, importTeam, type ImportedTeam } from "../fplTeam";
import { BUDGET, fmt, gwXp, POSITIONS, rangeXp, SQUAD_SHAPE, useApp, useStored } from "../data";
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
  const [imported, setImported] = useStored<ImportedTeam | null>("fpl:import", null);

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
            <p className="sub">Import your FPL team, build one, or load the Dream team. Each gameweek the best XI and captain are picked automatically.</p>
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

      <ImportPanel imported={imported} setImported={setImported} />

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

      {imported && full && <PlanCard imported={imported} squad={squad} lineups={lineups} />}
      {full && <ChipPlanner lineups={lineups} />}
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
  const { d, excluded, bank, setSquad } = useApp();
  const first = d.gws[0], last = d.gws[d.gws.length - 1];
  const windows = [1, 3, 5, 8].filter((_, i, a) => i === 0 || first + a[i - 1] - 1 < last);
  const [win, setWin] = useStored<number>("tf:window", 5);
  const from = first, to = Math.min(last, first + win - 1);
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
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Best single transfers for {from === to ? `GW${from}` : `GW${from}–${to}`}</h3>
        <div className="seg" title="How many gameweeks ahead to value each swap over">
          {windows.map((w) => <button key={w} className={win === w ? "on" : ""} onClick={() => setWin(w)}>{w === 1 ? "next GW" : `${w} GWs`}</button>)}
        </div>
      </div>
      <p className="sub">Legal swaps (same position, within budget, max 3 per club) among probable starters, ranked by what they add to
        your squad over the chosen window: best XI + captain each gameweek, with and without the swap. A short window favours this week's
        fixture; a long one favours the run. A −4 hit pays off only if the squad gain is above 4.</p>
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

function ChipPlanner({ lineups }: { lineups: GwLineup[] }) {
  const { excluded } = useApp();
  const xpOf = (p: Player, gw: number) => p.fixtures.filter((f) => f.gw === gw && !excluded.has(`${p.id}:${f.fixture}`)).reduce((s, f) => s + f.xp, 0);
  const rows = lineups.map((l) => ({
    gw: l.gw,
    bb: l.bench.reduce((s, p) => s + xpOf(p, l.gw), 0),
    tc: l.captain ? xpOf(l.captain, l.gw) : 0,
    cap: l.captain,
  }));
  const bestBB = rows.reduce((a, b) => (b.bb > a.bb ? b : a), rows[0]);
  const bestTC = rows.reduce((a, b) => (b.tc > a.tc ? b : a), rows[0]);
  return (
    <div className="panel">
      <h3>Chip planner</h3>
      <p className="sub">What each chip adds with this squad: Bench Boost scores your four substitutes, Triple Captain adds your captain's score once more.
        Doubles show up as big numbers.</p>
      <div className="kpis" style={{ marginBottom: 10 }}>
        <div className="kpi"><div className="v num">GW{bestBB.gw}</div><div className="l">best Bench Boost: +{fmt(bestBB.bb)} expected</div></div>
        <div className="kpi"><div className="v num">GW{bestTC.gw}</div><div className="l">best Triple Captain: +{fmt(bestTC.tc)} ({bestTC.cap?.name})</div></div>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead><tr><th>GW</th><th className="r">Bench Boost</th><th className="r">Triple Captain</th><th>Captain</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.gw}>
                <td><b>GW{r.gw}</b></td>
                <td className="r num" style={{ color: r === bestBB ? "var(--accent)" : undefined }}>+{fmt(r.bb)}</td>
                <td className="r num" style={{ color: r === bestTC ? "var(--accent)" : undefined }}>+{fmt(r.tc)}</td>
                <td>{r.cap?.name ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Import an FPL team by its public id (read-only, as of the last deadline). */
function ImportPanel({ imported, setImported }: { imported: ImportedTeam | null; setImported: (t: ImportedTeam | null) => void }) {
  const { d, setSquad, setBank } = useApp();
  const [id, setId] = useState(imported ? String(imported.teamId) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    const n = Number(id.trim());
    if (!Number.isInteger(n) || n <= 0) { setErr("A team id is a whole number, e.g. 1234567"); return; }
    setBusy(true); setErr(null);
    try {
      const t = await importTeam(n, new Set(d.byId.keys()));
      setImported(t);
      setSquad(t.squad);
      // budget = what the squad costs now + the money in the bank (selling prices are private, so current prices are used)
      const cost = t.squad.reduce((s, pid) => s + (d.byId.get(pid)?.price ?? 0), 0);
      setBank(Math.round((cost + t.bankFpl - BUDGET) * 10) / 10);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const names = (ids: number[]) => ids.map((x) => d.byId.get(x)?.name ?? `#${x}`).join(", ");
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Import from FPL</h3>
        <span className="metric-note">read-only · no password needed</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <input type="text" inputMode="numeric" placeholder="Your FPL team id" value={id} onChange={(e) => setId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()} style={{ width: 170 }} />
        <button className="btn primary" onClick={run} disabled={busy}>{busy ? "Importing…" : imported ? "Re-import" : "Import my team"}</button>
        {imported && <button className="btn small" onClick={() => setImported(null)}>forget</button>}
        {err && <span style={{ color: "var(--bad)" }}>{err}</span>}
      </div>
      {imported ? (
        <p className="sub" style={{ margin: "8px 0 0", fontSize: 13 }}>
          <b>{imported.name}</b> ({imported.manager}) · squad as of the GW{imported.gw} deadline · £{fmt(imported.bankFpl)}m in the bank ·
          team value £{fmt(imported.valueFpl)}m{imported.chip ? ` · ${imported.chip} played` : ""}.
          {imported.missing.length > 0 && <> Not in this forecast: {names(imported.missing)}.</>}
          {" "}Transfers you have made since that deadline are private to your FPL account, so make them here too.
        </p>
      ) : (
        <p className="faint" style={{ margin: "8px 0 0", fontSize: 12.5 }}>Your team id is the number in the address of your FPL
          Points page: fantasy.premierleague.com/entry/<b>1234567</b>/event/… The import reads the public team page only.</p>
      )}
    </div>
  );
}

/** The changes to make on FPL: transfers versus the imported squad, the hit, and next gameweek's captain and bench. */
function PlanCard({ imported, squad, lineups }: { imported: ImportedTeam; squad: Player[]; lineups: GwLineup[] }) {
  const { d, excluded } = useApp();
  const [free, setFree] = useStored<number>("fpl:free", 1);
  const now = new Set(squad.map((p) => p.id)), before = new Set(imported.squad);
  const outs = imported.squad.filter((x) => !now.has(x)).map((x) => d.byId.get(x)).filter((p): p is Player => !!p);
  const ins = squad.filter((p) => !before.has(p.id));
  const hit = Math.max(0, ins.length - free) * 4;
  const baseSquad = imported.squad.map((x) => d.byId.get(x)).filter((p): p is Player => !!p);
  const gain = useMemo(() => lineups.reduce((s, l) => s + l.points, 0) - lineups.reduce((s, l) => s + bestLineup(baseSquad, l.gw, excluded).points, 0),
    [lineups, baseSquad, excluded]); // eslint-disable-line
  const next = lineups[0];
  const byXp = next ? [...next.xi].sort((a, b) => gwXp(b, next.gw, excluded) - gwXp(a, next.gw, excluded)) : [];
  const vice = byXp.find((p) => p.id !== next?.captain?.id);
  const bench = next ? [...next.bench.filter((p) => p.pos === "GKP"), ...next.bench.filter((p) => p.pos !== "GKP").sort((a, b) => gwXp(b, next.gw, excluded) - gwXp(a, next.gw, excluded))] : [];
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Make these changes on FPL</h3>
        <span className="metric-note">compared with your GW{imported.gw} squad</span>
      </div>
      <div className="two" style={{ marginTop: 10 }}>
        <div>
          {ins.length === 0 ? <p className="muted" style={{ margin: 0 }}>No transfers: your squad matches the imported one.</p> : (
            <table className="plain">
              <thead><tr><th>Out</th><th>In</th></tr></thead>
              <tbody>{ins.map((p, i) => (
                <tr key={p.id}><td>{outs[i] ? <><PosChip pos={outs[i].pos} /> {outs[i].name} <span className="faint"><TeamShort id={outs[i].team} /></span></> : ""}</td>
                  <td><PosChip pos={p.pos} /> <b>{p.name}</b> <span className="faint"><TeamShort id={p.team} /></span></td></tr>
              ))}</tbody>
            </table>
          )}
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <span className="muted">Free transfers</span>
            <div className="seg">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={free === n ? "on" : ""} onClick={() => setFree(n)}>{n}</button>)}</div>
          </div>
          <p className="faint" style={{ fontSize: 12, margin: "4px 0 0" }}>FPL doesn't publish free transfers, so set yours.</p>
        </div>
        <div className="kpis" style={{ alignContent: "start" }}>
          <div className="kpi"><div className="v num">{ins.length}</div><div className="l">transfer{ins.length === 1 ? "" : "s"}{hit ? ` · −${hit} pts hit` : ""}</div></div>
          <div className="kpi"><div className="v num" style={{ color: gain - hit > 0 ? "var(--accent)" : gain - hit < 0 ? "var(--bad)" : undefined }}>{gain - hit >= 0 ? "+" : "−"}{fmt(Math.abs(gain - hit))}</div>
            <div className="l">expected points GW{lineups[0]?.gw}–{lineups[lineups.length - 1]?.gw} after the hit (best XI + captain each week)</div></div>
        </div>
      </div>
      {next && (
        <p style={{ margin: "12px 0 0" }}>
          <b>GW{next.gw}:</b> captain <b>{next.captain?.name}</b>, vice <b>{vice?.name}</b> · bench order {bench.map((p) => p.name).join(", ")}
        </p>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <a className="btn primary" href={FPL_TRANSFERS_URL} target="_blank" rel="noopener noreferrer">Open FPL transfers ↗</a>
        <a className="btn" href={FPL_PICK_TEAM_URL} target="_blank" rel="noopener noreferrer">Open FPL pick team ↗</a>
        <span className="faint" style={{ fontSize: 12.5 }}>Changes are made on FPL itself; this site never asks for your password.</span>
      </div>
    </div>
  );
}
