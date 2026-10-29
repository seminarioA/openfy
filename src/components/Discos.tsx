// Piezas de las páginas de Música al estilo Spotify (álbum, artista y
// playlist): carátulas, tarjetas de la rejilla y la cabecera con el color de
// la portada, el botón redondo de reproducir y el menú.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Disc3, ListMusic, Pause, Play, Shuffle, UserRound, type LucideIcon } from "lucide-react";
import type { Item } from "../lib/db";
import { alternar, alternarAleatorio, useReproductor } from "../lib/reproductor";
import { useColorDominante } from "../lib/colores";
import { portadasDe } from "../lib/listas";
import { MenuAcciones, type Accion } from "./MenuAcciones";
import { tocar } from "./Pistas";
import type { Entrada } from "../lib/useMusica";

/** «44 min 51 s», «1 h 12 min», como Spotify. */
export function duracionLarga(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${Math.round(seg % 60)} s`;
}

export function Caratula({ src, tam, redonda, icono: Icono = Disc3 }: { src?: string; tam?: number; redonda?: boolean; icono?: LucideIcon }) {
  const estilo = tam ? { width: tam, height: tam } : undefined;
  const clase = `caratula${redonda ? " redonda" : ""}`;
  return src ? (
    <img className={clase} src={src} alt="" loading="lazy" style={estilo} />
  ) : (
    <span className={`${clase} sin-caratula`} style={estilo} aria-hidden>
      <Icono size={tam ? tam / 3 : 42} />
    </span>
  );
}

/** La portada de una playlist: mosaico de cuatro carátulas, una sola o el icono. */
export function PortadaLista({ pistas, tam }: { pistas: Item[]; tam?: number }) {
  const portadas = portadasDe(pistas);
  if (portadas.length < 4) return <Caratula src={portadas[0]} tam={tam} icono={ListMusic} />;
  return (
    <span className="caratula mosaico" style={tam ? { width: tam, height: tam } : undefined} aria-hidden>
      {portadas.map((src) => (
        <img key={src} src={src} alt="" loading="lazy" />
      ))}
    </span>
  );
}

/** Tarjeta de la rejilla (álbum, artista o playlist): se ilumina y muestra el play. */
export function TarjetaDisco({ href, titulo, detalle, imagen, pistas, redonda }: { href: string; titulo: string; detalle: ReactNode; imagen: ReactNode; pistas: Item[]; redonda?: boolean }) {
  return (
    <div className={`disco${redonda ? " redondo" : ""}`}>
      <div className="disco-tapa">
        <a className="disco-abrir" href={href} tabIndex={-1} aria-hidden>
          {imagen}
        </a>
        {pistas.length ? (
          <button className="disco-play" onClick={() => void tocar(pistas[0], pistas)} aria-label={`Reproducir ${titulo}`}>
            <Play size={20} fill="currentColor" />
          </button>
        ) : null}
      </div>
      <a className="disco-abrir" href={href}>
        <b>{titulo}</b>
      </a>
      <small className="disco-detalle num">{detalle}</small>
    </div>
  );
}

/**
 * Página de un álbum, un artista o una playlist: cabecera con el color de la
 * portada, reproducir, aleatorio, el menú ⋮ y el contenido debajo.
 */
export function PaginaDisco({
  tipo,
  titulo,
  portada,
  imagen,
  detalle,
  descripcion,
  pistas,
  menu,
  etiquetaMenu,
  alEditar,
  children,
}: {
  tipo: string;
  titulo: string;
  /** De ella sale el color de fondo. */
  portada?: string;
  imagen: ReactNode;
  detalle: ReactNode;
  descripcion?: string;
  pistas: Item[];
  menu: Accion[];
  etiquetaMenu: string;
  /** Si se puede editar, pulsar el título lo edita (playlists). */
  alEditar?: () => void;
  children: ReactNode;
}) {
  const color = useColorDominante(portada);
  const rep = useReproductor();
  const suena = !!rep.actual && pistas.some((p) => p.id === rep.actual!.id);
  return (
    <div className="disco-pagina" style={{ "--fondo-album": color } as React.CSSProperties}>
      <div className="disco-cabecera">
        <div className="disco-cabecera-fila">
          {imagen}
          <div>
            <span className="disco-tipo">{tipo}</span>
            <h1>
              {alEditar ? (
                <button className="disco-editar" onClick={alEditar} title="Editar información">
                  {titulo}
                </button>
              ) : (
                titulo
              )}
            </h1>
            {descripcion ? <p className="disco-descripcion">{descripcion}</p> : null}
            <p className="num">{detalle}</p>
          </div>
        </div>
      </div>
      <div className="disco-acciones">
        <button
          className="disco-play-grande"
          disabled={!pistas.length}
          onClick={() => (suena ? alternar() : void tocar(pistas[0], pistas))}
          aria-label={suena && rep.sonando ? "Pausar" : "Reproducir"}
        >
          {suena && rep.sonando ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
        </button>
        <button className={`tira-boton grande${rep.aleatorio ? " activo" : ""}`} onClick={alternarAleatorio} aria-pressed={rep.aleatorio} aria-label="Aleatorio" title="Aleatorio">
          <Shuffle size={26} />
        </button>
        <MenuAcciones alinear="izquierda" etiqueta={etiquetaMenu} acciones={menu} />
      </div>
      <div className="disco-cuerpo">{children}</div>
    </div>
  );
}

/** La portada de una entrada de la biblioteca: mosaico (playlist), carátula (álbum) o foto redonda (artista). */
export function ImagenEntrada({ e, tam }: { e: Entrada; tam?: number }) {
  if (e.tipo === "lista") return <PortadaLista pistas={e.pistas} tam={tam} />;
  return <Caratula src={e.portada} tam={tam} redonda={e.tipo === "artista"} icono={e.tipo === "artista" ? UserRound : Disc3} />;
}

export function TarjetaEntrada({ e, detalle }: { e: Entrada; detalle?: ReactNode }) {
  return <TarjetaDisco href={e.href} titulo={e.titulo} detalle={detalle ?? e.detalle} imagen={<ImagenEntrada e={e} />} pistas={e.pistas} redonda={e.tipo === "artista"} />;
}

/** Acceso rápido del inicio, como los de arriba en Spotify: carátula pequeña, título y play al pasar. */
export function AccesoRapido({ e }: { e: Entrada }) {
  const rep = useReproductor();
  const suena = !!rep.actual && e.pistas.some((p) => p.id === rep.actual!.id);
  return (
    <div className={`sp-rapido${suena ? " suena" : ""}`}>
      <a href={e.href}>
        <ImagenEntrada e={e} tam={56} />
        <b>{e.titulo}</b>
      </a>
      {e.pistas.length ? (
        <button className="sp-rapido-play" onClick={() => (suena ? alternar() : void tocar(e.pistas[0], e.pistas))} aria-label={suena && rep.sonando ? "Pausar" : `Reproducir ${e.titulo}`}>
          {suena && rep.sonando ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Fila horizontal del inicio («Añadidos recientemente», «Tus artistas»…): el
 * título y «Mostrar todo» llevan a la lista entera; las flechas aparecen si
 * hay más de lo que cabe.
 */
export function Carrusel({ titulo, href, children }: { titulo: string; href?: string; children: ReactNode }) {
  const pista = useRef<HTMLDivElement>(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: true });
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const medir = () => setBordes({ inicio: el.scrollLeft <= 2, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      observador.disconnect();
    };
  }, []);
  const desplazar = (sentido: 1 | -1) => pista.current?.scrollBy({ left: sentido * pista.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="sp-fila">
      <header>
        <h2>{href ? <a href={href}>{titulo}</a> : titulo}</h2>
        {href ? (
          <a className="sp-mostrar" href={href}>
            Mostrar todo
          </a>
        ) : null}
      </header>
      <div className="sp-carrusel-marco">
        <div className="sp-carrusel" ref={pista}>
          {children}
        </div>
        {!bordes.inicio ? (
          <button className="sp-flecha izquierda" onClick={() => desplazar(-1)} aria-label="Anteriores">
            <ChevronLeft size={20} />
          </button>
        ) : null}
        {!bordes.fin ? (
          <button className="sp-flecha derecha" onClick={() => desplazar(1)} aria-label="Siguientes">
            <ChevronRight size={20} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
