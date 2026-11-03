# Quantitative FPL

A transfer-planning site for Fantasy Premier League, built on the xP model in the research repository
([xFPL](https://github.com/ofraley24/xFPL)). It reads one file, `public/data/forecast.json`, written before each
deadline by `xFPL/analysis/26_forecast.py`.

**Every number is expected FPL points given that the player starts.** The model does not estimate starting chances:
the site shows FPL's injury flags, a "probable starters" filter (recent starts + availability), and lets you switch any
fixture off.

## Run it

```bash
npm install
npm run dev        # copies the newest forecast from ../xFPL/data/forecasts, then serves http://localhost:5173
npm run build      # static site in dist/ (open with `npm run preview`)
```

## Deploy (Cloudflare Pages)

```bash
npm run deploy     # build, then upload dist/ to the Pages project "xfpl" (direct upload; data never goes through git)
```

The site is public; `public/_headers` sets `noindex`. `npm run deploy -- --require-access` refuses unless the live URL
redirects to Cloudflare Access, for when it is made private again. The research repo's `pipeline/auto_refresh.py` runs
`npm run deploy` after each successful weekly refresh (log: `xFPL/data/logs/deploy.log`). Override the project or URL
with `XFPL_PAGES_PROJECT` / `XFPL_SITE_URL`.

`npm run sync-data` copies the newest `forecast_*.json` (override the folder with `XFPL_FORECASTS=...`). Forecast files
are data, not code: `public/data/*.json` is gitignored.

## What's in it

Single-hue green table shading, no club colours. Editorial design (serif display, paper-and-ink palette with light and dark modes, validated chart colours), a sidebar
grouped by task, bookmarkable pages (`#/planner`, `#/paper`, ...). xP everywhere means expected points **if the player
starts**; it is labelled quietly in the metric names and explained in the paper.

| page | what it does |
| --- | --- |
| Overview | the personalised front page: your situation (field: top 10k / top 100k / all managers; aim: best gain / protect a lead / steady differentials / chase upside, shared with Transfer Strategies), top 10 by xP for the gameweek with EO and distributions, 10 differentials (under 10% EO, not in your squad) with risk class and P(10+) or the template to cover, a captain shortlist (safest / best gain on the field / upside), and 'Same xP, different stories'. Picks and classes come from `src/strategy.tsx`, shared with Transfer Strategies |
| Projections | xP over any gameweek range, xP per £m, haul chance; fixture cells you can switch off; filters incl. ownership and probable starters |
| Player Props | chance of each scoring event per player and fixture, each from its own component model: goal, 2+ goals, assist, clean sheet, defensive contribution, any bonus, 3 bonus, save points, yellow card; leaders per event; double gameweeks as 'at least once'. Follows the xP toggle (full model mixes start / substitute / no appearance) |
| Transfer Strategies | every pick scored against a field (top 10k / top 100k elite EO, or all managers' ownership): expected gain on the field xP × (1 − EO), volatility relative to the typical for the player's position and xP (leave-one-out local regression), classes Template (50%+ EO) / Steady differential / Punt, rank swing abs(1 − EO) × SD; differential map; strategy views (best gain / protect a lead / steady differentials / chase upside); upside swaps; captains with gain on the field xP × (2 − EO); the full elite ownership table (top-10k census, top-100k sample, 95% margins). Multi-gameweek totals assume independent fixtures and hold EO fixed |
| Fixtures | fixture ticker: expected goals for, clean-sheet chance or expected goal difference |
| My squad | best XI and captain each gameweek, chip planner, the team's points distribution for the gameweek (best XI + captain; team-mates treated as independent), transfer finder by squad effect over a chosen window (next GW / 3 / 5 / 8 GWs) |
| Squad Optimiser | the optimal 15 under FPL's rules, solved as an integer program in the browser; variance setting (Low / Neutral / High) adds λ × each player's variance above the typical for his position and xP |
| Stats | season / last-4 player and team stats, explorer, shot maps and percentiles |
| Haul map, Compare | price vs xP scatter (position by shape and colour); side-by-side players |
| The paper | condensed version of the Results Report: method, testing, results with live figures (`evidence.json`), horizon backtest, benchmark caveat, limitations; coefficients and hyperparameters withheld |
| Track record | each locked pre-deadline forecast scored after its gameweek against FPL's own projection (`track_record.json`); this week's provenance and quality gates |

## Data contract (`forecast.json`, schema 4)

Also synced: `stats.json` (27), `evidence.json` (28), `track_record.json` (29).

Header: season, deadline gameweek and time, gameweeks covered, FPL snapshot time, model id (code commit, training-data
hash), the forecast's quality gates. `teams`; `fixtures` (team expected goals from ratings frozen at the deadline);
`players` with price, ownership, FPL status / news, and per fixture: `xp`, quantiles, P(5+), P(10+), expected points by
source (`parts`, counts), and `pmf` (probability of each score, from 1,000 simulated matches); schema 3 adds availability (`p_start`, `p_sub`) and
the full-model mixture (`full`); schema 4 adds event probabilities given a start (`probs`) and given a substitute
appearance (`probs_sub`). Types: `src/types.ts`.

## Caveats

- Sums over gameweeks have no intervals: the backtest showed normal-approximation intervals for short ranges are not
  calibrated (`xFPL/docs/HORIZON_RESULTS.md`). The squad's team-total distribution treats team-mates as independent and is not backtested.
- The Squad Optimiser keeps one XI for the whole range (no weekly re-picks, no captain) — the squad tab re-picks weekly.
- Probable XI is a heuristic used for bonus competition in the simulation, not a starting probability.
