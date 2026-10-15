# xFPL Planner

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

`npm run sync-data` copies the newest `forecast_*.json` (override the folder with `XFPL_FORECASTS=...`). Forecast files
are data, not code: `public/data/*.json` is gitignored.

## What's in it

Editorial design (serif display, paper-and-ink palette with light and dark modes, validated chart colours), a sidebar
grouped by task, bookmarkable pages (`#/planner`, `#/paper`, ...). xP everywhere means expected points **if the player
starts**; it is labelled quietly in the metric names and explained in the paper.

| page | what it does |
| --- | --- |
| Overview | the gameweek at a glance: top picks per position, 'Same xP, different stories' (two same-position players with equal xP and different distributions), how it's built, captain shortlist, value, teams to target |
| Player analysis | xP over any gameweek range, xP per £m, haul chance; fixture cells you can switch off; filters incl. ownership and probable starters |
| Risk & upside | built on the full points distributions: strategy modes (protect a lead / expected points / chase a target), upside against xP with the typical upside for each xP (leave-one-out local regression; no comparison where too few similar players), bad-week (20th pct) and good-week (90th pct) outcomes, blank risk, upside swaps, chase captains. Multi-gameweek totals assume independent fixtures |
| Fixtures | fixture ticker: expected goals for, clean-sheet chance or expected goal difference |
| Captaincy | armband ranking with haul / blank chances from full points distributions; captain duel |
| My squad | best XI and captain each gameweek, chip planner, transfer finder by squad effect |
| Dream team | the optimal 15 under FPL's rules, solved as an integer program in the browser |
| Simulator | play a gameweek out from the simulated distributions; team-total distribution |
| Stats | season / last-4 player and team stats, explorer, shot maps and percentiles |
| Haul map, Compare | price vs xP scatter (position by shape and colour); side-by-side players |
| The paper | condensed version of the Results Report: method, testing, results with live figures (`evidence.json`), horizon backtest, benchmark caveat, limitations; coefficients and hyperparameters withheld |
| Track record | each locked pre-deadline forecast scored after its gameweek against FPL's own projection (`track_record.json`); this week's provenance and quality gates |

## Data contract (`forecast.json`, schema 2)

Also synced: `stats.json` (27), `evidence.json` (28), `track_record.json` (29).

Header: season, deadline gameweek and time, gameweeks covered, FPL snapshot time, model id (code commit, training-data
hash), the forecast's quality gates. `teams`; `fixtures` (team expected goals from ratings frozen at the deadline);
`players` with price, ownership, FPL status / news, and per fixture: `xp`, quantiles, P(5+), P(10+), expected points by
source (`parts`, counts), and `pmf` (probability of each score, from 1,000 simulated matches). Types: `src/types.ts`.

## Caveats

- Sums over gameweeks have no intervals: the backtest showed normal-approximation intervals for short ranges are not
  calibrated (`xFPL/docs/HORIZON_RESULTS.md`). The simulator's ranges assume independent players and are for fun.
- The dream team keeps one XI for the whole range (no weekly re-picks, no captain) — the squad tab re-picks weekly.
- Probable XI is a heuristic used for bonus competition in the simulation, not a starting probability.
