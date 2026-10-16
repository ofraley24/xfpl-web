import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local development mirror of functions/api/fpl/[[path]].ts: the same read-only allow-list of public team endpoints.
const ALLOWED = [
  /^\/api\/fpl\/entry\/\d{1,10}\/$/,
  /^\/api\/fpl\/entry\/\d{1,10}\/history\/$/,
  /^\/api\/fpl\/entry\/\d{1,10}\/transfers\/$/,
  /^\/api\/fpl\/entry\/\d{1,10}\/event\/\d{1,2}\/picks\/$/,
];

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api/fpl": {
        target: "https://fantasy.premierleague.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/fpl/, "/api"),
        // returning false makes Vite answer 404 instead of proxying
        bypass: (req) => {
          const url = (req.url ?? "").split("?")[0];
          return req.method !== "GET" || !ALLOWED.some((re) => re.test(url)) ? false : undefined;
        },
      },
    },
  },
});
