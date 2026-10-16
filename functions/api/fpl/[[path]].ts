// Cloudflare Pages Function: a read-only relay to the public FPL team endpoints (the FPL API sends no CORS headers,
// so the browser cannot call it directly). Only GET, and only these paths with numeric ids:
//   entry/{id}/   entry/{id}/history/   entry/{id}/transfers/   entry/{id}/event/{gw}/picks/
// Anything else is refused, so this is not an open proxy. Nothing is stored; responses are cached for 2 minutes.
// The same rule is mirrored for local development in vite.config.ts.
export const ALLOWED = [
  /^entry\/\d{1,10}\/$/,
  /^entry\/\d{1,10}\/history\/$/,
  /^entry\/\d{1,10}\/transfers\/$/,
  /^entry\/\d{1,10}\/event\/\d{1,2}\/picks\/$/,
];

export const onRequestGet = async ({ params }: { params: { path?: string | string[] } }) => {
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const path = parts.join("/") + "/";
  if (!ALLOWED.some((re) => re.test(path))) {
    return new Response(JSON.stringify({ error: "not allowed" }), { status: 404, headers: { "content-type": "application/json" } });
  }
  const upstream = await fetch(`https://fantasy.premierleague.com/api/${path}`, {
    headers: { "user-agent": "xFPL planner (read-only team import)" },
    cf: { cacheTtl: 120, cacheEverything: true },
  } as RequestInit);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "application/json", "cache-control": "private, max-age=120" },
  });
};
