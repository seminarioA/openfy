// Compone el icono de la app: la textura de papel y el símbolo «music-2» de
// Lucide (ISC), sin redibujar el trazado.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LADO = 512;
const svg = (await readFile(join(RAIZ, "node_modules/lucide-static/icons/music-2.svg"), "utf8"))
  .replace(/width="24"/, `width="300"`)
  .replace(/height="24"/, `height="300"`)
  .replace(/stroke="currentColor"/, `stroke="#4b2a80"`)
  .replace(/stroke-width="2"/, `stroke-width="1.6"`);

const textura = await sharp(join(RAIZ, "src/assets/papel.png")).resize(LADO, LADO).toBuffer();
await sharp({ create: { width: LADO, height: LADO, channels: 4, background: "#f3f0f7" } })
  .composite([
    { input: textura, blend: "multiply" },
    { input: Buffer.from(svg), gravity: "center" },
  ])
  .png()
  .toFile(join(RAIZ, "public/icono.png"));
console.log("public/icono.png");
