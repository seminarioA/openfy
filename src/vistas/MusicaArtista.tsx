// Página de un artista, como en Spotify: lo más escuchado, su discografía y
// los álbumes de otros en los que aparece.
import { useMemo, useState } from "react";
import { ListPlus, Plus, UserRound } from "lucide-react";
import { canciones, populares, type Album, type Artista } from "../lib/musica";
import { useHistorial } from "../lib/historial";
import { agregarALaFila } from "../lib/reproductor";
import { abrirSelectorLista, avisar, enlaceDentro } from "../lib/ui";
import { FilaPista } from "../components/Pistas";
import { Caratula, duracionLarga, PaginaDisco, TarjetaDisco } from "../components/Discos";

const POPULARES = 5;

export function TarjetaAlbum({ album }: { album: Album }) {
  return <TarjetaDisco href={enlaceDentro("musica", { album: album.clave })} titulo={album.titulo} detalle={album.anio ? `${album.anio} · Álbum` : "Álbum"} imagen={<Caratula src={album.portada} />} pistas={album.pistas} />;
}

export function VistaArtista({ artista }: { artista: Artista }) {
  const { lista } = useHistorial();
  const orden = useMemo(() => populares(artista.pistas, lista), [artista.pistas, lista]);
  const veces = useMemo(() => new Map(lista.map((v) => [v.id, v.veces ?? 1])), [lista]);
  const [todas, setTodas] = useState(false);
  const visibles = todas ? orden : orden.slice(0, POPULARES);
  const discos = artista.albumes.length;

  return (
    <PaginaDisco
      tipo="Artista"
      titulo={artista.nombre}
      portada={artista.portada}
      imagen={<Caratula src={artista.portada} tam={232} redonda icono={UserRound} />}
      descripcion={artista.alias.length ? `También aparece como ${artista.alias.join(", ")}.` : undefined}
      detalle={[canciones(artista.pistas.length), discos ? `${discos} ${discos === 1 ? "álbum" : "álbumes"}` : null, duracionLarga(artista.duracion)].filter(Boolean).join(" · ")}
      pistas={orden}
      etiquetaMenu="Más acciones del artista"
      menu={[
        {
          icono: <ListPlus size={20} />,
          texto: "Agregar a la fila",
          hacer: () => {
            void agregarALaFila(orden);
            avisar(`Lo de ${artista.nombre} se agregó a la fila.`);
          },
        },
        { icono: <Plus size={20} />, texto: "Agregar a una playlist", hacer: () => abrirSelectorLista(orden) },
      ]}
    >
      <section className="seccion">
        <header>
          <h2>Populares</h2>
        </header>
        <div className="temas" role="table">
          {visibles.map((p, i) => {
            const n = veces.get(p.id);
            return <FilaPista key={p.id} p={p} numero={i + 1} cola={orden} columna={n ? `${n} ${n === 1 ? "escucha" : "escuchas"}` : ""} />;
          })}
        </div>
        {orden.length > POPULARES ? (
          <button className="boton plano ver-mas" onClick={() => setTodas((t) => !t)}>
            {todas ? "Mostrar menos" : "Ver más"}
          </button>
        ) : null}
      </section>
      {discos ? (
        <section className="seccion">
          <header>
            <h2>Discografía</h2>
          </header>
          <div className="discos">
            {artista.albumes.map((a) => (
              <TarjetaAlbum key={a.clave} album={a} />
            ))}
          </div>
        </section>
      ) : null}
      {artista.apareceEn.length ? (
        <section className="seccion">
          <header>
            <h2>Aparece en</h2>
          </header>
          <div className="discos">
            {artista.apareceEn.map((a) => (
              <TarjetaAlbum key={a.clave} album={a} />
            ))}
          </div>
        </section>
      ) : null}
    </PaginaDisco>
  );
}
