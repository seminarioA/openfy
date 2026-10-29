// Supertonic 2 (Supertone, 2026): síntesis de voz multilingüe que lee el texto
// tal cual (sin fonemizador): con una misma voz se dice «Arrancamos con» en
// español y «Stay With Me» en inglés, cada trozo con su idioma.
// Adaptado del código web oficial (github.com/supertone-inc/supertonic,
// web/helper.js, MIT) a arreglos tipados; los pesos los carga lib/voz.worker.ts.

/** Lo que se usa de ONNX Runtime Web (se carga aparte, ya comprobado). */
export interface Ort {
  env: { wasm: { numThreads: number; wasmPaths: Record<string, string> | string; proxy: boolean } };
  Tensor: new (tipo: string, datos: BigInt64Array | Float32Array, forma: number[]) => Tensor;
  InferenceSession: { create(modelo: ArrayBuffer, opciones?: object): Promise<Sesion> };
}
export interface Tensor {
  data: Float32Array;
  dims: readonly number[];
}
export interface Sesion {
  run(entradas: Record<string, Tensor>): Promise<Record<string, Tensor>>;
}

export type Idioma = "es" | "en" | "pt" | "fr" | "ko";
export interface Trozo {
  texto: string;
  idioma: Idioma;
}

export interface ConfigSupertonic {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { chunk_compress_factor: number; latent_dim: number };
}

/** Una voz: sus dos vectores de estilo (de un JSON de voice_styles). */
export interface Estilo {
  ttl: Tensor;
  dp: Tensor;
}

interface EstiloJson {
  style_ttl: { dims: number[]; data: unknown };
  style_dp: { dims: number[]; data: unknown };
}

export function leerEstilo(ort: Ort, json: EstiloJson): Estilo {
  const plano = (d: unknown) => Float32Array.from((d as number[]).flat(Infinity as 1) as number[]);
  return {
    ttl: new ort.Tensor("float32", plano(json.style_ttl.data), json.style_ttl.dims),
    dp: new ort.Tensor("float32", plano(json.style_dp.data), json.style_dp.dims),
  };
}

const EMOJIS = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;
const CAMBIOS: [string, string][] = [
  ["–", "-"], ["‑", "-"], ["—", "-"], ["_", " "], ["“", '"'], ["”", '"'], ["‘", "'"], ["’", "'"],
  ["´", "'"], ["`", "'"], ["[", " "], ["]", " "], ["|", " "], ["/", " "], ["#", " "], ["→", " "], ["←", " "], ["«", '"'], ["»", '"'],
];

/** La limpieza del texto del código oficial (sin la etiqueta de idioma, que se pone por trozo). */
export function limpiar(texto: string) {
  let t = texto.normalize("NFKD").replace(EMOJIS, "");
  for (const [a, b] of CAMBIOS) t = t.replaceAll(a, b);
  t = t.replace(/[♥☆♡©\\]/g, "");
  t = t.replace(/ ([,.!?;:'])/g, "$1");
  t = t.replace(/"{2,}/g, '"').replace(/'{2,}/g, "'");
  return t.replace(/\s+/g, " ").trim();
}

/**
 * El texto con su etiqueta de idioma, como lo espera el modelo: «<es>…</es>».
 * Con varios idiomas en una misma entrada el modelo casi no habla: se
 * sintetiza un trozo cada vez (ver lib/voz.worker.ts).
 */
export function etiquetar(trozos: Trozo[]) {
  const limpios = trozos.map((t) => ({ ...t, texto: limpiar(t.texto) })).filter((t) => t.texto);
  const ultimo = limpios.at(-1);
  if (ultimo && !/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(ultimo.texto)) ultimo.texto += ".";
  return limpios.map((t) => `<${t.idioma}>${t.texto}</${t.idioma}>`).join(" ");
}

/** Ruido gaussiano (Box-Muller) para el latente inicial. */
function gauss() {
  const u1 = Math.max(0.0001, Math.random());
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random());
}

export class Supertonic {
  constructor(
    private ort: Ort,
    private cfg: ConfigSupertonic,
    private indice: number[],
    private duracion: Sesion,
    private codificador: Sesion,
    private estimador: Sesion,
    private vocoder: Sesion,
  ) {}

  get muestreo() {
    return this.cfg.ae.sample_rate;
  }

  /** Audio (PCM mono) de los trozos con la voz `estilo`. `velocidad` >1 habla más rápido; `pasos` es la calidad (5 por defecto). */
  async sintetizar(trozos: Trozo[], estilo: Estilo, { pasos = 5, velocidad = 1.05 } = {}) {
    const { ort } = this;
    const texto = etiquetar(trozos);
    const ids = new BigInt64Array(texto.length);
    for (let i = 0; i < texto.length; i++) {
      const c = texto.codePointAt(i)!;
      ids[i] = BigInt(c < this.indice.length ? this.indice[c] : -1);
    }
    const textIds = new ort.Tensor("int64", ids, [1, ids.length]);
    const textMask = new ort.Tensor("float32", new Float32Array(ids.length).fill(1), [1, 1, ids.length]);

    const { duration } = await this.duracion.run({ text_ids: textIds, style_dp: estilo.dp, text_mask: textMask });
    const segundos = duration.data[0] / velocidad;
    const { text_emb } = await this.codificador.run({ text_ids: textIds, style_ttl: estilo.ttl, text_mask: textMask });

    const { base_chunk_size, sample_rate } = this.cfg.ae;
    const trozo = base_chunk_size * this.cfg.ttl.chunk_compress_factor;
    const largo = Math.floor((Math.floor(segundos * sample_rate) + trozo - 1) / trozo);
    const dim = this.cfg.ttl.latent_dim * this.cfg.ttl.chunk_compress_factor;
    let latente: Float32Array<ArrayBuffer> = new Float32Array(dim * largo);
    for (let i = 0; i < latente.length; i++) latente[i] = gauss();
    const latentMask = new ort.Tensor("float32", new Float32Array(largo).fill(1), [1, 1, largo]);
    const total = new ort.Tensor("float32", Float32Array.of(pasos), [1]);

    for (let paso = 0; paso < pasos; paso++) {
      const { denoised_latent } = await this.estimador.run({
        noisy_latent: new ort.Tensor("float32", latente, [1, dim, largo]),
        text_emb,
        style_ttl: estilo.ttl,
        latent_mask: latentMask,
        text_mask: textMask,
        current_step: new ort.Tensor("float32", Float32Array.of(paso), [1]),
        total_step: total,
      });
      latente = denoised_latent.data as Float32Array<ArrayBuffer>;
    }
    const { wav_tts } = await this.vocoder.run({ latent: new ort.Tensor("float32", latente, [1, dim, largo]) });
    // El vocoder rellena hasta el final del último bloque: se recorta a la duración prevista.
    return { pcm: wav_tts.data.slice(0, Math.floor(segundos * sample_rate)), muestreo: sample_rate };
  }
}
