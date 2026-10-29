import { useCallback, useEffect, useRef, useState } from "react";
import { importarLote } from "./lib/importar";
import { pedirPersistencia } from "./lib/almacen";
import { avisar, cerrarAviso, useAviso, usePanel } from "./lib/ui";
import { VistaMusica } from "./vistas/Musica";
import { Tira } from "./components/Tira";
import { PanelReproductor } from "./components/PanelReproductor";
import { VistaLetra } from "./components/VistaLetra";
import { SelectorLista } from "./components/SelectorLista";
import { atajoBuscar, BarraSuperior } from "./components/BarraSuperior";
import { SubtitulosDJ } from "./components/TarjetaDJ";

export default function App() {
  const [soltando, setSoltando] = useState(false);
  const panelAbierto = !!usePanel();
  const selector = useRef<HTMLInputElement>(null);
  const aviso = useAviso();

  useEffect(() => {
    void pedirPersistencia();
    window.addEventListener("keydown", atajoBuscar);
    return () => window.removeEventListener("keydown", atajoBuscar);
  }, []);

  // Botón y arrastrar pasan por el mismo lote: audios sueltos, ZIP o RAR, y sus .lrc.
  const importar = useCallback(async (archivos: FileList | File[]) => {
    const { guardados, errores } = await importarLote([...archivos], (texto) => avisar(texto, 120000));
    const hechos = guardados.length;
    const resumen = hechos === 1 ? "1 canción guardada en este dispositivo." : `${hechos} canciones guardadas en este dispositivo.`;
    if (errores.length) avisar(`${hechos ? `${resumen} ` : ""}${errores.length === 1 ? errores[0] : `${errores.length} no se pudieron guardar: ${errores[0]}`}`, 8000);
    else if (hechos) avisar(resumen);
  }, []);

  return (
    <div
      className={`marco${soltando ? " zona-soltar" : ""}${panelAbierto ? " con-panel" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setSoltando(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setSoltando(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setSoltando(false);
        if (e.dataTransfer.files.length) void importar(e.dataTransfer.files);
      }}
    >
      <BarraSuperior alImportar={() => selector.current?.click()} />
      <main className="escritorio">
        <div className="cajon cajon-musica">
          <VistaMusica alImportar={() => selector.current?.click()} />
        </div>
      </main>

      <input
        ref={selector}
        id="selector-archivos"
        type="file"
        multiple
        hidden
        accept="audio/*,.flac,.opus,.lrc,.zip,application/zip,.rar,application/vnd.rar"
        onChange={(e) => {
          if (e.target.files?.length) void importar(e.target.files);
          e.target.value = "";
        }}
      />

      <PanelReproductor />
      <VistaLetra />
      <SelectorLista />
      <SubtitulosDJ />
      <Tira />

      {aviso ? (
        <div className="toast" role="status" key={aviso.id}>
          {aviso.texto}
          {aviso.accion ? (
            <button
              className="toast-accion"
              onClick={() => {
                aviso.accion!.hacer();
                cerrarAviso();
              }}
            >
              {aviso.accion.texto}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
