export function bytes(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export function duracion(seg?: number | null) {
  if (seg == null || !Number.isFinite(seg)) return "—";
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function fecha(valor?: string | number | null) {
  if (!valor) return "";
  const d = typeof valor === "number" ? new Date(valor < 1e12 ? valor * 1000 : valor) : new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return d.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" });
}

/** «Hoy», «Ayer», el día de la semana (esta semana) o la fecha: para agrupar historiales. */
export function diaRelativo(ms: number) {
  const d = new Date(ms);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(d, new Date())) return "Hoy";
  if (mismoDia(d, new Date(Date.now() - 86400000))) return "Ayer";
  if (Date.now() - ms < 6 * 86400000) return d.toLocaleDateString("es-PE", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/** Hora del día, «10:42». */
export function hora(ms: number) {
  return new Date(ms).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

/** Agrupa por `diaRelativo`, conservando el orden. */
export function agruparPorDia<T>(lista: T[], fecha: (x: T) => number): [string, T[]][] {
  const grupos = new Map<string, T[]>();
  for (const x of lista) {
    const dia = diaRelativo(fecha(x));
    grupos.set(dia, [...(grupos.get(dia) ?? []), x]);
  }
  return [...grupos.entries()];
}

const UNIDADES: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** «hace 3 meses». Acepta ISO, AAAA-MM-DD o segundos/milisegundos. */
export function hace(valor?: string | number | null) {
  if (!valor) return "";
  const d = typeof valor === "number" ? new Date(valor < 1e12 ? valor * 1000 : valor) : new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  const seg = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  for (const [unidad, s] of UNIDADES) {
    if (Math.abs(seg) >= s) return rtf.format(Math.round(seg / s), unidad);
  }
  return "hace un momento";
}

const EXT_MIME: Record<string, string> = {
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg",
  flac: "audio/flac", wav: "audio/wav", weba: "audio/webm",
};

export function extension(nombre: string) {
  const m = /\.([a-z0-9]{2,5})$/i.exec(nombre);
  return m ? m[1].toLowerCase() : "";
}

/** Si un archivo es un audio, por su tipo MIME o su extensión. */
export function esAudio(nombre: string, mime = "") {
  return mime.startsWith("audio/") || extension(nombre) in EXT_MIME;
}

export function mimeDeArchivo(nombre: string, mime = "") {
  return mime || EXT_MIME[extension(nombre)] || "application/octet-stream";
}

export function tituloDeArchivo(nombre: string) {
  return nombre
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
