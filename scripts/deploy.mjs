// Build the site and upload dist/ to Cloudflare Pages (direct upload; data never goes through git).
// The site is public (owner's decision, 2026-10-18; public/_headers sets noindex). Pass --require-access to refuse
// unless the live URL redirects to Cloudflare Access (<team>.cloudflareaccess.com), e.g. if it is made private again.
// --force keeps wrangler on classic Pages (it otherwise may deploy a public Worker instead, as on 2026-10-15).
// Env: XFPL_PAGES_PROJECT (default "xfpl"), XFPL_SITE_URL (default https://<project>.pages.dev).
import { execFileSync } from "node:child_process";

const project = process.env.XFPL_PAGES_PROJECT ?? "xfpl";
const siteUrl = process.env.XFPL_SITE_URL ?? `https://${project}.pages.dev`;
const requireAccess = process.argv.includes("--require-access");

async function behindAccess(url) {
  try {
    const res = await fetch(url, { redirect: "manual" });
    const to = res.headers.get("location") ?? "";
    return res.status >= 300 && res.status < 400 && new URL(to, url).hostname.endsWith(".cloudflareaccess.com");
  } catch (e) {
    console.error(`deploy: could not reach ${url} (${e.message})`);
    return false;
  }
}

if (requireAccess && !(await behindAccess(siteUrl))) {
  console.error(`deploy: ${siteUrl} is not behind Cloudflare Access; refusing to deploy (--require-access)`);
  process.exit(2);
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
run("npm", ["run", "build"]);
run("npx", ["wrangler", "pages", "deploy", "dist", "--project-name", project, "--branch", "main", "--commit-dirty=true", "--force"]);
console.log(`deploy: live at ${siteUrl}`);
