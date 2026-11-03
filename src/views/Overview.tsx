import { useMemo } from "react";
import { go } from "../App";
import { fmt, pct, useApp, useStored, XP_LABEL } from "../data";
import { useJson } from "../evidence";
import { atLeast } from "../prob";
import { AIM_BUTTON, ClsChip, FIELD_BUTTON, FIELD_LABEL, forAim, scorePool, signed, TEMPLATE_EO, type Aim, type Field, type Row } from "../strategy";
import type { Player, Pmf } from "../types";
import { PlayerName, PmfBars, PosChip, StatusChip, TeamShort } from "../ui";
import type { Elite } from "./EliteTable";

const DIFF_EO = 0.1;   // a differential: owned (effectively) by under 10% of the field

export default function Overview() {
  const { d, excluded, mode, squad } = useApp();
  const { v: el } = useJson<Elite>("./data/elite_ownership.json");
  const gw = d.fc.deadline_gw;
  // the same stored choices as Transfer Strategies, so the situation set here carries over
  const [fieldRaw, setField] = useStored<Field>("ts:field", "top10k");
  const [aim, setAim] = useStored<Aim>("ts:mode", "all");
  const field: Field = el ? fieldRaw : "all";
  const fieldName = FIELD_LABEL[field];
  const pool = useMemo(() => scorePool({ players: d.players, el: el ?? null, field, from: gw, to: gw, excluded, haulLine: 10, target: 10 }),
    [d, el, field, gw, excluded]);
  const owned = useMemo(() => new Set(squad), [squad]);
  const top = useMemo(() => [...pool].sort((a, b) => b.xp - a.xp).slice(0, 10), [pool]);
  const picks = useMemo(() => (aim === "protect" ? forAim(pool, "protect")
    : forAim(pool.filter((r) => r.eo < DIFF_EO && !owned.has(r.p.id)), aim)).slice(0, 10), [pool, aim, owned]);
  const captains = useMemo(() => {
    const best = (k: (r: Row) => number) => pool.reduce<Row | null>((m, r) => (!m || k(r) > k(m) ? r : m), null);
    return [
      { label: "Safest", note: "highest xP", r: best((r) => r.xp) },
      { label: "Best gain", note: `on the ${fieldName}: xP × (2 − EO)`, r: best((r) => r.xp * (2 - r.eo)) },
      { label: "Upside bet", note: "likeliest 20+ as captain", r: best((r) => r.haul) },
    ];
  }, [pool, fieldName]);
  const opp = (p: Player) => p.fixtures.filter((f) => f.gw === gw).map((f) => (f.home ? d.teams.get(f.opp)?.short : d.teams.get(f.opp)?.short.toLowerCase())).join(", ");
  const deadline = new Date(d.fc.deadline_utc);
  const stale = el && el.gw < gw;
  const Owned = ({ p }: { p: Player }) => (owned.has(p.id) ? <span className="chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>owned</span> : null);
  const Who = ({ r }: { r: Row }) => (
    <td><div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><StatusChip p={r.p} /><Owned p={r.p} /></div>
      <div className="faint" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}><TeamShort id={r.p.team} /> · {opp(r.p)} · £{fmt(r.p.price)}m</div></td>
  );
  const Mini = ({ r }: { r: Row }) => <td style={{ paddingTop: 2, paddingBottom: 0 }}><PmfBars pmf={r.pm} width={96} height={20} maxPts={20} /></td>;
  const pickTitle = aim === "protect" ? "Template to cover" : aim === "steady" ? "10 steady differentials" : aim === "chase" ? "10 punts" : "10 differentials";
  const pickNote = aim === "protect" ? `${Math.round(100 * TEMPLATE_EO)}%+ EO in the ${fieldName}, by the expected points you lose to them without him`
    : `under ${Math.round(100 * DIFF_EO)}% EO in the ${fieldName}${squad.length ? ", not in your squad" : ""}, ${aim === "chase" ? "by P(10+) × (1 − EO)" : "by expected gain on the field"}`;

  return (
    <div className="grid" style={{ gap: 28 }}>
      <header>
        <div className="kicker">Gameweek {gw} · deadline {deadline.toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
        <h1>Forecasting points distributions to personalise your strategy.</h1>
        <p className="lede">Every player's full range of outcomes, not just the average, scored against the managers you are competing with.
          Tell us your situation and the picks follow. <a href="#/paper" onClick={() => go("paper")}>How the model works</a>.</p>
      </header>

      <section className="panel">
        <h3 style={{ margin: "0 0 8px" }}>Your situation</h3>
        <div className="row" style={{ gap: 18 }}>
          <div className="row" style={{ gap: 8 }}><span className="muted">Competing with</span>
            <div className="seg">{(["top10k", "top100k", "all"] as const).map((k) => (
              <button key={k} className={field === k ? "on" : ""} disabled={k !== "all" && !el} onClick={() => setField(k)}>{FIELD_BUTTON[k]}</button>))}</div>
          </div>
          <div className="row" style={{ gap: 8 }}><span className="muted">Aim</span>
            <div className="seg">{(["all", "protect", "steady", "chase"] as const).map((k) => (
              <button key={k} className={aim === k ? "on" : ""} onClick={() => setAim(k)}>{AIM_BUTTON[k]}</button>))}</div>
          </div>
        </div>
        <p className="faint" style={{ margin: "8px 0 0", fontSize: 12 }}>
          {field === "all" ? <>Against all managers, EO is FPL's overall ownership.</>
            : <>EO is from gameweek {el!.gw} {fieldName} teams{stale ? ", entered at the last deadline (FPL hides picks until the deadline)" : ""}.</>}{" "}
          {squad.length ? <>Players in your squad are marked owned.</> : <>Load your team in <a href="#/squad" onClick={() => go("squad")}>My squad</a> to mark the players you own and leave them out of the differentials.</>}
        </p>
      </section>

      <section className="two">
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>Top 10, gameweek {gw}</h3><span className="metric-note">xP · {XP_LABEL[mode]}</span>
          </div>
          <div style={{ overflowX: "auto" }}><table className="plain" style={{ marginTop: 6 }}>
            <thead><tr><th></th><th>Player</th><th className="r">xP</th><th className="r">EO</th><th>Distribution</th></tr></thead>
            <tbody>{top.map((r, i) => (
              <tr key={r.p.id}><td className="faint num" style={{ width: 18, paddingRight: 0 }}>{i + 1}</td><Who r={r} />
                <td className="r serif" style={{ fontSize: 18, fontWeight: 600 }}>{fmt(r.xp)}</td><td className="r num">{fmt(100 * r.eo, 0)}%</td><Mini r={r} /></tr>
            ))}</tbody>
          </table></div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("planner")}>All projections →</button>
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>{pickTitle}</h3><span className="metric-note">{pickNote}</span>
          </div>
          {picks.length ? (
            <div style={{ overflowX: "auto" }}><table className="plain" style={{ marginTop: 6 }}>
              <thead><tr><th>Player</th><th>Risk</th><th className="r">xP</th><th className="r">EO</th>{aim === "protect" && <th className="r" title="xP × EO: expected points the field scores on him">Cost</th>}<th className="r" title="Chance of 10+ points">P(10+)</th><th>Distribution</th></tr></thead>
              <tbody>{picks.map((r) => (
                <tr key={r.p.id}><Who r={r} /><td><ClsChip c={r.cls} short /></td><td className="r num"><b>{fmt(r.xp)}</b></td><td className="r num">{fmt(100 * r.eo, 0)}%</td>
                  {aim === "protect" && <td className="r num">{fmt(r.cover, 2)}</td>}<td className="r num">{pct(r.haul)}</td><Mini r={r} /></tr>
              ))}</tbody>
            </table></div>
          ) : <p className="muted">No players fit this aim this gameweek.</p>}
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => go("risk")}>Full transfer strategies →</button>
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Captain shortlist</h3><span className="metric-note">gameweek {gw} · against the {fieldName}</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", marginTop: 10 }}>
          {captains.map(({ label, note, r }) => r && (
            <div key={label} style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <div className="kicker" style={{ marginBottom: 2 }}>{label}</div>
              <div className="row" style={{ gap: 6 }}><PosChip pos={r.p.pos} /><PlayerName p={r.p} /><Owned p={r.p} /></div>
              <div className="faint" style={{ fontSize: 11.5, margin: "2px 0 4px" }}>{note}</div>
              <div className="row" style={{ gap: 12, fontSize: 13 }}>
                <span>captain xP <b>{fmt(2 * r.xp)}</b></span><span>EO <b>{fmt(100 * r.eo, 0)}%</b></span>
                <span>gain <b>{signed(r.xp * (2 - r.eo))}</b></span><span>P(20+) <b>{pct(r.haul)}</b></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SameXp starters={pool.map((r) => r.p)} gw={gw} />
    </div>
  );
}

/** Two probable starters with almost the same xP but very different distributions: why the full distribution matters. */
function SameXp({ starters, gw }: { starters: Player[]; gw: number }) {
  const pick = useMemo(() => {
    const one = starters.map((p) => {
      const fx = p.fixtures.filter((f) => f.gw === gw);
      return fx.length === 1 && fx[0].pmf ? { p, xp: fx[0].xp, pm: fx[0].pmf as Pmf, haul: atLeast(fx[0].pmf, 10), blank: 1 - atLeast(fx[0].pmf, 3) } : null;
    }).filter((x): x is NonNullable<typeof x> => !!x && x.xp >= 4);
    let best: [typeof one[0], typeof one[0]] | null = null, gap = 0;
    for (let i = 0; i < one.length; i++) for (let j = i + 1; j < one.length; j++) {
      const a = one[i], b = one[j];
      if (a.p.pos !== b.p.pos || Math.abs(a.xp - b.xp) > 0.1) continue;   // like for like: same position, same xP
      const g = Math.abs(a.haul - b.haul);
      if (g > gap) { gap = g; best = a.haul > b.haul ? [a, b] : [b, a]; }
    }
    return best;
  }, [starters, gw]);
  if (!pick) return null;
  const [hi, lo] = pick;
  const card = (x: typeof hi, tag: string) => (
    <div className="panel" style={{ flex: 1, minWidth: 260 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><span><PosChip pos={x.p.pos} /> <PlayerName p={x.p} /> <span className="faint"><TeamShort id={x.p.team} /></span></span>
        <span className="metric-note">{tag}</span></div>
      <div className="row" style={{ gap: 18, margin: "8px 0 4px" }}>
        <span><span className="serif" style={{ fontSize: 26, fontWeight: 600 }}>{fmt(x.xp, 1)}</span> <span className="muted">xP</span></span>
        <span><b>{(100 * x.haul).toFixed(0)}%</b> <span className="muted">chance of 10+</span></span>
        <span><b>{(100 * x.blank).toFixed(0)}%</b> <span className="muted">blank risk</span></span>
      </div>
      <PmfBars pmf={x.pm} width={300} height={56} maxPts={20} />
    </div>
  );
  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ margin: 0 }}>Same xP, different stories</h3>
        <span className="metric-note">two {({ GKP: "goalkeepers", DEF: "defenders", MID: "midfielders", FWD: "forwards" } as const)[hi.p.pos]} · gameweek {gw} · full points distributions</span>
      </div>
      <p className="sub" style={{ marginTop: 4 }}>Expected points are only the average. Every forecast here is a full distribution of
        points, so you can see whether a player is a steady earner or a boom-or-bust bet, and choose the one that suits your rank.</p>
      <div className="row" style={{ alignItems: "stretch", gap: 16 }}>{card(hi, "more upside")}{card(lo, "steadier")}</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={() => go("risk")}>Explore transfer strategies →</button>
        <span className="faint" style={{ fontSize: 12.5 }}>Protect a lead with players whose bad weeks are still decent, or chase a rival with upside, and see what it costs in xP.</span>
      </div>
    </section>
  );
}
