import { describe, expect, it } from "vitest";
import { elegirResultado, esLaMisma, formasArtista, formasTitulo, leerLrc, lineaActual, normalizar, sanear, type Pista } from "./letras";

describe("leerLrc", () => {
  it("lee marcas, ignora metadatos y ordena por tiempo", () => {
    const lrc = "[ar:Artista]\n[ti:Título]\n[00:12.50]Segunda\n[00:01.00]Primera\n\n[01:02.3]Tercera";
    expect(leerLrc(lrc)).toEqual([
      { t: 1, texto: "Primera" },
      { t: 12.5, texto: "Segunda" },
      { t: 62.3, texto: "Tercera" },
    ]);
  });

  it("una línea con varias marcas se repite en cada una y aplica el offset", () => {
    const lineas = leerLrc("[offset:+500]\n[00:10.00][00:30.00]Estribillo");
    expect(lineas).toEqual([
      { t: 10.5, texto: "Estribillo" },
      { t: 30.5, texto: "Estribillo" },
    ]);
  });

  it("acepta minutos y segundos con dos puntos (00:10:50)", () => {
    expect(leerLrc("[00:10:50]Hola")[0].t).toBeCloseTo(10.5);
  });
});

describe("lineaActual", () => {
  const lineas = [
    { t: 1, texto: "a" },
    { t: 5, texto: "b" },
    { t: 9, texto: "c" },
  ];
  it("antes de la primera es -1; luego la última que empezó", () => {
    expect(lineaActual(lineas, 0.5)).toBe(-1);
    expect(lineaActual(lineas, 1)).toBe(0);
    expect(lineaActual(lineas, 7)).toBe(1);
    expect(lineaActual(lineas, 100)).toBe(2);
  });
});

describe("elegirResultado", () => {
  it("prefiere una sincronizada de duración parecida a una en texto más exacta", () => {
    const r = elegirResultado(
      [
        { plainLyrics: "texto", duration: 312 },
        { plainLyrics: "texto", syncedLyrics: "[00:01.00]a", duration: 306 },
      ],
      312,
    );
    expect(r?.syncedLyrics).toBeTruthy();
  });
  it("si la sincronizada está lejos en duración, se queda con la más parecida", () => {
    const r = elegirResultado(
      [
        { plainLyrics: "texto", duration: 312 },
        { syncedLyrics: "[00:01.00]a", duration: 400 },
      ],
      312,
    );
    expect(r?.duration).toBe(312);
  });
});

describe("esLaMisma", () => {
  const pista = (titulo: string, nombres: string[], album?: string, duracion = 0): Pista => ({
    titulos: formasTitulo(titulo),
    artistas: new Set(nombres.flatMap((n) => [...formasArtista(n)])),
    titulo: normalizar(titulo),
    album: album ? normalizar(album) : undefined,
    duracion,
  });
  const p = pista("真夜中のドア / Stay With Me", ["松原みき", "Miki Matsubara"], "Pocket Park", 312);
  it("reconoce la canción escrita de otra forma y con el artista en otro alfabeto o como canal «Topic»", () => {
    for (const [trackName, artistName] of [
      ["真夜中のドア - Stay With Me", "松原みき"],
      ["真夜中のドア〜stay with me", "松原みき"],
      ["真夜中のドア/Stay With Me", "Miki Matsubara - Topic"],
      ["Mayonaka no Door / Stay With Me", "Miki Matsubara"],
    ])
      expect(esLaMisma({ trackName, artistName }, p), `${trackName} · ${artistName}`).toBe(true);
  });
  it("no acepta la misma canción de otro artista ni otra canción de la misma artista", () => {
    expect(esLaMisma({ trackName: "真夜中のドア / STAY WITH ME", artistName: "Rainych" }, p)).toBe(false);
    expect(esLaMisma({ trackName: "It's So Creamy", artistName: "松原みき" }, p)).toBe(false);
  });
  it("el artista en otro alfabeto: entre paréntesis, entre corchetes o invertido", () => {
    const slow = pista("Slow Nights", ["亜蘭知子"], "More Relax", 224);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "Tomoko Aran(亜蘭知子)" }, slow)).toBe(true);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "亜蘭知子 [Tomoko Aran]" }, slow)).toBe(true);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "Aran, Tomoko" }, pista("Slow Nights", ["Tomoko Aran"]))).toBe(true);
  });
  it("con el artista solo en otro alfabeto, exige el mismo título, álbum y duración", () => {
    const slow = pista("Slow Nights", ["亜蘭知子"], "More Relax", 224);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "Tomoko Aran", albumName: "MORE RELAX", duration: 224 }, slow)).toBe(true);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "Tomoko Aran", albumName: "MORE RELAX", duration: 195 }, slow)).toBe(false);
    expect(esLaMisma({ trackName: "Slow Nights", artistName: "Besomorph", albumName: "Slow Nights", duration: 224 }, slow)).toBe(false);
  });
  it("un crédito con varios artistas basta con que uno coincida", () => {
    expect(esLaMisma({ trackName: "Stay With Me", artistName: "Rainych, Miki Matsubara" }, p)).toBe(true);
  });
});

describe("sanear", () => {
  it("descarta lo que no tiene forma de resultado y recorta letras desmesuradas", () => {
    expect(sanear(null)).toBeNull();
    expect(sanear("<script>")).toBeNull();
    const r = sanear({ trackName: 7, syncedLyrics: "x".repeat(100_000), duration: "312" })!;
    expect(r.trackName).toBeUndefined();
    expect(r.duration).toBeUndefined();
    expect(r.syncedLyrics!.length).toBe(60_000);
  });
});
