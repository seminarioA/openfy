import { describe, expect, it } from "vitest";
import type { Item } from "./db";
import { agruparAlbumes, agruparArtistas, artistasDe, ordenarPistas, populares } from "./musica";

let n = 0;
function pista(titulo: string, musica: Record<string, unknown> = {}, extra: Partial<Item> = {}): Item {
  n++;
  return { id: `p${n}`, tipo: "audio", titulo, mime: "audio/flac", guardado: 1, creado: n, extra: { musica }, ...extra };
}

describe("agruparAlbumes", () => {
  it("agrupa por artista del álbum y título, sin importar mayúsculas", () => {
    const a1 = pista("Mayonaka no Door", { album: "Pocket Park", albumArtista: "Miki Matsubara", pista: 2 }, { autores: ["Miki Matsubara"] });
    const a2 = pista("Pocket Park", { album: "pocket park", albumArtista: "Miki Matsubara", pista: 1 }, { autores: ["Miki Matsubara"], portada: "data:x" });
    const b1 = pista("Timely", { album: "Timely!!", pista: 1 }, { autores: ["Anri"] });
    const { albumes, sueltas } = agruparAlbumes([a1, a2, b1]);
    expect(sueltas).toEqual([]);
    expect(albumes).toHaveLength(2);
    const pocket = albumes.find((a) => a.titulo.toLowerCase() === "pocket park")!;
    expect(pocket.pistas.map((p) => p.titulo)).toEqual(["Pocket Park", "Mayonaka no Door"]);
    expect(pocket.portada).toBe("data:x");
    expect(pocket.artista).toBe("Miki Matsubara");
  });

  it("deja sueltas las pistas sin álbum", () => {
    const { albumes, sueltas } = agruparAlbumes([pista("Nota de voz")]);
    expect(albumes).toHaveLength(0);
    expect(sueltas.map((p) => p.titulo)).toEqual(["Nota de voz"]);
  });

  it("una recopilación sin artista del álbum es de varios artistas", () => {
    // Sueltas y sin artista del álbum, el mismo título de distintos artistas son discos distintos.
    const x = pista("A", { album: "Éxitos 80" }, { autores: ["Uno"] });
    const y = pista("B", { album: "Éxitos 80" }, { autores: ["Dos"] });
    expect(agruparAlbumes([x, y]).albumes).toHaveLength(2);
    // Del mismo ZIP, son un solo disco de varios artistas.
    const zx = pista("A", { album: "Éxitos 80" }, { autores: ["Uno"], extra: { musica: { album: "Éxitos 80" }, zip: "exitos.zip" } });
    const zy = pista("B", { album: "Éxitos 80" }, { autores: ["Dos"], extra: { musica: { album: "Éxitos 80" }, zip: "exitos.zip" } });
    const [unico, ...resto] = agruparAlbumes([zx, zy]).albumes;
    expect(resto).toHaveLength(0);
    expect(unico.artista).toBe("Varios artistas");
    const z = pista("C", { album: "Éxitos 80", albumArtista: "Varios" }, { autores: ["Tres"] });
    const w = pista("D", { album: "Éxitos 80", albumArtista: "Varios" }, { autores: ["Cuatro"] });
    expect(agruparAlbumes([z, w]).albumes[0].artista).toBe("Varios");
  });

  it("ordena los álbumes por el más recién añadido", () => {
    const viejo = pista("A", { album: "Viejo" }, { autores: ["X"], creado: 1 });
    const nuevo = pista("B", { album: "Nuevo" }, { autores: ["X"], creado: 99 });
    expect(agruparAlbumes([viejo, nuevo]).albumes.map((a) => a.titulo)).toEqual(["Nuevo", "Viejo"]);
  });
});

