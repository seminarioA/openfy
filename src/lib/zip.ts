// Lectura de ZIP en el navegador, en streaming: el ZIP no se carga entero en
// memoria (un álbum en FLAC puede pesar cientos de MB). Solo se descomprimen
// las entradas que se piden.
import { Unzip, UnzipInflate } from "fflate";
import { DemasiadoGrande, esBasura, MAXIMO_DESCOMPRIMIDO, MAXIMO_ENTRADAS, nombreDeRuta, ordenarEntradas, type EntradaComprimida } from "./archivos-comprimidos";

export type EntradaZip = EntradaComprimida;

export function esZip(archivo: File | Blob, nombre = (archivo as File).name ?? "") {
  return /\.zip$/i.test(nombre) || archivo.type === "application/zip" || archivo.type === "application/x-zip-compressed";
}

/**
 * Extrae del ZIP las entradas cuya ruta acepta `quiero`. `alAvanzar` recibe la
 * fracción del ZIP leída.
 */
export async function leerZip(zip: Blob, quiero: (ruta: string) => boolean, alAvanzar?: (fraccion: number) => void): Promise<EntradaZip[]> {
  const entradas: EntradaZip[] = [];
  const pendientes: Promise<void>[] = [];
  let fallo: Error | null = null;
  // Lo descomprimido hasta ahora y las entradas aceptadas: con tope, contra los ZIP que se inflan sin fin.
  let ocupado = 0;
  let aceptadas = 0;

  const unzip = new Unzip((archivo) => {
    if (fallo || esBasura(archivo.name) || !quiero(archivo.name)) return; // sin start(): no se descomprime
    if (++aceptadas > MAXIMO_ENTRADAS) {
      fallo = new DemasiadoGrande(nombreDeRuta((zip as File).name ?? "El ZIP"));
      return;
    }
    const trozos: Uint8Array[] = [];
    pendientes.push(
      new Promise<void>((resolver) => {
        archivo.ondata = (error, trozo, final) => {
          if (error) {
            fallo ??= new Error(`No se pudo descomprimir «${archivo.name}»: ${error.message}`);
            return resolver();
          }
          ocupado += trozo.byteLength;
          if (ocupado > MAXIMO_DESCOMPRIMIDO) {
            fallo ??= new DemasiadoGrande((zip as File).name ?? "El ZIP");
            archivo.terminate();
            return resolver();
          }
          trozos.push(trozo);
          if (final) {
            entradas.push({ nombre: nombreDeRuta(archivo.name), ruta: archivo.name, blob: new Blob(trozos as BlobPart[]) });
            resolver();
          }
        };
      }),
    );
    archivo.start();
  });
  unzip.register(UnzipInflate);

  const lector = zip.stream().getReader();
  let leidos = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (fallo) {
      await lector.cancel();
      break;
    }
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    unzip.push(value);
    leidos += value.byteLength;
    alAvanzar?.(zip.size ? leidos / zip.size : 0);
  }
  await Promise.all(pendientes);
  if (fallo) throw fallo;
  return ordenarEntradas(entradas);
}
