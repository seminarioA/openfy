import Dexie, { type EntityTable } from "dexie";

/** Una pista de tu biblioteca: el archivo vive en este dispositivo (lib/almacen.ts). */
export interface Item {
  id: string;
  tipo: "audio";
  titulo: string;
  autores?: string[];
  mime: string;
  tamano?: number;
  duracion?: number;
  portada?: string;
  /** El archivo está guardado en este dispositivo. */
  guardado: 0 | 1;
  /** Clave del archivo en el almacén local. */
  archivo?: string;
  creado: number;
  abierto?: number;
  /** Segundo donde se quedó. */
  posicion?: number;
  /** Avance de 0 a 1. */
  avance?: number;
  /** Etiquetas (extra.musica), letra (extra.letra) y el nombre del archivo. */
  extra?: Record<string, unknown>;
}

export interface Archivo {
  clave: string;
  blob: Blob;
}

/** Una pista de una playlist: la referencia y cuándo se agregó. */
export interface PistaDeLista {
  id: string;
  agregada: number;
}

/** Playlist hecha por el usuario. Guarda solo ids: la pista vive en `items`. */
export interface Lista {
  id: string;
  nombre: string;
  descripcion?: string;
  pistas: PistaDeLista[];
  creada: number;
  actualizada: number;
}

export const db = new Dexie("openfy") as Dexie & {
  items: EntityTable<Item, "id">;
  archivos: EntityTable<Archivo, "clave">;
  listas: EntityTable<Lista, "id">;
};

db.version(1).stores({
  items: "id, tipo, guardado, creado, abierto",
  archivos: "clave",
  listas: "id, actualizada",
});

// Otra pestaña abrió una versión más nueva de la base: esta se quedaría sin
// poder leerla, así que se recarga con el código nuevo.
db.on("versionchange", () => {
  db.close();
  location.reload();
  return false;
});

export function nuevoId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
