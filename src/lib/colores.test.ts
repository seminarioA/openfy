import { describe, expect, it } from "vitest";
import { elegirColor, paraFondo } from "./colores";

const pixeles = (...colores: [number, number, number, number][]) => new Uint8ClampedArray(colores.flatMap((c) => c));

describe("elegirColor", () => {
  it("prefiere un tono vivo a un gris aunque haya más gris", () => {
    const gris: [number, number, number, number] = [128, 128, 128, 255];
    const morado: [number, number, number, number] = [110, 60, 190, 255];
    const [r, g, b] = elegirColor(pixeles(gris, gris, gris, morado, morado))!;
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it("ignora casi blancos, casi negros y transparentes", () => {
    expect(elegirColor(pixeles([250, 250, 250, 255], [5, 5, 5, 255], [200, 30, 30, 0]))).toBeNull();
  });
});

describe("paraFondo", () => {
  it("oscurece los colores claros y deja los oscuros", () => {
    expect(paraFondo([240, 220, 200])).not.toBe("rgb(240, 220, 200)");
    expect(paraFondo([40, 30, 80])).toBe("rgb(40, 30, 80)");
  });
});
