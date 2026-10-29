import { describe, expect, it } from "vitest";
import { empalmar, recortarBordes } from "./audio-voz";

const SR = 1000;
const tono = (s: number, a = 0.5) => Float32Array.from({ length: Math.round(SR * s) }, (_, i) => a * Math.sin(i / 3));
const silencio = (s: number) => new Float32Array(Math.round(SR * s));
const unir = (...p: Float32Array[]) => {
  const r = new Float32Array(p.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of p) (r.set(x, o), (o += x.length));
  return r;
};

describe("recortarBordes", () => {
  it("quita el silencio de los bordes y deja un respiro", () => {
    const r = recortarBordes(unir(silencio(0.5), tono(1), silencio(0.8)), SR);
    expect(r.length / SR).toBeGreaterThan(1);
    expect(r.length / SR).toBeLessThan(1.1);
  });
  it("todo silencio: nada", () => expect(recortarBordes(silencio(1), SR).length).toBe(0));
});

describe("empalmar", () => {
  it("pone la pausa entre trozos, ignora los vacíos y normaliza el pico", () => {
    const r = empalmar([tono(1, 0.3), new Float32Array(0), tono(0.5, 0.5)], SR, 0.12);
    expect(r.length).toBe(1000 + 120 + 500);
    expect(Math.max(...r.map(Math.abs))).toBeCloseTo(0.9, 2);
  });
  it("no sube más de ×4 un audio muy bajo", () => {
    const r = empalmar([tono(1, 0.01)], SR, 0.1);
    expect(Math.max(...r.map(Math.abs))).toBeLessThan(0.05);
  });
});
