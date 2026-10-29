// Música como Spotify: «Tu biblioteca» a la izquierda y, a la derecha, el
// inicio o la página de un álbum, un artista o una playlist (según la URL).
import { ListEnd, ListPlus, Plus, UserRound } from "lucide-react";
import { canciones, claveArtista, esArtista, type Album } from "../lib/musica";
import { useMusica } from "../lib/useMusica";
import { agregarALaFila, reproducirDespues } from "../lib/reproductor";
import { abrirSelectorLista, avisar, irDentro, useParametros } from "../lib/ui";
import { EnlacesArtistas, ListaPistas } from "../components/Pistas";
import { Caratula, duracionLarga, PaginaDisco } from "../components/Discos";
import { BibliotecaMusica } from "../components/BibliotecaMusica";
import { VistaArtista } from "./MusicaArtista";
import { VistaLista } from "./MusicaLista";
import { MusicaInicio } from "./MusicaInicio";

function VistaAlbum({ album, artista }: { album: Album; artista: string }) {
  return (
    <PaginaDisco
      tipo="Álbum"
      titulo={album.titulo}
      portada={album.portada}
      imagen={<Caratula src={album.portada} tam={232} />}
      detalle={
        <>
          <b>{esArtista(artista) ? <EnlacesArtistas nombres={[artista]} /> : artista}</b>
          {album.anio ? ` · ${album.anio}` : ""} · {canciones(album.pistas.length)}, {duracionLarga(album.duracion)}
        </>
      }
      pistas={album.pistas}
      etiquetaMenu="Más acciones del álbum"
      menu={[
        {
          icono: <ListPlus size={20} />,
          texto: "Agregar el álbum a la fila",
          hacer: () => {
            void agregarALaFila(album.pistas);
            avisar(`«${album.titulo}» se agregó a la fila.`);
          },
        },
        {
          icono: <ListEnd size={20} />,
          texto: "Reproducir a continuación",
          hacer: () => {
            void reproducirDespues(album.pistas);
            avisar(`«${album.titulo}» suena justo después.`);
          },
        },
        { icono: <Plus size={20} />, texto: "Agregar a una playlist", hacer: () => abrirSelectorLista(album.pistas) },
        ...(esArtista(album.artista) ? [{ icono: <UserRound size={20} />, texto: "Ir al artista", hacer: () => irDentro("musica", { artista: claveArtista(album.artista) }) }] : []),
      ]}
    >
      <ListaPistas pistas={album.pistas} enAlbum />
    </PaginaDisco>
  );
}

export function VistaMusica({ alImportar }: { alImportar: () => void }) {
  const datos = useMusica();
  const parametros = useParametros();
  const album = datos.albumes.find((a) => a.clave === parametros.get("album"));
  const artista = datos.artistas.find((a) => a.claves.includes(parametros.get("artista") ?? ""));
  const lista = datos.listas.find((l) => l.id === parametros.get("lista"));

  return (
    <div className="sp-musica">
      <BibliotecaMusica entradas={datos.entradas} alImportar={alImportar} />
      <div className="sp-contenido">
        {album ? (
          <VistaAlbum album={album} artista={datos.nombreDe(album.artista)} />
        ) : artista ? (
          <VistaArtista key={artista.clave} artista={artista} />
        ) : lista ? (
          <VistaLista key={lista.id} lista={lista} pistas={datos.pistas} />
        ) : (
          <MusicaInicio datos={datos} alImportar={alImportar} />
        )}
      </div>
    </div>
  );
}
