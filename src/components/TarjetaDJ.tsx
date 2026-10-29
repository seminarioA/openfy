// El DJ en el inicio, como el acceso de Spotify: una tarjeta que lo pone o lo
// para. La primera vez avisa de lo que pesa la voz antes de bajarla.
import { useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { detenerDJ, iniciarDJ, useDJ } from "../lib/dj";
import { prepararVoz, useVoz } from "../lib/voz";
import { BYTES_VOZ, vozGuardada } from "../lib/voz-recursos";
import { alternar } from "../lib/reproductor";
import { avisar, mensajeError } from "../lib/ui";
import { existeArchivo, pedirPersistencia } from "../lib/almacen";
import type { DatosMusica } from "../lib/useMusica";
import { Dialogo } from "./Dialogo";

const MB = Math.round(BYTES_VOZ / 1e6);

export function TarjetaDJ({ datos }: { datos: DatosMusica }) {
  const dj = useDJ();
  const voz = useVoz();
  const [preguntando, setPreguntando] = useState(false);
  const [empezando, setEmpezando] = useState(false);

  const fuente = useMemo(() => {
    const alias = new Map<string, string[]>();
    for (const a of datos.artistas) for (const n of [a.nombre, ...a.alias]) alias.set(n, [a.nombre, ...a.alias]);
    return { pistas: datos.pistas, escuchas: datos.escuchas, aliasDe: (n: string) => alias.get(n) ?? [] };
  }, [datos]);

  const empezar = async (conVoz: boolean) => {
    setPreguntando(false);
    setEmpezando(true);
    try {
      // Solo lo que sigue en este dispositivo: el navegador puede haber liberado espacio.
      const presentes = (await Promise.all(fuente.pistas.map(async (p) => (p.archivo && (await existeArchivo(p.archivo)) ? p : null)))).filter((p) => p !== null);
      if (!presentes.length) throw new Error("Tu música ya no está en este dispositivo. Vuelve a añadirla para que el DJ la ponga.");
      if (conVoz) {
        // Que el navegador no borre la voz (ni tu música) cuando ande corto de espacio.
        await pedirPersistencia();
        await prepararVoz().catch(() => avisar("No se pudo preparar la voz. El DJ sigue sin voz."));
      }
      await iniciarDJ({ ...fuente, pistas: presentes }, { conVoz });
    } catch (e) {
      avisar(mensajeError(e));
    } finally {
      setEmpezando(false);
    }
  };

  const pulsar = async () => {
    if (dj.activo) return alternar();
    if (voz.estado === "lista" || (await vozGuardada())) return empezar(true);
    setPreguntando(true);
  };

  const preparando = voz.estado === "preparando";
  const detalle = preparando ? `Preparando la voz… ${Math.round(voz.fraccion * 100)} %` : dj.activo ? "Sonando" : "Tu música, presentada para ti";

  return (
    <>
      <div className={`sp-rapido sp-dj${dj.activo ? " suena" : ""}`}>
        <button className="sp-dj-abrir" onClick={() => void pulsar()} disabled={empezando}>
          <span className="sp-dj-marca" aria-hidden>
            DJ
          </span>
          <span className="sp-dj-texto">
            <b>DJ</b>
            <small>{detalle}</small>
          </span>
        </button>
        {dj.activo ? (
          <button className="sp-rapido-play" onClick={() => detenerDJ()} aria-label="Parar el DJ" title="Parar el DJ">
            <Pause size={16} fill="currentColor" />
          </button>
        ) : (
          <button className="sp-rapido-play" onClick={() => void pulsar()} disabled={empezando} aria-label="Poner el DJ">
            <Play size={16} fill="currentColor" />
          </button>
        )}
      </div>
      <Dialogo abierto={preguntando} alCerrar={() => setPreguntando(false)} titulo="La voz del DJ">
        <p className="texto-2">
          Para hablar, el DJ necesita su voz: se descarga una sola vez ({MB} MB) y después funciona sin conexión.
        </p>
        <div className="dialogo-acciones">
          <button className="boton" onClick={() => void empezar(false)}>
            Sin voz
          </button>
          <button className="boton tinta" onClick={() => void empezar(true)}>
            Descargar y empezar
          </button>
        </div>
      </Dialogo>
    </>
  );
}

/** Lo que dice el DJ, escrito sobre la barra del reproductor mientras habla. */
export function SubtitulosDJ() {
  const dj = useDJ();
  if (!dj.activo || !dj.frase) return null;
  return (
    <div className="dj-subtitulos" role="status" aria-live="polite">
      <span className="sp-dj-marca" aria-hidden>
        DJ
      </span>
      <p>{dj.frase}</p>
    </div>
  );
}
