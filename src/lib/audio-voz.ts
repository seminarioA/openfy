// Retoques del audio de la voz del DJ, aparte para poder probarlos.

/** Quita el silencio del principio y del final (deja un respiro de 20 y 40 ms). */
export function recortarBordes(pcm: Float32Array, muestreo: number, umbral = 0.008) {
  const v = Math.max(1, Math.round(muestreo * 0.01));
  const suena = (i: number) => {
    let q = 0;
    const fin = Math.min(pcm.length, i + v);
    for (let j = i; j < fin; j++) q += pcm[j] * pcm[j];
    return Math.sqrt(q / (fin - i)) > umbral;
  };
  let a = 0;
  while (a < pcm.length && !suena(a)) a += v;
  if (a >= pcm.length) return pcm.slice(0, 0);
  let b = pcm.length - v;
  while (b > a && !suena(b)) b -= v;
  return pcm.slice(Math.max(0, a - 2 * v), Math.min(pcm.length, b + 4 * v));
}

/** Empalma los trozos con `pausa` segundos entre ellos y deja el pico en `pico` (sin subir más de ×4). */
export function empalmar(partes: Float32Array[], muestreo: number, pausa: number, pico = 0.9) {
  const hueco = Math.round(muestreo * pausa);
  const llenas = partes.filter((p) => p.length);
  const salida = new Float32Array(llenas.reduce((s, p) => s + p.length, 0) + hueco * Math.max(0, llenas.length - 1));
  let o = 0;
  let maximo = 0;
  for (const [i, p] of llenas.entries()) {
    if (i) o += hueco;
    salida.set(p, o);
    o += p.length;
    for (const x of p) maximo = Math.max(maximo, Math.abs(x));
  }
  // Supertonic sale bajo de volumen: se lleva siempre al mismo pico.
  const g = maximo ? Math.min(pico / maximo, 4) : 1;
  for (let i = 0; i < salida.length; i++) salida[i] *= g;
  return salida;
}
