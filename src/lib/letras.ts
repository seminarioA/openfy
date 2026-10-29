// Letras de canciones. Por orden: la que ya está guardada con la pista (la del
// propio archivo, un .lrc del ZIP o una búsqueda anterior) y, si no hay, la de
// LRCLIB (lrclib.net: abierto, sin cuenta, con letras sincronizadas). Lo que se
// encuentra se guarda con la pista para verla sin conexión. Para buscarla se
// envían título, artista, álbum y duración a lrclib.net, y nada más.
//
// Lo que llega de LRCLIB es texto de terceros: se valida su forma, se recorta
// su tamaño y se muestra siempre como texto (React lo escapa), nunca como HTML.
import { useEffect, useSyncExternalStore } from "react";
import { db, type Item } from "./db";
import { datosMusica } from "./musica";

export interface LineaLetra {
  /** Segundo en que empieza. */
  t: number;
  texto: string;
}

export interface Letra {
  fuente: "archivo" | "lrc" | "lrclib";
  /** Sincronizada, si la hay. */
  lineas?: LineaLetra[];
  texto?: string;
  instrumental?: boolean;
  /**
   * Con qué versión de la búsqueda se intentó encontrar una sincronizada para
   * esta letra en texto (antes era `true`). Una búsqueda mejor la reintenta.
   */
  buscadaSincronizada?: boolean | number;
}

/** Marca de búsqueda sin resultado, para no repetirla a diario. */
interface SinLetra {
  ninguna: true;
  buscada: number;
  /** Versión de la búsqueda que no encontró nada. */
  version?: number;
}

/** Sube cuando la búsqueda mejora: las letras en texto y las no encontradas se vuelven a buscar. */
export const VERSION_BUSQUEDA = 2;
/** Tope de una letra (caracteres): una canción no pasa de unos pocos miles. */
const MAXIMO_LETRA = 60_000;

const UNA_SEMANA = 7 * 86400000;

/** Lee un .lrc: «[mm:ss.cc] texto», con varias marcas por línea y [offset:±ms]. */
export function leerLrc(lrc: string): LineaLetra[] {
  let desfase = 0;
  const lineas: LineaLetra[] = [];
  for (const cruda of lrc.split(/\r?\n/)) {
    const offset = /^\[offset:\s*([+-]?\d+)\]/i.exec(cruda);
    if (offset) {
      desfase = Number(offset[1]) / 1000;
      continue;
    }
    const marcas = [...cruda.matchAll(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g)];
    if (!marcas.length) continue;
    const texto = cruda.replace(/\[[^\]]*\]/g, "").trim();
    for (const m of marcas) lineas.push({ t: Math.max(0, Number(m[1]) * 60 + Number(m[2].replace(":", ".")) + desfase), texto });
  }
  return lineas.sort((a, b) => a.t - b.t);
}

/** La línea que suena en el segundo `t` (índice), o -1 antes de la primera. */
export function lineaActual(lineas: LineaLetra[], t: number) {
  let i = -1;
  for (const [j, l] of lineas.entries()) {
    if (l.t > t) break;
    i = j;
  }
  return i;
}

function guardada(item: Item): Letra | SinLetra | undefined {
  return (item.extra as { letra?: Letra | SinLetra } | undefined)?.letra;
}

async function guardar(item: Item, letra: Letra | SinLetra) {
  const actual = await db.items.get(item.id);
  await db.items.update(item.id, { extra: { ...(actual?.extra ?? item.extra), letra } });
}

export interface RespuestaLrclib {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  duration?: number;
}

/** Margen de duración (s) para fiarse de los tiempos de una sincronizada: misma grabación, otra edición. */
const MARGEN_DURACION = 10;

/** Para comparar nombres: forma NFKC, minúsculas, sin espacios, signos ni símbolos. */
export function normalizar(texto: string) {
  return texto.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/**
 * Las formas de un título: entero y cada parte separada por « / », « - », «〜»
 * o paréntesis («真夜中のドア / Stay With Me» → también «真夜中のドア» y «Stay With Me»),
 * sin «feat.» ni «Remastered».
 */
export function formasTitulo(titulo: string) {
  const limpio = titulo.replace(/\s*[([](?:feat\.?|ft\.?|with|remaster(?:ed)?|\d{4} remaster)[^)\]]*[)\]]/gi, "").replace(/\s+-\s+(?:\d{4}\s+)?remaster(?:ed)?.*$/i, "");
  const partes = [limpio, ...limpio.split(/\s+[/\-–—]\s+|\s*[/〜~～]\s*|\s*[()（）[\]]\s*/)];
  return new Set(partes.map(normalizar).filter((p) => p.length >= 2));
}

