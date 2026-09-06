import { pdf } from "./distribution.js";

const DEFAULTS = { n: 201, xMin: -5, xMax: 5, N: 10000 };

export function gaussianElectorate(params = {}) {
  const n = params.n ?? DEFAULTS.n;
  const xMin = params.xMin ?? DEFAULTS.xMin;
  const xMax = params.xMax ?? DEFAULTS.xMax;
  const N = params.N ?? DEFAULTS.N;
  const xs = new Array(n);
  const ws = new Array(n);
  const dx = (xMax - xMin) / (n - 1);
  let sumPdf = 0;
  for (let i = 0; i < n; i++) {
    const x = xMin + dx * i;
    xs[i] = x;
    sumPdf += pdf(x);
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = Math.max(0, Math.round(pdf(xs[i]) * N / sumPdf));
    ws[i] = c;
    total += c;
  }
  return { xs, ws, n, xMin, xMax, total };
}

export function getElectorate(params = {}) {
  const n = params.n ?? DEFAULTS.n;
  const xMin = params.xMin ?? DEFAULTS.xMin;
  const xMax = params.xMax ?? DEFAULTS.xMax;
  const N = params.N ?? DEFAULTS.N;
  const c = getElectorate._c;
  if (c && c.n === n && c.xMin === xMin && c.xMax === xMax && c.total === N) return c;
  const elec = gaussianElectorate({ n, xMin, xMax, N });
  getElectorate._c = elec;
  return elec;
}

export const ELEC = getElectorate();

export async function loadOrSaveElectorate(params = {}, path = "data/electorate.json") {
  const n = params.n ?? DEFAULTS.n;
  const xMin = params.xMin ?? DEFAULTS.xMin;
  const xMax = params.xMax ?? DEFAULTS.xMax;
  const N = params.N ?? DEFAULTS.N;
  try {
    const { readFileSync, writeFileSync, mkdirSync } = await import("fs");
    try {
      const obj = JSON.parse(readFileSync(path, "utf8"));
      if (obj.n === n && obj.xMin === xMin && obj.xMax === xMax && obj.total === N) return obj;
    } catch { }
    const elec = gaussianElectorate({ n, xMin, xMax, N });
    mkdirSync("data", { recursive: true });
    writeFileSync(path, JSON.stringify(elec));
    return elec;
  } catch {
    return gaussianElectorate({ n, xMin, xMax, N });
  }
}
