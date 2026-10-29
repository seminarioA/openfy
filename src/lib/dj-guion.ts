// Lo que el DJ pone y lo que dice, como el DJ de Spotify: tandas de 3 o 4
// canciones (tus favoritas, lo que hace tiempo no escuchas, lo que todavía no
// has escuchado, un rato con un artista, la misma década) y, antes de cada
// tanda, una frase hecha con tus datos de verdad: nombres, años y cuántas
// veces la pusiste. Nada inventado: si un dato no está, la frase no lo usa.
import type { Item } from "./db";
import { datosMusica } from "./musica";

export interface Escucha {
  veces?: number;
  visto: number;
}

export interface Tanda {
  tipo: "inicio" | "favoritas" | "olvidadas" | "nuevas" | "artista" | "decada" | "mezcla";
  pistas: Item[];
  guion: string;
}

const DIA = 86_400_000;

/** Si se puede leer en voz alta en español: solo letras latinas, números y signos. */
export const pronunciable = (texto: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}]+$/u.test(texto.trim());

/** La parte del título que se puede leer («真夜中のドア / Stay With Me» → «Stay With Me»); `null` si no hay. */
export function tituloLeible(titulo: string) {
  if (pronunciable(titulo)) return titulo.trim();
  const partes = titulo.split(/\s*(?:\/|-|〜|~|～|\(|\)|（|）)\s*/).map((p) => p.trim()).filter((p) => p.length > 1 && pronunciable(p) && /\p{L}/u.test(p));
  return partes[0] ?? null;
}

/** El primer nombre del artista que se puede leer (los alias en otro alfabeto: 松原みき → Miki Matsubara). */
export function artistaLeible(nombres: (string | undefined)[]) {
  return nombres.find((n): n is string => !!n && pronunciable(n) && /\p{L}/u.test(n)) ?? null;
}

// ---------- idioma de cada nombre ----------

const ESPANOL = new Set("de del la el los las que y en un una mi tu te me por para con sin al lo se no amor corazón vida noche sol mar luna".split(" "));
const INGLES = new Set(
  ("the a an of to in on at by for from with without and or but is are be been was were i i'm im you your yours me my mine we our us they their he she his her it its " +
    "this that these those all any some no not don't can't won't never ever always just so too only one two love lover lovers night nights day days time " +
    "baby girl boy man woman heart eyes mind soul dream dreams life world city town street road home away back down up out over under " +
    "stay go come take make give get let say tell call feel want wanna gonna need know think see look hold run fall dance cry smile " +
    "good bad new old young little big slow fast high low hot cold blue red white black gold golden summer winter spring autumn rain wind sky sun moon star stars " +
    "fire light lights dark door window game games maker trouble friend friends love's yesterday today tomorrow tonight forever goodbye good-bye hello " +
    "kiss touch magic music song songs party crazy sweet lonely alone together again more less last first best only true real midnight morning evening " +
    "remember forget believe inside outside where when why what who how if than then there here").split(" "),
);

