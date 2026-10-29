# Openfy

Un reproductor de música local con la forma de Spotify: tu biblioteca a la
izquierda, álbumes, artistas y playlists, la fila de reproducción, letras
sincronizadas y ecualizador. Tu música no sale de tu dispositivo: no hay
cuentas ni servidor.

## Qué hace

- **Añadir música**: MP3, M4A, FLAC, OGG u Opus, sueltos o en un **ZIP** o
  **RAR** con un álbum entero. Arrastra los archivos a la ventana o usa
  «Añadir audio». La carátula sale del propio archivo o de la imagen del
  álbum (`cover.jpg`, `folder.jpg`…).
- **Biblioteca**: álbumes y artistas a partir de las etiquetas, con los
  nombres de un mismo artista en distintos alfabetos unidos (松原みき /
  Miki Matsubara). Playlists propias, historial de escuchas y búsqueda.
- **Reproductor**: aleatorio, repetir, «a continuación», fila editable,
  ecualizador de 10 bandas y controles del sistema (Media Session).
- **Letras sincronizadas**: la del propio archivo, un `.lrc` con el mismo
  nombre que la canción (suelto o dentro del ZIP/RAR) o, si no hay, la de
  [LRCLIB](https://lrclib.net). Lo encontrado se guarda para verlo sin conexión.
- **Sin conexión**: es una PWA; los audios se guardan en el almacenamiento
  privado del navegador (OPFS, o IndexedDB si no lo hay).

## Privacidad y seguridad

- Tus audios, playlists, historial y foto de perfil se quedan en el
  navegador. Lo único que sale es la búsqueda de letras: título, artista,
  álbum y duración de la canción se envían a `lrclib.net`, sin cookies ni
  referer.
- Las letras son contenido de terceros: se valida su forma, se recorta su
  tamaño y se muestran siempre como texto, nunca como HTML.
- Los ZIP y RAR se abren con límites (4 GB descomprimidos y 5000 entradas
  como mucho) contra archivos que se inflan sin fin; de cada entrada solo se
  usa el nombre, y lo guardado lleva una clave propia, nunca la ruta del
  archivo comprimido.

## Desarrollo

Hace falta Node.js 20.19 o superior (o 22.12+).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas (Vitest)
npm run build      # versión para publicar, en dist/
```

`npm run icono` regenera `public/icono.png` (el símbolo «music-2» de Lucide
sobre la textura de papel).

Hecho con React 19, Vite, TypeScript y Dexie. Las etiquetas se leen con
[music-metadata](https://github.com/Borewit/music-metadata), los ZIP con
[fflate](https://github.com/101arrowz/fflate) y los RAR con
[node-unrar-js](https://github.com/YuJianrong/node-unrar.js).

## Licencia

MIT (ver [LICENSE](LICENSE)). node-unrar-js incluye el código de UnRAR de
RARLAB, que se distribuye con su propia licencia: permite usarlo para
descomprimir, no para crear un compresor RAR.
