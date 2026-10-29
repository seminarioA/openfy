// Página de una playlist, como en Spotify: mosaico de carátulas, nombre y
// descripción editables, las canciones con la fecha en que se agregaron
// (arrastrar para ordenar) y, debajo, un buscador para agregar más.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Item, Lista } from "../lib/db";
import { borrarLista, editarLista, moverEnLista, pistasDe, quitarDeLista, agregarALista, portadasDe } from "../lib/listas";
import { canciones, datosMusica } from "../lib/musica";
import { hace } from "../lib/formato";
import { agregarALaFila } from "../lib/reproductor";
import { abrirSelectorLista, avisar, irDentro, mensajeError } from "../lib/ui";
import { CabeceraPistas, EnlaceAlbum, FilaPista } from "../components/Pistas";
import { Dialogo } from "../components/Dialogo";
import { duracionLarga, PaginaDisco, PortadaLista } from "../components/Discos";

function EditarLista({ lista, abierto, alCerrar }: { lista: Lista; abierto: boolean; alCerrar: () => void }) {
  const [nombre, setNombre] = useState(lista.nombre);
  const [descripcion, setDescripcion] = useState(lista.descripcion ?? "");
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await editarLista(lista.id, { nombre, descripcion });
      alCerrar();
    } catch (err) {
      avisar(mensajeError(err));
    }
  };
  return (
    <Dialogo abierto={abierto} alCerrar={alCerrar} titulo="Editar información" ancho={520}>
      <form className="formulario-lista" onSubmit={(e) => void guardar(e)}>
        <label>
          <span className="ficha">Nombre</span>
          <input className="entrada" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={100} required />
        </label>
        <label>
          <span className="ficha">Descripción</span>
          <textarea className="entrada" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} rows={4} placeholder="Añade una descripción opcional" />
        </label>
        <div className="acciones">
          <button type="button" className="boton plano" onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton tinta">
            Guardar
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

/** Buscar en la biblioteca algo que agregar; sin búsqueda, lo añadido hace poco. */
function BuscarParaLista({ lista, pistas }: { lista: Lista; pistas: Item[] }) {
  const [abierto, setAbierto] = useState(!lista.pistas.length);
  const [q, setQ] = useState("");
  const dentro = new Set(lista.pistas.map((x) => x.id));
  const t = q.trim().toLowerCase();
  const candidatas = pistas.filter((p) => !dentro.has(p.id));
  const resultados = (t ? candidatas.filter((p) => `${p.titulo} ${p.autores?.join(" ") ?? ""} ${datosMusica(p).album ?? ""}`.toLowerCase().includes(t)) : candidatas).slice(0, t ? 30 : 8);
  if (!abierto)
    return (
      <button className="boton plano buscar-mas" onClick={() => setAbierto(true)}>
        <Search size={18} /> Buscar más
      </button>
    );
  return (
    <section className="seccion buscar-lista">
      <header>
        <h2>Busquemos algo para tu playlist</h2>
        {lista.pistas.length ? (
          <button className="boton plano" onClick={() => setAbierto(false)}>
            Listo
          </button>
        ) : null}
      </header>
      <label className="buscador">
        <Search size={17} />
        <span className="oculto-visual">Buscar canciones</span>
        <input className="entrada" placeholder="Buscar canciones, artistas o álbumes" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {!t && resultados.length ? <small className="texto-3">Añadidas hace poco a tu música</small> : null}
      <div className="temas" role="table">
        {resultados.map((p, i) => (
          <FilaPista
            key={p.id}
            p={p}
            numero={i + 1}
            cola={resultados}
            columna={<EnlaceAlbum p={p} />}
            accionFin={
              <button
                className="ui-pildora"
                onClick={() =>
                  void agregarALista(lista.id, [p]).then(
                    () => avisar(`Se agregó a «${lista.nombre}».`),
                    (e) => avisar(mensajeError(e)),
                  )
                }
              >
                Agregar
              </button>
            }
          />
        ))}
      </div>
      {t && !resultados.length ? <p className="texto-3">Nada en tu música coincide con «{q}».</p> : null}
      {!t && !candidatas.length ? <p className="texto-3">Toda tu música ya está en esta playlist.</p> : null}
    </section>
  );
}

