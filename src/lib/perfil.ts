// Tu foto de perfil: una imagen de este dispositivo, reducida y guardada en los
// ajustes locales del navegador. No sale de aquí.
import { useSyncExternalStore } from "react";

const CLAVE = "openfy.perfil-foto";
const oyentes = new Set<() => void>();

function leer() {
  try {
    return localStorage.getItem(CLAVE) ?? undefined;
  } catch {
    return undefined;
  }
}

let foto = leer();

export function fijarFoto(datos: string | undefined) {
  foto = datos;
  try {
    if (datos) localStorage.setItem(CLAVE, datos);
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: dura lo que la pestaña */
  }
  oyentes.forEach((f) => f());
}

export function useFotoPerfil() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    () => foto,
  );
}
