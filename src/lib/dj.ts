// El DJ, como el de Spotify: pone tandas de tu música (lib/dj-guion.ts) y,
// al empezar cada tanda, habla por encima del comienzo de la primera canción
// con la música más baja. La frase de la siguiente tanda se sintetiza
// mientras suena la actual, para que no haya esperas. Si pones otra cosa, se
// retira. Sin voz (no se pudo preparar o no la quisiste bajar), sigue igual
// y sus frases salen escritas sobre el reproductor.
import { useSyncExternalStore } from "react";
import type { Item } from "./db";
import { armarSesion, textoDe, trozosDe, type Escucha, type Tanda } from "./dj-guion";
import { atenuar, estadoReproductor, extenderCola, reproducir, suscribirReproductor } from "./reproductor";
import { decir, sintetizar } from "./voz";
import type { AjustesVoz } from "./voz.worker";

/** La voz del DJ (F4 de Supertonic): pausada y con poco hueco entre lo dicho en español y en inglés. */
export const VOZ_DJ: Partial<AjustesVoz> = { velocidad: 1, pasos: 5, pausa: 110 };
/** Cuánto baja la música mientras habla (fracción de tu volumen). */
const MUSICA_AL_HABLAR = 0.22;

export interface EstadoDJ {
  activo: boolean;
  /** Lo que está diciendo ahora (también se muestra escrito). */
  frase: string | null;
  conVoz: boolean;
}

let estado: EstadoDJ = { activo: false, frase: null, conVoz: true };
const oyentes = new Set<() => void>();
function fijar(parcial: Partial<EstadoDJ>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((f) => f());
}

export function useDJ() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => estado,
  );
}

/** Lo que el DJ necesita de tu biblioteca para armar una sesión. */
export interface FuenteDJ {
  pistas: Item[];
  escuchas: Map<string, Escucha>;
  aliasDe: (nombre: string) => string[];
}

interface Sesion {
  fuente: FuenteDJ;
  /** Frase por id de la canción con que empieza cada tanda. */
  frases: Map<string, string>;
  /** Audio ya sintetizado de cada frase (o la promesa de tenerlo). */
  audios: Map<string, Promise<{ pcm: Float32Array; muestreo: number } | null>>;
  /** La cola que puso el DJ: si cambia por otra, el DJ se retira. */
  cola: Item[];
  ultimaTanda: string;
  hablando: { parar: () => void } | null;
  quitar: () => void;
}

let sesion: Sesion | null = null;

function audioDe(s: Sesion, id: string) {
  if (!s.audios.has(id)) {
    const frase = s.frases.get(id);
    s.audios.set(id, frase && estado.conVoz ? sintetizar(trozosDe(frase), VOZ_DJ).catch(() => null) : Promise.resolve(null));
  }
  return s.audios.get(id)!;
}

function registrarTandas(s: Sesion, tandas: Tanda[]) {
  for (const t of tandas) s.frases.set(t.pistas[0].id, t.guion);
  s.ultimaTanda = tandas.at(-1)?.pistas[0].id ?? s.ultimaTanda;
}

function nuevasTandas(s: Sesion) {
  const ya = new Set(s.cola.map((p) => p.id));
  // Sin repetir lo ya puesto en esta sesión mientras quede música sin poner.
  const restantes = s.fuente.pistas.filter((p) => !ya.has(p.id));
  const tandas = armarSesion({ ...s.fuente, pistas: restantes.length >= 6 ? restantes : s.fuente.pistas, ahora: Date.now(), hora: new Date().getHours() }, 4).filter((t) => t.tipo !== "inicio");
  return tandas.length ? tandas : armarSesion({ ...s.fuente, ahora: Date.now(), hora: new Date().getHours() }, 4).slice(1);
}

async function hablarSobre(s: Sesion, id: string) {
  const guion = s.frases.get(id);
  if (!guion) return;
  const frase = textoDe(guion);
  fijar({ frase });
  const audio = await audioDe(s, id);
  if (sesion !== s || estadoReproductor().actual?.id !== id) return;
  if (!audio) {
    // Sin voz: la frase se lee unos segundos sobre el reproductor.
    setTimeout(() => sesion === s && estado.frase === frase && fijar({ frase: null }), 6000);
    return;
  }
  atenuar(MUSICA_AL_HABLAR, 350);
  const voz = decir(audio, estadoReproductor().silencio ? 0 : Math.max(0.35, estadoReproductor().volumen));
  s.hablando = voz;
  await voz.termino;
  if (s.hablando === voz) s.hablando = null;
  atenuar(1, 900);
  if (sesion === s && estado.frase === frase) fijar({ frase: null });
}

function alCambiar(s: Sesion) {
  let anterior: string | null = estadoReproductor().actual?.id ?? null;
  return () => {
    const r = estadoReproductor();
    // Pusiste otra cosa (otro álbum, otra playlist): el DJ se retira.
    if (r.cola !== s.cola && !(r.cola.length > s.cola.length && r.cola[0]?.id === s.cola[0]?.id)) return detenerDJ("otra cola");
    s.cola = r.cola;
    const id = r.actual?.id ?? null;
    if (id === anterior) return;
    anterior = id;
    s.hablando?.parar();
    atenuar(1, 300);
    if (!id) return;
    if (s.frases.has(id)) void hablarSobre(s, id);
    // La frase de la próxima tanda, ya sintetizada para cuando llegue.
    const resto = r.cola.slice(r.indice + 1);
    const proxima = resto.find((p) => s.frases.has(p.id));
    if (proxima) void audioDe(s, proxima.id);
    // Empieza la última tanda: se añaden más, para que la música no se corte.
    if (id === s.ultimaTanda) {
      const mas = nuevasTandas(s);
      registrarTandas(s, mas);
      const items = mas.flatMap((t) => t.pistas);
      extenderCola(items);
      s.cola = estadoReproductor().cola;
    }
  };
}

/** Empieza el DJ con tu música. Con `conVoz`, habla (la voz debe poder prepararse). */
export async function iniciarDJ(fuente: FuenteDJ, { conVoz = true } = {}) {
  detenerDJ("otra sesión");
  if (!fuente.pistas.length) throw new Error("Añade música para que el DJ tenga qué poner.");
  const tandas = armarSesion({ ...fuente, ahora: Date.now(), hora: new Date().getHours() });
  const cola = tandas.flatMap((t) => t.pistas);
  const s: Sesion = { fuente, frases: new Map(), audios: new Map(), cola, ultimaTanda: "", hablando: null, quitar: () => {} };
  registrarTandas(s, tandas);
  sesion = s;
  fijar({ activo: true, frase: null, conVoz });
  // La primera frase, lista antes de empezar: así el saludo suena con la primera canción.
  await audioDe(s, cola[0].id);
  if (sesion !== s) return;
  try {
    await reproducir(cola[0], cola, 0);
  } catch (e) {
    detenerDJ("no se pudo poner la primera");
    throw e;
  }
  s.cola = estadoReproductor().cola;
  s.quitar = suscribirReproductor(alCambiar(s));
  void hablarSobre(s, cola[0].id);
  const segunda = tandas[1]?.pistas[0];
  if (segunda) void audioDe(s, segunda.id);
}

export function detenerDJ(motivo = "parado") {
  if (!sesion) return;
  if (import.meta.env.DEV) console.debug(`[dj] se retira: ${motivo}`);
  const s = sesion;
  sesion = null;
  s.quitar();
  s.hablando?.parar();
  atenuar(1, 300);
  fijar({ activo: false, frase: null });
}
