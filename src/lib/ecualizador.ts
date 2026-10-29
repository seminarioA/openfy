// Ecualizador de 10 bandas para el reproductor de música (Web Audio). El
// reproductor le pasa su <audio> con `engancharEcualizador`; el grafo solo se
// crea al activarlo (una vez conectado, el audio pasa siempre por él). Los
// ajustes se recuerdan en este navegador.
import { useSyncExternalStore } from "react";

export const BANDAS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const LIMITE_DB = 12;

/** Ganancia de cada banda en dB, de graves a agudos. */
export const PRESETS: Record<string, number[]> = {
  Plano: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Graves: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  Agudos: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  "Graves y agudos": [5, 4, 2, 0, -2, -2, 0, 2, 4, 5],
  Voz: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1],
  Pop: [-1, 0, 2, 3, 4, 3, 1, 0, -1, -1],
  Rock: [4, 3, 2, 0, -1, -1, 1, 2, 3, 4],
  Jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  Clásica: [0, 0, 0, 0, 0, 0, -2, -3, -3, -4],
  Electrónica: [5, 4, 1, 0, -2, 1, 0, 1, 4, 5],
};

export interface AjustesEcualizador {
  activo: boolean;
  /** Ganancia general en dB (para compensar subidas y no saturar). */
  preamp: number;
  ganancias: number[];
  /** Nombre del preset, o «Personalizado». */
  preset: string;
}

const CLAVE = "openfy.ecualizador";
const PORDEFECTO: AjustesEcualizador = { activo: false, preamp: 0, ganancias: [...PRESETS.Plano], preset: "Plano" };
const oyentes = new Set<() => void>();

function leer(): AjustesEcualizador {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (a && Array.isArray(a.ganancias) && a.ganancias.length === BANDAS.length) return { ...PORDEFECTO, ...a };
  } catch {
    /* sin almacenamiento */
  }
  return PORDEFECTO;
}

let ajustes = leer();

// ---------- grafo de audio ----------

let elemento: HTMLMediaElement | null = null;
let contexto: AudioContext | null = null;
let filtros: BiquadFilterNode[] = [];
let ganancia: GainNode | null = null;

const dbAGanancia = (db: number) => 10 ** (db / 20);

function crearGrafo() {
  if (contexto || !elemento) return;
  contexto = new AudioContext();
  const fuente = contexto.createMediaElementSource(elemento);
  ganancia = contexto.createGain();
  filtros = BANDAS.map((frecuencia, i) => {
    const f = contexto!.createBiquadFilter();
    f.type = i === 0 ? "lowshelf" : i === BANDAS.length - 1 ? "highshelf" : "peaking";
    f.frequency.value = frecuencia;
    f.Q.value = 1.1;
    return f;
  });
  [fuente, ganancia, ...filtros].reduce((a: AudioNode, b) => (a.connect(b), b));
  filtros.at(-1)!.connect(contexto.destination);
}

function aplicar() {
  if (ajustes.activo) crearGrafo();
  if (!contexto || !ganancia) return;
  const t = contexto.currentTime;
  ganancia.gain.setTargetAtTime(ajustes.activo ? dbAGanancia(ajustes.preamp) : 1, t, 0.02);
  filtros.forEach((f, i) => f.gain.setTargetAtTime(ajustes.activo ? ajustes.ganancias[i] : 0, t, 0.02));
}

function cambiar(parcial: Partial<AjustesEcualizador>) {
  ajustes = { ...ajustes, ...parcial };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ajustes));
  } catch {
    /* sin almacenamiento */
  }
  aplicar();
  oyentes.forEach((f) => f());
}

// ---------- API ----------

/** Lo llama el reproductor al crear su <audio>. */
export function engancharEcualizador(el: HTMLMediaElement) {
  elemento = el;
  aplicar();
}

/** Lo llama el reproductor antes de sonar: el navegador suspende el audio hasta un gesto. */
export function reanudarEcualizador() {
  if (contexto?.state === "suspended") void contexto.resume();
}

export function useEcualizador() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => ajustes,
  );
}

export function activarEcualizador(activo: boolean) {
  cambiar({ activo });
  reanudarEcualizador();
}

export function cambiarBanda(i: number, db: number) {
  const ganancias = ajustes.ganancias.map((g, j) => (j === i ? Math.max(-LIMITE_DB, Math.min(LIMITE_DB, db)) : g));
  cambiar({ ganancias, preset: "Personalizado" });
}

export function cambiarPreamp(db: number) {
  cambiar({ preamp: Math.max(-LIMITE_DB, Math.min(LIMITE_DB, db)) });
}

export function aplicarPreset(nombre: string) {
  const g = PRESETS[nombre];
  if (g) cambiar({ ganancias: [...g], preset: nombre });
}