describe("ordenarPistas", () => {
  it("ordena por disco, número y, sin número, por título natural", () => {
    const orden = ordenarPistas([
      pista("Pista 10", {}),
      pista("b", { disco: 2, pista: 1 }),
      pista("a", { disco: 1, pista: 2 }),
      pista("Pista 2", {}),
      pista("c", { disco: 1, pista: 1 }),
    ]).map((p) => p.titulo);
    expect(orden).toEqual(["c", "a", "Pista 2", "Pista 10", "b"]);
  });
});

describe("artistas", () => {
  it("una pista es de sus artistas y del artista del álbum, sin repetir ni «Varios artistas»", () => {
    const p = pista("Stay With Me", { album: "Pocket Park", albumArtista: "Miki Matsubara" }, { autores: ["松原みき", "miki matsubara"] });
    expect(artistasDe(p)).toEqual(["松原みき", "miki matsubara"]);
    expect(artistasDe(pista("X", { albumArtista: "Varios artistas" }, { autores: ["Uno"] }))).toEqual(["Uno"]);
  });

  it("agrupa por artista: sus álbumes, dónde aparece y las sueltas al final", () => {
    const a1 = pista("Uno", { album: "Propio", albumArtista: "Anri", pista: 1, anio: 1983 }, { autores: ["Anri"] });
    const a2 = pista("Dos", { album: "Propio", albumArtista: "Anri", pista: 2, anio: 1983 }, { autores: ["Anri"] });
    const col = pista("Juntos", { album: "Dúos", albumArtista: "Otro", pista: 1 }, { autores: ["Anri"] });
    const otra = pista("Ajena", { album: "Dúos", albumArtista: "Otro", pista: 2 }, { autores: ["Otro"] });
    const suelta = pista("Demo", {}, { autores: ["ANRI"] });
    const anri = agruparArtistas([a1, a2, col, otra, suelta]).find((a) => a.clave === "anri")!;
    expect(anri.nombre).toBe("Anri");
    expect(anri.albumes.map((a) => a.titulo)).toEqual(["Propio"]);
    expect(anri.apareceEn.map((a) => a.titulo)).toEqual(["Dúos"]);
    expect(anri.pistas.map((p) => p.titulo)).toEqual(["Uno", "Dos", "Juntos", "Demo"]);
  });

  it("populares: más veces primero, luego la última escucha; las no escuchadas conservan su orden", () => {
    const [x, y, z, w] = ["x", "y", "z", "w"].map((t) => pista(t));
    const orden = populares([x, y, z, w], [
      { id: z.id, visto: 10, veces: 3 },
      { id: y.id, visto: 50 },
      { id: w.id, visto: 20, veces: 1 },
    ]);
    expect(orden.map((p) => p.titulo)).toEqual(["z", "y", "w", "x"]);
  });

  it("une el nombre del álbum en latino con el de las pistas en otro alfabeto", () => {
    const pocket = [1, 2].map((n) => pista(`P${n}`, { album: "Pocket Park", albumArtista: "Miki Matsubara", pista: n, anio: 1980 }, { autores: ["松原みき"] }));
    const cupid = pista("Cupid", { album: "Cupid", albumArtista: "松原みき", pista: 1 }, { autores: ["松原みき"] });
    const artistas = agruparArtistas([...pocket, cupid]);
    expect(artistas).toHaveLength(1);
    const [miki] = artistas;
    expect(miki.nombre).toBe("松原みき");
    expect(miki.alias).toEqual(["Miki Matsubara"]);
    expect(miki.claves).toEqual(expect.arrayContaining(["miki matsubara", "松原みき"]));
    expect(miki.pistas).toHaveLength(3);
    expect(miki.albumes.map((a) => a.titulo).sort()).toEqual(["Cupid", "Pocket Park"]);
  });

  it("no une créditos del mismo alfabeto (A y «A feat. B»)", () => {
    const x = pista("Uno", { album: "Single", albumArtista: "Anri" }, { autores: ["Anri feat. Otro"] });
    expect(agruparArtistas([x]).map((a) => a.nombre).sort()).toEqual(["Anri", "Anri feat. Otro"]);
  });
});
