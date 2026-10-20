import { useEffect, useMemo, useState } from "react";
import { AppCtx, derive, fixtureKey, hasFullModel, useStored, withMode, type AppState, type Derived } from "./data";
import type { XpMode } from "./types";
import type { Forecast } from "./types";
import Overview from "./views/Overview";
import Planner from "./views/Planner";
import Risk from "./views/Risk";
import Events from "./views/Events";
import Fixtures from "./views/Fixtures";
import Squad from "./views/Squad";
import Optimiser from "./views/Optimiser";
import Scatter from "./views/Scatter";
import Simulator from "./views/Simulator";
import Compare from "./views/Compare";
import Stats from "./views/Stats";
import Paper from "./views/Paper";
import TrackRecord from "./views/TrackRecord";
import PlayerDrawer from "./views/PlayerDrawer";

const NAV: { group: string | null; items: [string, string][] }[] = [
  { group: null, items: [["overview", "Overview"]] },
  { group: "Plan", items: [["planner", "Player analysis"], ["events", "Scoring events"], ["risk", "Risk & upside"], ["fixtures", "Fixtures"]] },
  { group: "My team", items: [["squad", "My squad"], ["optimiser", "Dream team"], ["sim", "Simulator"]] },
  { group: "Explore", items: [["stats", "Stats"], ["scatter", "Haul map"], ["compare", "Compare"]] },
  { group: "Method", items: [["paper", "The paper"], ["record", "Track record"]] },
];
const ROUTES = new Set(NAV.flatMap((g) => g.items.map(([k]) => k)));
export type Route = string;

export function go(route: Route) {
  window.location.hash = `#/${route}`;
}

function useRoute(): Route {
  const read = () => {
    const r = window.location.hash.replace(/^#\/?/, "").split("/")[0];
    return ROUTES.has(r) ? r : "overview";
  };
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}

export default function App() {
  const [d, setD] = useState<Derived | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("./data/forecast.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((fc: Forecast) => setD(derive(fc)))
      .catch((e) => setErr(String(e)));
  }, []);
  if (err) return <main><div className="panel">Could not load <code>data/forecast.json</code> ({err}). Run <code>npm run sync-data</code>.</div></main>;
  if (!d) return <main><div className="muted">Loading forecast…</div></main>;
  return <Loaded d={d} />;
}

function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return <span className="countdown">deadline passed</span>;
  const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return <span className="countdown">{d > 0 ? `${d}d ` : ""}{h}h {String(m).padStart(2, "0")}m</span>;
}

function Loaded({ d: d0 }: { d: Derived }) {
  const route = useRoute();
  const fullAvailable = hasFullModel(d0.fc);
  const [modeStored, setMode] = useStored<XpMode>("xpmode", "start");
  const mode: XpMode = fullAvailable ? modeStored : "start";
  const d = useMemo(() => withMode(d0, mode), [d0, mode]);
  const first = d.gws[0], last = d.gws[d.gws.length - 1];
  const [rng, setRng] = useStored<[number, number]>(`range:${d.fc.deadline_gw}`, [first, Math.min(last, first + 5)]);
  const [excludedArr, setExcluded] = useStored<string[]>(`excluded:${d.fc.deadline_gw}`, []);
  const [compare, setCompare] = useStored<number[]>("compare", []);
  const [squad, setSquad] = useStored<number[]>("squad", []);
  const [bank, setBank] = useStored<number>("bank", 0);
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useStored<"auto" | "light" | "dark">("theme", "auto");
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => setMenu(false), [route]);

  const excluded = useMemo(() => new Set(excludedArr), [excludedArr]);
  const state: AppState = {
    d,
    from: Math.max(first, rng[0]),
    to: Math.min(last, rng[1]),
    setRange: (a, b) => setRng([a, b]),
    excluded,
    toggleFixture: (pid, fx) => {
      const k = fixtureKey(pid, fx);
      setExcluded((old) => (old.includes(k) ? old.filter((x) => x !== k) : [...old, k]));
    },
    openPlayer: setOpen,
    compare,
    toggleCompare: (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4))),
    squad: squad.filter((id) => d.byId.has(id)),
    setSquad,
    bank,
    setBank,
    mode,
    setMode,
    fullAvailable,
  };
  const deadline = new Date(d.fc.deadline_utc);
  const narrow = route === "paper";
  return (
    <AppCtx.Provider value={state}>
      <div className="mobile-bar">
        <button className="btn small" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
        <span className="wordmark">x<i>FPL</i></span>
        <span className="spacer" />
        <span className="muted" style={{ fontSize: 12 }}>GW{d.fc.deadline_gw} · <Countdown iso={d.fc.deadline_utc} /></span>
      </div>
      {menu && <div className="drawer-bg" onClick={() => setMenu(false)} />}
      <div className="shell">
        <aside className={`side ${menu ? "open" : ""}`}>
          <div>
            <div className="wordmark">x<i>FPL</i></div>
            <div className="tagline">Expected FPL points from a model you can audit.</div>
          </div>
          <nav className="grid" style={{ gap: 14 }} aria-label="Sections">
            {NAV.map((g) => (
              <div key={g.group ?? "home"} className="nav-group">
                {g.group && <div className="nav-label">{g.group}</div>}
                {g.items.map(([k, label]) => (
                  <button key={k} className={`nav-item ${route === k ? "on" : ""}`} onClick={() => go(k)}>
                    <span>{label}</span>{k === "compare" && compare.length ? <span className="faint">{compare.length}</span> : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="side-foot">
            <div>
              <div className="nav-label" style={{ margin: "0 0 2px" }}>Gameweek {d.fc.deadline_gw} deadline</div>
              <div>{deadline.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
              <div>in <Countdown iso={d.fc.deadline_utc} /></div>
            </div>
            {fullAvailable && (
              <div>
                <div className="nav-label" style={{ margin: "0 0 4px" }}>xP shown</div>
                <div className="seg" title="Which expected points every page shows">
                  <button className={mode === "start" ? "on" : ""} onClick={() => setMode("start")}>If he starts</button>
                  <button className={mode === "full" ? "on" : ""} onClick={() => setMode("full")}>Full model</button>
                </div>
              </div>
            )}
            <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
              {mode === "start"
                ? <>xP = expected FPL points <b>if the player starts</b>.</>
                : <>xP = expected FPL points <b>weighted by the chance he starts or comes on</b>; FPL's injury flags are applied as a rule of thumb.</>}{" "}
              <a href="#/paper" onClick={() => go("paper")}>How it's built</a>
            </div>
            <div className="seg" title="Theme">
              {(["auto", "light", "dark"] as const).map((t) => (
                <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>
              ))}
            </div>
          </div>
        </aside>
        <main className={narrow ? "narrow" : ""}>
          {route === "overview" && <Overview />}
          {route === "planner" && <Planner />}
          {route === "risk" && <Risk />}
          {route === "events" && <Events />}
          {route === "fixtures" && <Fixtures />}
          {route === "squad" && <Squad />}
          {route === "optimiser" && <Optimiser />}
          {route === "sim" && <Simulator />}
          {route === "stats" && <Stats />}
          {route === "scatter" && <Scatter />}
          {route === "compare" && <Compare />}
          {route === "paper" && <Paper />}
          {route === "record" && <TrackRecord />}
        </main>
      </div>
      {open !== null && d.byId.has(open) && <PlayerDrawer id={open} onClose={() => setOpen(null)} />}
    </AppCtx.Provider>
  );
}
