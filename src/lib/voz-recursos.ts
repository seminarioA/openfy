// Lo que hace falta para la voz del DJ (lib/voz.ts): Supertonic 2 de
// Supertone (OpenRAIL), multilingüe, en la versión int8 del mantenedor de
// sherpa-onnx; su configuración y la voz F4, oficiales; y el motor de ONNX
// Runtime Web (MIT). ~105 MB que se bajan una sola vez y se guardan en el
// almacenamiento privado del navegador (OPFS).
//
// Cada archivo se busca, por orden: guardado de antes; en el mismo origen que
// la app (`./voz/…`, para desarrollar sin volver a bajarlo); y en su origen
// público. Venga de donde venga, se comprueba su SHA-256 antes de usarlo o
// guardarlo: un CDN alterado no puede colar código. Funciona igual en el hilo
// principal y en un worker.

export interface Recurso {
  nombre: string;
  /** Dónde está en el mismo origen, bajo `voz/`. */
  ruta: string;
  bytes: number;
  sha256: string;
  /** Origen público, con la versión fijada o comprobada por el hash. */
  url: string;
}

const INT8 = "https://huggingface.co/csukuangfj2/sherpa-onnx-supertonic-tts-int8-2026-03-06/resolve/main";
const ST = "https://huggingface.co/Supertone/supertonic-2/resolve/main";
const JSD = "https://cdn.jsdelivr.net/npm";

export const RECURSOS = {
  config: { nombre: "tts.json", ruta: "supertonic/tts.json", bytes: 8699, sha256: "ee531d9af9b80438a2ed703e22155ee6c83b12595ab22fd3bb6de94c7502fe96", url: `${ST}/onnx/tts.json` },
  indice: { nombre: "unicode_indexer.json", ruta: "supertonic/unicode_indexer.json", bytes: 262_196, sha256: "b7662a73a0703f43b97c0f2e089f8e8325e26f5d841aca393b5a54c509c92df1", url: `${ST}/onnx/unicode_indexer.json` },
  voz: { nombre: "F4.json", ruta: "supertonic/F4.json", bytes: 419_642, sha256: "e056fc2bee393edc8bff761eb28f33fb461e8dad828c3b05348a010ac1b7bb79", url: `${ST}/voice_styles/F4.json` },
  duracion: { nombre: "duration_predictor.int8.onnx", ruta: "supertonic/duration_predictor.int8.onnx", bytes: 1_521_526, sha256: "6d556b3691165c364be91dc0bd894656b5949f5acd2750d8ec2f954010845011", url: `${INT8}/duration_predictor.int8.onnx` },
  codificador: { nombre: "text_encoder.int8.onnx", ruta: "supertonic/text_encoder.int8.onnx", bytes: 27_431_318, sha256: "dd5f535ed629f7df86071043e15f541ce1b2ab7f1bdbce4c7892b307bca79fa3", url: `${INT8}/text_encoder.int8.onnx` },
  estimador: { nombre: "vector_estimator.int8.onnx", ruta: "supertonic/vector_estimator.int8.onnx", bytes: 40_686_657, sha256: "9cce89801068dc998719fbc91777f99f3f4d16ee36592281f8703f32e305daa2", url: `${INT8}/vector_estimator.int8.onnx` },
  vocoder: { nombre: "vocoder.int8.onnx", ruta: "supertonic/vocoder.int8.onnx", bytes: 25_977_132, sha256: "db99c36fb871fbfb128b903662995f2e22213e875f2434f319f8d10ee0f10e90", url: `${INT8}/vocoder.int8.onnx` },
  ortJs: { nombre: "ort.wasm.min.mjs", ruta: "ort.wasm.min.mjs", bytes: 142_864, sha256: "d02079ae1c4143f3a555a1dff86ba523b92022d8fe519263a34cf88675738753", url: `${JSD}/onnxruntime-web@1.18.0/dist/esm/ort.wasm.min.js` },
  ortWasm: { nombre: "ort-wasm-simd.wasm", ruta: "ort-wasm-simd.wasm", bytes: 10_595_041, sha256: "f533b5f21790563d7556c611c3835ac65848ee326da2689aac54ed7d9cc8c6a4", url: `${JSD}/onnxruntime-web@1.18.0/dist/ort-wasm-simd.wasm` },
} satisfies Record<string, Recurso>;