/** Palabras en minúsculas, sin signos. */
const palabras = (t: string) => t.toLowerCase().normalize("NFKC").match(/[\p{L}']+/gu) ?? [];

/**
 * En qué idioma leer un nombre: «en» si tiene palabras en inglés («Night
 * Cruising», «Stay With Me»); «es» si es español o no se sabe, que es como
 * mejor suenan los nombres japoneses en letras latinas (Miki Matsubara).
 */
export function idiomaDe(texto: string): "es" | "en" {
  if (/[ñáéíóúü¿¡]/i.test(texto)) return "es";
  const ps = palabras(texto);
  // Palabras con ortografía inglesa que no tiene ni el español ni el japonés en letras latinas.
  const ortografiaInglesa = (p: string) => /(ing|ight|ness|less|tion|[^aeiouy]y)$|th|ee|ea|wh|ck|ph|oo[^k]/.test(p);
  const ingles = ps.filter((p) => INGLES.has(p) || ortografiaInglesa(p)).length;
  const espanol = ps.filter((p) => ESPANOL.has(p)).length;
  return ingles > espanol ? "en" : "es";
}

// Un nombre que va en inglés se marca en la frase así: ⟦Stay With Me⟧.
const MARCA = /⟦([^⟧]*)⟧/g;
const marcar = (texto: string) => (idiomaDe(texto) === "en" ? `⟦${texto}⟧` : texto);

/** La frase tal como se lee en pantalla (sin las marcas de idioma). */
export const textoDe = (guion: string) => guion.replace(MARCA, "$1");

/** La frase en trozos con su idioma, para la voz: lo marcado, en inglés; el resto, en español. */
export function trozosDe(guion: string): { texto: string; idioma: "es" | "en" }[] {
  const trozos: { texto: string; idioma: "es" | "en" }[] = [];
  let desde = 0;
  for (const m of guion.matchAll(MARCA)) {
    const antes = guion.slice(desde, m.index).trim();
    if (antes) trozos.push({ texto: antes, idioma: "es" });
    trozos.push({ texto: m[1], idioma: "en" });
    desde = m.index! + m[0].length;
  }
  const resto = guion.slice(desde).trim();
  // Un resto de solo signos («.», «,») no se dice: se queda con el trozo anterior.
  if (resto && /\p{L}|\p{N}/u.test(resto)) trozos.push({ texto: resto.replace(/^[,.;:]\s*/, ""), idioma: "es" });
  else if (resto && trozos.length) trozos[trozos.length - 1].texto += resto;
  return trozos.filter((t) => t.texto.trim());
}

export function saludo(hora: number) {
  return hora >= 5 && hora < 12 ? "Buenos días" : hora >= 12 && hora < 19 ? "Buenas tardes" : "Buenas noches";
}

const DECADAS: Record<number, string> = { 50: "los cincuenta", 60: "los sesenta", 70: "los setenta", 80: "los ochenta", 90: "los noventa" };
/** «los ochenta», «los dos mil», «los dos mil diez»… */
export function decada(anio: number) {
  const d = Math.floor(anio / 10) * 10;
  if (d >= 1950 && d < 2000) return DECADAS[d % 100];
  if (d === 2000) return "los dos mil";
  if (d === 2010) return "los dos mil diez";
  if (d === 2020) return "los dos mil veinte";
  return null;
}

const NUMEROS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce"];
export const vecesEnLetras = (n: number) => (n === 1 ? "una vez" : `${NUMEROS[n] ?? n} veces`);

/** «un par de semanas», «más de un mes», «varios meses»… */
export function tiempoDesde(ms: number) {
  const dias = ms / DIA;
  if (dias < 10) return "unos días";
  if (dias < 21) return "un par de semanas";
  if (dias < 45) return "más de un mes";
  if (dias < 300) return "varios meses";
  return "más de un año";
}

export interface Contexto {
  pistas: Item[];
  escuchas: Map<string, Escucha>;
  /** Todos los nombres de cada artista (el suyo y sus alias), por nombre. */
  aliasDe: (nombre: string) => string[];
  ahora: number;
  hora: number;
  azar?: () => number;
}

function barajar<T>(lista: T[], azar: () => number) {
  const c = [...lista];
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** Primera letra en mayúscula, también si empieza con una marca de idioma. */
const mayuscula = (t: string) => t.replace(/^(⟦?)(.)/, (_, m: string, c: string) => m + c.toUpperCase());

const elegir = <T,>(opciones: T[], azar: () => number) => opciones[Math.floor(azar() * opciones.length)];

/** Cómo nombrar una pista en voz alta: «"Título", de Artista», lo que se pueda leer de ello (con el idioma marcado). */
function presentar(p: Item, ctx: Contexto) {
  const a = artistaLeible((p.autores ?? []).flatMap((n) => [n, ...ctx.aliasDe(n)]));
  const t = tituloLeible(p.titulo);
  const artista = a ? marcar(a) : null;
  const titulo = t ? marcar(t) : null;
  if (titulo && artista) return `${titulo}, de ${artista}`;
  if (titulo) return titulo;
  if (artista) return `esta de ${artista}`;
  return null;
}

/** La frase de una tanda: sobre su primera canción y lo que tiene en común. */
export function guionDe(tipo: Tanda["tipo"], pistas: Item[], ctx: Contexto, azar: () => number): string {
  const p = pistas[0];
  const quien = presentar(p, ctx);
  const e = ctx.escuchas.get(p.id);
  const anio = datosMusica(p).anio;
  const leible = artistaLeible((p.autores ?? []).flatMap((n) => [n, ...ctx.aliasDe(n)]));
  const artista = leible ? marcar(leible) : null;
  const sigue = quien ? `Empezamos con ${quien}.` : "Empezamos.";
  switch (tipo) {
    case "inicio":
      return `${saludo(ctx.hora)}. Soy tu DJ y hoy pongo tu música. ${quien ? `Arrancamos con ${quien}.` : "Arrancamos."}`;
    case "favoritas":
      return e?.veces && e.veces > 1
        ? elegir([`Una que ya te sabes: la has puesto ${vecesEnLetras(e.veces)}. ${quien ? `${mayuscula(quien)}.` : ""}`, `Vamos con tus favoritas. ${sigue}`], azar).trim()
        : `Vamos con tus favoritas. ${sigue}`;
    case "olvidadas":
      return e ? `Hace ${tiempoDesde(ctx.ahora - e.visto)} que no escuchabas esto. ${sigue}` : `Algo que hace tiempo no escuchas. ${sigue}`;
    case "nuevas":
      return elegir([`Ahora, canciones que todavía no has escuchado. ${sigue}`, `Algo nuevo para ti, aunque ya estaba en tu biblioteca. ${sigue}`], azar);
    case "artista":
      return artista ? `Un rato con ${artista}. ${tituloLeible(p.titulo) ? `Empezamos con ${marcar(tituloLeible(p.titulo)!)}.` : ""}`.trim() : `Seguimos con el mismo artista. ${sigue}`;
    case "decada": {
      const d = anio ? decada(anio) : null;
      return d ? `Nos vamos a ${d}${anio ? `, a ${anio}` : ""}. ${sigue}` : `Seguimos. ${sigue}`;
    }
    default:
      return quien
        ? elegir([`Seguimos con ${quien}.`, `Ahora, ${quien}.`, `Y sigue ${quien}.`, `Va ${quien}.`], azar)
        : elegir(["Seguimos.", "Y seguimos con más."], azar);
  }
}

/**
 * La sesión: tandas de 3 o 4 canciones sin repetir ninguna, alternando el
 * tipo. La primera son tus favoritas (o lo que haya).
 */
export function armarSesion(ctx: Contexto, maximo = 6): Tanda[] {
  const azar = ctx.azar ?? Math.random;
  const usadas = new Set<string>();
  const libres = (lista: Item[]) => lista.filter((p) => !usadas.has(p.id));
  /** De 3 a 4 canciones aún no puestas; si no llegan a `minimo`, ninguna (la tanda no se hace). */
  const tomar = (lista: Item[], minimo = 3) => {
    const elegidas = libres(lista).slice(0, 3 + Math.floor(azar() * 2));
    if (elegidas.length < minimo) return [];
    elegidas.forEach((p) => usadas.add(p.id));
    return elegidas;
  };
  const veces = (p: Item) => ctx.escuchas.get(p.id)?.veces ?? (ctx.escuchas.has(p.id) ? 1 : 0);
  const favoritas = () => barajar(ctx.pistas.filter((p) => veces(p) >= 2), azar).sort((a, b) => veces(b) - veces(a)).slice(0, 12);
  const olvidadas = () => barajar(ctx.pistas.filter((p) => ctx.escuchas.has(p.id) && ctx.ahora - ctx.escuchas.get(p.id)!.visto > 14 * DIA), azar);
  const nuevas = () => barajar(ctx.pistas.filter((p) => !ctx.escuchas.has(p.id)), azar);
  const deArtista = () => {
    const grupos = new Map<string, Item[]>();
    for (const p of libres(ctx.pistas)) for (const a of p.autores?.slice(0, 1) ?? []) grupos.set(a, [...(grupos.get(a) ?? []), p]);
    const candidatos = [...grupos.values()].filter((g) => g.length >= 3);
    return candidatos.length ? barajar(elegir(candidatos, azar), azar) : [];
  };
  const deDecada = () => {
    const porDecada = new Map<number, Item[]>();
    for (const p of libres(ctx.pistas)) {
      const a = datosMusica(p).anio;
      if (a && decada(a)) porDecada.set(Math.floor(a / 10), [...(porDecada.get(Math.floor(a / 10)) ?? []), p]);
    }
    const candidatas = [...porDecada.values()].filter((g) => g.length >= 3);
    return candidatas.length ? barajar(elegir(candidatas, azar), azar) : [];
  };

  const tandas: Tanda[] = [];
  const agregar = (tipo: Tanda["tipo"], pistas: Item[]) => {
    if (pistas.length) tandas.push({ tipo, pistas, guion: guionDe(tipo, pistas, ctx, azar) });
  };
  const primera = tomar(favoritas());
  agregar("inicio", primera.length ? primera : tomar(barajar(ctx.pistas, azar), 1));
  const turnos: [Tanda["tipo"], () => Item[]][] = [
    ["nuevas", nuevas],
    ["artista", deArtista],
    ["olvidadas", olvidadas],
    ["decada", deDecada],
    ["favoritas", favoritas],
  ];
  for (let i = 0; tandas.length < maximo && i < turnos.length * 2; i++) {
    const [tipo, fuente] = turnos[i % turnos.length];
    agregar(tipo, tomar(fuente()));
  }
  // Si la biblioteca es corta y faltan tandas, lo que quede, mezclado.
  while (tandas.length < maximo && libres(ctx.pistas).length) agregar("mezcla", tomar(barajar(ctx.pistas, azar), 1));
  return tandas;
}
