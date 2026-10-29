// La barra de arriba, como la de Spotify: el logo, el botón de inicio, el
// buscador «¿Qué quieres escuchar?», «Añadir audio» y tu foto de perfil.
import { useRef } from "react";
import { House, ImageUp, Search, Trash2, Upload, UserRound, X } from "lucide-react";
import { reducirImagen } from "../lib/importar";
import { fijarFoto, useFotoPerfil } from "../lib/perfil";
import { avisar, buscar, irDentro, useBusqueda, useParametros } from "../lib/ui";
import { MenuAcciones } from "./MenuAcciones";

export function BarraSuperior({ alImportar }: { alImportar: () => void }) {
  const q = useBusqueda();
  const parametros = useParametros();
  const enInicio = !parametros.get("album") && !parametros.get("artista") && !parametros.get("lista") && !parametros.get("ver");
  const foto = useFotoPerfil();
  const selector = useRef<HTMLInputElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  return (
    <header className="barra-superior">
      <a className="barra-logo" href="#musica" aria-label="Openfy, inicio" onClick={() => buscar("")}>
        <img src="./icono.png" alt="" width={32} height={32} />
      </a>
      <div className="barra-centro">
        <button
          className="barra-inicio"
          aria-label="Inicio"
          title="Inicio"
          aria-current={enInicio && !q ? "page" : undefined}
          onClick={() => {
            buscar("");
            irDentro("musica");
          }}
        >
          <House size={24} fill={enInicio && !q ? "currentColor" : "none"} />
        </button>
        <label className="sp-buscar barra-buscar">
          <Search size={22} />
          <span className="oculto-visual">Buscar en tu música</span>
          <input
            ref={campo}
            id="buscar-musica"
            placeholder="¿Qué quieres escuchar?"
            value={q}
            onChange={(e) => buscar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") buscar("");
            }}
          />
          {q ? (
            <button
              className="tira-boton"
              onClick={() => {
                buscar("");
                campo.current?.focus();
              }}
              aria-label="Borrar la búsqueda"
            >
              <X size={18} />
            </button>
          ) : null}
        </label>
      </div>
      <div className="barra-derecha">
        <button className="barra-anadir" onClick={alImportar} title="MP3, M4A, FLAC, OGG, o un ZIP o RAR con un álbum">
          <Upload size={18} /> <span className="texto-boton">Añadir audio</span>
        </button>
        <div className="foto-perfil">
          <MenuAcciones
            etiqueta="Tu perfil"
            icono={foto ? <img src={foto} alt="" /> : <UserRound size={20} />}
            acciones={[
              { icono: <ImageUp size={20} />, texto: foto ? "Cambiar foto de perfil" : "Poner foto de perfil", hacer: () => selector.current?.click() },
              ...(foto ? [{ icono: <Trash2 size={20} />, texto: "Quitar foto", hacer: () => fijarFoto(undefined) }] : []),
            ]}
          />
          <input
            ref={selector}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const archivo = e.target.files?.[0];
              e.target.value = "";
              if (!archivo) return;
              // Reducida; el círculo la recorta centrada (object-fit: cover), sin deformarla.
              const datos = await reducirImagen(archivo, 256);
              if (datos) fijarFoto(datos);
              else avisar("No se pudo leer esa imagen.");
            }}
          />
        </div>
      </div>
    </header>
  );
}

// Para que «/» enfoque el buscador, como en Spotify (Ctrl+K también).
export function atajoBuscar(e: KeyboardEvent) {
  const objetivo = e.target as HTMLElement | null;
  if (objetivo?.closest("input, textarea, [contenteditable]")) return;
  if (e.key === "/" || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    document.getElementById("buscar-musica")?.focus();
  }
}