/**
 * Los artistas que firma un crédito («A, B & C feat. D», «X - Topic») y sus
 * nombres entre paréntesis o corchetes («Tomoko Aran(亜蘭知子)», «亜蘭知子 [Tomoko Aran]»).
 * «Aran, Tomoko» también vale como «Tomoko Aran».
 */
export function formasArtista(nombre: string) {
  const limpio = nombre.replace(/\s+-\s+topic$/i, "");
  const partes = [limpio, ...limpio.split(/\s*(?:,|&|\/|;|\bfeat\.?|\bft\.?|\band\b|、|・|[()（）[\]【】])\s*/i)];
  const invertido = /^([^,]+),\s*([^,]+)$/.exec(limpio);
  if (invertido) partes.push(`${invertido[2]} ${invertido[1]}`);
  return new Set(partes.map(normalizar).filter((p) => p.length >= 2));
}

const algunaEn = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

/** Lo que se sabe de la pista para reconocerla entre los resultados. */
export interface Pista {
  titulos: Set<string>;
  artistas: Set<string>;
  /** Título entero y álbum, normalizados. */
  titulo: string;
  album?: string;
  duracion: number;
}

/** Margen (s) para dar por buena la misma grabación cuando el artista viene escrito en otro alfabeto. */
const MARGEN_OTRO_ALFABETO = 2;

/**
 * Si un resultado es la misma canción: alguna forma del título y algún
 * artista coinciden. Si el artista no coincide (suele ser el mismo escrito en
 * otro alfabeto: 亜蘭知子 / Tomoko Aran), solo con pruebas fuertes: el mismo
 * título entero, el mismo álbum y la misma duración (±2 s).
 */
export function esLaMisma(r: RespuestaLrclib, p: Pista) {
  if (!r.trackName || !r.artistName) return false;
  if (!algunaEn(formasTitulo(r.trackName), p.titulos)) return false;
  if (algunaEn(formasArtista(r.artistName), p.artistas)) return true;
  const mismoAlbum = !!p.album && !!r.albumName && [...formasTitulo(r.albumName)].some((a) => a === p.album);
  return mismoAlbum && normalizar(r.trackName) === p.titulo && !!p.duracion && !!r.duration && Math.abs(r.duration - p.duracion) <= MARGEN_OTRO_ALFABETO;
}

/**
 * Entre los resultados (ya filtrados como la misma canción), la sincronizada de
 * duración más parecida dentro del margen; si no hay, la de duración más parecida.
 */
export function elegirResultado(lista: RespuestaLrclib[], duracion: number) {
  const utiles = lista.filter((x) => x.plainLyrics || x.syncedLyrics || x.instrumental);
  const distancia = (x: RespuestaLrclib) => (duracion && x.duration ? Math.abs(x.duration - duracion) : 0);
  const ordenadas = [...utiles].sort((a, b) => distancia(a) - distancia(b));
  return ordenadas.find((x) => x.syncedLyrics && (!duracion || !x.duration || distancia(x) <= MARGEN_DURACION)) ?? ordenadas[0] ?? null;
}

/** Valida la forma de un resultado y recorta lo que no cabe: es contenido de terceros. */
export function sanear(x: unknown): RespuestaLrclib | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const cadena = (v: unknown) => (typeof v === "string" && v.trim() ? v.slice(0, MAXIMO_LETRA) : null);
  return {
    id: typeof o.id === "number" ? o.id : undefined,
    trackName: cadena(o.trackName) ?? undefined,
    artistName: cadena(o.artistName) ?? undefined,
    albumName: cadena(o.albumName) ?? undefined,
    instrumental: o.instrumental === true,
    plainLyrics: cadena(o.plainLyrics),
    syncedLyrics: cadena(o.syncedLyrics),
    duration: typeof o.duration === "number" && Number.isFinite(o.duration) ? o.duration : undefined,
  };
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Lo más que dura una búsqueda de letra con todos sus reintentos (ms), y cada petición. */
const PLAZO_BUSQUEDA = 20_000;
const PLAZO_PETICION = 10_000;

