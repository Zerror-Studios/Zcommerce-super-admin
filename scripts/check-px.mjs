/**
 * Flags raw pixel sizes in component and page files (docs/design/README.md rule 4: no one-off font sizes,
 * radii or margins in page files). Sizes belong in src/styles/tokens.css / tokens-expression.css and the
 * Tailwind theme in src/styles/theme.css.
 *
 * Catches Tailwind arbitrary values (`text-[13px]`, `w-[260px]`, `rounded-[10px]`) and px strings in inline
 * styles (`style={{ width: "260px" }}`). 1px and 0px are allowed (hairlines).
 *
 * Usage: node scripts/check-px.mjs [--max N]
 *   Lists every hit and exits 1 when there are more than N (default 0). Use --max to ratchet down while
 *   older files are restyled phase by phase.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const SCAN_DIR = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
// Generated code, the rich-text editor's content extensions, and the component showcase.
const ALLOWED = ["src/gql/", "src/helpers/extension/", "src/components/ui/DevUiPage.tsx"];
const ARBITRARY_PATTERN = /-\[(-?\d*\.?\d+)px\]/g;
const INLINE_PATTERN = /["'`](-?\d*\.?\d+)px["'`]/g;

const maxIndex = process.argv.indexOf("--max");
const MAX_HITS = maxIndex > -1 ? Number(process.argv[maxIndex + 1]) : 0;

// ─── Scan ────────────────────────────────────────────────────────────────────
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isHairline = (value) => Math.abs(Number(value)) <= 1;

const hits = [];
for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file).split(sep).join("/");
  if (!EXTENSIONS.some((ext) => rel.endsWith(ext))) continue;
  if (ALLOWED.some((allowed) => rel.startsWith(allowed))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      const matches = [...line.matchAll(ARBITRARY_PATTERN), ...line.matchAll(INLINE_PATTERN)];
      for (const match of matches) {
        if (!isHairline(match[1])) hits.push(`${rel}:${index + 1}  ${match[0]}`);
      }
    });
}

// ─── Report ──────────────────────────────────────────────────────────────────
const byFile = new Map();
for (const hit of hits) {
  const file = hit.split(":")[0];
  byFile.set(file, (byFile.get(file) ?? 0) + 1);
}
for (const hit of hits) console.log(hit);
console.log(`\n${hits.length} raw px value(s) in ${byFile.size} file(s); allowed: ${MAX_HITS}.`);
process.exit(hits.length > MAX_HITS ? 1 : 0);
