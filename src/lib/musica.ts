// La música agrupada por álbum, a partir de las etiquetas que guarda la
// importación (item.extra.musica). Sin efectos: solo datos.
import type { Item } from "./db";

export interface DatosMusica {
  album?: string;
  albumArtista?: string;
  pista?: number;
  totalPistas?: number;
  disco?: number;
  anio?: number;
  genero?: string;
}

export interface Album {
  clave: string;
  titulo: string;
  artista: string;
  anio?: number;
  portada?: string;
  pistas: Item[];
  duracion: number;
  /** Cuándo se añadió su última pista (para ordenar por recientes). */
  anadido: number;
}

export const canciones = (n: number) => `${n} ${n === 1 ? "canción" : "canciones"}`;

export function datosMusica(item: Item): DatosMusica {
  return ((item.extra as { musica?: DatosMusica } | undefined)?.musica ?? {}) as DatosMusica;
}

const normalizar = (s: string) => s.normalize("NFKC").trim().toLowerCase();

/**
 * El álbum al que pertenece una pista (o `null`). Sin artista del álbum, las
 * pistas de un mismo ZIP con el mismo álbum son un solo disco aunque cambie el
 * artista (recopilaciones); si no, manda el artista.
 */
export function claveAlbum(item: Item): string | null {
  const m = datosMusica(item);
  if (!m.album) return null;
  // El ZIP o RAR del que salió (`zip` en lo importado antes de admitir RAR).
  const zip = (item.extra as { comprimido?: string; zip?: string } | undefined)?.comprimido ?? (item.extra as { zip?: string } | undefined)?.zip;
  const dueno = m.albumArtista ?? (zip ? `zip:${zip}` : (item.autores?.[0] ?? ""));
  return `${normalizar(dueno)}|${normalizar(m.album)}`;
}

/** Lo que el agrupado de álbumes pone cuando no hay un artista concreto. */
const SIN_ARTISTA = new Set(["varios artistas", "artista desconocido"]);

export const claveArtista = (nombre: string) => normalizar(nombre);

/** Si `nombre` es un artista con página (no «Varios artistas» ni «Artista desconocido»). */
export const esArtista = (nombre?: string | null): nombre is string => !!nombre?.trim() && !SIN_ARTISTA.has(claveArtista(nombre));

/** Los artistas de una pista: los suyos y el del álbum, sin repetir. */
export function artistasDe(item: Item): string[] {
  const vistos = new Set<string>();
  return [...(item.autores ?? []), datosMusica(item).albumArtista].filter((n): n is string => {
    if (!esArtista(n) || vistos.has(claveArtista(n))) return false;
    vistos.add(claveArtista(n));
    return true;
  });
}

/** Pistas en orden de disco y número; sin número, por título. */
export function ordenarPistas(pistas: Item[]) {
  return [...pistas].sort((a, b) => {
    const x = datosMusica(a);
    const y = datosMusica(b);
    return (x.disco ?? 1) - (y.disco ?? 1) || (x.pista ?? Infinity) - (y.pista ?? Infinity) || a.titulo.localeCompare(b.titulo, undefined, { numeric: true });
  });
}

/**
 * Agrupa los audios por álbum (artista del álbum + título). Los que no tienen
 * álbum quedan como pistas sueltas.
 */
export function agruparAlbumes(audios: Item[]): { albumes: Album[]; sueltas: Item[] } {
  const grupos = new Map<string, Item[]>();
  const sueltas: Item[] = [];
  for (const item of audios) {
    const m = datosMusica(item);
    if (!m.album) {
      sueltas.push(item);
      continue;
    }
    const clave = claveAlbum(item)!;
    grupos.set(clave, [...(grupos.get(clave) ?? []), item]);
  }
  const albumes = [...grupos.entries()].map(([clave, pistas]): Album => {
    const ordenadas = ordenarPistas(pistas);
    const m = datosMusica(ordenadas[0]);
    const anios = pistas.map((p) => datosMusica(p).anio).filter((a): a is number => !!a);
    // Si las pistas son de varios artistas sin artista del álbum, es una recopilación.
    const artistas = new Set(pistas.map((p) => p.autores?.[0]).filter(Boolean));
    return {
      clave,
      titulo: m.album!,
      artista: m.albumArtista ?? (artistas.size > 1 ? "Varios artistas" : (ordenadas[0].autores?.[0] ?? "Artista desconocido")),
      anio: anios.length ? Math.min(...anios) : undefined,
      portada: ordenadas.find((p) => p.portada)?.portada,
      pistas: ordenadas,
      duracion: pistas.reduce((s, p) => s + (p.duracion ?? 0), 0),
      anadido: Math.max(...pistas.map((p) => p.creado)),
    };
  });
  albumes.sort((a, b) => b.anadido - a.anadido);
  return { albumes, sueltas };
}