/** GET a LRCLIB; reintenta si está saturado (503/429) mientras quede plazo. `null` si no hay (404). */
async function pedirLrclib(ruta: string, q: URLSearchParams, limite: number): Promise<unknown> {
  for (let intento = 0; ; intento++) {
    const r = await fetch(`https://lrclib.net/api/${ruta}?${q}`, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(Math.max(1000, Math.min(PLAZO_PETICION, limite - Date.now()))),
    });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    const espera = 700 * 2 ** intento * (0.75 + Math.random() / 2);
    if ((r.status === 503 || r.status === 429) && intento < 4 && Date.now() + espera < limite) {
      await esperar(espera);
      continue;
    }
    throw new Error(`LRCLIB no responde ahora (HTTP ${r.status}).`);
  }
}

async function buscarEnLrclib(item: Item): Promise<RespuestaLrclib | null> {
  const limite = Date.now() + PLAZO_BUSQUEDA;
  const datos = datosMusica(item);
  // Sus nombres: los de la pista y el del álbum (a veces en otro alfabeto: 松原みき / Miki Matsubara).
  const nombres = [...(item.autores ?? []), ...(datos.albumArtista ? [datos.albumArtista] : [])].filter(Boolean);
  if (!nombres.length) return null;
  const duracion = item.duracion ?? 0;
  const pista: Pista = {
    titulos: formasTitulo(item.titulo),
    artistas: new Set(nombres.flatMap((n) => [...formasArtista(n)])),
    titulo: normalizar(item.titulo),
    album: datos.album ? normalizar(datos.album) : undefined,
    duracion,
  };

  // 1. La coincidencia exacta (título, artista, álbum y duración).
  const q = new URLSearchParams({ track_name: item.titulo, artist_name: nombres[0] });
  if (datos.album) q.set("album_name", datos.album);
  if (duracion) q.set("duration", String(Math.round(duracion)));
  const exacta = sanear(await pedirLrclib("get", q, limite).catch(() => null));
  if (exacta?.syncedLyrics || exacta?.instrumental) return exacta;

  // 2. Búsqueda libre con varias formas del título y del artista, hasta dar con
  // una sincronizada de la misma canción y duración parecida.
  const partes = [...new Set([item.titulo, ...item.titulo.split(/\s+[/\-–—]\s+|\s*[/〜~～]\s*/)].map((t) => t.trim()).filter((t) => t.length >= 2))];
  const consultas = [...new Set([...partes.flatMap((t) => nombres.map((n) => `${t} ${n}`)), ...partes])].slice(0, 6);
  const vistos = new Map<number | string, RespuestaLrclib>();
  if (exacta) vistos.set(exacta.id ?? "exacta", exacta);
  let fallos = 0;
  let ultimoFallo: unknown;
  for (const texto of consultas) {
    if (Date.now() >= limite) break;
    let lista: unknown;
    try {
      lista = await pedirLrclib("search", new URLSearchParams({ q: texto }), limite);
    } catch (e) {
      fallos++;
      ultimoFallo = e;
      continue;
    }
    if (!Array.isArray(lista)) continue;
    for (const crudo of lista.slice(0, 50)) {
      const r = sanear(crudo);
      if (r && esLaMisma(r, pista)) vistos.set(r.id ?? vistos.size, r);
    }
    const mejor = elegirResultado([...vistos.values()], duracion);
    if (mejor?.syncedLyrics && (!duracion || !mejor.duration || Math.abs(mejor.duration - duracion) <= MARGEN_DURACION)) return mejor;
  }
  // Si LRCLIB no contestó a ninguna búsqueda, es un fallo (se reintenta luego), no «sin letra».
  if (fallos && fallos === consultas.length && !vistos.size) throw ultimoFallo instanceof Error ? ultimoFallo : new Error("LRCLIB no responde ahora.");
  if (!vistos.size && Date.now() >= limite) throw new Error("LRCLIB tarda demasiado ahora.");
  return elegirResultado([...vistos.values()], duracion);
}

