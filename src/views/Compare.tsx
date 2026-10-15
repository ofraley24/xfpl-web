import { fmt, gwXp, pct, rangeXp, useApp } from "../data";
import { PlayerName, PlayerSearch, PosChip, RangePicker, StatusChip, TeamShort } from "../ui";

const COLS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

export default function Compare() {
  const { d, compare, toggleCompare, from, to, excluded } = useApp();
  const ps = compare.map((id) => d.byId.get(id)!).filter(Boolean);
  const gws = d.gws.filter((g) => g >= from && g <= to);
  const W = 640, H = 220, M = 30;
  const top = Math.max(1, ...ps.flatMap((p) => gws.map((g) => gwXp(p, g, excluded))));
  const sx = (i: number) => M + (gws.length > 1 ? (i * (W - 2 * M)) / (gws.length - 1) : (W - 2 * M) / 2);
  const sy = (v: number) => H - M - (v / top) * (H - 2 * M);
  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Compare</h2>
            <p className="sub">Up to four players. Tick ⚖︎ in the Planner or search here.</p>
          </div>
          <RangePicker />
        </div>
        <PlayerSearch onPick={(p) => !compare.includes(p.id) && toggleCompare(p.id)} placeholder="Add a player…" />
      </div>
      {ps.length > 0 && (
        <>
          <div className="panel" style={{ overflowX: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 420, height: "auto" }} role="img" aria-label="expected points per gameweek">
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <g key={t}><line x1={M} x2={W - M} y1={sy(t * top)} y2={sy(t * top)} stroke="var(--line)" />
                  <text x={M - 4} y={sy(t * top) + 4} textAnchor="end">{fmt(t * top)}</text></g>
              ))}
              {gws.map((g, i) => <text key={g} x={sx(i)} y={H - 8} textAnchor="middle">GW{g}</text>)}
              {ps.map((p, k) => (
                <g key={p.id}>
                  <polyline fill="none" stroke={COLS[k]} strokeWidth={2.5} points={gws.map((g, i) => `${sx(i)},${sy(gwXp(p, g, excluded))}`).join(" ")} />
                  {gws.map((g, i) => <circle key={g} cx={sx(i)} cy={sy(gwXp(p, g, excluded))} r={4} fill={COLS[k]}><title>{`${p.name} GW${g}: ${gwXp(p, g, excluded).toFixed(2)}`}</title></circle>)}
                </g>
              ))}
            </svg>
          </div>
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th></th><th>Player</th><th className="r">£m</th><th className="r">Own</th><th className="r">xP range</th><th className="r">xP/£m</th>
                {gws.map((g) => <th key={g} className="r">GW{g}</th>)}<th className="r">haul %</th><th></th></tr></thead>
              <tbody>
                {ps.map((p, k) => {
                  const v = rangeXp(p, from, to, excluded);
                  const fx = p.fixtures.filter((f) => f.gw >= from && f.gw <= to);
                  return (
                    <tr key={p.id}>
                      <td><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: COLS[k] }} /></td>
                      <td><div className="row" style={{ gap: 6 }}><PosChip pos={p.pos} /><PlayerName p={p} /><StatusChip p={p} /><TeamShort id={p.team} /></div></td>
                      <td className="r num">{fmt(p.price)}</td>
                      <td className="r num muted">{fmt(p.own)}%</td>
                      <td className="r num"><b>{fmt(v)}</b></td>
                      <td className="r num">{fmt(v / p.price, 2)}</td>
                      {gws.map((g) => <td key={g} className="r num">{fmt(gwXp(p, g, excluded))}</td>)}
                      <td className="r num">{pct(1 - fx.reduce((s, f) => s * (1 - f.p10), 1))}</td>
                      <td><button className="btn small" onClick={() => toggleCompare(p.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
