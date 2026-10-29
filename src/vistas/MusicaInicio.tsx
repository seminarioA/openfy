// El inicio de Música, como el de Spotify: filtros en píldoras (lo que se busca
// llega de la barra de arriba), accesos rápidos a lo último que sonó y filas
// horizontales. Al buscar: «Resultado principal», «Canciones» y el resto por tipo.
import { useMemo } from "react";
import { Pause, Play, Plus, Shuffle } from "lucide-react";
import type { Item } from "../lib/db";
import { canciones, datosMusica } from "../lib/musica";
import type { DatosMusica, Entrada } from "../lib/useMusica";
import { alternar, useReproductor } from "../lib/reproductor";
import { enlaceDentro, irDentro, useBusqueda, useParametros } from "../lib/ui";
import { FilaPista, HistorialMusica, ListaPistas, tocar } from "../components/Pistas";
import { AccesoRapido, Carrusel, ImagenEntrada, TarjetaEntrada } from "../components/Discos";
import { BibliotecaMusica, nuevaPlaylist } from "../components/BibliotecaMusica";
import { TarjetaDJ } from "../components/TarjetaDJ";

export const VERES = [
  { id: "todo", nombre: "Todo" },
  { id: "pistas", nombre: "Canciones" },
  { id: "albumes", nombre: "Álbumes" },
  { id: "artistas", nombre: "Artistas" },
  { id: "listas", nombre: "Playlists" },
  { id: "historial", nombre: "Historial" },
] as const;
export type Ver = (typeof VERES)[number]["id"] | "biblioteca";

const TIPO: Record<Entrada["tipo"], string> = { lista: "Playlist", album: "Álbum", artista: "Artista" };

function mezclar<T>(lista: T[]) {
  return [...lista].sort(() => Math.random() - 0.5);
}

/** Cuánto se parece `texto` a lo buscado: igual, empieza por, contiene o nada. */
function parecido(texto: string, t: string) {
  const x = texto.toLowerCase();
  return x === t ? 3 : x.startsWith(t) ? 2 : x.includes(t) ? 1 : 0;
}