/** La letra de una pista; `null` si no hay. Lanza solo si LRCLIB falla. */
export async function obtenerLetra(item: Item, { forzar = false } = {}): Promise<Letra | null> {
  const previa = guardada((await db.items.get(item.id)) ?? item);
  // Una letra guardada solo en texto se intenta mejorar con una sincronizada, una vez por versión de la búsqueda.
  if (previa && !("ninguna" in previa) && previa.fuente !== "lrc" && !previa.lineas?.length && Number(previa.buscadaSincronizada ?? 0) < VERSION_BUSQUEDA) {
    const r = await buscarEnLrclib(item).catch(() => null);
    const mejor: Letra = r?.syncedLyrics ? { fuente: "lrclib", lineas: leerLrc(r.syncedLyrics), texto: r.plainLyrics ?? previa.texto } : { ...previa, buscadaSincronizada: VERSION_BUSQUEDA };
    await guardar(item, mejor);
    return mejor;
  }
  if (previa && !("ninguna" in previa)) return previa;
  if (previa && "ninguna" in previa && !forzar && (previa.version ?? 1) >= VERSION_BUSQUEDA && Date.now() - previa.buscada < UNA_SEMANA) return null;

  const r = await buscarEnLrclib(item);
  if (!r || (!r.plainLyrics && !r.syncedLyrics && !r.instrumental)) {
    await guardar(item, { ninguna: true, buscada: Date.now(), version: VERSION_BUSQUEDA });
    return null;
  }
  const letra: Letra = {
    fuente: "lrclib",
    instrumental: r.instrumental || undefined,
    lineas: r.syncedLyrics ? leerLrc(r.syncedLyrics) : undefined,
    texto: r.plainLyrics ?? undefined,
  };
  await guardar(item, letra);
  return letra;
}

// ---------- disponibilidad, compartida por la barra y la vista de letra ----------

export type EstadoLetra = { estado: "buscando" } | { estado: "lista"; letra: Letra } | { estado: "ninguna" } | { estado: "error"; mensaje: string };

const estados = new Map<string, EstadoLetra>();
const pendientes = new Map<string, Promise<EstadoLetra>>();
const oyentes = new Set<() => void>();

function fijar(id: string, e: EstadoLetra) {
  estados.set(id, e);
  oyentes.forEach((f) => f());
}

/** Esperas antes de reintentar una búsqueda que falló (LRCLIB saturado o sin red). */
const REINTENTOS_MS = [15_000, 45_000, 120_000];
const reintentos = new Map<string, number>();

/**
 * Busca (una vez) la letra de una pista y deja su estado. Si falla, se
 * reintenta sola unas veces, más espaciadas cada vez, y otra vez la próxima vez que se pida.
 */
export function pedirLetra(item: Item, forzar = false): Promise<EstadoLetra> {
  const previo = estados.get(item.id);
  if (!forzar && previo && previo.estado !== "error" && previo.estado !== "buscando") return Promise.resolve(previo);
  const enCurso = pendientes.get(item.id);
  if (enCurso && !forzar) return enCurso;
  fijar(item.id, { estado: "buscando" });
  const promesa = obtenerLetra(item, { forzar })
    .then((letra): EstadoLetra => (letra ? { estado: "lista", letra } : { estado: "ninguna" }))
    .catch((e): EstadoLetra => ({ estado: "error", mensaje: e instanceof Error ? e.message : String(e) }))
    .then((e) => {
      fijar(item.id, e);
      pendientes.delete(item.id);
      const n = reintentos.get(item.id) ?? 0;
      if (e.estado === "error" && n < REINTENTOS_MS.length) {
        reintentos.set(item.id, n + 1);
        setTimeout(() => {
          if (estados.get(item.id)?.estado === "error") void pedirLetra(item);
        }, REINTENTOS_MS[n]);
      } else if (e.estado !== "error") reintentos.delete(item.id);
      return e;
    });
  pendientes.set(item.id, promesa);
  return promesa;
}

/** El estado de la letra de `item`; la pide si aún no se sabe. */
export function useLetraDe(item?: Item | null): EstadoLetra | undefined {
  const estado = useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => (item ? estados.get(item.id) : undefined),
  );
  useEffect(() => {
    if (item) void pedirLetra(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);
  return estado;
}
