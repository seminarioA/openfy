// Baja la voz del DJ a public/voz/ para desarrollar sin volver a descargarla
// en cada navegador: la app la toma de ahí antes que de internet. Comprueba
// el SHA-256 de cada archivo (los mismos de src/lib/voz-recursos.ts).
// Uso: npm run voz
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const fuente = await readFile(join(RAIZ, "src/lib/voz-recursos.ts"), "utf8");
const recursos = [...fuente.matchAll(/\{ nombre: "([^"]+)", ruta: "([^"]+)", bytes: ([\d_]+), sha256: "([0-9a-f]{64})", url: `([^`]+)` \}/g)].map((m) => ({
  nombre: m[1],
  ruta: m[2],
  bytes: Number(m[3].replaceAll("_", "")),
  sha256: m[4],
  url: m[5].replace("${INT8}", "https://huggingface.co/csukuangfj2/sherpa-onnx-supertonic-tts-int8-2026-03-06/resolve/main").replace("${ST}", "https://huggingface.co/Supertone/supertonic-2/resolve/main").replace("${JSD}", "https://cdn.jsdelivr.net/npm"),
}));
if (!recursos.length) throw new Error("No se encontraron los recursos en voz-recursos.ts.");
const sha = (b) => createHash("sha256").update(b).digest("hex");
for (const r of recursos) {
  const destino = join(RAIZ, "public/voz", r.ruta);
  if (existsSync(destino) && sha(await readFile(destino)) === r.sha256) {
    console.log(`ya está  ${r.ruta}`);
    continue;
  }
  const res = await fetch(r.url);
  if (!res.ok) throw new Error(`${r.url}: HTTP ${res.status}`);
  const datos = Buffer.from(await res.arrayBuffer());
  if (datos.length !== r.bytes || sha(datos) !== r.sha256) throw new Error(`${r.nombre}: no coincide con su SHA-256.`);
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, datos);
  console.log(`bajado   ${r.ruta} (${(r.bytes / 1e6).toFixed(1)} MB)`);
}
