import { assess, winnersFromVs, HONEST_METHODS } from "./methods.js";
import { strategicWinner } from "./strategic.js";

export function yeeGrid(B, cMin, cMax, steps, methods = HONEST_METHODS) {
  const cs = [];
  for (let i = 0; i < steps; i++) cs.push(cMin + (cMax - cMin) * i / (steps - 1));
  const names = Object.keys(methods);
  const results = {};
  for (const name of names) results[name] = [];
  for (const c of cs) {
    const ws = winnersFromVs(assess([0, B, c]));
    for (const name of names) results[name].push(ws[name]);
  }
  return { B, cMin, cMax, steps, cs, results };
}

export function metrics(grid) {
  const out = {};
  for (const name of Object.keys(grid.results)) {
    const wins = grid.results[name];
    let aCount = 0;
    let msd = 0, msdN = 0;
    wins.forEach((w, i) => {
      if (w === 0) aCount++;
      if (w >= 0) {
        const p = [0, grid.B, grid.cs[i]][w];
        msd += 1 + p * p;
        msdN++;
      }
    });
    out[name] = { aWinFraction: aCount / wins.length, meanSqDistance: msd / wins.length, decidedFraction: msdN / wins.length };
  }
  return out;
}

export function strategicYeeGrid(B, cMin, cMax, steps, honestName, stratMethod) {
  const cs = [];
  for (let i = 0; i < steps; i++) cs.push(cMin + (cMax - cMin) * i / (steps - 1));
  const honest = [], strategic = [], changedMass = [], iterations = [], converged = [];
  let sample = null;
  for (const c of cs) {
    const positions = [0, B, c];
    honest.push(HONEST_METHODS[honestName](positions));
    const s = strategicWinner(positions, stratMethod);
    strategic.push(s.winner);
    changedMass.push(s.changedMass);
    iterations.push(s.iterations);
    converged.push(s.converged);
    if (!sample || (!s.converged && sample.converged) || s.iterations > sample.iterations) {
      sample = { C: c, converged: s.converged, iterations: s.iterations, winner: s.winner, log: s.log };
    }
  }
  return { B, honestName, stratMethod, cMin, cMax, steps, cs, honest, strategic, changedMass, iterations, converged, sample };
}
