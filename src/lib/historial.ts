// Historial de lo que escuchas, como el de Spotify: qué y cuándo. Se recuerda
// en este navegador y se puede pausar o borrar.
import { useSyncExternalStore } from "react";

export interface Visto {
  id: string;
  /** Última vez que se escuchó (ms). */
  visto: number;
  /** Cuántas veces se escuchó. */
  veces?: number;
}

const CLAVE = "openfy.historial";
const CLAVE_PAUSA = "openfy.historial-pausado";
const MAXIMO = 2000;
const oyentes = new Set<() => void>();

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v == null ? porDefecto : (JSON.parse(v) as T);
  } catch {
    return porDefecto;
  }
}

let estado = {
  lista: leer<Visto[]>(CLAVE, []).filter((x) => x && typeof x.id === "string"),
  pausado: leer<boolean>(CLAVE_PAUSA, false),
};

function cambiar(lista: Visto[], pausado = estado.pausado) {
  estado = { lista: lista.slice(0, MAXIMO), pausado };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado.lista));
    localStorage.setItem(CLAVE_PAUSA, JSON.stringify(pausado));
  } catch {
    /* sin almacenamiento: dura lo que la pestaña */
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

/** El historial y si está en pausa. */
export function useHistorial() {
  return useSyncExternalStore(suscribir, () => estado);
}

export function vistoDe(id: string) {
  return estado.lista.find((x) => x.id === id);
}

/** La sube al principio al escucharla. */
export function registrarEscucha(id: string) {
  if (estado.pausado) return;
  const previo = vistoDe(id);
  cambiar([{ id, visto: Date.now(), veces: (previo?.veces ?? (previo ? 1 : 0)) + 1 }, ...estado.lista.filter((x) => x.id !== id)]);
}

export function quitarDelHistorial(id: string) {
  cambiar(estado.lista.filter((x) => x.id !== id));
}

export function borrarHistorial() {
  cambiar([]);
}

export function pausarHistorial(pausado: boolean) {
  cambiar(estado.lista, pausado);
}
