import { useMemo, useState } from "react";
import { fixtureKey, fixturesIn, fmt, pct, POSITIONS, useApp, useStored } from "../data";
import type { Player, Pos } from "../types";
import { heat, PlayerName, PosChip, RangePicker, StatusChip, TeamShort } from "../ui";

type SortKey = "xp" | "value" | "price" | "own" | "haul" | "perfx" | `gw${number}`;

export default function Planner() {
  const { d, from, to, excluded, toggleFixture, compare, toggleCompare } = useApp();
  const [pos, setPos] = useStored<Pos | "ALL">("pl:pos", "ALL");
  const [team, setTeam] = useStored<number>("pl:team", 0);
  const [maxPrice, setMaxPrice] = useStored<number>("pl:maxprice", 16);
  const [starters, setStarters] = useStored<boolean>("pl:starters", true);
  const [fit, setFit] = useStored<boolean>("pl:fit", false);
  const [maxOwn, setMaxOwn] = useStored<number>("pl:maxown", 100);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; desc: boolean }>({ k: "xp", desc: true });
  const [limit, setLimit] = useState(60);
  const gws = d.gws.filter((g) => g >= from && g <= to);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return d.players
      .filter((p) => (pos === "ALL" || p.pos === pos) && (!team || p.team === team) && p.price <= maxPrice + 1e-9 && p.own <= maxOwn)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.full_name.toLowerCase().includes(s))
      .filter((p) => !starters || p.fixtures.some((f) => f.gw >= from && f.gw <= to && f.xi))
      .filter((p) => !fit || p.status === "a" || (p.status === "d" && (p.chance_next ?? 0) >= 75))
      .map((p) => {
        const fx = fixturesIn(p, from, to, excluded);
        const xp = fx.reduce((a, f) => a + f.xp, 0);
        const haul = 1 - fx.reduce((a, f) => a * (1 - f.p10), 1); // P(at least one 10+ score), fixtures independent
        const byGw = new Map<number, number>();
        fx.forEach((f) => byGw.set(f.gw, (byGw.get(f.gw) ?? 0) + f.xp));
        return { p, xp, value: xp / p.price, haul, n: fx.length, perfx: fx.length ? xp / fx.length : 0, byGw };
      });
  }, [d, pos, team, maxPrice, maxOwn, q, starters, fit, from, to, excluded]);

  const sorted = useMemo(() => {
    const key = (r: (typeof rows)[number]) => {
      if (sort.k.startsWith("gw")) return r.byGw.get(Number(sort.k.slice(2))) ?? -1;
      if (sort.k === "price") return r.p.price;
      if (sort.k === "own") return r.p.own;
      return r[sort.k as "xp" | "value" | "haul" | "perfx"];
    };
    return [...rows].sort((a, b) => (sort.desc ? key(b) - key(a) : key(a) - key(b)));
  }, [rows, sort]);

  const th = (k: SortKey, label: string, cls = "r") => (
    <th key={k} className={`${cls} ${sort.k === k ? "sorted" : ""}`} onClick={() => setSort((s) => ({ k, desc: s.k === k ? !s.desc : true }))}>
      {label}{sort.k === k ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Transfer planner</h2>
            <p className="sub">Expected points (given a start) summed over the gameweeks you pick. Click a fixture to switch it off.</p>
          </div>
          <RangePicker />
        </div>
        <div className="row">
          <div className="seg">
            {(["ALL", ...POSITIONS] as const).map((x) => (
              <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>
            ))}
          </div>
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
            <option value={0}>All teams</option>
            {[...d.teams.values()].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label className="row" style={{ gap: 6 }}>
            <span className="muted">max £{fmt(maxPrice)}m</span>
            <input type="range" min={4} max={16} step={0.1} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} />
          </label>
          <label className="row" style={{ gap: 6 }} title="Differentials: hide players owned by more than this share of managers">
            <span className="muted">owned ≤ {maxOwn >= 100 ? "any" : `${maxOwn}%`}</span>
            <input type="range" min={1} max={100} step={1} value={maxOwn} onChange={(e) => setMaxOwn(Number(e.target.value))} />
          </label>
          <label className="row" style={{ gap: 4 }} title="Players in the probable XI (a heuristic from recent starts and FPL availability) for at least one fixture in the range">
            <input type="checkbox" checked={starters} onChange={(e) => setStarters(e.target.checked)} /> probable starters
          </label>
          <label className="row" style={{ gap: 4 }} title="Hide injured, suspended and doubtful (< 75%) players">
            <input type="checkbox" checked={fit} onChange={(e) => setFit(e.target.checked)} /> fit only
          </label>
          <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{rows.length} players</span>
        </div>
      </div>

      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th title="Add to compare">⚖︎</th>
              <th>Player</th>
              <th>Team</th>
              {th("price", "£m")}
              {th("own", "Own")}
              {th("xp", `xP GW${from}${to > from ? `–${to}` : ""}`)}
              {th("value", "xP/£m")}
              {th("perfx", "xP/fix")}
              {th("haul", "Haul %")}
              {gws.map((g) => th(`gw${g}`, `GW${g}`, "c"))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map(({ p, xp, value, haul, perfx }) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} /></td>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={p.pos} /><PlayerName p={p} /><StatusChip p={p} /></div></td>
                <td><TeamShort id={p.team} /></td>
                <td className="r num">{fmt(p.price)}</td>
                <td className="r num muted">{fmt(p.own)}%</td>
                <td className="r num"><b>{fmt(xp)}</b></td>
                <td className="r num">{fmt(value, 2)}</td>
                <td className="r num muted">{fmt(perfx, 2)}</td>
                <td className="r num" title="Chance of at least one 10+ point score in the range (if he starts every fixture)">{pct(haul)}</td>
                {gws.map((g) => <GwCell key={g} p={p} gw={g} excluded={excluded} toggle={toggleFixture} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn" onClick={() => setLimit((l) => l + 60)}>Show more ({sorted.length - limit} left)</button>
        </div>
      )}
    </div>
  );
}

export function GwCell({ p, gw, excluded, toggle }: { p: Player; gw: number; excluded: Set<string>; toggle: (pid: number, fx: number) => void }) {
  const { d } = useApp();
  const fx = p.fixtures.filter((f) => f.gw === gw);
  if (!fx.length) return <td><span className="cell blank">blank</span></td>;
  return (
    <td>
      <span className="multi">
        {fx.map((f) => {
          const off = excluded.has(fixtureKey(p.id, f.fixture));
          const opp = d.teams.get(f.opp)?.short ?? "?";
          return (
            <span key={f.fixture} className={`cell ${off ? "off" : ""}`} style={{ background: heat(f.xp, 8) }}
              title={`${opp} (${f.home ? "home" : "away"}) — xP ${f.xp.toFixed(2)}, P(10+) ${(100 * f.p10).toFixed(0)}%${off ? " — switched off" : ""}. Click to toggle.`}
              onClick={() => toggle(p.id, f.fixture)}>
              <b className="num">{f.xp.toFixed(1)}</b>
              <span className="o">{f.home ? opp : opp.toLowerCase()}</span>
            </span>
          );
        })}
      </span>
    </td>
  );
}
