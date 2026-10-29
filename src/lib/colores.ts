// Color dominante de una carátula, para el degradado de la página del álbum y
// el fondo de la letra (como Spotify). Se elige el tono más vivo, no el
// promedio, y se oscurece lo justo para que el texto blanco se lea.
import { useEffect, useState } from "react";

const cache = new Map<string, string>();
const RESPALDO = "rgb(70, 51, 107)"; // el morado de la app

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = mal;
    img.src = src;
  });
}

/** Cubetas de color pesadas por saturación; sin casi blancos ni casi negros. */
export function elegirColor(pixeles: Uint8ClampedArray): [number, number, number] | null {
  const cubetas = new Map<number, { n: number; r: number; g: number; b: number; peso: number }>();
  for (let i = 0; i < pixeles.length; i += 4) {
    const [r, g, b, a] = [pixeles[i], pixeles[i + 1], pixeles[i + 2], pixeles[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luz = (max + min) / 2;
    if (luz < 28 || luz > 235) continue;
    const saturacion = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    const clave = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const c = cubetas.get(clave) ?? { n: 0, r: 0, g: 0, b: 0, peso: 0 };
    c.n++;
    c.r += r;
    c.g += g;
    c.b += b;
    c.peso += 0.25 + saturacion;
    cubetas.set(clave, c);
  }
  const mejor = [...cubetas.values()].sort((a, b) => b.peso - a.peso)[0];
  return mejor ? [mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n] : null;
}

/** Oscurece un color hasta `luz` de luminosidad (sobre 255), para que el texto blanco se lea. */
export function paraFondo([r, g, b]: [number, number, number], luz = 110) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const f = lum > luz ? luz / lum : 1;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

export async function colorDominante(src?: string, luz = 110): Promise<string> {
  if (!src) return RESPALDO;
  const clave = `${luz}:${src}`;
  const guardado = cache.get(clave);
  if (guardado) return guardado;
  try {
    const img = await cargarImagen(src);
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = 32;
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, 32, 32);
    const color = elegirColor(ctx.getImageData(0, 0, 32, 32).data);
    const final = color ? paraFondo(color, luz) : RESPALDO;
    cache.set(clave, final);
    return final;
  } catch {
    return RESPALDO;
  }
}

export function useColorDominante(src?: string, luz = 110) {
  const [color, setColor] = useState(() => (src && cache.get(`${luz}:${src}`)) || RESPALDO);
  useEffect(() => {
    let vivo = true;
    void colorDominante(src, luz).then((c) => vivo && setColor(c));
    return () => {
      vivo = false;
    };
  }, [src, luz]);
  return color;
}
