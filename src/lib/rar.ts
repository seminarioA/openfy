// Lectura de RAR (RAR4 y RAR5) en el navegador, con el descompresor oficial
// de RARLAB compilado a WebAssembly (node-unrar-js). Se cargan solo al abrir un
// RAR. A diferencia del ZIP, el RAR se lee entero en memoria.
import wasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";
import { DemasiadoGrande, esBasura, MAXIMO_DESCOMPRIMIDO, MAXIMO_ENTRADAS, nombreDeRuta, ordenarEntradas, type EntradaComprimida } from "./archivos-comprimidos";

export function esRar(archivo: File | Blob, nombre = (archivo as File).name ?? "") {
  return /\.rar$/i.test(nombre) || archivo.type === "application/vnd.rar" || archivo.type === "application/x-rar-compressed";
}

let wasm: Promise<ArrayBuffer> | null = null;

/**
 * Extrae del RAR las entradas cuya ruta acepta `quiero`. Antes de descomprimir
 * nada, suma lo que ocuparían según la cabecera y rechaza el archivo si pasa
 * del tope.
 */
export async function leerRar(rar: File, quiero: (ruta: string) => boolean, alAvanzar?: (fraccion: number) => void): Promise<EntradaComprimida[]> {
  const { createExtractorFromData } = await import("node-unrar-js");
  wasm ??= fetch(wasmUrl).then((r) => r.arrayBuffer());
  let extractor;
  let todas;
  try {
    extractor = await createExtractorFromData({ wasmBinary: await wasm, data: await rar.arrayBuffer() });
    todas = [...extractor.getFileList().fileHeaders];
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "";
    if (/password/i.test(motivo)) throw new Error(`«${rar.name}» tiene contraseña.`);
    throw new Error(`«${rar.name}» no es un RAR válido o está dañado.`);
  }
  const cabeceras = todas.filter((h) => !h.flags.directory && !esBasura(h.name) && quiero(h.name));
  if (cabeceras.length > MAXIMO_ENTRADAS || cabeceras.reduce((s, h) => s + h.unpSize, 0) > MAXIMO_DESCOMPRIMIDO) throw new DemasiadoGrande(rar.name);
  if (cabeceras.some((h) => h.flags.encrypted)) throw new Error(`«${rar.name}» tiene contraseña.`);

  const elegidas = new Set(cabeceras.map((h) => h.name));
  const total = cabeceras.reduce((s, h) => s + h.unpSize, 0) || 1;
  const entradas: EntradaComprimida[] = [];
  let hecho = 0;
  let ocupado = 0;
  try {
    for (const { fileHeader, extraction } of extractor.extract({ files: (h) => elegidas.has(h.name) }).files) {
      if (!extraction) continue;
      // La cabecera puede mentir: se cuenta también lo que de verdad sale.
      ocupado += extraction.byteLength;
      if (ocupado > MAXIMO_DESCOMPRIMIDO) throw new DemasiadoGrande(rar.name);
      entradas.push({ nombre: nombreDeRuta(fileHeader.name), ruta: fileHeader.name.replace(/\\/g, "/"), blob: new Blob([extraction as BlobPart]) });
      hecho += fileHeader.unpSize;
      alAvanzar?.(hecho / total);
    }
  } catch (e) {
    if (e instanceof DemasiadoGrande) throw e;
    throw new Error(`No se pudo descomprimir «${rar.name}»${e instanceof Error && e.message ? `: ${e.message}` : ""}.`);
  }
  return ordenarEntradas(entradas);
}
