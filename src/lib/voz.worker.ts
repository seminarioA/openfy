/// <reference lib="webworker" />
// Síntesis de voz en un hilo aparte, para que la interfaz no se trabe, con
// Supertonic 2 (lib/supertonic.ts). Los archivos llegan comprobados
// (lib/voz-recursos.ts).
//
// Supertonic no admite cambiar de idioma dentro de una misma entrada (con
// varias etiquetas casi todo sale en silencio), así que cada trozo se
// sintetiza en su idioma con la misma voz y se empalman: sin el silencio de
// sus bordes y con una pausa corta entre ellos.
import { obtenerRecurso, RECURSOS, type ClaveRecurso } from "./voz-recursos";
import { leerEstilo, Supertonic, type ConfigSupertonic, type Estilo, type Ort, type Trozo } from "./supertonic";
import { empalmar, recortarBordes } from "./audio-voz";

declare const self: DedicatedWorkerGlobalScope;

/** Cómo suena. */
export interface AjustesVoz {
  /** Más de 1 habla más rápido. */
  velocidad: number;
  /** Pasos de la síntesis: más es mejor y más lento. */
  pasos: number;
  /** Pausa entre trozos (ms). */
  pausa: number;
}

export type MensajeVoz = { tipo: "preparar"; base: string } | { tipo: "hablar"; id: number; trozos: Trozo[]; ajustes?: Partial<AjustesVoz> };

export type RespuestaVoz =
  | { tipo: "progreso"; fraccion: number }
  | { tipo: "lista" }
  | { tipo: "audio"; id: number; pcm: Float32Array; muestreo: number }
  | { tipo: "error"; id?: number; mensaje: string };

let listo: Promise<{ tts: Supertonic; estilo: Estilo }> | null = null;

const urlDe = (datos: ArrayBuffer, tipo: string) => URL.createObjectURL(new Blob([datos], { type: tipo }));
const json = <T,>(datos: ArrayBuffer) => JSON.parse(new TextDecoder().decode(datos)) as T;

function preparar(base: string) {
  listo ??= (async () => {
    const total = Object.values(RECURSOS).reduce((s, r) => s + r.bytes, 0);
    const avance = new Map<ClaveRecurso, number>();
    const traer = (clave: ClaveRecurso) =>
      obtenerRecurso(clave, base, (bytes) => {
        avance.set(clave, bytes);
        self.postMessage({ tipo: "progreso", fraccion: [...avance.values()].reduce((s, b) => s + b, 0) / total } satisfies RespuestaVoz);
      });
    // De uno en uno: en datos móviles, varias descargas a la vez no van más rápido y fallan más.
    const ort = (await import(/* @vite-ignore */ urlDe(await traer("ortJs"), "text/javascript"))) as Ort;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = { "ort-wasm-simd.wasm": urlDe(await traer("ortWasm"), "application/wasm") };
    const sesion = async (clave: ClaveRecurso) => ort.InferenceSession.create(await traer(clave), { executionProviders: ["wasm"] });
    const cfg = json<ConfigSupertonic>(await traer("config"));
    const indice = json<number[]>(await traer("indice"));
    const estilo = leerEstilo(ort, json(await traer("voz")));
    const tts = new Supertonic(ort, cfg, indice, await sesion("duracion"), await sesion("codificador"), await sesion("estimador"), await sesion("vocoder"));
    return { tts, estilo };
  })();
  listo.catch(() => (listo = null));
  return listo;
}

async function hablar(trozos: Trozo[], ajustes: Partial<AjustesVoz> = {}) {
  const { tts, estilo } = await listo!;
  const partes: Float32Array[] = [];
  for (const t of trozos) {
    if (!t.texto.trim()) continue;
    const { pcm } = await tts.sintetizar([t], estilo, { pasos: ajustes.pasos ?? 5, velocidad: ajustes.velocidad ?? 1.05 });
    partes.push(recortarBordes(pcm, tts.muestreo));
  }
  return { pcm: empalmar(partes, tts.muestreo, (ajustes.pausa ?? 120) / 1000), muestreo: tts.muestreo };
}

// Una síntesis tras otra: las sesiones de ONNX no admiten dos a la vez.
let turno: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<MensajeVoz>) => {
  turno = turno.then(() => atender(e.data));
};

async function atender(m: MensajeVoz) {
  try {
    if (m.tipo === "preparar") {
      await preparar(m.base);
      self.postMessage({ tipo: "lista" } satisfies RespuestaVoz);
    } else {
      if (!listo) throw new Error("La voz aún no está lista.");
      const { pcm, muestreo } = await hablar(m.trozos, m.ajustes);
      self.postMessage({ tipo: "audio", id: m.id, pcm, muestreo } satisfies RespuestaVoz, [pcm.buffer]);
    }
  } catch (error) {
    self.postMessage({ tipo: "error", id: m.tipo === "hablar" ? m.id : undefined, mensaje: error instanceof Error ? error.message : String(error) } satisfies RespuestaVoz);
  }
}
