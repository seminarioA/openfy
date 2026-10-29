// Barra del reproductor, como la de Spotify: a la izquierda lo que suena; en el
// centro aleatorio, anterior, reproducir, siguiente y repetir sobre la barra de
// progreso; a la derecha letra, fila, ecualizador, historial y volumen.
import { useEffect } from "react";
import {
  History,
  ListMusic,
  MicVocal,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersVertical,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { alternar, alternarAleatorio, alternarSilencio, anterior, cambiarRepetir, cambiarVolumen, detener, irA, siguiente, useReproductor } from "../lib/reproductor";
import { claveAlbum, datosMusica } from "../lib/musica";
import { duracion } from "../lib/formato";
import { useLetraDe } from "../lib/letras";
import { abrirLetra, abrirPanel, cerrarLetra, cerrarPanel, irDentro, useLetra, usePanel, type PestanaPanel } from "../lib/ui";
import { Miniatura } from "./Portada";
import { EnlacesArtistas } from "./Pistas";

/** Barra de rango con la parte recorrida coloreada (vía --avance). */
function Barra({ valor, max, alCambiar, etiqueta, clase }: { valor: number; max: number; alCambiar: (v: number) => void; etiqueta: string; clase: string }) {
  const avance = max ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <input
      className={`barra-rep ${clase}`}
      type="range"
      min={0}
      max={max || 1}
      step="any"
      value={Math.min(valor, max || 1)}
      onChange={(e) => alCambiar(Number(e.target.value))}
      aria-label={etiqueta}
      style={{ "--avance": `${avance}%` } as React.CSSProperties}
    />
  );
}

export function Tira() {
  const r = useReproductor();
  const panel = usePanel();
  const letra = useLetra();
  const estadoLetra = useLetraDe(r.actual);
  const visible = !!r.actual;
  useEffect(() => {
    document.documentElement.style.setProperty("--tira", visible ? "var(--alto-tira)" : "0px");
  }, [visible]);
  if (!r.actual) return null;

  const item = r.actual;
  const total = r.duracion || item.duracion || 0;
  const album = claveAlbum(item);
  const artista = item.autores?.join(", ") || datosMusica(item).album || "";
  // Cada botón abre su pestaña del panel; pulsar la que ya está abierta lo cierra.
  const botonPanel = (p: PestanaPanel, nombre: string, Icono: typeof History, clase = "solo-ancho") => (
    <button className={`tira-boton ${clase}`} onClick={() => (panel?.pestana === p ? cerrarPanel() : abrirPanel(p))} aria-label={nombre} title={nombre} aria-pressed={panel?.pestana === p}>
      <Icono size={18} />
    </button>
  );
  const IconoVolumen = r.silencio || r.volumen === 0 ? VolumeX : r.volumen < 0.5 ? Volume1 : Volume2;

  return (
    <div className="tira" role="region" aria-label="Reproductor">
      <div className="tira-tema">
        <Miniatura item={item} tamano={56} />
        <div>
          <button className="tira-titulo" onClick={() => album && irDentro("musica", { album })} disabled={!album} title={album ? "Ir al álbum" : undefined}>
            {item.titulo}
          </button>
          <small>{item.autores?.length ? <EnlacesArtistas nombres={item.autores} /> : artista}</small>
        </div>
      </div>

      <div className="tira-centro">
        <div className="tira-mandos">
          <button className={`tira-boton solo-ancho${r.aleatorio ? " activo" : ""}`} onClick={alternarAleatorio} aria-pressed={r.aleatorio} aria-label="Aleatorio" title="Aleatorio">
            <Shuffle size={18} />
          </button>
          <button className="tira-boton solo-ancho" onClick={() => void anterior()} aria-label="Anterior" title="Anterior">
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button className="tira-play" onClick={alternar} aria-label={r.sonando ? "Pausar" : "Reproducir"}>
            {r.sonando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button className="tira-boton" onClick={() => void siguiente()} aria-label="Siguiente" title="Siguiente">
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className={`tira-boton solo-ancho${r.repetir !== "no" ? " activo" : ""}`}
            onClick={cambiarRepetir}
            aria-label={r.repetir === "una" ? "Repetir una" : r.repetir === "todo" ? "Repetir todo" : "No repetir"}
            title={r.repetir === "una" ? "Repetir esta canción" : r.repetir === "todo" ? "Repetir todo" : "Repetir"}
          >
            {r.repetir === "una" ? <Repeat1 size={18} /> : <Repeat size={18} />}
          </button>
        </div>
        <div className="tira-progreso">
          <span className="num">{duracion(r.tiempo)}</span>
          <Barra clase="progreso-rep" valor={r.tiempo} max={total} alCambiar={irA} etiqueta="Posición" />
          <span className="num">{duracion(total)}</span>
        </div>
      </div>

      <div className="tira-derecha">
        <button
          className={`tira-boton${letra ? " activo" : ""}`}
          onClick={() => (letra ? cerrarLetra() : abrirLetra())}
          disabled={!letra && estadoLetra?.estado !== "lista"}
          aria-pressed={!!letra}
          aria-label="Letra"
          title={estadoLetra?.estado === "lista" ? "Letra" : estadoLetra?.estado === "buscando" ? "Buscando la letra…" : estadoLetra?.estado === "error" ? "La letra no está disponible ahora" : "Esta canción no tiene letra"}
        >
          <MicVocal size={18} />
        </button>
        {botonPanel("fila", "A continuación", ListMusic, "")}
        {botonPanel("ecualizador", "Ecualizador", SlidersVertical)}
        {botonPanel("historial", "Historial de música", History)}
        <div className="tira-volumen solo-ancho">
          <button className="tira-boton" onClick={alternarSilencio} aria-label={r.silencio ? "Activar sonido" : "Silenciar"} title={r.silencio ? "Activar sonido" : "Silenciar"}>
            <IconoVolumen size={18} />
          </button>
          <Barra clase="volumen-rep" valor={r.silencio ? 0 : r.volumen} max={1} alCambiar={cambiarVolumen} etiqueta="Volumen" />
        </div>
        <button className="tira-boton solo-ancho" onClick={detener} aria-label="Cerrar reproductor" title="Cerrar reproductor">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
