import { Tooltip } from "../Tooltip";
import { useEffect, useMemo, useState } from "react";
import { POSITIONS, useApp, useStored } from "../data";
import {
  fmtStat, GROUPS, percentile, PLAYER_STATS, STAT, statValue, TEAM_STATS, teamValue, useStats,
  type StatPlayer, type StatsDoc, type StatTeam, type Window,
} from "../stats";
import type { Pos } from "../types";
import { placeLabels, POS_SHAPE, PosChip, PosMarker, tint } from "../ui";

type Sub = "players" | "teams" | "explorer";

export default function Stats() {
  const { doc, err } = useStats();
  const [sub, setSub] = useStored<Sub>("st:sub", "players");
  const [w, setW] = useStored<Window>("st:window", "season");
  const [card, setCard] = useState<number | null>(null);
  if (err) return <div className="panel">No stats sheet found ({err}). Run <code>npm run sync-data</code>.</div>;
  if (!doc) return <div className="panel muted">Loading stats…</div>;
  const wl = (k: Window) => (k === "season" ? `Season (GW${doc.windows.season[0]}–${doc.through_gw})` : `Last ${doc.windows.last4.length} GWs`);
  return (
    <div className="grid">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Stats sheet</h2>
            <p className="sub">What has actually happened this season, through GW{doc.through_gw}: FPL's numbers, Understat's shot data and the
              model's team ratings. Click a player for a shot map and percentiles.</p>
          </div>
          <div className="row">
            <div className="seg">{(["players", "teams", "explorer"] as const).map((k) => <button key={k} className={sub === k ? "on" : ""} onClick={() => setSub(k)}>{k}</button>)}</div>
            <div className="seg">{(["season", "last4"] as const).map((k) => <button key={k} className={w === k ? "on" : ""} onClick={() => setW(k)}>{wl(k)}</button>)}</div>
          </div>
        </div>
      </div>
      {sub === "players" && <PlayersTable doc={doc} w={w} open={setCard} />}
      {sub === "teams" && <TeamsTable doc={doc} w={w} />}
      {sub === "explorer" && <Explorer doc={doc} w={w} open={setCard} />}
      {card !== null && <StatsCard doc={doc} w={w} id={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// percentile within the list: clear at the bottom, strongest green at the top
const shade = (pct: number) => tint(pct ** 1.5);

function PlayersTable({ doc, w, open }: { doc: StatsDoc; w: Window; open: (id: number) => void }) {
  const { d } = useApp();
  const [group, setGroup] = useStored<string>("st:group", "Overview");
  const [per90, setPer90] = useStored<boolean>("st:per90", false);
  const [pos, setPos] = useStored<Pos | "ALL">("st:pos", "ALL");
  const [team, setTeam] = useStored<number>("st:team", 0);
  const [minMins, setMinMins] = useStored<number>("st:minmins", 180);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: string; desc: boolean }>({ k: "pts", desc: true });
  const [limit, setLimit] = useState(60);
  const cols = GROUPS[group];
  useEffect(() => { if (!cols.includes(sort.k)) setSort({ k: cols.find((c) => c !== "mins") ?? cols[0], desc: true }); }, [group]); // eslint-disable-line

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return doc.players.filter((p) => (pos === "ALL" || p.pos === pos) && (!team || p.team === team)
      && (p.s[w].mins ?? 0) >= minMins && (!s || p.name.toLowerCase().includes(s)));
  }, [doc, w, pos, team, minMins, q]);
  // percentile of each column within the filtered rows
  const dist = useMemo(() => Object.fromEntries(cols.map((k) => [k, rows.map((p) => statValue(p, w, k, per90)).filter((x): x is number => x !== null)])), [rows, cols, w, per90]);
  const sorted = useMemo(() => {
    const val = (p: StatPlayer) => statValue(p, w, sort.k, per90) ?? -Infinity;
    return [...rows].sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [rows, sort, w, per90]);

  return (
    <>
      <div className="panel">
        <div className="row">
          <div className="seg">{Object.keys(GROUPS).map((g) => <button key={g} className={group === g ? "on" : ""} onClick={() => setGroup(g)}>{g}</button>)}</div>
          <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={per90} onChange={(e) => setPer90(e.target.checked)} /> per 90</label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div className="seg">{(["ALL", ...POSITIONS] as const).map((x) => <button key={x} className={pos === x ? "on" : ""} onClick={() => setPos(x)}>{x}</button>)}</div>
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
            <option value={0}>All teams</option>
            {doc.teams.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <label className="row" style={{ gap: 6 }}><span className="muted">min {minMins} mins</span>
            <input type="range" min={0} max={900} step={30} value={minMins} onChange={(e) => setMinMins(Number(e.target.value))} /></label>
          <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted">{rows.length} players · cells shaded by percentile within this list</span>
        </div>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>Player</th><th>Team</th>
              {cols.map((k) => {
                const s = STAT.get(k)!;
                return (
                  <th key={k} className={`r ${sort.k === k ? "sorted" : ""}`} title={s.desc}
                    onClick={() => setSort((o) => ({ k, desc: o.k === k ? !o.desc : !s.low }))}>
                    {s.label}{per90 && s.per90 ? "/90" : ""}{sort.k === k ? (sort.desc ? " ↓" : " ↑") : ""}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((p) => (
              <tr key={p.id}>
                <td><div className="row" style={{ gap: 6 }}><PosChip pos={p.pos} /><span className="pname" onClick={() => open(p.id)}>{p.name}</span></div></td>
                <td className="muted">{d.teams.get(p.team)?.short}</td>
                {cols.map((k) => {
                  const x = statValue(p, w, k, per90);
                  const s = STAT.get(k)!;
                  const st = x === null || ["mins", "apps", "starts", "price", "own"].includes(k) ? undefined : shade(percentile(dist[k], x, s.low));
                  return <td key={k} className="r num" style={st}>{fmtStat(k, x, per90)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && <div className="row" style={{ justifyContent: "center" }}><button className="btn" onClick={() => setLimit((l) => l + 60)}>Show more ({sorted.length - limit} left)</button></div>}
    </>
  );
}

function Spark({ vals, color, w = 90, h = 24 }: { vals: number[]; color: string; w?: number; h?: number }) {
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 2 - ((v - lo) / span) * (h - 4)}`).join(" ");
  return <svg width={w} height={h}><polyline fill="none" stroke={color} strokeWidth={1.8} points={pts} /></svg>;
}

function TeamsTable({ doc, w }: { doc: StatsDoc; w: Window }) {
  const [perGame, setPerGame] = useStored<boolean>("st:pergame", false);
  const [sort, setSort] = useState<{ k: string; desc: boolean }>({ k: "pts", desc: true });
  const val = (t: StatTeam, k: string) => {
    if (k === "att") return t.ratings[t.ratings.length - 1]?.att ?? null;
    if (k === "def") return t.ratings[t.ratings.length - 1]?.def ?? null;
    return teamValue(t, w, k, perGame);
  };
  const sorted = [...doc.teams].sort((a, b) => ((val(b, sort.k) ?? -1e9) - (val(a, sort.k) ?? -1e9)) * (sort.desc ? 1 : -1));
  const dist = Object.fromEntries([...TEAM_STATS.map((s) => s.key), "att", "def"].map((k) => [k, doc.teams.map((t) => val(t, k)).filter((x): x is number => x !== null)]));
  const th = (k: string, label: string, desc: string, low = false) => (
    <th key={k} className={`r ${sort.k === k ? "sorted" : ""}`} title={desc} onClick={() => setSort((o) => ({ k, desc: o.k === k ? !o.desc : !low }))}>
      {label}{sort.k === k ? (sort.desc ? " ↓" : " ↑") : ""}
    </th>
  );
  return (
    <>
      <div className="panel row">
        <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={perGame} onChange={(e) => setPerGame(e.target.checked)} /> per game</label>
        <span className="muted">Underlying numbers from Understat; attack/defence are the model's current ratings (higher = stronger), with their trend this season.</span>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>#</th><th>Team</th>
              {TEAM_STATS.map((s) => th(s.key, s.label, s.desc, s.low))}
              {th("att", "Attack", "Model attack rating (now)")}
              {th("def", "Defence", "Model defence rating (now)")}
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.id}>
                <td className="muted">{i + 1}</td>
                <td><b>{t.name}</b></td>
                {TEAM_STATS.map((s) => {
                  const x = val(t, s.key);
                  const dp = perGame && s.perGame ? 2 : s.dp;
                  return <td key={s.key} className="r num" style={x === null || s.key === "mp" ? undefined : shade(percentile(dist[s.key], x, s.low))}>{x === null ? "–" : x.toFixed(dp)}</td>;
                })}
                {(["att", "def"] as const).map((k) => { const x = val(t, k); return <td key={k} className="r num" style={x === null ? undefined : shade(percentile(dist[k], x))}>{x?.toFixed(2) ?? "–"}</td>; })}
                <td><Spark vals={t.ratings.map((r) => r.att)} color="var(--pink)" /><Spark vals={t.ratings.map((r) => r.def)} color="var(--cyan)" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="faint">Trend: attack (pink) and defence (blue) ratings before each match this season, up to the next fixture.</p>
    </>
  );
}

function Explorer({ doc, w, open }: { doc: StatsDoc; w: Window; open: (id: number) => void }) {
  const [mode, setMode] = useStored<"players" | "teams">("ex:mode", "players");
  const [xk, setXk] = useStored<string>("ex:x", "uxg");
  const [yk, setYk] = useStored<string>("ex:y", "g");
  const [txk, setTxk] = useStored<string>("ex:tx", "xg");
  const [tyk, setTyk] = useStored<string>("ex:ty", "xga");
  const [per90, setPer90] = useStored<boolean>("ex:per90", false);
  const [show, setShow] = useStored<Pos[]>("ex:pos", ["DEF", "MID", "FWD"]);
  const [minMins, setMinMins] = useStored<number>("ex:minmins", 270);
  const [hover, setHover] = useState<{ label: string; x: number; y: number; cx: number; cy: number } | null>(null);

  const pts = mode === "players"
    ? doc.players.filter((p) => show.includes(p.pos) && (p.s[w].mins ?? 0) >= minMins)
      .map((p) => ({ id: p.id, label: p.name, pos: p.pos as Pos | null, x: statValue(p, w, xk, per90), y: statValue(p, w, yk, per90), color: `var(--pos-${p.pos})`, size: 3 + Math.sqrt(p.s[w].mins ?? 0) / 6 }))
    : doc.teams.map((t) => ({ id: -t.id, label: t.short, pos: null as Pos | null, x: teamValue(t, w, txk, true), y: teamValue(t, w, tyk, true), color: "var(--series-1)", size: 7 }));
  const ok = pts.filter((p): p is typeof p & { x: number; y: number } => p.x !== null && p.y !== null);
  const W = 900, H = 520, M = { l: 56, r: 24, t: 16, b: 42 };
  const xs = ok.map((p) => p.x), ys = ok.map((p) => p.y);
  const [x0, x1] = [Math.min(...xs, 0), Math.max(...xs, 0.01) * 1.05], [y0, y1] = [Math.min(...ys, 0), Math.max(...ys, 0.01) * 1.05];
  const sx = (v: number) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)] ?? 0; };
  const mx = med(xs), my = med(ys);
  // label the outliers: furthest from the medians (scaled)
  const far = new Set([...ok].sort((a, b) => Math.hypot((b.x - mx) / (x1 - x0 || 1), (b.y - my) / (y1 - y0 || 1)) - Math.hypot((a.x - mx) / (x1 - x0 || 1), (a.y - my) / (y1 - y0 || 1))).slice(0, mode === "teams" ? 20 : 14).map((p) => p.id));
  const xl = mode === "players" ? `${STAT.get(xk)!.label}${per90 && STAT.get(xk)!.per90 ? " per 90" : ""}` : `${TEAM_STATS.find((s) => s.key === txk)!.label} per game`;
  const yl = mode === "players" ? `${STAT.get(yk)!.label}${per90 && STAT.get(yk)!.per90 ? " per 90" : ""}` : `${TEAM_STATS.find((s) => s.key === tyk)!.label} per game`;
  const showDiag = mode === "players" ? (["uxg", "npxg", "fxg"].includes(xk) && yk === "g") || (xk === "uxa" && yk === "a") : (txk === "xg" && tyk === "gf") || (txk === "xga" && tyk === "ga") || (txk === "xpts" && tyk === "pts");

  return (
    <>
      <div className="panel">
        <div className="row">
          <div className="seg">{(["players", "teams"] as const).map((k) => <button key={k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{k}</button>)}</div>
          {mode === "players" ? (
            <>
              <label className="row" style={{ gap: 4 }}>x <select style={{ width: 200 }} value={xk} onChange={(e) => setXk(e.target.value)}>{PLAYER_STATS.map((s) => <option key={s.key} value={s.key}>{s.label} · {s.desc}</option>)}</select></label>
              <label className="row" style={{ gap: 4 }}>y <select style={{ width: 200 }} value={yk} onChange={(e) => setYk(e.target.value)}>{PLAYER_STATS.map((s) => <option key={s.key} value={s.key}>{s.label} · {s.desc}</option>)}</select></label>
              <label className="row" style={{ gap: 4 }}><input type="checkbox" checked={per90} onChange={(e) => setPer90(e.target.checked)} /> per 90</label>
              <div className="seg">{POSITIONS.map((p) => <button key={p} className={show.includes(p) ? "on" : ""} onClick={() => setShow(show.includes(p) ? show.filter((x) => x !== p) : [...show, p])}>{p}</button>)}</div>
              <label className="row" style={{ gap: 6 }}><span className="muted">min {minMins} mins</span><input type="range" min={0} max={900} step={30} value={minMins} onChange={(e) => setMinMins(Number(e.target.value))} /></label>
            </>
          ) : (
            <>
              <label className="row" style={{ gap: 4 }}>x <select style={{ width: 200 }} value={txk} onChange={(e) => setTxk(e.target.value)}>{TEAM_STATS.filter((s) => s.key !== "mp").map((s) => <option key={s.key} value={s.key}>{s.label} · {s.desc}</option>)}</select></label>
              <label className="row" style={{ gap: 4 }}>y <select style={{ width: 200 }} value={tyk} onChange={(e) => setTyk(e.target.value)}>{TEAM_STATS.filter((s) => s.key !== "mp").map((s) => <option key={s.key} value={s.key}>{s.label} · {s.desc}</option>)}</select></label>
            </>
          )}
          <span className="muted">{ok.length} points{showDiag ? " · dashed line: actual = expected" : " · dotted lines: medians"}</span>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 600, height: "auto" }} role="img" aria-label={`${yl} against ${xl}`}>
          {Array.from({ length: 6 }, (_, i) => y0 + (i * (y1 - y0)) / 5).map((t) => (
            <g key={`y${i0(t)}`}><line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" /><text x={M.l - 6} y={sy(t) + 4} textAnchor="end">{tick(t)}</text></g>
          ))}
          {Array.from({ length: 6 }, (_, i) => x0 + (i * (x1 - x0)) / 5).map((t) => (
            <text key={`x${i0(t)}`} x={sx(t)} y={H - M.b + 16} textAnchor="middle">{tick(t)}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle">{xl}</text>
          <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`}>{yl}</text>
          {showDiag
            ? <line x1={sx(Math.max(x0, y0))} y1={sy(Math.max(x0, y0))} x2={sx(Math.min(x1, y1))} y2={sy(Math.min(x1, y1))} stroke="var(--muted)" strokeDasharray="5 4" />
            : <><line x1={sx(mx)} x2={sx(mx)} y1={M.t} y2={H - M.b} stroke="var(--faint)" strokeDasharray="2 4" /><line x1={M.l} x2={W - M.r} y1={sy(my)} y2={sy(my)} stroke="var(--faint)" strokeDasharray="2 4" /></>}
          {ok.map((p) => (
            p.pos
              ? <PosMarker key={p.id} pos={p.pos} x={sx(p.x)} y={sy(p.y)} r={p.size} opacity={0.5}
                onMouseEnter={(e) => setHover({ label: p.label, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY })} onMouseLeave={() => setHover(null)}
                onClick={() => open(p.id)} />
              : <circle key={p.id} className="dot" cx={sx(p.x)} cy={sy(p.y)} r={p.size} fill={p.color} fillOpacity={0.6} stroke={p.color}
                onMouseEnter={(e) => setHover({ label: p.label, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY })} onMouseLeave={() => setHover(null)} />
          ))}
          {placeLabels(ok.filter((p) => far.has(p.id)), (p) => ({ x: sx(p.x), y: sy(p.y), text: p.label }), W).map(({ item: p, x, y: ly, anchor }) => (
            <text key={`l${p.id}`} x={x} y={ly} textAnchor={anchor} style={{ fill: "var(--text)", fontWeight: 650 }}>{p.label}</text>
          ))}
        </svg>
        {mode === "players" && <div className="legend">{show.map((p) => <span key={p}><span style={{ color: `var(--pos-${p})` }}>{POS_SHAPE[p]}</span> {p}</span>)}<span>size = minutes played</span></div>}
      </div>
      {hover && <Tooltip x={hover.cx} y={hover.cy}><b>{hover.label}</b><br />{xl}: {tick(hover.x)} · {yl}: {tick(hover.y)}</Tooltip>}
    </>
  );
}
const i0 = (t: number) => Math.round(t * 1000);
const tick = (t: number) => (Math.abs(t) >= 10 ? t.toFixed(0) : Math.abs(t) >= 1 ? t.toFixed(1) : t.toFixed(2));

// ---------------------------------------------------------------- player stats card: shot map + percentiles
const CARD_STATS: Record<Pos, string[]> = {
  GKP: ["saves", "gp", "gc", "fxgc", "cs", "pts", "bonus", "bps"],
  DEF: ["npxg", "uxa", "kp", "xgbuildup", "cbi", "tkl", "rec", "dc", "fxgc", "pts", "bonus"],
  MID: ["npxg", "shots", "uxa", "kp", "xgchain", "xgbuildup", "rec", "tkl", "dc", "pts", "bonus"],
  FWD: ["npxg", "shots", "sot", "big", "xgps", "uxa", "kp", "xgchain", "pts", "bonus"],
};

function StatsCard({ doc, w, id, onClose }: { doc: StatsDoc; w: Window; id: number; onClose: () => void }) {
  const { d, openPlayer } = useApp();
  const p = doc.players.find((x) => x.id === id);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  if (!p) return null;
  const peers = doc.players.filter((x) => x.pos === p.pos && (x.s[w].mins ?? 0) >= 270);
  const keys = CARD_STATS[p.pos];
  const t = p.s[w];
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`${p.name} stats`}>
        <button className="btn small close" onClick={onClose}>✕</button>
        <div className="row" style={{ gap: 8 }}><PosChip pos={p.pos} /><span className="muted">{d.teams.get(p.team)?.name}</span></div>
        <h2 style={{ marginTop: 6 }}>{p.name}</h2>
        <div className="row muted">{t.mins} mins · {t.apps} apps · {t.g} G · {t.a} A · {t.pts} pts
          {d.byId.has(p.id) && <button className="btn small" onClick={() => { onClose(); openPlayer(p.id); }}>forecast card →</button>}
        </div>
        <h3 style={{ marginTop: 16 }}>Per 90 vs other {p.pos}s (270+ mins, {w === "season" ? "season" : "last 4 GWs"})</h3>
        <div className="grid" style={{ gap: 6 }}>
          {keys.map((k) => {
            const s = STAT.get(k)!;
            const per90 = !!s.per90;
            const x = statValue(p, w, k, per90);
            const vals = peers.map((q) => statValue(q, w, k, per90)).filter((v): v is number => v !== null);
            const pc = x === null ? null : percentile(vals, x, s.low);
            return (
              <div key={k} title={s.desc}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
                  <span>{s.label}{per90 ? "/90" : ""}</span>
                  <span className="num"><b>{fmtStat(k, x, per90)}</b> <span className="muted">{pc === null ? "" : `${ordinal(Math.round(100 * pc))} pct`}</span></span>
                </div>
                <div style={{ height: 8, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${100 * (pc ?? 0)}%`, height: "100%", background: pc !== null && pc >= 0.8 ? "var(--accent)" : pc !== null && pc < 0.3 ? "var(--pink)" : "var(--cyan)" }} />
                </div>
              </div>
            );
          })}
        </div>
        <h3 style={{ marginTop: 18 }}>Shot map ({p.shots.length} shots, season)</h3>
        <ShotMap shots={p.shots} />
        <p className="faint">Circle size = xG. Filled green = goal, blue = saved, hollow = missed or blocked, gold = hit the post. Penalties have a square marker.</p>
      </aside>
    </>
  );
}

function ShotMap({ shots }: { shots: StatPlayer["shots"] }) {
  // Understat coordinates: X 0..1 along the pitch (1 = opponent goal line), Y 0..1 across. Show the attacking half.
  const W = 500, H = 340; // 68 m wide x ~50 m deep (half of 105 m), drawn goal at the top
  const px = (y: number) => y * W; // across
  const py = (x: number) => (1 - x) * 2 * H; // depth from goal line (x=1 -> 0)
  const col: Record<string, string> = { G: "var(--accent)", S: "var(--cyan)", P: "var(--gold)", M: "var(--muted)", B: "var(--muted)" };
  const goals = shots.filter((s) => s[3] === "G").length;
  const xg = shots.reduce((a, s) => a + s[2], 0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", background: "color-mix(in srgb, var(--accent) 7%, var(--panel-2))", borderRadius: 10 }} role="img" aria-label="shot map">
        <g stroke="var(--line)" fill="none" strokeWidth={1.5}>
          <rect x={px(0.5 - 40.3 / 68 / 2)} y={0} width={px(40.3 / 68)} height={py(1 - 16.5 / 105)} />
          <rect x={px(0.5 - 18.3 / 68 / 2)} y={0} width={px(18.3 / 68)} height={py(1 - 5.5 / 105)} />
          <line x1={px(0.5 - 7.32 / 68 / 2)} x2={px(0.5 + 7.32 / 68 / 2)} y1={1} y2={1} stroke="var(--text)" strokeWidth={3} />
          <circle cx={px(0.5)} cy={py(1 - 11 / 105)} r={2} fill="var(--line)" />
          <path d={`M ${px(0.5 - 9.15 / 68)} ${H} A ${px(9.15 / 68)} ${px(9.15 / 68)} 0 0 1 ${px(0.5 + 9.15 / 68)} ${H}`} />
        </g>
        {shots.map((s, i) => {
          const [x, y, sxg, res, , , pen] = s;
          const r = 3 + Math.sqrt(sxg) * 16;
          const filled = res === "G" || res === "S" || res === "P";
          return pen
            ? <rect key={i} x={px(y) - 5} y={py(x) - 5} width={10} height={10} fill={filled ? col[res] : "none"} stroke={col[res]} strokeWidth={1.5}><title>{`penalty · ${res === "G" ? "goal" : "missed/saved"}`}</title></rect>
            : <circle key={i} cx={px(y)} cy={Math.min(py(x), H - 2)} r={r} fill={filled ? col[res] : "none"} fillOpacity={0.75} stroke={col[res]} strokeWidth={1.5}>
              <title>{`GW${s[5]} ${s[4]}' · xG ${sxg.toFixed(2)} · ${{ G: "goal", S: "saved", M: "missed", B: "blocked", P: "post" }[res]}`}</title></circle>;
        })}
      </svg>
      <div className="row muted" style={{ gap: 14, fontSize: 12 }}><span>{goals} goals from {xg.toFixed(2)} xG</span><span>{shots.length ? (xg / shots.length).toFixed(2) : "–"} xG per shot</span></div>
    </div>
  );
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
