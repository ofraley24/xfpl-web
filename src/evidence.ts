// Validation evidence (public/data/evidence.json, xFPL/analysis/28_export_evidence.py) and the live track record
// (public/data/track_record.json, xFPL/analysis/29_track_record.py).
import { useEffect, useState } from "react";

export interface Acc { bias: number; rmse: number; mae: number; rank: number; top10: number }
export interface Ratio { ratio: number; lo: number | null; hi: number | null; n: number }
export interface EvidenceSet {
  label: string; starts: number; seasons: string[];
  accuracy: { model: Acc; pps5: Acc; form5: Acc };
  reliability: { pred: number; obs: number; lo: number; hi: number; n: number }[];
  pit: { hist: number[]; c50: number; c80: number };
  components: { name: string; pred: number; obs: number; ratio: number }[];
  high_end: Record<"top5" | "top10" | "top20" | "top40" | "all", Ratio>;
}
export interface Decile { pred: number; obs: number; n: number }
// Availability model (xFPL/analysis/30_availability.py): P(start), P(sub), P(no appearance) at the deadline.
export interface AvailabilityEvidence {
  rows: number;
  seasons: { season: string; set: "dev" | "sealed" | "live"; n: number; ll_model: number; ll_base: number; obs_start: number; pred_start: number; obs_sub: number; pred_sub: number }[];
  rel_start: Decile[];
  rel_sub: Decile[];
  horizon: { h: number; n: number; obs_start: number; pred_start: number; ll_raw: number; ll_recal: number }[];
}
// The full model, P(start) x xP|start + P(sub) x xP|sub (xFPL/analysis/31_full_xp.py), development seasons.
export interface FullEvidence {
  rows: number; seasons: string[];
  overall: Ratio;
  by_season: (Ratio & { season: string })[];
  by_position: (Ratio & { pos: string })[];
  deciles: { p_start: number; pred: number; obs: number; n: number }[];
  accuracy: { model: Acc; form5: Acc };
  pit: { hist: number[]; c50: number; c80: number };
  sub: { n: number; ratio: number; min_pred: number; min_obs: number };
  sub_by_season: { season: string; min_pred: number; min_obs: number }[];
}
export interface Evidence {
  generated_utc: string;
  sets: Record<"dev" | "sealed" | "live", EvidenceSet>;
  horizon: { h: number; bias: number; mae: number; rank: number; cover80: number }[];
  availability?: AvailabilityEvidence; // absent in evidence files written before 2026-10-18
  full?: FullEvidence;
}
export interface TrackMetrics { bias: number; mae: number; rmse: number; rank: number; top10: number; ratio: number }
export interface TrackGw { gw: number; n: number; forecast_snapshot: string; deadline_snapshot: string; model: TrackMetrics; fpl_same: TrackMetrics; fpl_deadline: TrackMetrics }
export interface Track { generated_utc: string; season: string; rows: string; locked: { gw: number; snapshot: string; deadline: string; scored: boolean }[]; gameweeks: TrackGw[]; overall: null | { n: number; gws: number; model: TrackMetrics; fpl_same: TrackMetrics; fpl_deadline: TrackMetrics } }

export function useJson<T>(url: string) {
  const [v, setV] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(setV).catch((e) => setErr(String(e)));
  }, [url]);
  return { v, err };
}
export const useEvidence = () => useJson<Evidence>("./data/evidence.json");
export const useTrack = () => useJson<Track>("./data/track_record.json");
