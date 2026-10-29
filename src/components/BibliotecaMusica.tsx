// «Tu biblioteca», el panel izquierdo de Música como en Spotify: playlists,
// álbumes y artistas por lo último que sonó, con filtros, búsqueda y «+» para
// crear una playlist o añadir audio. En el móvil se abre como una pestaña.
import { useState } from "react";
import { Plus, Search, Upload, Volume2, X } from "lucide-react";
import type { Entrada } from "../lib/useMusica";
import { crearLista } from "../lib/listas";
import { useReproductor } from "../lib/reproductor";
import { irDentro } from "../lib/ui";
import { MenuAcciones } from "./MenuAcciones";
import { ImagenEntrada } from "./Discos";

const FILTROS = [
  { id: "lista", nombre: "Playlists" },
  { id: "album", nombre: "Álbumes" },
  { id: "artista", nombre: "Artistas" },
] as const;

export async function nuevaPlaylist() {
  const l = await crearLista();
  irDentro("musica", { lista: l.id });
}

export function BibliotecaMusica({ entradas, alImportar, comoPagina }: { entradas: Entrada[]; alImportar: () => void; comoPagina?: boolean }) {
  const rep = useReproductor();
  const [filtro, setFiltro] = useState<Entrada["tipo"] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const visibles = entradas.filter((e) => (!filtro || e.tipo === filtro) && (!t || `${e.titulo} ${e.detalle}`.toLowerCase().includes(t)));
  const hayListas = entradas.some((e) => e.tipo === "lista");
  const hayMusica = entradas.some((e) => e.tipo !== "lista");

  return (
    <aside className={`sp-biblioteca${comoPagina ? " como-pagina" : ""}`} aria-label="Tu biblioteca">
      <header>
        <h2>Tu biblioteca</h2>
        <MenuAcciones
          etiqueta="Crear"
          icono={<Plus size={20} />}
          acciones={[
            { icono: <Plus size={20} />, texto: "Crear playlist", hacer: () => void nuevaPlaylist() },
            { icono: <Upload size={20} />, texto: "Añadir audio (MP3, FLAC, ZIP, RAR…)", hacer: alImportar },
          ]}
        />
      </header>
      {entradas.length ? (
        <div className="sp-biblioteca-filtros">
          <div className="ui-chips" role="group" aria-label="Filtrar la biblioteca">
            {filtro ? (
              <button className="ui-chip sp-chip-quitar" onClick={() => setFiltro(null)} aria-label="Quitar el filtro">
                <X size={16} />
              </button>
            ) : null}
            {FILTROS.filter((f) => !filtro || f.id === filtro).map((f) => (
              <button key={f.id} className="ui-chip" aria-pressed={filtro === f.id} onClick={() => setFiltro(filtro === f.id ? null : f.id)}>
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {entradas.length ? (
        <div className="sp-biblioteca-orden">
          {buscando ? (
            <label className="sp-biblioteca-buscar">
              <Search size={16} />
              <span className="oculto-visual">Buscar en tu biblioteca</span>
              <input autoFocus placeholder="Buscar en tu biblioteca" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setBuscando(false)} />
            </label>
          ) : (
            <button className="tira-boton" onClick={() => setBuscando(true)} aria-label="Buscar en tu biblioteca" title="Buscar en tu biblioteca">
              <Search size={18} />
            </button>
          )}
          <span className="texto-2">Recientes</span>
        </div>
      ) : null}
      <div className="sp-biblioteca-cuerpo">
        {!hayListas && !t && (!filtro || filtro === "lista") ? (
          <div className="sp-invitacion">
            <b>Crea tu primera playlist</b>
            <span>Es fácil, te ayudamos.</span>
            <button className="sp-pildora" onClick={() => void nuevaPlaylist()}>
              Crear playlist
            </button>
          </div>
        ) : null}
        {!hayMusica && !t ? (
          <div className="sp-invitacion">
            <b>Añade tu música</b>
            <span>MP3, M4A, FLAC u OGG, o un ZIP o RAR con un álbum entero.</span>
            <button className="sp-pildora" onClick={alImportar}>
              Añadir audio
            </button>
          </div>
        ) : null}
        <ul className="sp-entradas">
          {visibles.map((e) => {
            const suena = !!rep.actual && e.pistas.some((p) => p.id === rep.actual!.id);
            return (
              <li key={`${e.tipo}-${e.id}`}>
                <a className={`sp-entrada${suena ? " suena" : ""}`} href={e.href}>
                  <ImagenEntrada e={e} tam={48} />
                  <span>
                    <b>{e.titulo}</b>
                    <small>{e.detalle}</small>
                  </span>
                  {suena && rep.sonando ? <Volume2 size={16} aria-label="Sonando" /> : null}
                </a>
              </li>
            );
          })}
        </ul>
        {t && !visibles.length ? <p className="texto-3 sp-nada">Nada en tu biblioteca coincide con «{q}».</p> : null}
      </div>
    </aside>
  );
}
