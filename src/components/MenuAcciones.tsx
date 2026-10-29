// Menú ⋮ de acciones (canciones, álbumes, playlists…): se abre con el botón y se cierra al
// elegir, al pulsar fuera o con Escape.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";

export interface Accion {
  icono: ReactNode;
  texto: string;
  /** Una acción o un enlace (se abre en otra pestaña; con `descarga`, se descarga con ese nombre). */
  hacer?: () => void;
  enlace?: string;
  descarga?: string;
}

export function MenuAcciones({
  acciones,
  etiqueta = "Más acciones",
  alinear = "derecha",
  icono = <EllipsisVertical size={20} />,
}: {
  acciones: Accion[];
  etiqueta?: string;
  alinear?: "derecha" | "izquierda";
  /** Lo que muestra el botón (por defecto, ⋮). */
  icono?: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && setAbierto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  return (
    <div className="ui-opciones" ref={caja}>
      <button className="ui-tres-puntos" aria-label={etiqueta} title={etiqueta} aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {icono}
      </button>
      {abierto ? (
        <div className={`ui-menu${alinear === "derecha" ? " ui-menu-derecha" : ""}`} role="menu">
          {acciones.map((a) =>
            a.enlace ? (
              <a key={a.texto} role="menuitem" href={a.enlace} {...(a.descarga ? { download: a.descarga } : { target: "_blank", rel: "noreferrer" })} onClick={() => setAbierto(false)}>
                {a.icono} {a.texto}
              </a>
            ) : (
              <button
                key={a.texto}
                role="menuitem"
                onClick={() => {
                  a.hacer?.();
                  setAbierto(false);
                }}
              >
                {a.icono} {a.texto}
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
