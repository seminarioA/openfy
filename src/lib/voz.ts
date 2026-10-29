// La voz del DJ: síntesis local y multilingüe (Supertonic 2, en un worker:
// lib/voz.worker.ts), para que diga en español lo suyo y en inglés los
// títulos en inglés. La primera vez baja ~105 MB y los guarda; después
// funciona sin conexión. Si no se puede (sin WebAssembly, sin espacio…), el
// DJ sigue con sus textos en pantalla.
import { useSyncExternalStore } from "react";
import type { AjustesVoz, MensajeVoz, RespuestaVoz } from "./voz.worker";
import type { Trozo } from "./supertonic";

export type EstadoVoz = { estado: "apagada" } | { estado: "preparando"; fraccion: number } | { estado: "lista" } | { estado: "error"; mensaje: string };

let estado: EstadoVoz = { estado: "apagada" };
const oyentes = new Set<() => void>();
function fijar(e: EstadoVoz) {
  estado = e;
  oyentes.forEach((f) => f());
}

export function useVoz() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => estado,
  );
}

let worker: Worker | null = null;
let preparada: Promise<void> | null = null;
let siguienteId = 0;
const pendientes = new Map<number, { ok: (a: { pcm: Float32Array; muestreo: number }) => void; mal: (e: Error) => void }>();

function hilo() {
  if (worker) return worker;
  worker = new Worker(new URL("./voz.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<RespuestaVoz>) => {
    const r = e.data;
    if (r.tipo === "progreso") fijar({ estado: "preparando", fraccion: r.fraccion });
    else if (r.tipo === "audio") {
      pendientes.get(r.id)?.ok({ pcm: r.pcm, muestreo: r.muestreo });
      pendientes.delete(r.id);
    } else if (r.tipo === "error" && r.id !== undefined) {
      pendientes.get(r.id)?.mal(new Error(r.mensaje));
      pendientes.delete(r.id);
    }
  };
  return worker;
}

/** Deja la voz lista (la baja la primera vez). */
export function prepararVoz(): Promise<void> {
  preparada ??= new Promise<void>((ok, mal) => {
    const w = hilo();
    const escuchar = (e: MessageEvent<RespuestaVoz>) => {
      if (e.data.tipo === "lista") {
        w.removeEventListener("message", escuchar);
        fijar({ estado: "lista" });
        ok();
      } else if (e.data.tipo === "error" && e.data.id === undefined) {
        w.removeEventListener("message", escuchar);
        fijar({ estado: "error", mensaje: e.data.mensaje });
        preparada = null;
        mal(new Error(e.data.mensaje));
      }
    };
    w.addEventListener("message", escuchar);
    if (estado.estado !== "lista") fijar({ estado: "preparando", fraccion: 0 });
    w.postMessage({ tipo: "preparar", base: document.baseURI } satisfies MensajeVoz);
  });
  return preparada;
}

/** El audio de los trozos, cada uno en su idioma (PCM mono y su frecuencia de muestreo). */
export async function sintetizar(trozos: Trozo[], ajustes?: Partial<AjustesVoz>) {
  await prepararVoz();
  const id = ++siguienteId;
  return new Promise<{ pcm: Float32Array; muestreo: number }>((ok, mal) => {
    pendientes.set(id, { ok, mal });
    hilo().postMessage({ tipo: "hablar", id, trozos, ajustes } satisfies MensajeVoz);
  });
}

let contexto: AudioContext | null = null;

/** Hace sonar un audio sintetizado a `volumen` (0-1). Se resuelve al terminar; `parar` lo corta. */
export function decir(audio: { pcm: Float32Array; muestreo: number }, volumen = 1) {
  contexto ??= new AudioContext();
  if (contexto.state === "suspended") void contexto.resume();
  const buffer = contexto.createBuffer(1, audio.pcm.length, audio.muestreo);
  buffer.copyToChannel(audio.pcm as Float32Array<ArrayBuffer>, 0);
  const fuente = contexto.createBufferSource();
  fuente.buffer = buffer;
  const ganancia = contexto.createGain();
  ganancia.gain.value = volumen;
  fuente.connect(ganancia).connect(contexto.destination);
  const termino = new Promise<void>((ok) => (fuente.onended = () => ok()));
  fuente.start();
  return { duracion: buffer.duration, termino, parar: () => fuente.stop() };
}
