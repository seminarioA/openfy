// Límites comunes a los ZIP y RAR que se abren en el navegador. Un archivo
// comprimido puede venir de cualquier sitio: se limita cuánto puede ocupar
// descomprimido (contra las «bombas» que crecen miles de veces) y cuántas
// entradas trae, y de cada entrada solo se usa el nombre (nunca la ruta para
// escribir en disco: lo que se guarda va con una clave propia, ver lib/almacen.ts).

/** Tope de lo descomprimido de un archivo: un álbum en FLAC de alta resolución cabe holgado. */
export const MAXIMO_DESCOMPRIMIDO = 4 * 1024 ** 3;
/** Tope de entradas que se aceptan de un archivo. */
export const MAXIMO_ENTRADAS = 5000;

export interface EntradaComprimida {
  /** Nombre del archivo, sin carpetas. */
  nombre: string;
  /** Ruta dentro del archivo comprimido. */
  ruta: string;
  blob: Blob;
}

/** Basura de sistemas operativos que no es contenido, y rutas que no son de un archivo. */
export function esBasura(ruta: string) {
  return ruta.endsWith("/") || ruta.split(/[/\\]/).some((parte) => parte.startsWith(".") || parte === "__MACOSX");
}

/** Nombre sin carpetas, sea cual sea el separador. */
export const nombreDeRuta = (ruta: string) => ruta.split(/[/\\]/).pop() || ruta;

export const ordenarEntradas = (entradas: EntradaComprimida[]) => entradas.sort((a, b) => a.ruta.localeCompare(b.ruta, undefined, { numeric: true }));

export class DemasiadoGrande extends Error {
  constructor(nombre: string) {
    super(`«${nombre}» ocupa demasiado al descomprimirlo (más de ${MAXIMO_DESCOMPRIMIDO / 1024 ** 3} GB) o trae demasiados archivos.`);
  }
}
