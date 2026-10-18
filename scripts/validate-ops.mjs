// Validates every gql operation in src/graphql/*.ts against the backend
// platform-admin schema (federation directives stripped). Read-only.
// Usage: npm run validate:ops  (PLATFORM_SCHEMA overrides the schema path; root CLAUDE.md §5).
// Exits 1 when any operation is invalid.
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(
  path.resolve("package.json"),
);
const { buildASTSchema, parse, validate } = require("graphql");

const schemaFile = process.env.PLATFORM_SCHEMA ??
  path.resolve("../zcom-backend/services/platform-admin/src/graphql/schemas/index.ts");
const opsDir = path.resolve("src/graphql");

const schemaSrc = readFileSync(schemaFile, "utf8");
const sdl = schemaSrc
  .slice(schemaSrc.indexOf("gql`") + 4, schemaSrc.lastIndexOf("`"))
  .replace(/extend schema\s*@link\([^)]*\)\s*/s, "");
const schema = buildASTSchema(parse(sdl));

// Collect every exported gql`...` constant across files.
const consts = new Map();
for (const f of readdirSync(opsDir)) {
  const src = readFileSync(path.join(opsDir, f), "utf8");
  const re = /export const (\w+) = gql`([\s\S]*?)`;/g;
  let m;
  while ((m = re.exec(src))) consts.set(m[1], { file: f, body: m[2] });
}
function expand(name, seen = new Set()) {
  const c = consts.get(name);
  if (!c) throw new Error(`unknown const ${name}`);
  if (seen.has(name)) return "";
  seen.add(name);
  return c.body.replace(/\$\{(\w+)\}/g, (_, dep) => expand(dep, seen));
}
let failures = 0;
for (const [name, c] of consts) {
  const text = expand(name);
  let doc;
  try {
    doc = parse(text);
  } catch (e) {
    console.log(`PARSE ERROR ${c.file}:${name}: ${e.message}`);
    failures++;
    continue;
  }
  const isOp = doc.definitions.some((d) => d.kind === "OperationDefinition");
  if (!isOp) continue; // fragment-only consts are validated via their users
  const errors = validate(schema, doc);
  if (errors.length) {
    failures++;
    console.log(`INVALID ${c.file}:${name}`);
    for (const e of errors) console.log(`   - ${e.message}`);
  } else {
    console.log(`ok      ${c.file}:${name}`);
  }
}
console.log(`\n${failures} invalid operation(s)`);
// ─── Depth (the gateway's GraphQL Armor limit, fragments flattened) ────────
// The gateway rejects operations deeper than MAX_DEPTH levels. Depth is
// measured on the flattened query: a fragment spread is not a level, its
// fields are counted where they are spread.
const MAX_DEPTH = 10;

function depthOf(selectionSet, fragments, seen = new Set()) {
  if (!selectionSet) return 0;
  let deepest = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === "Field") {
      deepest = Math.max(deepest, 1 + depthOf(selection.selectionSet, fragments, seen));
    } else if (selection.kind === "InlineFragment") {
      deepest = Math.max(deepest, depthOf(selection.selectionSet, fragments, seen));
    } else if (selection.kind === "FragmentSpread") {
      const name = selection.name.value;
      if (seen.has(name)) continue;
      const fragment = fragments.get(name);
      if (fragment) deepest = Math.max(deepest, depthOf(fragment.selectionSet, fragments, new Set([...seen, name])));
    }
  }
  return deepest;
}

let depthFailures = 0;
for (const [name, c] of consts) {
  const doc = parse(expand(name));
  const fragments = new Map(doc.definitions.filter((d) => d.kind === "FragmentDefinition").map((d) => [d.name.value, d]));
  for (const op of doc.definitions.filter((d) => d.kind === "OperationDefinition")) {
    const depth = depthOf(op.selectionSet, fragments);
    if (depth > MAX_DEPTH) {
      depthFailures++;
      console.log(`TOO DEEP ${c.file}:${name}: depth ${depth} > ${MAX_DEPTH} (gateway GraphQL Armor)`);
    }
  }
}
console.log(`${depthFailures} operation(s) over the gateway depth limit`);
process.exitCode = failures > 0 || depthFailures > 0 ? 1 : 0;
