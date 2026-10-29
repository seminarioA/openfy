// Playlists del usuario, como en Spotify: un nombre, una descripción y una
// lista ordenada de pistas de la biblioteca. Se guardan en IndexedDB con solo
// los ids, así una pista borrada de la biblioteca simplemente deja de salir.
import { db, nuevoId, type Item, type Lista } from "./db";

/** «Mi playlist n.º N», con el primer número que no esté usado. */
export function siguienteNombre(nombres: string[]) {
  const usados = new Set(nombres.map((n) => /^Mi playlist n\.º (\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number));
  let n = 1;
  while (usados.has(n)) n++;
  return `Mi playlist n.º ${n}`;
}

/** Copia de `lista` con el elemento `de` movido a la posición `a`. */
export function mover<T>(lista: T[], de: number, a: number): T[] {
  if (de === a || de < 0 || de >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(Math.max(0, Math.min(a, copia.length)), 0, x);
  return copia;
}

/** Hasta cuatro carátulas distintas para el mosaico; con menos de cuatro, solo la primera. */
export function portadasDe(pistas: Item[]) {
  const unicas = [...new Set(pistas.map((p) => p.portada).filter((p): p is string => !!p))];
  return unicas.length >= 4 ? unicas.slice(0, 4) : unicas.slice(0, 1);
}

/** Las pistas de una playlist que siguen en la biblioteca, en su orden. */
export function pistasDe(lista: Lista, porId: Map<string, Item>) {
  return lista.pistas.flatMap((x, indice) => {
    const item = porId.get(x.id);
    return item ? [{ item, indice, agregada: x.agregada }] : [];
  });
}

export async function crearLista(items: Item[] = []): Promise<Lista> {
  const ahora = Date.now();
  const lista: Lista = {
    id: nuevoId(),
    nombre: siguienteNombre((await db.listas.toArray()).map((l) => l.nombre)),
    pistas: items.map((p) => ({ id: p.id, agregada: ahora })),
    creada: ahora,
    actualizada: ahora,
  };
  await db.listas.add(lista);
  return lista;
}

/** Agrega las que aún no estén; devuelve cuántas se agregaron y cuántas ya estaban. */
export async function agregarALista(id: string, items: Item[]) {
  return db.transaction("rw", db.listas, async () => {
    const lista = await db.listas.get(id);
    if (!lista) throw new Error("Esa playlist ya no existe.");
    const ya = new Set(lista.pistas.map((x) => x.id));
    const ahora = Date.now();
    const nuevas = items.filter((p, i) => !ya.has(p.id) && items.findIndex((q) => q.id === p.id) === i);
    await db.listas.update(id, { pistas: [...lista.pistas, ...nuevas.map((p) => ({ id: p.id, agregada: ahora }))], actualizada: ahora });
    return { lista, agregadas: nuevas.length, repetidas: items.length - nuevas.length };
  });
}

async function cambiarPistas(id: string, f: (pistas: Lista["pistas"]) => Lista["pistas"]) {
  await db.transaction("rw", db.listas, async () => {
    const lista = await db.listas.get(id);
    if (lista) await db.listas.update(id, { pistas: f(lista.pistas), actualizada: Date.now() });
  });
}

/** Quita la pista que está en la posición `indice` (una pista puede repetirse en listas antiguas). */
export const quitarDeLista = (id: string, indice: number) => cambiarPistas(id, (p) => p.filter((_, i) => i !== indice));

export const moverEnLista = (id: string, de: number, a: number) => cambiarPistas(id, (p) => mover(p, de, a));

export async function editarLista(id: string, cambios: { nombre: string; descripcion?: string }) {
  const nombre = cambios.nombre.trim();
  if (!nombre) throw new Error("La playlist necesita un nombre.");
  await db.listas.update(id, { nombre, descripcion: cambios.descripcion?.trim() || undefined, actualizada: Date.now() });
}

export const borrarLista = (id: string) => db.listas.delete(id);
