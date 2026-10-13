import { useEffect, useMemo, useState } from "react";
import { AppCtx, derive, fixtureKey, useStored, type AppState, type Derived } from "./data";
import type { Forecast } from "./types";
import Planner from "./views/Planner";
import Fixtures from "./views/Fixtures";
import Squad from "./views/Squad";
import Optimiser from "./views/Optimiser";
import Captaincy from "./views/Captaincy";
import Scatter from "./views/Scatter";
import Simulator from "./views/Simulator";
import Compare from "./views/Compare";
import About from "./views/About";
import PlayerDrawer from "./views/PlayerDrawer";

const TABS = [
  ["planner", "Planner"],
  ["fixtures", "Fixtures"],
  ["squad", "My squad"],
  ["optimiser", "Dream team"],
  ["captain", "Captaincy"],
  ["scatter", "Haul map"],
  ["sim", "Simulator"],
  ["compare", "Compare"],
  ["about", "About"],
] as const;
type Tab = (typeof TABS)[number][0];

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
  if (!d) return <main><div className="panel muted">Loading forecast…</div></main>;
  return <Loaded d={d} />;
}

function Loaded({ d }: { d: Derived }) {
  const [tab, setTab] = useStored<Tab>("tab", "planner");
  const first = d.gws[0], last = d.gws[d.gws.length - 1];
  const [rng, setRng] = useStored<[number, number]>(`range:${d.fc.deadline_gw}`, [first, Math.min(last, first + 5)]);
  const [excludedArr, setExcluded] = useStored<string[]>(`excluded:${d.fc.deadline_gw}`, []);
  const [compare, setCompare] = useStored<number[]>("compare", []);
  const [squad, setSquad] = useStored<number[]>("squad", []);
  const [bank, setBank] = useStored<number>("bank", 0);
  const [open, setOpen] = useState<number | null>(null);
  const [theme, setTheme] = useStored<"auto" | "light" | "dark">("theme", "auto");
  useEffect(() => {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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
  };
  const deadline = new Date(d.fc.deadline_utc);
  return (
    <AppCtx.Provider value={state}>
      <header className="top">
        <div className="top-inner">
          <div className="brand">x<b>FPL</b> <small>GW{d.fc.deadline_gw} deadline {deadline.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div>
          <nav className="tabs">
            {TABS.map(([k, label]) => (
              <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
                {label}{k === "compare" && compare.length ? ` (${compare.length})` : ""}
              </button>
            ))}
          </nav>
          <span className="spacer" />
          <div className="seg" title="Theme">
            {(["auto", "light", "dark"] as const).map((t) => (
              <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t}</button>
            ))}
          </div>
        </div>
      </header>
      <main>
        <div className="banner">
          <span>⚠️</span>
          <span>
            <b>Every number assumes the player starts.</b> xP is expected FPL points <i>given a start</i>, so backup keepers and
            injured players can look great. Check the status chips, click a fixture cell to switch it off, or use the
            "probable starters" filter. {excluded.size > 0 && <>{excluded.size} fixture{excluded.size > 1 ? "s" : ""} switched off. <button className="btn small" onClick={() => setExcluded([])}>reset</button></>}
          </span>
        </div>
        {tab === "planner" && <Planner />}
        {tab === "fixtures" && <Fixtures />}
        {tab === "squad" && <Squad />}
        {tab === "optimiser" && <Optimiser />}
        {tab === "captain" && <Captaincy />}
        {tab === "scatter" && <Scatter />}
        {tab === "sim" && <Simulator />}
        {tab === "compare" && <Compare />}
        {tab === "about" && <About />}
      </main>
      {open !== null && d.byId.has(open) && <PlayerDrawer id={open} onClose={() => setOpen(null)} />}
    </AppCtx.Provider>
  );
}
