import { describe, expect, it } from "vitest";
import type { Item } from "./db";
import { armarSesion, artistaLeible, decada, guionDe, idiomaDe, saludo, textoDe, tituloLeible, trozosDe, type Contexto } from "./dj-guion";

const pista = (id: string, titulo: string, autor: string, anio?: number): Item => ({ id, tipo: "audio", titulo, autores: [autor], mime: "audio/flac", guardado: 1, creado: 0, extra: { musica: { anio } } });
const ALIAS: Record<string, string[]> = { 松原みき: ["Miki Matsubara"], 亜蘭知子: ["Tomoko Aran"] };
// Azar fijo: las pruebas no dependen de la suerte.
const fijo = () => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
const ctx = (pistas: Item[], escuchas: [string, number, number][] = []): Contexto => ({
  pistas,
  escuchas: new Map(escuchas.map(([id, veces, hace]) => [id, { veces, visto: Date.UTC(2026, 9, 29) - hace * 86_400_000 }])),
  aliasDe: (n) => ALIAS[n] ?? [],
  ahora: Date.UTC(2026, 9, 29),
  hora: 21,
  azar: fijo(),
});

describe("qué se puede leer en voz alta", () => {
  it("de un título en japonés y en inglés, la parte latina; si no hay, nada", () => {
    expect(tituloLeible("真夜中のドア / Stay With Me")).toBe("Stay With Me");
    expect(tituloLeible("Waterless Pool (水のないプール)")).toBe("Waterless Pool (水のないプール)".split(" (")[0]);
    expect(tituloLeible("裸足のサロメ")).toBeNull();
    expect(tituloLeible("Slow Nights")).toBe("Slow Nights");
  });
  it("del artista, su alias en letras latinas", () => {
    expect(artistaLeible(["松原みき", "Miki Matsubara"])).toBe("Miki Matsubara");
    expect(artistaLeible(["亜蘭知子"])).toBeNull();
  });
  it("saludo por la hora y décadas en palabras", () => {
    expect([saludo(8), saludo(15), saludo(23), saludo(3)]).toEqual(["Buenos días", "Buenas tardes", "Buenas noches", "Buenas noches"]);
    expect([decada(1980), decada(1987), decada(2004), decada(2015), decada(1930)]).toEqual(["los ochenta", "los ochenta", "los dos mil", "los dos mil diez", null]);
  });
});

describe("guionDe", () => {
  const c = ctx([], [["a", 5, 2]]);
  it("usa los datos reales: veces escuchada, nombre leíble y nunca el título en japonés", () => {
    const g = textoDe(guionDe("favoritas", [pista("a", "真夜中のドア / Stay With Me", "松原みき")], c, () => 0));
    expect(g).toContain("cinco veces");
    expect(g).toContain("Stay With Me, de Miki Matsubara");
    expect(g).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
  });
  it("sin nada leíble, no nombra la canción", () => {
    const g = guionDe("nuevas", [pista("b", "裸足のサロメ", "国分友里恵")], c, () => 0);
    expect(g).not.toMatch(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u);
    expect(g).toMatch(/Empezamos\.$/);
  });
  it("la década solo si la pista tiene año", () => {
    expect(guionDe("decada", [pista("c", "Slow Nights", "Tomoko Aran", 1983)], c, () => 0)).toContain("los ochenta, a 1983");
    expect(guionDe("decada", [pista("d", "Slow Nights", "Tomoko Aran")], c, () => 0)).not.toContain("los");
  });
});

describe("armarSesion", () => {
  const pistas = Array.from({ length: 30 }, (_, i) => pista(`p${i}`, `Canción ${i}`, i < 10 ? "Miki Matsubara" : i < 20 ? "Tomoko Aran" : "Otra", 1975 + i));
  const escuchas: [string, number, number][] = [
    ["p0", 9, 1],
    ["p1", 6, 2],
    ["p2", 4, 3],
    ["p11", 1, 60],
    ["p12", 2, 90],
  ];
  const sesion = armarSesion(ctx(pistas, escuchas));
  it("tandas de 3 o 4 canciones, sin repetir ninguna", () => {
    const ids = sesion.flatMap((t) => t.pistas.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of sesion) expect(t.pistas.length).toBeGreaterThanOrEqual(3);
    expect(sesion.length).toBe(6);
  });
  it("empieza saludando con tus favoritas", () => {
    expect(sesion[0].tipo).toBe("inicio");
    expect(sesion[0].guion).toMatch(/^Buenas noches\. Soy tu DJ/);
    expect(["p0", "p1", "p2"]).toContain(sesion[0].pistas[0].id);
  });
  it("con muy pocas canciones, no se cuelga y usa lo que hay", () => {
    const corta = armarSesion(ctx(pistas.slice(0, 2)));
    expect(corta.flatMap((t) => t.pistas).length).toBe(2);
  });
});

describe("idioma de cada nombre", () => {
  it("títulos en inglés, en inglés; en español o nombres japoneses, en español", () => {
    for (const t of ["Stay With Me", "Slow Nights", "Night Cruising", "Midnight Pretenders", "I Can't Say Good-bye", "Mind Game", "Good Friend", "Privacy", "Run Rabbit Run", "Cosmic Love"]) expect(idiomaDe(t), t).toBe("en");
    for (const t of ["Miki Matsubara", "Tomoko Aran", "Mayonaka no Doa", "Corazón de melón", "La noche", "Momoko Kikuchi", "Yurie Kokubu", "Hoy", "Muy bien"]) expect(idiomaDe(t), t).toBe("es");
  });
  it("la frase se parte en trozos con su idioma y en pantalla se lee sin marcas", () => {
    const c = ctx([], [["a", 9, 2]]);
    const g = guionDe("favoritas", [pista("a", "Slow Nights", "亜蘭知子")], c, () => 0);
    expect(textoDe(g)).toBe("Una que ya te sabes: la has puesto nueve veces. Slow Nights, de Tomoko Aran.");
    expect(trozosDe(g)).toEqual([
      { texto: "Una que ya te sabes: la has puesto nueve veces.", idioma: "es" },
      { texto: "Slow Nights", idioma: "en" },
      { texto: "de Tomoko Aran.", idioma: "es" },
    ]);
  });
  it("un título en inglés al final se queda con su punto", () => {
    expect(trozosDe("Empezamos con ⟦Stay With Me⟧.")).toEqual([
      { texto: "Empezamos con", idioma: "es" },
      { texto: "Stay With Me.", idioma: "en" },
    ]);
  });
});
