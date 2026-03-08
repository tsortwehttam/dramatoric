import { sha1 } from "./TextHelpers";

export function strToDeterministicRgb(s: string): [number, number, number] {
  const hash = sha1(s);
  let r = parseInt(hash.slice(0, 2), 16);
  let g = parseInt(hash.slice(2, 4), 16);
  let b = parseInt(hash.slice(4, 6), 16);

  const min = 60;
  const max = 200;
  r = Math.floor((r / 255) * (max - min) + min);
  g = Math.floor((g / 255) * (max - min) + min);
  b = Math.floor((b / 255) * (max - min) + min);

  return [r, g, b];
}

export function strToDeterministicRgba(s: string, opacity: number): string {
  const [r, g, b] = strToDeterministicRgb(s);
  return `rgba(${r},${g},${b},${opacity})`;
}

export function brighten(hex: string, amt: number): string {
  const h = hex.replace(/^#/, "");
  const r = Math.min(255, Math.floor(parseInt(h.slice(0, 2), 16) + 255 * amt));
  const g = Math.min(255, Math.floor(parseInt(h.slice(2, 4), 16) + 255 * amt));
  const b = Math.min(255, Math.floor(parseInt(h.slice(4, 6), 16) + 255 * amt));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
