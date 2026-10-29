// Archivos del usuario en este dispositivo. Se usa el sistema de archivos privado
// del origen (OPFS) cuando existe, porque aguanta archivos grandes (álbumes en FLAC); si no, el
// archivo va como Blob a IndexedDB (contextos sin HTTPS, navegadores antiguos).
import { db } from "./db";

type Directorio = FileSystemDirectoryHandle;

let raiz: Promise<Directorio | null> | null = null;

function directorio(): Promise<Directorio | null> {
  raiz ??= (async () => {
    try {
      if (!window.isSecureContext || !navigator.storage?.getDirectory) return null;
      const dir = await navigator.storage.getDirectory();
      const sub = await dir.getDirectoryHandle("openfy", { create: true });
      // Comprueba que se puede escribir de verdad (Safari antiguo no tiene createWritable).
      const prueba = await sub.getFileHandle(".prueba", { create: true });
      if (!("createWritable" in prueba)) return null;
      return sub;
    } catch {
      return null;
    }
  })();
  return raiz;
}

export async function usaOPFS() {
  return (await directorio()) !== null;
}

function nombreSeguro(clave: string) {
  return clave.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Guarda un Blob o un flujo de bytes. Devuelve el tamaño escrito. */
export async function guardarArchivo(
  clave: string,
  datos: Blob | ReadableStream<Uint8Array>,
  tipo = "application/octet-stream",
): Promise<number> {
  const dir = await directorio();
  if (dir) {
    const handle = await dir.getFileHandle(nombreSeguro(clave), { create: true });
    const escritor = await handle.createWritable();
    try {
      if (datos instanceof Blob) {
        await escritor.write(datos);
      } else {
        const lector = datos.getReader();
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          await escritor.write(value as Uint8Array<ArrayBuffer>);
        }
      }
      await escritor.close();
    } catch (error) {
      await escritor.abort().catch(() => {});
      throw error;
    }
    return (await handle.getFile()).size;
  }
  const blob = datos instanceof Blob ? datos : await new Response(datos).blob();
  const conTipo = blob.type ? blob : new Blob([blob], { type: tipo });
  await db.archivos.put({ clave, blob: conTipo });
  return conTipo.size;
}

export async function leerArchivo(clave: string, tipo?: string): Promise<Blob | null> {
  const dir = await directorio();
  if (dir) {
    try {
      const handle = await dir.getFileHandle(nombreSeguro(clave));
      const archivo = await handle.getFile();
      return tipo && archivo.type !== tipo ? new Blob([archivo], { type: tipo }) : archivo;
    } catch {
      /* puede estar en IndexedDB si se guardó antes de tener OPFS */
    }
  }
  const fila = await db.archivos.get(clave);
  return fila?.blob ?? null;
}

/** Si el archivo sigue en este dispositivo (sin leerlo: el navegador puede liberar espacio por su cuenta). */
export async function existeArchivo(clave: string) {
  const dir = await directorio();
  if (dir) {
    try {
      await dir.getFileHandle(nombreSeguro(clave));
      return true;
    } catch {
      /* puede estar en IndexedDB */
    }
  }
  return !!(await db.archivos.get(clave));
}

export async function borrarArchivo(clave: string) {
  const dir = await directorio();
  if (dir) await dir.removeEntry(nombreSeguro(clave)).catch(() => {});
  await db.archivos.delete(clave);
}

export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}

export async function espacio() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usado: e.usage ?? 0, cuota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

const urls = new Map<string, string>();

/** URL de objeto para reproducir o leer un archivo guardado. Se reutiliza mientras viva la página. */
export async function urlDeArchivo(clave: string, tipo?: string) {
  const previa = urls.get(clave);
  if (previa) return previa;
  const blob = await leerArchivo(clave, tipo);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(clave, url);
  return url;
}

export function soltarUrl(clave: string) {
  const url = urls.get(clave);
  if (url) URL.revokeObjectURL(url);
  urls.delete(clave);
}
