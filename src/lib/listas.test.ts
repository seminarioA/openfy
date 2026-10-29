import { describe, expect, it } from "vitest";
import type { Item, Lista } from "./db";
import { mover, pistasDe, portadasDe, siguienteNombre } from "./listas";

const item = (id: string, portada?: string): Item => ({ id, tipo: "audio", titulo: id, mime: "audio/flac", guardado: 1, creado: 0, portada });

describe("siguienteNombre", () => {
  it("usa el primer número libre", () => {
    expect(siguienteNombre([])).toBe("Mi playlist n.º 1");
    expect(siguienteNombre(["Mi playlist n.º 1", "Mi playlist n.º 3", "Para correr"])).toBe("Mi playlist n.º 2");
  });
});

describe("mover", () => {
  it("mueve hacia abajo y hacia arriba sin tocar el original", () => {
    const l = ["a", "b", "c", "d"];
    expect(mover(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(mover(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(mover(l, 1, 99)).toEqual(["a", "c", "d", "b"]);
    expect(l).toEqual(["a", "b", "c", "d"]);
  });
});

describe("portadasDe", () => {
  it("mosaico con cuatro carátulas distintas; si no llegan, solo la primera", () => {
    expect(portadasDe([item("1", "a"), item("2", "a"), item("3", "b")])).toEqual(["a"]);
    expect(portadasDe(["a", "b", "b", "c", "d", "e"].map((p, i) => item(String(i), p)))).toEqual(["a", "b", "c", "d"]);
    expect(portadasDe([item("1")])).toEqual([]);
  });
});

describe("pistasDe", () => {
  it("salta las pistas que ya no están en la biblioteca y conserva su posición", () => {
    const lista: Lista = { id: "l", nombre: "L", creada: 0, actualizada: 0, pistas: [{ id: "a", agregada: 1 }, { id: "borrada", agregada: 2 }, { id: "b", agregada: 3 }] };
    const r = pistasDe(lista, new Map([["a", item("a")], ["b", item("b")]]));
    expect(r.map((x) => [x.item.id, x.indice])).toEqual([["a", 0], ["b", 2]]);
  });
});
