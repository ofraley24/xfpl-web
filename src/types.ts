// Shape of public/data/forecast.json, written by xFPL/analysis/26_forecast.py (schema_version 3).
// Schema 3 adds availability (p_start, p_sub), xP given a substitute appearance and the full mixture (`full`).

export type Pos = "GKP" | "DEF" | "MID" | "FWD";

export interface Pmf {
  lo: number; // points value of p[0]
  p: number[]; // probabilities for lo, lo+1, ...
}

export interface PlayerFixture {
  gw: number;
  h: number; // gameweeks ahead of the deadline (1 = next gameweek)
  fixture: number;
  opp: number;
  home: boolean;
  kickoff: string;
  xi: boolean; // in the probable XI used for the bonus simulation (a heuristic, not a start probability)
  xp: number; // expected points GIVEN THAT THE PLAYER STARTS
  q10: number;
  q50: number;
  q90: number;
  p5: number;
  p10: number;
  var_ale: number;
  sd_epi: number;
  parts: Record<string, number>;
  pmf?: Pmf;
  // schema 3: availability and the full model (P(start) x xP|start + P(sub) x xP|sub)
  p_start?: number;
  p_sub?: number;
  xp_sub?: number;
  full?: FullModel;
  xp_start?: number; // set by data.withMode: the start-conditional xP, kept when the view shows the full model
}

export interface FullModel {
  xp: number;
  q10: number;
  q50: number;
  q90: number;
  p5: number;
  p10: number;
  pmf: Pmf;
}

export type XpMode = "start" | "full";

export interface Player {
  id: number;
  code: number;
  name: string;
  full_name: string;
  team: number;
  pos: Pos;
  price: number;
  own: number; // % of FPL managers
  status: string; // a available, d doubtful, i injured, s suspended, n not available
  chance_next: number | null;
  news: string;
  fixtures: PlayerFixture[];
}

export interface Team {
  id: number;
  name: string;
  short: string;
}

export interface Fixture {
  id: number;
  gw: number;
  home: number;
  away: number;
  kickoff: string;
  xg_home: number;
  xg_away: number;
}

export interface Forecast {
  schema_version: number;
  target: string;
  full_target?: string;
  season: string;
  deadline_gw: number;
  deadline_utc: string;
  gameweeks: number[];
  snapshot_utc: string;
  generated_utc: string;
  model: { tag: string; season: string; code_commit: string; train_hash: string; created_utc: string };
  intervals: string;
  gates: { name: string; pass: boolean; detail: string }[];
  teams: Team[];
  fixtures: Fixture[];
  players: Player[];
}
