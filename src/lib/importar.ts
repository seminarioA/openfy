// Importación: lo que eliges o arrastras se guarda en este dispositivo con sus
// etiquetas (título, artista, álbum, pista, año, carátula y letra). Un ZIP de
// álbum se abre y su imagen sirve de carátula; un .lrc con el mismo nombre
// que la pista es su letra sincronizada.
import { db, nuevoId, type Item } from "./db";
import { guardarArchivo } from "./almacen";
import { esAudio, mimeDeArchivo, tituloDeArchivo } from "./formato";
import { esZip, leerZip } from "./zip";
import { esRar, leerRar } from "./rar";
import { leerLrc, type Letra } from "./letras";

function esperar(el: HTMLMediaElement, evento: string, ms = 8000) {
  return new Promise<void>((resolver) => {
    const fin = () => {
      el.removeEventListener(evento, fin);
      el.removeEventListener("error", fin);
      resolver();
    };
    el.addEventListener(evento, fin, { once: true });
    el.addEventListener("error", fin, { once: true });
    setTimeout(fin, ms);
  });
}

/** La duración que da el navegador, para audios sin etiquetas legibles. */
async function duracionDe(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const el = document.createElement("audio");
  el.preload = "metadata";
  el.src = url;
  try {
    await esperar(el, "loadedmetadata");
    return Number.isFinite(el.duration) ? el.duration : undefined;
  } finally {
    el.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

/** Una imagen reducida a `lado` px (el mayor) como JPEG en data URL, para carátulas. */
export async function reducirImagen(imagen: Blob, lado = 512): Promise<string | undefined> {
  try {
    const mapa = await createImageBitmap(imagen);
    const escala = Math.min(1, lado / Math.max(mapa.width, mapa.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(mapa.width * escala);
    lienzo.height = Math.round(mapa.height * escala);
    lienzo.getContext("2d")?.drawImage(mapa, 0, 0, lienzo.width, lienzo.height);
    mapa.close();
    return lienzo.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined;
  }
}

/** Etiquetas de un audio (ID3, Vorbis, MP4…): título, artista, álbum, pista, año, carátula y letra. */
async function analizarAudio(blob: Blob) {
  try {
    const { parseBlob, selectCover, TimestampFormat } = await import("music-metadata");
    const { common, format } = await parseBlob(blob, { duration: false, skipPostHeaders: true });
    const caratula = selectCover(common.picture);
    // Letra incrustada: sincronizada si trae marcas en milisegundos; si no, en texto.
    const l = common.lyrics?.find((x) => x.text || x.syncText?.length);
    const sincronizada = l?.timeStampFormat === TimestampFormat.milliseconds ? l.syncText.filter((x) => x.timestamp != null) : [];
    const letra: Letra | undefined = !l
      ? undefined
      : sincronizada.length
        ? { fuente: "archivo", lineas: sincronizada.map((x) => ({ t: x.timestamp! / 1000, texto: x.text })) }
        : { fuente: "archivo", texto: l.text ?? l.syncText.map((x) => x.text).join("\n") };
    return {
      titulo: common.title?.trim() || undefined,
      artistas: common.artists?.length ? common.artists : common.artist ? [common.artist] : undefined,
      musica: {
        album: common.album?.trim() || undefined,
        albumArtista: common.albumartist?.trim() || undefined,
        pista: common.track.no ?? undefined,
        totalPistas: common.track.of ?? undefined,
        disco: common.disk.no ?? undefined,
        anio: common.year ?? undefined,
        genero: common.genre?.[0],
      },
      duracion: format.duration,
      letra,
      portada: caratula ? await reducirImagen(new Blob([caratula.data as BlobPart], { type: caratula.format })) : undefined,
    };
  } catch {
    return null; // sin etiquetas legibles: se usa el nombre del archivo
  }
}

export interface OpcionesImportar {
  extra?: Record<string, unknown>;
  /** Carátula si el archivo no trae la suya (p. ej. la imagen de un ZIP de álbum). */
  portadaRespaldo?: string;
}

/** Guarda un audio en este dispositivo y lo registra en la biblioteca. */
export async function importarArchivo(archivo: File | Blob, nombre: string, opciones: OpcionesImportar = {}) {
  const mime = mimeDeArchivo(nombre, archivo.type);
  if (!esAudio(nombre, mime)) throw new Error(`«${nombre}» no es un audio reconocible.`);
  const id = nuevoId();
  const clave = `item-${id}`;
  const blob = archivo.type === mime ? archivo : new Blob([archivo], { type: mime });

  const extra: Record<string, unknown> = { nombre, ...opciones.extra };
  const etiquetas = await analizarAudio(blob);
  if (etiquetas) extra.musica = etiquetas.musica;
  // Un .lrc que acompaña a la pista (opciones.extra.letra) manda sobre la incrustada.
  if (etiquetas?.letra && !extra.letra) extra.letra = etiquetas.letra;

  const tamano = await guardarArchivo(clave, blob, mime);
  const item: Item = {
    id,
    tipo: "audio",
    titulo: etiquetas?.titulo ?? tituloDeArchivo(nombre),
    autores: etiquetas?.artistas,
    mime,
    tamano,
    duracion: etiquetas?.duracion ?? (await duracionDe(blob)),
    portada: etiquetas?.portada ?? opciones.portadaRespaldo,
    guardado: 1,
    archivo: clave,
    creado: Date.now(),
    extra,
  };
  await db.items.add(item);
  return item;
}

const IMAGEN = /\.(jpe?g|png|webp)$/i;

/** La carátula de un ZIP de álbum: cover/folder/front, o si no la imagen más grande. */
function elegirPortada(imagenes: { nombre: string; blob: Blob }[]) {
  const nombrada = imagenes.find((i) => /^(cover|folder|front|portada|album)\b/i.test(i.nombre));
  return nombrada ?? [...imagenes].sort((a, b) => b.blob.size - a.blob.size)[0];
}

export interface ResultadoLote {
  guardados: Item[];
  errores: string[];
}

const sinExtension = (ruta: string) => ruta.replace(/\.[^./\\]+$/, "").toLowerCase();
const esLrc = (nombre: string) => /\.lrc$/i.test(nombre);
/** Tope de un .lrc: una letra no pasa de unos pocos KB. */
const MAXIMO_LRC = 512 * 1024;

async function textoLrc(blob: Blob) {
  return blob.size > MAXIMO_LRC ? undefined : blob.text();
}

/**
 * Importa lo que el usuario elige o arrastra. Un ZIP o un RAR se abre y cada
 * audio de dentro entra como cualquier otro; su imagen de portada sirve de
 * carátula a las pistas que no traen la suya. Un .lrc con el mismo nombre que
 * su canción («01 - Canción.lrc»), dentro del archivo o suelto, es su letra.
 */
export async function importarLote(archivos: File[], alAvanzar?: (texto: string) => void): Promise<ResultadoLote> {
  const guardados: Item[] = [];
  const errores: string[] = [];
  const sueltasLrc = new Map<string, File>();
  for (const a of archivos) if (esLrc(a.name)) sueltasLrc.set(sinExtension(a.name), a);
  const usadas = new Set<string>();

  for (const archivo of archivos) {
    if (esLrc(archivo.name)) continue;
    try {
      const comprimido = esZip(archivo) ? "zip" : esRar(archivo) ? "rar" : null;
      if (!comprimido) {
        alAvanzar?.(`Guardando ${archivo.name}…`);
        const lrcSuelta = sueltasLrc.get(sinExtension(archivo.name));
        const lrc = lrcSuelta ? await textoLrc(lrcSuelta) : undefined;
        if (lrcSuelta) usadas.add(sinExtension(archivo.name));
        guardados.push(await importarArchivo(archivo, archivo.name, lrc ? { extra: { letra: { fuente: "lrc", lineas: leerLrc(lrc) } satisfies Letra } } : {}));
        continue;
      }
      const quiero = (ruta: string) => esAudio(ruta) || IMAGEN.test(ruta) || esLrc(ruta);
      const avance = (f: number) => alAvanzar?.(`Abriendo ${archivo.name}… ${Math.round(f * 100)} %`);
      const entradas = comprimido === "zip" ? await leerZip(archivo, quiero, avance) : await leerRar(archivo, quiero, avance);
      const audios = entradas.filter((e) => esAudio(e.nombre));
      if (!audios.length) throw new Error(`«${archivo.name}» no tiene audios.`);
      const imagen = elegirPortada(entradas.filter((e) => IMAGEN.test(e.nombre)));
      const portadaRespaldo = imagen ? await reducirImagen(imagen.blob) : undefined;
      const lrcs = new Map<string, string>();
      for (const e of entradas.filter((x) => esLrc(x.nombre))) {
        const texto = await textoLrc(e.blob);
        if (texto) lrcs.set(sinExtension(e.ruta), texto);
      }
      for (const [i, e] of audios.entries()) {
        alAvanzar?.(`Guardando ${archivo.name}: ${i + 1} de ${audios.length} · ${e.nombre}`);
        try {
          const blob = new Blob([e.blob], { type: mimeDeArchivo(e.nombre) });
          const lrc = lrcs.get(sinExtension(e.ruta));
          const letra: Letra | undefined = lrc ? { fuente: "lrc", lineas: leerLrc(lrc) } : undefined;
          guardados.push(await importarArchivo(blob, e.nombre, { portadaRespaldo, extra: { comprimido: archivo.name, rutaComprimido: e.ruta, ...(letra ? { letra } : {}) } }));
        } catch (error) {
          errores.push(error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      errores.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Un .lrc suelto sin su canción en el lote: la letra de una canción que ya está en tu música con ese nombre de archivo.
  for (const [base, lrcSuelta] of sueltasLrc) {
    if (usadas.has(base)) continue;
    const texto = await textoLrc(lrcSuelta);
    const lineas = texto ? leerLrc(texto) : [];
    const pista = (await db.items.toArray()).find((p) => typeof p.extra?.nombre === "string" && sinExtension(p.extra.nombre) === base);
    if (!pista || !lineas.length) {
      errores.push(`«${lrcSuelta.name}»: ${lineas.length ? "no hay ninguna canción con ese nombre de archivo." : "no es una letra sincronizada (.lrc)."}`);
      continue;
    }
    await db.items.update(pista.id, { extra: { ...pista.extra, letra: { fuente: "lrc", lineas } satisfies Letra } });
    guardados.push(pista);
  }
  return { guardados, errores };
}
