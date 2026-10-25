/**
 * Checks that the SYNCED kit files are byte-identical with the merchant admin (PRD-014 FE-16).
 * A file is SYNCED when its first line carries the "SYNCED FILE" marker. Read-only.
 *
 * Usage: node scripts/check-synced-kit.mjs [--peer ../zcom-frontend]
 *   Exits 1 when a SYNCED file differs from (or is missing in) the peer repo; exits 0 with a
 *   notice when the peer repo isn't checked out next to this one.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ─── Config ──────────────────────────────────────────────────────────────────
const MARKER = "SYNCED FILE (zcom-ui-consistency)";
const KIT_DIR = join("src", "components", "ui");
const peerFlag = process.argv.indexOf("--peer");
const PEER_ROOT = resolve(peerFlag > -1 ? process.argv[peerFlag + 1] : "../zcom-frontend");

// ─── Check ───────────────────────────────────────────────────────────────────
const peerKit = join(PEER_ROOT, KIT_DIR);
if (!existsSync(peerKit)) {
  console.log(`check-synced-kit: ${peerKit} not found; skipped.`);
  process.exit(0);
}

const differing = [];
let checked = 0;
for (const name of readdirSync(KIT_DIR).sort()) {
  const own = readFileSync(join(KIT_DIR, name), "utf8");
  if (!own.split("\n", 1)[0].includes(MARKER)) continue;
  checked += 1;
  const peerFile = join(peerKit, name);
  if (!existsSync(peerFile)) differing.push(`${name} (missing in peer)`);
  else if (readFileSync(peerFile, "utf8") !== own) differing.push(name);
}

for (const name of differing) console.log(`differs  ${name}`);
console.log(`\n${checked} SYNCED file(s) checked, ${differing.length} differ.`);
process.exit(differing.length > 0 ? 1 : 0);
