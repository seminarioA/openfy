// «Agregar a una playlist»: elige una playlist (o crea una nueva) para lo que
// se pidió desde el menú de una canción, un álbum o un artista.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plus, Search } from "lucide-react";
import { db, type Lista } from "../lib/db";
import { agregarALista, crearLista } from "../lib/listas";
import { avisar, cerrarSelectorLista, irDentro, mensajeError, useSelectorLista } from "../lib/ui";
import { Dialogo } from "./Dialogo";
import { PortadaLista } from "./Discos";
import { canciones } from "../lib/musica";

export function SelectorLista() {
  const sel = useSelectorLista();
  const [q, setQ] = useState("");
  const listas = useLiveQuery(() => db.listas.orderBy("actualizada").reverse().toArray(), [], []);
  const pistas = useLiveQuery(() => db.items.where("tipo").equals("audio").toArray(), [], []);
  const porId = useMemo(() => new Map(pistas.map((p) => [p.id, p])), [pistas]);

  const cerrar = () => {
    setQ("");
    cerrarSelectorLista();
  };
  const que = sel ? (sel.items.length === 1 ? `«${sel.items[0].titulo}»` : canciones(sel.items.length)) : "";

  const agregar = async (lista: Lista) => {
    if (!sel) return;
    try {
      const { agregadas } = await agregarALista(lista.id, sel.items);
      avisar(agregadas ? `${sel.items.length === 1 ? "Se agregó" : `Se agregaron ${agregadas}`} a «${lista.nombre}».` : `Ya estaba en «${lista.nombre}».`);
    } catch (e) {
      avisar(mensajeError(e));
    }
    cerrar();
  };

  const nueva = async () => {
    if (!sel) return;
    const lista = await crearLista(sel.items);
    cerrar();
    avisar(`Se creó «${lista.nombre}» con ${que}.`);
    irDentro("musica", { lista: lista.id });
  };

  const t = q.trim().toLowerCase();
  const visibles = t ? listas.filter((l) => l.nombre.toLowerCase().includes(t)) : listas;
  return (
    <Dialogo abierto={!!sel} alCerrar={cerrar} titulo="Agregar a una playlist">
      <p className="texto-2 dialogo-que">{que}</p>
      {listas.length > 5 ? (
        <label className="buscador">
          <Search size={17} />
          <span className="oculto-visual">Buscar una playlist</span>
          <input className="entrada" placeholder="Buscar una playlist" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      ) : null}
      <ul className="selector-listas">
        <li>
          <button onClick={() => void nueva()}>
            <span className="caratula sin-caratula" aria-hidden>
              <Plus size={22} />
            </span>
            <span>
              <b>Nueva playlist</b>
            </span>
          </button>
        </li>
        {visibles.map((l) => {
          const items = l.pistas.flatMap((x) => porId.get(x.id) ?? []);
          const ya = !!sel && sel.items.every((p) => l.pistas.some((x) => x.id === p.id));
          return (
            <li key={l.id}>
              <button onClick={() => void agregar(l)}>
                <PortadaLista pistas={items} />
                <span>
                  <b>{l.nombre}</b>
                  <small className="num">{canciones(items.length)}</small>
                </span>
                {ya ? <Check size={18} className="selector-ya" aria-label="Ya está" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {t && !visibles.length ? <p className="texto-3">Ninguna playlist se llama así.</p> : null}
    </Dialogo>
  );
}
