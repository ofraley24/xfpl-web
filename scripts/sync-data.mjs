// Copy the newest forecast JSON from the research repo (../xFPL/data/forecasts) to public/data/forecast.json.
// Forecast files are data, not code: public/data is gitignored.
import { readdirSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const src = resolve(process.env.XFPL_FORECASTS ?? "../xFPL/data/forecasts");
const dst = resolve("public/data");
mkdirSync(dst, { recursive: true });
if (!existsSync(src)) {
  console.warn(`sync-data: ${src} not found; keeping public/data as it is`);
  process.exit(0);
}
const files = readdirSync(src).filter((f) => /^forecast_.*\.json$/.test(f)).sort((a, b) => {
  // newest deadline, then newest snapshot: forecast_<season>_gw<NN>_<snapshot>.json sorts lexically
  return a < b ? -1 : 1;
});
if (!files.length) {
  console.warn("sync-data: no forecast files found");
  process.exit(0);
}
const latest = files[files.length - 1];
copyFileSync(join(src, latest), join(dst, "forecast.json"));
console.log(`sync-data: ${latest} -> public/data/forecast.json`);
