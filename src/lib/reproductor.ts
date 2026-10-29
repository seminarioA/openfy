// Un único <audio> para toda la app: sigue sonando al cambiar de vista, en
// segundo plano y con la pantalla bloqueada (Media Session).
//
// Lo que suena después sale de dos sitios, como en Spotify: primero tu fila
// (lo que agregas a mano) y luego la cola de contexto (el álbum o la lista desde
// la que pulsaste reproducir).
import { useSyncExternalStore } from "react";
import { db, type Item } from "./db";
import { urlDeArchivo } from "./almacen";
import { registrarEscucha } from "./historial";
import { engancharEcualizador, reanudarEcualizador } from "./ecualizador";

export interface EstadoReproductor {
  actual: Item | null;
  /** Cola de contexto (álbum, lista…). */
  cola: Item[];
  /** Posición en la cola de contexto de lo último que sonó de ella. */
  indice: number;
  /** Tu fila: suena antes de seguir con el contexto. */
  fila: Item[];
  sonando: boolean;
  tiempo: number;
  duracion: number;
  /** Baraja lo que queda del contexto. */
  aleatorio: boolean;
  repetir: "no" | "todo" | "una";
  volumen: number;
  silencio: boolean;
}

// Modos y volumen se recuerdan en este navegador.
const CLAVE_MODOS = "openfy.reproductor";
type Modos = Pick<EstadoReproductor, "aleatorio" | "repetir" | "volumen" | "silencio">;
function leerModos(): Modos {
  const porDefecto: Modos = { aleatorio: false, repetir: "no", volumen: 1, silencio: false };
  try {
    return { ...porDefecto, ...JSON.parse(localStorage.getItem(CLAVE_MODOS) ?? "{}") };
  } catch {
    return porDefecto;
  }
}

let estado: EstadoReproductor = { actual: null, cola: [], indice: -1, fila: [], sonando: false, tiempo: 0, duracion: 0, ...leerModos() };
/** El contexto en su orden original, para deshacer el aleatorio. */
let original: Item[] = [];
/** Factor (0-1) por el que se multiplica tu volumen mientras habla el DJ (ver `atenuar`); tu volumen no cambia. */
let atenuacion = 1;
const oyentes = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let ultimoGuardado = 0;

function emitir(parcial: Partial<EstadoReproductor>) {
  estado = { ...estado, ...parcial };
  oyentes.forEach((f) => f());
}

function guardarModos() {
  const { aleatorio, repetir, volumen, silencio } = estado;
  try {
    localStorage.setItem(CLAVE_MODOS, JSON.stringify({ aleatorio, repetir, volumen, silencio }));
  } catch {
    /* sin almacenamiento */
  }
}

function barajar<T>(lista: T[]) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function elemento() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("timeupdate", () => {
    emitir({ tiempo: audio!.currentTime });
    const ahora = Date.now();
    if (estado.actual && ahora - ultimoGuardado > 5000) {
      ultimoGuardado = ahora;
      const d = audio!.duration || estado.actual.duracion || 0;
      void db.items.update(estado.actual.id, { posicion: audio!.currentTime, avance: d ? audio!.currentTime / d : 0 });
    }
  });
  audio.addEventListener("durationchange", () => emitir({ duracion: audio!.duration || 0 }));
  audio.addEventListener("play", () => emitir({ sonando: true }));
  audio.addEventListener("pause", () => emitir({ sonando: false }));
  audio.addEventListener("ended", () => {
    if (estado.repetir === "una") {
      irA(0);
      void audio!.play();
    } else void siguiente();
  });
  audio.volume = estado.volumen * atenuacion;
  audio.muted = estado.silencio;
  engancharEcualizador(audio);
  return audio;
}