export type ClaveRecurso = keyof typeof RECURSOS;
export const BYTES_VOZ = Object.values(RECURSOS).reduce((s, r) => s + r.bytes, 0);

/** SHA-256 en hexadecimal. */
export async function sha256(datos: ArrayBuffer) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", datos));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Carpeta propia de esta voz: la de Piper (openfy-voz) queda aparte y no se toca.
const CARPETA = "openfy-voz-supertonic";

async function carpeta(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await navigator.storage.getDirectory()).getDirectoryHandle(CARPETA, { create: true });
  } catch {
    return null;
  }
}

async function guardado(r: Recurso): Promise<ArrayBuffer | null> {
  try {
    const archivo = await (await (await carpeta())?.getFileHandle(r.nombre))?.getFile();
    // Solo se guarda lo ya comprobado; el tamaño basta para descartar uno a medias.
    return archivo && archivo.size === r.bytes ? await archivo.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function guardar(r: Recurso, datos: ArrayBuffer) {
  try {
    const dir = await carpeta();
    if (!dir) return;
    const h = await dir.getFileHandle(r.nombre, { create: true });
    // createWritable no existe en los workers de Safari: allí se usa el acceso síncrono.
    if ("createWritable" in h) {
      const w = await h.createWritable();
      await w.write(datos);
      await w.close();
    }
  } catch {
    /* sin espacio o sin OPFS: se volverá a bajar la próxima vez */
  }
}

/** Baja `url` con avance; `null` si no está (404) o no se puede. */
async function bajar(url: string, alAvanzar: (bytes: number) => void): Promise<ArrayBuffer | null> {
  let r: Response;
  try {
    r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  } catch {
    return null;
  }
  if (!r.ok || !r.body) return null;
  // Un servidor de desarrollo sin el archivo responde con el index.html de la app.
  if (/text\/html/.test(r.headers.get("content-type") ?? "")) return null;
  const lector = r.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    total += value.byteLength;
    alAvanzar(total);
  }
  const datos = new Uint8Array(total);
  let p = 0;
  for (const t of trozos) {
    datos.set(t, p);
    p += t.byteLength;
  }
  return datos.buffer;
}

/**
 * Un recurso comprobado: de lo guardado, del mismo origen o de su origen
 * público. `alAvanzar` recibe los bytes bajados de este recurso.
 */
export async function obtenerRecurso(clave: ClaveRecurso, base: string, alAvanzar: (bytes: number) => void = () => {}): Promise<ArrayBuffer> {
  const r: Recurso = RECURSOS[clave];
  const previo = await guardado(r);
  if (previo) {
    alAvanzar(r.bytes);
    return previo;
  }
  for (const url of [new URL(`voz/${r.ruta}`, base).href, r.url]) {
    const datos = await bajar(url, alAvanzar);
    if (!datos) continue;
    if (datos.byteLength !== r.bytes || (await sha256(datos)) !== r.sha256) {
      // No es el archivo esperado: no se usa ni se guarda, y se prueba el siguiente origen.
      continue;
    }
    await guardar(r, datos);
    return datos;
  }
  throw new Error(`No se pudo obtener ${r.nombre}.`);
}

/** Si la voz ya está guardada entera en este navegador (para no anunciar una descarga que no hará falta). */
export async function vozGuardada() {
  const dir = await carpeta();
  if (!dir) return false;
  for (const r of Object.values(RECURSOS)) {
    try {
      if ((await (await dir.getFileHandle(r.nombre)).getFile()).size !== r.bytes) return false;
    } catch {
      return false;
    }
  }
  return true;
}
