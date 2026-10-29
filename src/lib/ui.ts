import { useEffect, useState, useSyncExternalStore } from "react";
import type { Item } from "./db";

// La app es una sola vista: Música. Se conserva el nombre en los enlaces
// (#musica?album=…) para que «atrás» del navegador funcione igual.
export type Vista = "musica";

// Navegación con parámetros en el hash (#musica?album=…):
// cada paso entra en el historial del navegador, así «atrás» funciona.
export function leerParametros() {
  return new URLSearchParams(location.hash.split("?")[1] ?? "");
}

export function useParametros() {
  const [parametros, setParametros] = useState(leerParametros);
  useEffect(() => {
    const f = () => setParametros(leerParametros());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return parametros;
}

/** El hash de un lugar dentro de una vista, para enlaces (<a href>) y para irDentro. */
export function enlaceDentro(vista: Vista, parametros: Record<string, string | null | undefined> = {}) {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros)) if (valor) q.set(clave, valor);
  return `#${vista}${q.size ? `?${q}` : ""}`;
}

export function irDentro(vista: Vista, parametros: Record<string, string | null | undefined> = {}) {
  const destino = enlaceDentro(vista, parametros);
  if (location.hash !== destino) location.hash = destino;
}

// Panel lateral del reproductor de música (a continuación, ecualizador,
// historial) y vista de la letra, que ocupa el área principal como en Spotify.
// Los abren la barra del reproductor, los menús de las pistas y Música.
export type PestanaPanel = "fila" | "ecualizador" | "historial";
export interface EstadoPanel {
  pestana: PestanaPanel;
}

let panel: EstadoPanel | null = null;
const oyentesPanel = new Set<() => void>();

export function abrirPanel(pestana: PestanaPanel) {
  panel = { pestana };
  oyentesPanel.forEach((f) => f());
}

export function cerrarPanel() {
  panel = null;
  oyentesPanel.forEach((f) => f());
}

export function usePanel() {
  return useSyncExternalStore(
    (f) => {
      oyentesPanel.add(f);
      return () => oyentesPanel.delete(f);
    },
    () => panel,
  );
}

/** Letra abierta: la de lo que suena, o la de `itemId` si se pidió otra pista. */
let letra: { itemId?: string } | null = null;

export function abrirLetra(itemId?: string) {
  letra = { itemId };
  oyentesPanel.forEach((f) => f());
}

export function cerrarLetra() {
  letra = null;
  oyentesPanel.forEach((f) => f());
}

export function useLetra() {
  return useSyncExternalStore(
    (f) => {
      oyentesPanel.add(f);
      return () => oyentesPanel.delete(f);
    },
    () => letra,
  );
}

// Selector «Agregar a una playlist»: lo abren los menús de pistas, álbumes y
// artistas con lo que hay que agregar.
let selectorLista: { items: Item[] } | null = null;

export function abrirSelectorLista(items: Item[]) {
  if (!items.length) return;
  selectorLista = { items };
  oyentesPanel.forEach((f) => f());
}

export function cerrarSelectorLista() {
  selectorLista = null;
  oyentesPanel.forEach((f) => f());
}

export function useSelectorLista() {
  return useSyncExternalStore(
    (f) => {
      oyentesPanel.add(f);
      return () => oyentesPanel.delete(f);
    },
    () => selectorLista,
  );
}

// Avisos breves (no hay alert() en la vista previa y además estorban).
let aviso: { texto: string; id: number; accion?: { texto: string; hacer: () => void } } | null = null;
const oyentes = new Set<() => void>();
let temporizador: ReturnType<typeof setTimeout> | undefined;

/** Un aviso breve; con `accion`, un botón (p. ej. «Deshacer»). */
export function avisar(texto: string, ms = 3200, accion?: { texto: string; hacer: () => void }) {
  aviso = { texto, id: Date.now(), accion };
  oyentes.forEach((f) => f());
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    aviso = null;
    oyentes.forEach((f) => f());
  }, ms);
}

export function cerrarAviso() {
  clearTimeout(temporizador);
  aviso = null;
  oyentes.forEach((f) => f());
}

export function useAviso() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => aviso,
  );
}

export function mensajeError(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

// Lo que se busca en la barra de arriba, como en Spotify: se escribe desde
// cualquier página y los resultados salen en el inicio.
let busqueda = "";
const oyentesBusqueda = new Set<() => void>();

export function buscar(texto: string) {
  busqueda = texto;
  oyentesBusqueda.forEach((f) => f());
  const p = leerParametros();
  if (texto && (p.get("album") || p.get("artista") || p.get("lista"))) irDentro("musica", { ver: p.get("ver") });
}

export function useBusqueda() {
  return useSyncExternalStore(
    (f) => {
      oyentesBusqueda.add(f);
      return () => oyentesBusqueda.delete(f);
    },
    () => busqueda,
  );
}
