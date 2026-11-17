// Dipakai di Dockerfile (tahap builder).
// Menyalin paket beserta SELURUH dependensi runtime-nya (berdasarkan package-lock.json)
// ke folder tujuan, untuk melengkapi hasil tracing Next.js standalone.
// Contoh: exceljs (serverExternalPackages) memuat file seperti
// generator-function/require.mjs secara dinamis yang tidak ikut ter-trace.
//
// Pemakaian: node scripts/copy-runtime-deps.mjs <tujuan> <paket...>
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [dest, ...roots] = process.argv.slice(2);
if (!dest || roots.length === 0) {
  console.error("Pemakaian: node scripts/copy-runtime-deps.mjs <tujuan> <paket...>");
  process.exit(1);
}

const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages;

/** Resolusi ala Node: cari node_modules/<name> dari folder `from` naik ke atas. */
function resolve(name, from) {
  let base = from;
  for (;;) {
    const p = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    if (lock[p]) return p;
    if (!base) return null;
    const i = base.lastIndexOf("/node_modules/");
    base = i < 0 ? "" : base.slice(0, i);
  }
}

const seen = new Set();
function walk(path) {
  if (seen.has(path)) return;
  seen.add(path);
  const meta = lock[path];
  const deps = { ...(meta.dependencies || {}), ...(meta.optionalDependencies || {}) };
  for (const name of Object.keys(deps)) {
    const r = resolve(name, path);
    if (r) walk(r);
  }
}

for (const name of roots) {
  const p = resolve(name, "");
  if (!p) throw new Error(`Paket ${name} tidak ada di package-lock.json`);
  walk(p);
}

let copied = 0;
for (const p of seen) {
  if (!existsSync(p)) continue; // optional dependency untuk platform lain
  const target = join(dest, p);
  mkdirSync(join(target, ".."), { recursive: true });
  cpSync(p, target, { recursive: true, dereference: true });
  copied++;
}
console.log(`copy-runtime-deps: ${copied} paket disalin ke ${dest} (${roots.join(", ")})`);