/** «Resultado principal»: la entrada o canción más parecida, en grande. */
function ResultadoPrincipal({ e, pista }: { e?: Entrada; pista?: Item }) {
  const rep = useReproductor();
  const pistas = e ? e.pistas : pista ? [pista] : [];
  const suena = !!rep.actual && pistas.some((p) => p.id === rep.actual!.id);
  const titulo = e?.titulo ?? pista?.titulo ?? "";
  return (
    <div className="sp-principal-resultado">
      <a href={e?.href ?? (pista ? enlaceDentro("musica", { ver: "pistas" }) : "#musica")}>
        {e ? <ImagenEntrada e={e} tam={92} /> : <img className="caratula" src={pista?.portada} alt="" style={{ width: 92, height: 92 }} />}
        <b>{titulo}</b>
        <span>
          <span className="sp-tipo">{e ? TIPO[e.tipo] : "Canción"}</span> {e?.tipo === "album" ? e.detalle.replace(/^Álbum · /, "") : pista?.autores?.join(", ")}
        </span>
      </a>
      {pistas.length ? (
        <button className="disco-play" onClick={() => (suena ? alternar() : void tocar(pistas[0], pistas))} aria-label={suena && rep.sonando ? "Pausar" : `Reproducir ${titulo}`}>
          {suena && rep.sonando ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
      ) : null}
    </div>
  );
}

export function MusicaInicio({ datos, alImportar }: { datos: DatosMusica; alImportar: () => void }) {
  const parametros = useParametros();
  const pedido = parametros.get("ver");
  const ver: Ver = pedido === "biblioteca" || VERES.some((v) => v.id === pedido) ? (pedido as Ver) : "todo";
  const q = useBusqueda();
  const t = q.trim().toLowerCase();
  const { pistas, entradas, nombreDe, escuchas, sueltas } = datos;

  const enc = useMemo(() => {
    const deTipo = (tipo: Entrada["tipo"]) => entradas.filter((e) => e.tipo === tipo);
    const filtrar = (lista: Entrada[]) => (t ? lista.filter((e) => parecido(`${e.titulo} ${e.detalle}`, t)) : lista);
    const pistasHalladas = t ? pistas.filter((p) => parecido(`${p.titulo} ${(p.autores ?? []).map(nombreDe).join(" ")} ${p.autores?.join(" ") ?? ""} ${datosMusica(p).album ?? ""}`, t)) : pistas;
    return {
      listas: filtrar(deTipo("lista")),
      albumes: filtrar(deTipo("album")),
      artistas: filtrar(deTipo("artista")),
      pistas: pistasHalladas,
    };
  }, [entradas, pistas, t, nombreDe]);

  // Lo más parecido a lo buscado; a igualdad, artista, álbum, playlist y canción, en ese orden.
  const principal = useMemo(() => {
    if (!t) return null;
    const candidatas = [
      ...enc.artistas.map((e) => ({ e, p: parecido(e.titulo, t) + 0.3 })),
      ...enc.albumes.map((e) => ({ e, p: parecido(e.titulo, t) + 0.2 })),
      ...enc.listas.map((e) => ({ e, p: parecido(e.titulo, t) + 0.1 })),
    ];
    const pista = enc.pistas.map((x) => ({ x, p: parecido(x.titulo, t) })).sort((a, b) => b.p - a.p)[0];
    const mejor = candidatas.sort((a, b) => b.p - a.p)[0];
    if (mejor && (!pista || mejor.p >= pista.p)) return { e: mejor.e };
    return pista ? { pista: pista.x } : null;
  }, [enc, t]);

  const recientes = entradas.filter((e) => e.escuchado).sort((a, b) => b.escuchado - a.escuchado).slice(0, 8);
  const masEscuchadas = pistas.filter((p) => escuchas.has(p.id)).sort((a, b) => (escuchas.get(b.id)?.veces ?? 1) - (escuchas.get(a.id)?.veces ?? 1)).slice(0, 8);
  const artistasPorEscuchas = [...enc.artistas].sort((a, b) => b.escuchado - a.escuchado);

  const verA = (v: Ver) => irDentro("musica", { ver: v === "todo" ? null : v });
  const vacio = !pistas.length;

  return (
    <div className="sp-inicio">
      <div className="ui-chips sp-chips" role="tablist" aria-label="Ver la música por">
        <button className="ui-chip solo-movil" role="tab" aria-selected={ver === "biblioteca"} aria-pressed={ver === "biblioteca"} onClick={() => verA("biblioteca")}>
          Tu biblioteca
        </button>
        {VERES.map((v) => (
          <button key={v.id} className="ui-chip" role="tab" aria-selected={ver === v.id} aria-pressed={ver === v.id} onClick={() => verA(v.id)}>
            {v.nombre}
          </button>
        ))}
        <button
          className="tira-boton grande sp-aleatorio"
          disabled={vacio}
          onClick={() => {
            const m = mezclar(enc.pistas);
            if (m[0]) void tocar(m[0], m);
          }}
          aria-label={t ? "Lo encontrado en aleatorio" : "Toda tu música en aleatorio"}
          title={t ? "Lo encontrado en aleatorio" : "Toda tu música en aleatorio"}
        >
          <Shuffle size={22} />
        </button>
      </div>

      {vacio && ver !== "listas" && ver !== "biblioteca" ? (
        <div className="sp-vacio">
          <h2>Tu música empieza aquí</h2>
          <p>Añade MP3, M4A, FLAC u OGG, o un ZIP o RAR con un álbum entero.</p>
          <button className="sp-pildora" onClick={alImportar}>
            Añadir audio
          </button>
        </div>
      ) : ver === "biblioteca" ? (
        <BibliotecaMusica entradas={entradas} alImportar={alImportar} comoPagina />
      ) : ver === "historial" ? (
        <HistorialMusica pistas={pistas} />
      ) : ver === "pistas" ? (
        enc.pistas.length ? <ListaPistas pistas={enc.pistas} /> : <p className="texto-3">Ninguna canción coincide con «{q}».</p>
      ) : ver === "albumes" || ver === "artistas" || ver === "listas" ? (
        <div className="discos">
          {ver === "listas" && !t ? (
            <button className="disco disco-crear" onClick={() => void nuevaPlaylist()}>
              <span className="caratula sin-caratula" aria-hidden>
                <Plus size={48} />
              </span>
              <b>Crear playlist</b>
              <small>Elige canciones de tu música</small>
            </button>
          ) : null}
          {(ver === "albumes" ? enc.albumes : ver === "artistas" ? enc.artistas : enc.listas).map((e) => (
            <TarjetaEntrada key={e.id} e={e} detalle={ver === "albumes" ? e.detalle.replace(/^Álbum · /, "") : undefined} />
          ))}
          {t && !(ver === "albumes" ? enc.albumes : ver === "artistas" ? enc.artistas : enc.listas).length ? <p className="texto-3">Nada coincide con «{q}».</p> : null}
        </div>
      ) : t ? (
        // Búsqueda en «Todo»
        <>
          {principal ? (
            <div className="sp-busqueda-arriba">
              <section className="sp-fila">
                <header>
                  <h2>Resultado principal</h2>
                </header>
                <ResultadoPrincipal e={principal.e} pista={principal.pista} />
              </section>
              {enc.pistas.length ? (
                <section className="sp-fila">
                  <header>
                    <h2>Canciones</h2>
                    {enc.pistas.length > 4 ? (
                      <button className="sp-mostrar" onClick={() => verA("pistas")}>
                        Mostrar todo
                      </button>
                    ) : null}
                  </header>
                  <div className="temas" role="table">
                    {enc.pistas.slice(0, 4).map((p, i) => (
                      <FilaPista key={p.id} p={p} numero={i + 1} cola={enc.pistas} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="texto-3">Nada en tu música coincide con «{q}».</p>
          )}
          {enc.artistas.length ? (
            <Carrusel titulo="Artistas">
              {enc.artistas.map((e) => (
                <TarjetaEntrada key={e.id} e={e} />
              ))}
            </Carrusel>
          ) : null}
          {enc.albumes.length ? (
            <Carrusel titulo="Álbumes">
              {enc.albumes.map((e) => (
                <TarjetaEntrada key={e.id} e={e} detalle={e.detalle.replace(/^Álbum · /, "")} />
              ))}
            </Carrusel>
          ) : null}
          {enc.listas.length ? (
            <Carrusel titulo="Playlists">
              {enc.listas.map((e) => (
                <TarjetaEntrada key={e.id} e={e} />
              ))}
            </Carrusel>
          ) : null}
        </>
      ) : (
        // Inicio
        <>
          {pistas.length ? (
            <div className="sp-rapidos">
              <TarjetaDJ datos={datos} />
              {recientes.slice(0, 7).map((e) => (
                <AccesoRapido key={`${e.tipo}-${e.id}`} e={e} />
              ))}
            </div>
          ) : null}
          {enc.listas.length ? (
            <Carrusel titulo="Tus playlists" href={enlaceDentro("musica", { ver: "listas" })}>
              {enc.listas.map((e) => (
                <TarjetaEntrada key={e.id} e={e} detalle={canciones(e.pistas.length)} />
              ))}
            </Carrusel>
          ) : null}
          {enc.albumes.length ? (
            <Carrusel titulo="Añadidos recientemente" href={enlaceDentro("musica", { ver: "albumes" })}>
              {[...enc.albumes]
                .sort((a, b) => Math.max(...b.pistas.map((p) => p.creado)) - Math.max(...a.pistas.map((p) => p.creado)))
                .map((e) => (
                  <TarjetaEntrada key={e.id} e={e} detalle={e.detalle.replace(/^Álbum · /, "")} />
                ))}
            </Carrusel>
          ) : null}
          {artistasPorEscuchas.length ? (
            <Carrusel titulo="Tus artistas" href={enlaceDentro("musica", { ver: "artistas" })}>
              {artistasPorEscuchas.map((e) => (
                <TarjetaEntrada key={e.id} e={e} />
              ))}
            </Carrusel>
          ) : null}
          {masEscuchadas.length ? (
            <section className="sp-fila">
              <header>
                <h2>Lo que más escuchas</h2>
                <a className="sp-mostrar" href={enlaceDentro("musica", { ver: "historial" })}>
                  Historial
                </a>
              </header>
              <div className="temas sp-dos-columnas" role="table">
                {masEscuchadas.map((p, i) => (
                  <FilaPista key={p.id} p={p} numero={i + 1} cola={masEscuchadas} />
                ))}
              </div>
            </section>
          ) : null}
          {sueltas.length ? (
            <section className="sp-fila">
              <header>
                <h2>Pistas sueltas</h2>
              </header>
              <ListaPistas pistas={sueltas} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
