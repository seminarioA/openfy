// Ventana modal con <dialog> nativo: atrapa el foco, se cierra con Escape y al
// pulsar fuera, y devuelve el foco a quien la abrió.
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialogo({ abierto, alCerrar, titulo, children, ancho = 440 }: { abierto: boolean; alCerrar: () => void; titulo: string; children: ReactNode; ancho?: number }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      // showModal enfoca el primer botón (cerrar); si hay un campo, se empieza por él.
      d.querySelector<HTMLElement>("input, textarea, select")?.focus();
    } else if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      className="dialogo"
      style={{ width: `min(${ancho}px, calc(100vw - 32px))` }}
      aria-label={titulo}
      onClose={() => abierto && alCerrar()}
      // Un clic en el fondo llega al propio <dialog>; dentro, al contenido.
      onClick={(e) => e.target === e.currentTarget && alCerrar()}
    >
      {abierto ? (
        <div className="dialogo-cuerpo">
          <header>
            <h2>{titulo}</h2>
            <button className="ui-boton-icono" onClick={alCerrar} aria-label="Cerrar">
              <X size={20} />
            </button>
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