function sesionMultimedia(item: Item) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: item.titulo,
    artist: item.autores?.join(", ") ?? "",
    album: (item.extra as { musica?: { album?: string } } | undefined)?.musica?.album ?? "",
    artwork: item.portada ? [{ src: item.portada, sizes: "512x512" }] : [],
  });
  const acciones: [MediaSessionAction, () => void][] = [
    ["play", () => void elemento().play()],
    ["pause", () => elemento().pause()],
    ["nexttrack", () => void siguiente()],
    ["previoustrack", () => void anterior()],
    ["seekbackward", () => saltar(-10)],
    ["seekforward", () => saltar(30)],
  ];
  for (const [accion, fn] of acciones) {
    try {
      navigator.mediaSession.setActionHandler(accion, fn);
    } catch {
      /* acción no soportada */
    }
  }
}

/** Hace sonar una pista sin tocar la cola ni la fila. */
async function sonar(item: Item, desde?: number) {
  if (!item.archivo) throw new Error("Ese archivo no está guardado en este dispositivo.");
  const url = await urlDeArchivo(item.archivo, item.mime);
  if (!url) throw new Error("No se encontró el archivo en este dispositivo.");
  const el = elemento();
  el.src = url;
  const inicio = desde ?? (typeof item.posicion === "number" && (item.avance ?? 0) < 0.97 ? item.posicion : 0);
  el.currentTime = inicio;
  emitir({ actual: item, tiempo: inicio, duracion: item.duracion ?? 0 });
  sesionMultimedia(item);
  registrarEscucha(item.id);
  reanudarEcualizador();
  await db.items.update(item.id, { abierto: Date.now() });
  await el.play();
}

/** Reproduce `item` con `cola` como contexto (por defecto, la cola actual si lo contiene). */
export async function reproducir(item: Item, cola?: Item[], desde?: number) {
  if (!cola && estado.cola.some((x) => x.id === item.id)) {
    emitir({ indice: estado.cola.findIndex((x) => x.id === item.id) });
    return sonar(item, desde);
  }
  original = cola ?? [item];
  // Con aleatorio, lo pulsado suena primero y el resto va barajado.
  const contexto = estado.aleatorio ? [item, ...barajar(original.filter((x) => x.id !== item.id))] : original;
  emitir({ cola: contexto, indice: contexto.findIndex((x) => x.id === item.id) });
  await sonar(item, desde);
}

/** Activa o quita el aleatorio sobre lo que queda del contexto (lo ya escuchado no se toca). */
export function alternarAleatorio() {
  const aleatorio = !estado.aleatorio;
  if (aleatorio) {
    const hecho = estado.cola.slice(0, estado.indice + 1);
    emitir({ aleatorio, cola: [...hecho, ...barajar(estado.cola.slice(estado.indice + 1))] });
  } else {
    const i = original.findIndex((x) => x.id === estado.actual?.id);
    emitir({ aleatorio, cola: original.length ? original : estado.cola, indice: i >= 0 ? i : estado.indice });
  }
  guardarModos();
}

/** No repetir → repetir todo → repetir una. */
export function cambiarRepetir() {
  emitir({ repetir: estado.repetir === "no" ? "todo" : estado.repetir === "todo" ? "una" : "no" });
  guardarModos();
}

export function cambiarVolumen(volumen: number) {
  const v = Math.max(0, Math.min(1, volumen));
  elemento().volume = v * atenuacion;
  elemento().muted = v === 0;
  emitir({ volumen: v, silencio: v === 0 });
  guardarModos();
}

export function alternarSilencio() {
  const silencio = !estado.silencio;
  elemento().muted = silencio;
  // Al quitar el silencio con el volumen a cero, vuelve a un nivel audible.
  if (!silencio && estado.volumen === 0) cambiarVolumen(0.5);
  emitir({ silencio });
  guardarModos();
}

export function alternar() {
  const el = elemento();
  if (!estado.actual) return;
  if (el.paused) {
    reanudarEcualizador();
    void el.play();
  } else el.pause();
}

export function pausar() {
  audio?.pause();
}

export function saltar(segundos: number) {
  const el = elemento();
  el.currentTime = Math.max(0, Math.min((el.duration || 0) - 0.5, el.currentTime + segundos));
}

export function irA(segundo: number) {
  elemento().currentTime = segundo;
}

