import { beforeEach, describe, expect, it } from "vitest";
import { borrarHistorial, pausarHistorial, quitarDelHistorial, registrarEscucha, vistoDe } from "./historial";

describe("historial de escuchas", () => {
  beforeEach(() => {
    pausarHistorial(false);
    borrarHistorial();
  });

  it("cuenta cuántas veces se escuchó cada pista", () => {
    registrarEscucha("pista1");
    registrarEscucha("pista1");
    expect(vistoDe("pista1")?.veces).toBe(2);
  });

  it("en pausa no se registra nada; quitar borra una sola entrada", () => {
    pausarHistorial(true);
    registrarEscucha("pista1");
    expect(vistoDe("pista1")).toBeUndefined();
    pausarHistorial(false);
    registrarEscucha("pista1");
    registrarEscucha("pista2");
    quitarDelHistorial("pista1");
    expect(vistoDe("pista1")).toBeUndefined();
    expect(vistoDe("pista2")).toBeDefined();
  });
});
