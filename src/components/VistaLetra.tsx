// La letra en el área principal, como en Spotify: fondo del color de la
// carátula, líneas grandes, la que suena en blanco y las que vienen atenuadas.
// Pulsar una línea salta a ese momento.
import { useEffect, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { X } from "lucide-react";
import { db } from "../lib/db";
import { irA, useReproductor } from "../lib/reproductor";
import { lineaActual, useLetraDe } from "../lib/letras";
import { datosMusica } from "../lib/musica";
import { useColorDominante } from "../lib/colores";
import { avisar, cerrarLetra, useLetra } from "../lib/ui";

export function VistaLetra() {
  const abierta = useLetra();
  const rep = useReproductor();
  const pedida = useLiveQuery(
    () => (abierta?.itemId ? db.items.get(abierta.itemId) : undefined),
    [abierta?.itemId],
  );
  const item = abierta?.itemId ? pedida : rep.actual;
  const fondo = useColorDominante(item?.portada, 140);
  const estado = useLetraDe(abierta ? item : null);
  const letra = estado?.estado === "lista" ? estado.letra : undefined;
  const lista = useRef<HTMLOListElement>(null);
  const suena = !!item && rep.actual?.id === item.id;

  useEffect(() => {
    if (!abierta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && cerrarLetra();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [abierta]);

  // Sin letra no hay tarjeta: si la canción (p. ej. la siguiente) no tiene, se cierra y se avisa.
  useEffect(() => {
    if (!abierta || !item || !estado) return;
    if (estado.estado === "ninguna" || estado.estado === "error") {
      cerrarLetra();
      avisar(
        estado.estado === "error"
          ? "La letra no está disponible ahora. Prueba más tarde."
          : `«${item.titulo}» no tiene letra.`,
      );
    }
  }, [abierta, item, estado]);

  const activa = useMemo(
    () => (letra?.lineas && suena ? lineaActual(letra.lineas, rep.tiempo) : -1),
    [letra, suena, rep.tiempo],
  );
  useEffect(() => {
    lista.current
      ?.querySelector<HTMLElement>(`[data-i="${activa}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activa]);

  if (!abierta) return null;
  const artista = [
    item?.autores?.join(", "),
    item ? datosMusica(item).album : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      className="vista-letra"
      style={{ "--fondo-letra": fondo } as React.CSSProperties}
      aria-label="Letra"
    >
      <div className="letra-hoja">
        <header>
          <div>
            <b>{item?.titulo ?? "Letra"}</b>
            {artista ? <small>{artista}</small> : null}
          </div>
          <button
            className="letra-cerrar"
            onClick={cerrarLetra}
            aria-label="Cerrar la letra"
          >
            <X size={22} />
          </button>
        </header>
        <div className="letra-cuerpo">
          {!item ? (
            <p className="letra-aviso">
              No suena nada. Pon una canción para ver su letra.
            </p>
          ) : !letra ? (
            <p className="letra-aviso">Buscando la letra…</p>
          ) : letra?.instrumental ? (
            <p className="letra-aviso">Instrumental</p>
          ) : letra?.lineas?.length ? (
            <ol ref={lista} className={`letra-lineas${suena ? "" : " quieta"}`}>
              {letra.lineas.map((l, i) => (
                <li
                  key={i}
                  data-i={i}
                  className={
                    i === activa ? "activa" : i < activa ? "pasada" : undefined
                  }
                >
                  <button onClick={() => suena && irA(l.t)} disabled={!suena}>
                    {l.texto || "♪"}
                  </button>
                </li>
              ))}
            </ol>
          ) : letra?.texto ? (
            <>
              <small className="letra-nota">
                Esta letra no está sincronizada con la canción.
              </small>
              <p className="letra-plana">{letra.texto}</p>
            </>
          ) : null}
          {letra ? (
            <small className="letra-fuente">
              {letra.fuente === "lrclib"
                ? "Letra de LRCLIB (lrclib.net), guardada para verla sin conexión."
                : letra.fuente === "lrc"
                  ? "Letra del archivo .lrc del álbum."
                  : "Letra incluida en el archivo."}
            </small>
          ) : null}
        </div>
      </div>
    </section>
  );
}