export function VistaLista({ lista, pistas }: { lista: Lista; pistas: Item[] }) {
  const porId = useMemo(() => new Map(pistas.map((p) => [p.id, p])), [pistas]);
  const filas = pistasDe(lista, porId);
  const items = filas.map((f) => f.item);
  const total = items.reduce((s, p) => s + (p.duracion ?? 0), 0);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  // Arrastrar para ordenar: la fila que se arrastra y sobre cuál se soltaría.
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const mover = (de: number, a: number) => void moverEnLista(lista.id, filas[de].indice, filas[a].indice);

  return (
    <>
      <PaginaDisco
        tipo="Playlist"
        titulo={lista.nombre}
        portada={portadasDe(items)[0]}
        imagen={<PortadaLista pistas={items} tam={232} />}
        descripcion={lista.descripcion}
        detalle={items.length ? `${canciones(items.length)}, ${duracionLarga(total)}` : "Vacía"}
        pistas={items}
        alEditar={() => setEditando(true)}
        etiquetaMenu="Más acciones de la playlist"
        menu={[
          { icono: <Pencil size={20} />, texto: "Editar información", hacer: () => setEditando(true) },
          ...(items.length
            ? [
                {
                  icono: <ListPlus size={20} />,
                  texto: "Agregar a la fila",
                  hacer: () => {
                    void agregarALaFila(items);
                    avisar(`«${lista.nombre}» se agregó a la fila.`);
                  },
                },
                { icono: <Plus size={20} />, texto: "Agregar a otra playlist", hacer: () => abrirSelectorLista(items) },
              ]
            : []),
          { icono: <Trash2 size={20} />, texto: "Eliminar", hacer: () => setBorrando(true) },
        ]}
      >
        {filas.length ? (
          <div className="temas" role="table">
            <CabeceraPistas columna="Álbum" fecha="Agregada" />
            {filas.map(({ item, agregada }, i) => (
              <FilaPista
                key={`${item.id}-${i}`}
                p={item}
                numero={i + 1}
                cola={items}
                columna={<EnlaceAlbum p={item} />}
                fecha={hace(agregada)}
                clase={`${arrastrada === i ? "arrastrada" : ""}${destino === i && arrastrada !== i ? " destino" : ""}`}
                atributos={{
                  draggable: true,
                  onDragStart: (e) => {
                    setArrastrada(i);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", item.titulo);
                  },
                  onDragOver: (e) => {
                    if (arrastrada === null) return;
                    e.preventDefault();
                    setDestino(i);
                  },
                  onDrop: (e) => {
                    e.preventDefault();
                    if (arrastrada !== null && arrastrada !== i) mover(arrastrada, i);
                  },
                  onDragEnd: () => {
                    setArrastrada(null);
                    setDestino(null);
                  },
                }}
                acciones={[
                  { icono: <Trash2 size={20} />, texto: "Quitar de esta playlist", hacer: () => void quitarDeLista(lista.id, filas[i].indice) },
                  ...(i > 0 ? [{ icono: <ArrowUp size={20} />, texto: "Subir", hacer: () => mover(i, i - 1) }] : []),
                  ...(i < filas.length - 1 ? [{ icono: <ArrowDown size={20} />, texto: "Bajar", hacer: () => mover(i, i + 1) }] : []),
                ]}
              />
            ))}
          </div>
        ) : null}
        <BuscarParaLista key={lista.id} lista={lista} pistas={pistas} />
      </PaginaDisco>

      <EditarLista key={`${lista.id}-${editando}`} lista={lista} abierto={editando} alCerrar={() => setEditando(false)} />
      <Dialogo abierto={borrando} alCerrar={() => setBorrando(false)} titulo="¿Eliminar la playlist?">
        <p className="texto-2">
          Se eliminará «{lista.nombre}». Las canciones siguen en tu música.
        </p>
        <div className="acciones">
          <button className="boton plano" onClick={() => setBorrando(false)}>
            Cancelar
          </button>
          <button
            className="boton tinta"
            onClick={() => {
              void borrarLista(lista.id).then(() => {
                avisar(`Se eliminó «${lista.nombre}».`);
                irDentro("musica", { ver: "listas" });
              });
            }}
          >
            Eliminar
          </button>
        </div>
      </Dialogo>
    </>
  );
}
