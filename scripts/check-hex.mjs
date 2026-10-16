/**
 * Flags raw hex colours in component and page files (docs/design/01-foundations.md §4, 06-qa-checklist.md).
 * Colours belong in src/styles/tokens.css (and src/theme/heroui-theme.js, which HeroUI needs as hex).
 *
 * Usage: node scripts/check-hex.mjs [--max N]
 *   Lists every hit and exits 1 when there are more than N (default 0). Use --max to ratchet down while
 *   older files are restyled phase by phase.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".css"];
// Besides tokens: content styles for the rich-text editor and storefront previews (they style the merchant's
// content, not the admin UI), third-party brand logos, and editor content defaults.
const ALLOWED = [
  "src/styles/tokens.css",
  "src/theme/heroui-theme.js",
  "src/gql/",
  "src/styles/stories.css",
  "src/styles/blockeditor.css",
  "src/styles/embedpopup.css",
  "src/styles/imagedrop.css",
  "src/helpers/extension/",
  "src/store/slices/editorSlice.ts",
  "src/config/marketplaceApps.tsx",
  "src/App.css",
];
const HEX_PATTERN = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

const maxIndex = process.argv.indexOf("--max");
const MAX_HITS = maxIndex > -1 ? Number(process.argv[maxIndex + 1]) : 0;

// ─── Scan ────────────────────────────────────────────────────────────────────
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const hits = [];
for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (!EXTENSIONS.some((ext) => rel.endsWith(ext))) continue;
  if (ALLOWED.some((allowed) => rel.startsWith(allowed))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      // Skip HTML entities (&#123;) and in-page links (href="#top").
      const matches = [...line.matchAll(HEX_PATTERN)].filter((match) => {
        const before = line.slice(0, match.index);
        // Order numbers ("#1042") are 4 digits; real 4-digit hex colours with no letters are vanishingly rare.
        if (/^#\d{4}$/.test(match[0])) return false;
        return !before.endsWith("&") && !/(href|to)=["'{`]*$/.test(before);
      });
      for (const match of matches) hits.push(`${rel}:${index + 1}  ${match[0]}`);
    });
}

// ─── Report ──────────────────────────────────────────────────────────────────
const byFile = new Map();
for (const hit of hits) {
  const file = hit.split(":")[0];
  byFile.set(file, (byFile.get(file) ?? 0) + 1);
}
for (const hit of hits) console.log(hit);
console.log(`\n${hits.length} raw hex colour(s) in ${byFile.size} file(s); allowed: ${MAX_HITS}.`);
process.exit(hits.length > MAX_HITS ? 1 : 0);
