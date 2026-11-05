/**
 * Checks that every SYNCED file is identical in the merchant admin and the Super Admin console (PRD-014 FE-16).
 * A file is SYNCED when its first line carries the "SYNCED FILE" marker. Line endings are ignored (git
 * normalises them on checkout). Read-only. The same script lives in both repos.
 *
 * Usage: node scripts/check-synced-kit.mjs [--peer <path to the other app>]
 *   Without --peer it looks for ../Zcomm-frontend and ../zcommerce-super-admin (and the old names
 *   ../zcom-frontend, ../zcom-super-admin) and uses whichever is not this repo.
 *   Exits 1 when a SYNCED file differs from (or is missing in) the peer, or when no peer is found.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────
const MARKER = "SYNCED FILE (zcom-ui-consistency)";
const SRC = "src";
const EXT = /\.(tsx?|jsx?|mjs|css)$/;
const CANDIDATES = ["../Zcomm-frontend", "../zcommerce-super-admin", "../zcom-frontend", "../zcom-super-admin"];

const peerFlag = process.argv.indexOf("--peer");
const self = resolve(".");
const peerRoot =
  peerFlag > -1
    ? resolve(process.argv[peerFlag + 1])
    : CANDIDATES.map((p) => resolve(p)).find((p) => p !== self && existsSync(join(p, SRC)) && basename(p) !== basename(self));

if (!peerRoot || !existsSync(join(peerRoot, SRC))) {
  console.log("check-synced-kit: the other app was not found next to this repo; pass --peer <path>.");
  process.exit(1);
}

// ─── Walk ────────────────────────────────────────────────────────────────────
const normalise = (text) => text.replace(/\r\n/g, "\n");
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXT.test(name)) yield full;
  }
}

const differing = [];
let checked = 0;
for (const file of walk(SRC)) {
  const own = normalise(readFileSync(file, "utf8"));
  if (!own.split("\n", 1)[0].includes(MARKER)) continue;
  checked += 1;
  const rel = relative(".", file);
  const peerFile = join(peerRoot, rel);
  if (!existsSync(peerFile)) differing.push(`${rel} (missing in peer)`);
  else if (normalise(readFileSync(peerFile, "utf8")) !== own) differing.push(rel);
}

for (const name of differing) console.log(`differs  ${name}`);
console.log(`\n${checked} SYNCED file(s) checked against ${relative(".", peerRoot) || peerRoot}, ${differing.length} differ.`);
process.exit(differing.length > 0 ? 1 : 0);
