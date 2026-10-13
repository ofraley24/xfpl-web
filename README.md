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

| tab | what it does |
| --- | --- |
| Planner | every player's xP summed over any gameweek range, xP per £m, chance of a 10+ haul; colour-coded fixture cells you can click to switch off; filters for position, team, price, probable starters, fitness |
| Fixtures | fixture ticker by team: expected goals for, clean-sheet chance, or expected goal difference over the range |
| My squad | build your 15 (or load the dream team); best XI and captain picked each gameweek on a pitch view; transfer finder ranking every legal single swap by what it adds to your squad |
| Dream team | the optimal 15 under FPL's rules (2/5/5/3, ≤ 3 per club, budget) for the range, solved as an integer program in the browser; lock / ban players |
| Captaincy | armband ranking per gameweek with haul (10+, 15+) and blank chances from each player's full points distribution; captain duel: P(A outscores B) |
| Haul map | scatter of every probable starter: price vs xP / xP per £m / haul chance; bubble size = ownership |
| Simulator | play your gameweek out: each starter's score drawn from his simulated distribution, exact distribution of your team total, chance to reach a target, range outlook |
| Compare | up to four players side by side, per-gameweek chart |
| About | what the numbers mean, the horizon backtest, this forecast's provenance and quality gates |

Clicking a player opens a card with his points broken down by source (goals, assists, clean sheets, bonus, ...) and a
distribution chart for every fixture.

## Data contract (`forecast.json`, schema 2)

Header: season, deadline gameweek and time, gameweeks covered, FPL snapshot time, model id (code commit, training-data
hash), the forecast's quality gates. `teams`; `fixtures` (team expected goals from ratings frozen at the deadline);
`players` with price, ownership, FPL status / news, and per fixture: `xp`, quantiles, P(5+), P(10+), expected points by
source (`parts`, counts), and `pmf` (probability of each score, from 1,000 simulated matches). Types: `src/types.ts`.

## Caveats

- Sums over gameweeks have no intervals: the backtest showed normal-approximation intervals for short ranges are not
  calibrated (`xFPL/docs/HORIZON_RESULTS.md`). The simulator's ranges assume independent players and are for fun.
- The dream team keeps one XI for the whole range (no weekly re-picks, no captain) — the squad tab re-picks weekly.
- Probable XI is a heuristic used for bonus competition in the simulation, not a starting probability.
