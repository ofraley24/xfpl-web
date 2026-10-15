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
export interface Evidence {
  generated_utc: string;
  sets: Record<"dev" | "sealed" | "live", EvidenceSet>;
  horizon: { h: number; bias: number; mae: number; rank: number; cover80: number }[];
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