/** Lo siguiente: primero tu fila, luego la cola de contexto. Al final, se para. */
export async function siguiente() {
  const [primero, ...resto] = estado.fila;
  if (primero) {
    emitir({ fila: resto });
    await sonar(primero, 0);
    return;
  }
  const proximo = estado.cola[estado.indice + 1];
  if (proximo) {
    emitir({ indice: estado.indice + 1 });
    await sonar(proximo, 0);
  } else if (estado.repetir === "todo" && estado.cola.length) {
    emitir({ indice: 0 });
    await sonar(estado.cola[0], 0);
  }
}

/** Vuelve al principio si ya avanzó; si no, a la anterior del contexto. */
export async function anterior() {
  if (elemento().currentTime > 4) {
    irA(0);
    return;
  }
  // Si lo que suena vino de la fila, «anterior» es lo último del contexto.
  const enContexto = estado.cola[estado.indice]?.id === estado.actual?.id;
  const destino = enContexto ? estado.indice - 1 : estado.indice;
  const item = estado.cola[destino];
  if (item) {
    emitir({ indice: destino });
    await sonar(item, 0);
  }
}

/** Lo que va a sonar: tu fila y luego el resto del contexto. */
export function aContinuacion(e: EstadoReproductor = estado) {
  return { fila: e.fila, contexto: e.cola.slice(e.indice + 1) };
}

/** Al final de tu fila (una canción o varias, p. ej. un álbum). Si no suena nada, empieza a sonar. */
export async function agregarALaFila(items: Item | Item[]) {
  const lista = Array.isArray(items) ? items : [items];
  if (!lista.length) return;
  if (!estado.actual) return reproducir(lista[0], lista);
  emitir({ fila: [...estado.fila, ...lista] });
}

/** Justo después de lo que suena (una canción o varias). */
export async function reproducirDespues(items: Item | Item[]) {
  const lista = Array.isArray(items) ? items : [items];
  if (!lista.length) return;
  if (!estado.actual) return reproducir(lista[0], lista);
  emitir({ fila: [...lista, ...estado.fila] });
}

export function quitarDeLaFila(posicion: number) {
  emitir({ fila: estado.fila.filter((_, i) => i !== posicion) });
}

export function vaciarLaFila() {
  emitir({ fila: [] });
}

/** Salta a algo de lo que va a sonar (de tu fila o del contexto). */
export async function saltarA(origen: "fila" | "contexto", posicion: number) {
  if (origen === "fila") {
    const item = estado.fila[posicion];
    if (!item) return;
    emitir({ fila: estado.fila.slice(posicion + 1) });
    await sonar(item, 0);
  } else {
    const i = estado.indice + 1 + posicion;
    const item = estado.cola[i];
    if (!item) return;
    emitir({ indice: i });
    await sonar(item, 0);
  }
}

export function detener() {
  const el = elemento();
  el.pause();
  el.removeAttribute("src");
  emitir({ actual: null, sonando: false, tiempo: 0, duracion: 0 });
}

// ---------- para el DJ (lib/dj.ts) ----------

let rampa = 0;

/** Baja o sube la música hasta `factor` de tu volumen en `ms`, suave. */
export function atenuar(factor: number, ms = 400) {
  const el = elemento();
  const desde = atenuacion;
  const inicio = performance.now();
  cancelAnimationFrame(rampa);
  const paso = (t: number) => {
    const k = Math.min(1, (t - inicio) / ms);
    atenuacion = desde + (factor - desde) * k;
    el.volume = estado.volumen * atenuacion;
    if (k < 1) rampa = requestAnimationFrame(paso);
  };
  rampa = requestAnimationFrame(paso);
}

export function estadoReproductor() {
  return estado;
}

export function suscribirReproductor(f: () => void) {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

/** Añade pistas al final del contexto que suena (sin tocar lo que suena ni tu fila). */
export function extenderCola(items: Item[]) {
  original = [...original, ...items];
  emitir({ cola: [...estado.cola, ...items] });
}

export function useReproductor() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => estado,
  );
}
