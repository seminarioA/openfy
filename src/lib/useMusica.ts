// Todo lo que muestra Música, calculado una vez para la biblioteca, el inicio
// y las páginas: pistas, playlists, álbumes, artistas y lo escuchado.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Item, type Lista } from "./db";
import { agruparAlbumes, agruparArtistas, canciones, claveArtista } from "./musica";
import { pistasDe } from "./listas";
import { useHistorial, type Visto } from "./historial";
import { enlaceDentro } from "./ui";

/** Una fila de «Tu biblioteca»: una playlist, un álbum o un artista. */
export interface Entrada {
  tipo: "lista" | "album" | "artista";
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  portada?: string;
  pistas: Item[];
  /** Última vez que sonó algo suyo (0 si nunca). */
  escuchado: number;
  /** Para ordenar por «Recientes»: lo último que sonó o, si no, cuándo se añadió. */
  reciente: number;
}

const SIN_PISTAS: Item[] = [];
const SIN_LISTAS: Lista[] = [];

export function useMusica() {
  const pistas = useLiveQuery(() => db.items.where("tipo").equals("audio").reverse().sortBy("creado"), [], SIN_PISTAS);
  const listas = useLiveQuery(() => db.listas.orderBy("actualizada").reverse().toArray(), [], SIN_LISTAS);
  const { lista: historial } = useHistorial();
  return useMemo(() => {
    const porId = new Map(pistas.map((p) => [p.id, p]));
    const { albumes, sueltas } = agruparAlbumes(pistas);
    const artistas = agruparArtistas(pistas, albumes);
    const nombres = new Map(artistas.flatMap((a) => a.claves.map((c) => [c, a.nombre] as const)));
    /** El nombre unificado de un artista (p. ej. «Miki Matsubara» → «松原みき»). */
    const nombreDe = (n: string) => nombres.get(claveArtista(n)) ?? n;
    const escuchas = new Map<string, Visto>(historial.map((v) => [v.id, v]));
    const ultima = (ps: Item[]) => ps.reduce((m, p) => Math.max(m, escuchas.get(p.id)?.visto ?? 0), 0);

    const entradas: Entrada[] = [
      ...listas.map((l): Entrada => {
        const ps = pistasDe(l, porId).map((x) => x.item);
        const e = ultima(ps);
        return { tipo: "lista", id: l.id, titulo: l.nombre, detalle: `Playlist · ${canciones(ps.length)}`, href: enlaceDentro("musica", { lista: l.id }), pistas: ps, escuchado: e, reciente: Math.max(e, l.actualizada) };
      }),
      ...albumes.map((a): Entrada => {
        const e = ultima(a.pistas);
        return { tipo: "album", id: a.clave, titulo: a.titulo, detalle: `Álbum · ${nombreDe(a.artista)}`, href: enlaceDentro("musica", { album: a.clave }), portada: a.portada, pistas: a.pistas, escuchado: e, reciente: Math.max(e, a.anadido) };
      }),
      ...artistas.map((a): Entrada => {
        const e = ultima(a.pistas);
        return { tipo: "artista", id: a.clave, titulo: a.nombre, detalle: "Artista", href: enlaceDentro("musica", { artista: a.clave }), portada: a.portada, pistas: a.pistas, escuchado: e, reciente: e };
      }),
    ].sort((x, y) => y.reciente - x.reciente);

    return { pistas, listas, porId, albumes, sueltas, artistas, nombreDe, escuchas, entradas };
  }, [pistas, listas, historial]);
}

export type DatosMusica = ReturnType<typeof useMusica>;
