// Piezas de la música que comparten la vista Música y el panel del reproductor:
// la fila de una pista con su menú, una lista de pistas y el historial.
import { Fragment, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { Clock3, Disc3, ListEnd, ListPlus, MicVocal, Pause, Play, Plus, Trash2, UserRound, X } from "lucide-react";
import type { Item } from "../lib/db";
import { agregarALaFila, alternar, reproducir, reproducirDespues, useReproductor } from "../lib/reproductor";
import { claveAlbum, claveArtista, datosMusica, esArtista } from "../lib/musica";
import { agruparPorDia, duracion, hora } from "../lib/formato";
import { borrarHistorial, pausarHistorial, quitarDelHistorial, useHistorial } from "../lib/historial";
import { abrirLetra, abrirSelectorLista, avisar, enlaceDentro, irDentro, mensajeError } from "../lib/ui";
import { pedirLetra } from "../lib/letras";
import { MenuAcciones, type Accion } from "./MenuAcciones";
import { Miniatura } from "./Portada";

/** Reproduce `p` con `cola` como contexto; si ya suena, pausa o sigue. */
export async function tocar(p: Item, cola: Item[], actual?: Item | null) {
  try {
    if (actual?.id === p.id) alternar();
    else await reproducir(p, cola);
  } catch (e) {
    avisar(mensajeError(e));
  }
}

export const enlaceArtista = (nombre: string) => enlaceDentro("musica", { artista: claveArtista(nombre) });

/** Los artistas separados por comas; cada uno lleva a su página. */
export function EnlacesArtistas({ nombres }: { nombres: string[] }) {
  return (
    <>
      {nombres.map((n, i) => (
        <Fragment key={`${n}-${i}`}>
          {i ? ", " : ""}
          {esArtista(n) ? (
            <a className="enlace-musica" href={enlaceArtista(n)}>
              {n}
            </a>
          ) : (
            n
          )}
        </Fragment>
      ))}
    </>
  );
}

/** El álbum de una pista, con enlace si está agrupado. */
export function EnlaceAlbum({ p }: { p: Item }) {
  const album = datosMusica(p).album;
  const clave = claveAlbum(p);
  if (!album) return null;
  return clave ? (
    <a className="enlace-musica" href={enlaceDentro("musica", { album: clave })}>
      {album}
    </a>
  ) : (
    <>{album}</>
  );
}

/** «Artista, Artista · Álbum», con enlaces, como bajo cada canción en Spotify. */
export function Creditos({ p, conAlbum }: { p: Item; conAlbum?: boolean }) {
  const album = conAlbum && datosMusica(p).album;
  return (
    <>
      {p.autores?.length ? <EnlacesArtistas nombres={p.autores} /> : "Sin artista"}
      {album ? (
        <>
          {" · "}
          <EnlaceAlbum p={p} />
        </>
      ) : null}
    </>
  );
}

function MenuPista({ p, extra = [] }: { p: Item; extra?: Accion[] }) {
  const album = claveAlbum(p);
  // Los que firman la pista; el del álbum se alcanza desde el álbum.
  const artistas = (p.autores ?? []).filter(esArtista).slice(0, 3);
  return (
    <MenuAcciones
      acciones={[
        ...extra,
        {
          icono: <Plus size={20} />,
          texto: "Agregar a una playlist",
          hacer: () => abrirSelectorLista([p]),
        },
        {
          icono: <ListEnd size={20} />,
          texto: "Reproducir a continuación",
          hacer: () => {
            void reproducirDespues(p);
            avisar("Suena justo después.");
          },
        },
        {
          icono: <ListPlus size={20} />,
          texto: "Agregar a la fila",
          hacer: () => {
            void agregarALaFila(p);
            avisar("Agregada a la fila.");
          },
        },
        {
          icono: <MicVocal size={20} />,
          texto: "Ver letra",
          // Solo se abre si la hay; si no, se avisa.
          hacer: () =>
            void pedirLetra(p).then((e) =>
              e.estado === "lista" ? abrirLetra(p.id) : avisar(e.estado === "error" ? "La letra no está disponible ahora. Prueba más tarde." : `«${p.titulo}» no tiene letra.`),
            ),
        },
        ...artistas.map((a) => ({
          icono: <UserRound size={20} />,
          texto: artistas.length === 1 ? "Ir al artista" : `Ir a ${a}`,
          hacer: () => irDentro("musica", { artista: claveArtista(a) }),
        })),
        ...(album ? [{ icono: <Disc3 size={20} />, texto: "Ir al álbum", hacer: () => irDentro("musica", { album }) }] : []),
      ]}
    />
  );
}

/**
 * Una pista en forma de fila de tabla, como en Spotify: el número se vuelve
 * ▶ al pasar el ratón y la que suena muestra unas barras animadas. `cola` es
 * el contexto con que suena al pulsarla, salvo que se indique `alReproducir`
 * (p. ej. saltar a un punto de la fila).
 */
export function FilaPista({
  p,
  numero,
  cola,
  conAlbum,
  columna,
  fecha,
  conMiniatura = true,
  alQuitar,
  alReproducir,
  acciones,
  accionFin,
  clase = "",
  atributos,
}: {
  p: Item;
  numero: number;
  cola: Item[];
  /** Bajo el título, el álbum además de los artistas. */
  conAlbum?: boolean;
  /** Columna extra (álbum, hora de escucha…). */
  columna?: ReactNode;
  /** Columna de fecha (cuándo se agregó a una playlist). */
  fecha?: string;
  conMiniatura?: boolean;
  alQuitar?: () => void;
  alReproducir?: () => void;
  /** Acciones propias del lugar (p. ej. quitar de la playlist), arriba del menú. */
  acciones?: Accion[];
  /** Un botón antes de la duración (p. ej. «Agregar»). */
  accionFin?: ReactNode;
  clase?: string;
  /** Atributos de la fila (arrastrar para ordenar). */
  atributos?: HTMLAttributes<HTMLDivElement>;
}) {
  const rep = useReproductor();
  const activa = rep.actual?.id === p.id;
  const sonar = () => (alReproducir && !activa ? alReproducir() : tocar(p, cola, rep.actual));
  return (
    <div
      {...atributos}
      className={`tema${activa ? " sonando" : ""}${conMiniatura ? " con-mini" : ""}${columna !== undefined ? " con-columna" : ""}${fecha !== undefined ? " con-fecha" : ""} ${clase}`}
      role="row"
      onDoubleClick={() => !activa && sonar()}
    >
      <span className="tema-n">
        {activa && rep.sonando ? (
          <span className="barras" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <span className="num">{numero}</span>
        )}
        <button className="tema-play" onClick={sonar} aria-label={activa && rep.sonando ? "Pausar" : `Reproducir ${p.titulo}`}>
          {activa && rep.sonando ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
      </span>
      {conMiniatura ? <Miniatura item={p} /> : null}
      <div className="tema-titulo">
        <b>{p.titulo}</b>
        <small>
          <Creditos p={p} conAlbum={conAlbum} />
        </small>
      </div>
      {columna !== undefined ? <span className="tema-columna">{columna}</span> : null}
      {fecha !== undefined ? <span className="tema-columna tema-fecha">{fecha}</span> : null}
      <div className="tema-fin">
        {accionFin}
        {alQuitar ? (
          <button className="tema-accion" onClick={alQuitar} aria-label={`Quitar «${p.titulo}»`} title="Quitar">
            <X size={18} />
          </button>
        ) : null}
        <span className="num">{duracion(p.duracion)}</span>
        <MenuPista p={p} extra={acciones} />
      </div>
    </div>
  );
}

/** Cabecera de la tabla de pistas. */
export function CabeceraPistas({ conMiniatura = true, columna, fecha }: { conMiniatura?: boolean; columna?: string; fecha?: string }) {
  return (
    <div className={`tema tema-cabecera${conMiniatura ? " con-mini" : ""}${columna ? " con-columna" : ""}${fecha ? " con-fecha" : ""}`} role="row">
      <span className="tema-n">#</span>
      {conMiniatura ? <span /> : null}
      <span>Título</span>
      {columna ? <span className="tema-columna">{columna}</span> : null}
      {fecha ? <span className="tema-columna tema-fecha">{fecha}</span> : null}
      <span className="tema-fin">
        <Clock3 size={16} aria-label="Duración" />
      </span>
    </div>
  );
}

/**
 * Lista de pistas. En un álbum se numera por pista y sin miniaturas; fuera de
 * un álbum, con la columna del álbum.
 */
export function ListaPistas({ pistas, enAlbum }: { pistas: Item[]; enAlbum?: boolean }) {
  return (
    <div className="temas" role="table">
      <CabeceraPistas conMiniatura={!enAlbum} columna={enAlbum ? undefined : "Álbum"} />
      {pistas.map((p, i) => (
        <FilaPista
          key={p.id}
          p={p}
          numero={enAlbum ? (datosMusica(p).pista ?? i + 1) : i + 1}
          cola={pistas}
          columna={enAlbum ? undefined : <EnlaceAlbum p={p} />}
          conMiniatura={!enAlbum}
        />
      ))}
    </div>
  );
}

/** Lo escuchado, por día y de lo más reciente a lo más antiguo. */
export function HistorialMusica({ pistas }: { pistas: Item[] }) {
  const { lista, pausado } = useHistorial();
  const [confirmar, setConfirmar] = useState(false);
  const grupos = useMemo(() => {
    const porId = new Map(pistas.map((p) => [p.id, p]));
    const escuchas = lista.flatMap((v) => {
      const item = porId.get(v.id);
      return item ? [{ visto: v.visto, item }] : [];
    });
    return agruparPorDia(escuchas, (e) => e.visto);
  }, [lista, pistas]);

  return (
    <div className="historial-musica">
      <div className="acciones">
        {confirmar ? (
          <>
            <span className="texto-2">¿Borrar el historial de escuchas?</span>
            <button
              className="boton tinta"
              onClick={() => {
                borrarHistorial();
                setConfirmar(false);
              }}
            >
              Sí, borrar
            </button>
            <button className="boton plano" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button className="boton" onClick={() => setConfirmar(true)} disabled={!grupos.length}>
            <Trash2 size={18} /> Borrar el historial
          </button>
        )}
        <button className="boton" onClick={() => pausarHistorial(!pausado)}>
          {pausado ? <Play size={18} /> : <Pause size={18} />} {pausado ? "Reanudar el historial" : "Pausar el historial"}
        </button>
      </div>
      {pausado ? (
        <div className="aviso">
          <Pause size={16} aria-hidden /> El historial está en pausa: lo que escuches ahora no se guarda.
        </div>
      ) : null}
      {grupos.map(([dia, escuchas]) => {
        const cola = escuchas.map((e) => e.item);
        return (
          <section key={dia} className="seccion">
            <header>
              <h2>{dia}</h2>
            </header>
            <div className="temas" role="table">
              {escuchas.map(({ visto, item }, i) => (
                <FilaPista
                  key={item.id}
                  p={item}
                  numero={i + 1}
                  cola={cola}
                  conAlbum
                  columna={hora(visto)}
                  alQuitar={() => quitarDelHistorial(item.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
      {!grupos.length ? <p className="texto-3">Lo que escuches aparecerá aquí, agrupado por día.</p> : null}
    </div>
  );
}