export interface Artista {
  clave: string;
  /** Todas sus claves: la suya y las de sus otros nombres (para los enlaces). */
  claves: string[];
  /** El nombre con que firma sus pistas más veces. */
  nombre: string;
  /** Otros nombres con que aparece, p. ej. en otro alfabeto. */
  alias: string[];
  portada?: string;
  /** Sus pistas: por álbum (del más reciente al más antiguo) y luego las sueltas. */
  pistas: Item[];
  /** Sus álbumes: los que firma o en los que todas las pistas son suyas. */
  albumes: Album[];
  /** Álbumes de otros en los que aparece. */
  apareceEn: Album[];
  duracion: number;
}

/** Si el nombre está escrito solo con letras latinas (con números, signos y espacios). */
const esLatino = (nombre: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test(nombre);

/**
 * Nombres que son el mismo artista. Si un álbum firma «Miki Matsubara» y todas
 * sus pistas son de «松原みき» (una sola artista por pista), es la misma persona
 * escrita en dos alfabetos. Solo se unen nombres de alfabetos distintos: así
 * «A» y «A feat. B» siguen siendo créditos distintos. Devuelve la clave común.
 */
export function aliasDeArtistas(albumes: Album[]) {
  const padre = new Map<string, string>();
  const raiz = (c: string): string => {
    const p = padre.get(c);
    return p && p !== c ? raiz(p) : c;
  };
  for (const a of albumes) {
    const firma = datosMusica(a.pistas[0]).albumArtista;
    if (!esArtista(firma)) continue;
    const deLasPistas = new Set(a.pistas.map((p) => (p.autores?.length === 1 ? p.autores[0] : "")));
    if (deLasPistas.size !== 1) continue;
    const [interprete] = deLasPistas;
    if (!esArtista(interprete) || esLatino(interprete) === esLatino(firma)) continue;
    const x = raiz(claveArtista(firma));
    const y = raiz(claveArtista(interprete));
    if (x !== y) padre.set(x, y);
  }
  return raiz;
}

/** Agrupa las pistas por artista (de la pista o del álbum), en orden alfabético. */
export function agruparArtistas(audios: Item[], albumes = agruparAlbumes(audios).albumes): Artista[] {
  const raiz = aliasDeArtistas(albumes);
  const grupos = new Map<string, { nombres: Map<string, number>; pistas: Map<string, Item> }>();
  for (const item of audios) {
    for (const nombre of artistasDe(item)) {
      const clave = raiz(claveArtista(nombre));
      const g = grupos.get(clave) ?? { nombres: new Map<string, number>(), pistas: new Map<string, Item>() };
      // Firmar la pista cuenta más que firmar el álbum: manda el nombre de los créditos.
      g.nombres.set(nombre, (g.nombres.get(nombre) ?? 0) + (item.autores?.includes(nombre) ? 2 : 1));
      g.pistas.set(item.id, item);
      grupos.set(clave, g);
    }
  }
  const porAnio = (a: Album, b: Album) => (b.anio ?? 0) - (a.anio ?? 0) || a.titulo.localeCompare(b.titulo);
  return [...grupos.entries()]
    .map(([clave, g]): Artista => {
      const ids = new Set(g.pistas.keys());
      const nombres = [...g.nombres.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
      const claves = [...new Set(nombres.map(claveArtista))];
      const suyos = albumes.filter((a) => claves.includes(claveArtista(a.artista)) || a.pistas.every((p) => ids.has(p.id))).sort(porAnio);
      const apareceEn = albumes.filter((a) => !suyos.includes(a) && a.pistas.some((p) => ids.has(p.id))).sort(porAnio);
      const enAlbumes = [...suyos, ...apareceEn].flatMap((a) => a.pistas.filter((p) => ids.has(p.id)));
      const vistas = new Set(enAlbumes.map((p) => p.id));
      const sueltas = ordenarPistas([...g.pistas.values()].filter((p) => !vistas.has(p.id)));
      const pistas = [...enAlbumes, ...sueltas];
      return {
        clave,
        claves,
        nombre: nombres[0],
        // Mayúsculas aparte, «Anri» y «ANRI» son el mismo nombre: solo cuentan los de otra clave.
        alias: nombres.filter((n, i) => claveArtista(n) !== claveArtista(nombres[0]) && nombres.findIndex((m) => claveArtista(m) === claveArtista(n)) === i),
        portada: suyos.find((a) => a.portada)?.portada ?? pistas.find((p) => p.portada)?.portada,
        pistas,
        albumes: suyos,
        apareceEn,
        duracion: pistas.reduce((s, p) => s + (p.duracion ?? 0), 0),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { sensitivity: "base" }));
}

/**
 * Las más escuchadas primero (por veces y luego por la última escucha); las
 * nunca escuchadas, después y en su orden.
 */
export function populares(pistas: Item[], escuchas: { id: string; visto: number; veces?: number }[]) {
  const datos = new Map(escuchas.map((e) => [e.id, e]));
  const veces = (p: Item) => datos.get(p.id)?.veces ?? (datos.has(p.id) ? 1 : 0);
  return pistas
    .map((p, i) => ({ p, i }))
    .sort((a, b) => veces(b.p) - veces(a.p) || (datos.get(b.p.id)?.visto ?? 0) - (datos.get(a.p.id)?.visto ?? 0) || a.i - b.i)
    .map((x) => x.p);
}
