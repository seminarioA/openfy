// Panel lateral del reproductor de música, acoplado a la derecha como en
// Spotify: lo que suena a continuación, el ecualizador y el historial. La letra
// va aparte, en el área principal (VistaLetra).
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { History, ListMusic, SlidersVertical, Trash2, X } from "lucide-react";
import { db } from "../lib/db";
import { aContinuacion, quitarDeLaFila, saltarA, useReproductor, vaciarLaFila } from "../lib/reproductor";
import { datosMusica } from "../lib/musica";
import { activarEcualizador, aplicarPreset, BANDAS, cambiarBanda, cambiarPreamp, LIMITE_DB, PRESETS, useEcualizador } from "../lib/ecualizador";
import { abrirPanel, cerrarPanel, usePanel, type PestanaPanel } from "../lib/ui";
import { FilaPista, HistorialMusica } from "./Pistas";

const PESTANAS: { id: PestanaPanel; nombre: string; icono: typeof ListMusic }[] = [
  { id: "fila", nombre: "A continuación", icono: ListMusic },
  { id: "ecualizador", nombre: "Ecualizador", icono: SlidersVertical },
  { id: "historial", nombre: "Historial", icono: History },
];

function ACont() {
  const rep = useReproductor();
  const { fila, contexto } = aContinuacion(rep);
  const album = contexto.length && contexto.every((p) => datosMusica(p).album === datosMusica(contexto[0]).album) ? datosMusica(contexto[0]).album : undefined;
  if (!rep.actual) return <p className="texto-3">No suena nada. Pon una canción, o agrégala a la fila desde su menú ⋮.</p>;
  return (
    <div className="panel-secciones">
      <section>
        <h3>Sonando</h3>
        <div className="temas" role="table">
          <FilaPista p={rep.actual} numero={1} cola={rep.cola} conAlbum />
        </div>
      </section>
      {fila.length ? (
        <section>
          <header>
            <h3>En tu fila</h3>
            <button className="boton plano" onClick={vaciarLaFila}>
              <Trash2 size={16} /> Vaciar
            </button>
          </header>
          <div className="temas" role="table">
            {fila.map((p, i) => (
              <FilaPista key={`${p.id}-${i}`} p={p} numero={i + 1} cola={rep.cola} conAlbum alQuitar={() => quitarDeLaFila(i)} alReproducir={() => void saltarA("fila", i)} />
            ))}
          </div>
        </section>
      ) : null}
      {contexto.length ? (
        <section>
          <h3>{album ? `Después, de «${album}»` : "Después"}</h3>
          <div className="temas" role="table">
            {contexto.map((p, i) => (
              <FilaPista key={`${p.id}-${i}`} p={p} numero={i + 1} cola={rep.cola} conAlbum alReproducir={() => void saltarA("contexto", i)} />
            ))}
          </div>
        </section>
      ) : fila.length ? null : (
        <p className="texto-3">No hay nada más en la fila.</p>
      )}
    </div>
  );
}

function PanelEcualizador() {
  const eq = useEcualizador();
  const etiqueta = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f));
  return (
    <div className="panel-eq">
      <label className="interruptor">
        <input type="checkbox" checked={eq.activo} onChange={(e) => activarEcualizador(e.target.checked)} />
        <span>{eq.activo ? "Ecualizador activado" : "Ecualizador desactivado"}</span>
      </label>
      <div className="ui-chips" role="group" aria-label="Presets">
        {Object.keys(PRESETS).map((nombre) => (
          <button key={nombre} className="ui-chip" aria-pressed={eq.preset === nombre} onClick={() => aplicarPreset(nombre)} disabled={!eq.activo}>
            {nombre}
          </button>
        ))}
      </div>
      <div className={`eq-bandas${eq.activo ? "" : " apagado"}`}>
        <div className="eq-banda preamp">
          <span className="num">{eq.preamp > 0 ? `+${eq.preamp}` : eq.preamp}</span>
          <input type="range" min={-LIMITE_DB} max={LIMITE_DB} step={1} value={eq.preamp} onChange={(e) => cambiarPreamp(Number(e.target.value))} aria-label="Preamplificación" disabled={!eq.activo} />
          <small>Pre</small>
        </div>
        {BANDAS.map((f, i) => (
          <div key={f} className="eq-banda">
            <span className="num">{eq.ganancias[i] > 0 ? `+${eq.ganancias[i]}` : eq.ganancias[i]}</span>
            <input type="range" min={-LIMITE_DB} max={LIMITE_DB} step={1} value={eq.ganancias[i]} onChange={(e) => cambiarBanda(i, Number(e.target.value))} aria-label={`${etiqueta(f)} Hz`} disabled={!eq.activo} />
            <small className="num">{etiqueta(f)}</small>
          </div>
        ))}
      </div>
      <small className="texto-3">dB por banda, de graves a agudos. Si suena saturado, baja «Pre».</small>
    </div>
  );
}

export function PanelReproductor() {
  const panel = usePanel();
  const pistas = useLiveQuery(() => db.items.where("tipo").equals("audio").toArray(), [], []);
  useEffect(() => {
    if (!panel) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrarPanel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [panel]);
  if (!panel) return null;
  return (
    <aside className="panel-rep" aria-label="Reproductor de música">
      <header>
        <nav className="ui-pestanas" role="tablist">
          {PESTANAS.map((p) => (
            <button key={p.id} role="tab" aria-selected={panel.pestana === p.id} onClick={() => abrirPanel(p.id)}>
              <p.icono size={16} aria-hidden /> {p.nombre}
            </button>
          ))}
        </nav>
        <button className="ui-boton-icono" onClick={cerrarPanel} aria-label="Cerrar el panel">
          <X size={20} />
        </button>
      </header>
      <div className="panel-cuerpo">
        {panel.pestana === "fila" ? (
          <ACont />
        ) : panel.pestana === "ecualizador" ? (
          <PanelEcualizador />
        ) : (
          <HistorialMusica pistas={pistas} />
        )}
      </div>
    </aside>
  );
}
