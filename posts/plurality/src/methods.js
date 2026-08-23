import { ELEC } from "./electorate.js";

export const COLORS = ["#2ca02c", "#d62728", "#ff7f0e"];
export const NAMES = ["A", "B", "C"];

function argmax(arr) {
  let best = 0, bv = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > bv) { bv = arr[i]; best = i; }
  return best;
}

export function assess(positions, elec = ELEC) {
  const EPS = 1e-9;
  return elec.xs.map((x, i) => {
    const dists = positions.map(p => Math.abs(x - p));
    const order = positions.map((p, idx) => idx).sort((a, b) => {
      const d = dists[a] - dists[b];
      return Math.abs(d) < EPS ? a - b : d;
    });
    return { w: elec.ws[i], order, dists };
  });
}

function oneHot(i) {
  const r = [0, 0, 0];
  r[i] = 1;
  return r;
}

function tally(vs, ratings) {
  const tot = [0, 0, 0];
  vs.forEach((v, k) => ratings[k].forEach((x, c) => { tot[c] += x * v.w; }));
  return argmax(tot);
}

function irvWinner(vs, ranks) {
  let rem = new Set([0, 1, 2]);
  while (rem.size > 1) {
    const tot = [0, 0, 0];
    vs.forEach((v, k) => {
      for (const c of ranks[k]) { if (rem.has(c)) { tot[c] += v.w; break; } }
    });
    const sum = tot.reduce((a, b) => a + b, 0);
    let leader = -1, max = -Infinity;
    for (const c of rem) if (tot[c] > max) { max = tot[c]; leader = c; }
    if (max > sum / 2) return leader;
    let elim = -1, min = Infinity;
    for (const c of rem) if (tot[c] < min) { min = tot[c]; elim = c; }
    rem.delete(elim);
  }
  return [...rem][0];
}

function condorcetWinner(vs, ranks) {
  const n = 3;
  const margin = Array.from({ length: n }, () => new Array(n).fill(0));
  vs.forEach((v, k) => {
    const r = ranks[k];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (r.indexOf(i) < r.indexOf(j)) margin[i][j] += v.w;
      }
    }
  });
  for (let i = 0; i < n; i++) {
    let wins = true;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (margin[i][j] <= margin[j][i]) { wins = false; break; }
    }
    if (wins) return i;
  }
  return -1;
}

function prefers(a, v, b) {
  return v.order.indexOf(a) < v.order.indexOf(b);
}

function tallyTotals(vs, ballots) {
  const tot = [0, 0, 0];
  for (let k = 0; k < vs.length; k++) {
    const r = ballots[k];
    for (let c = 0; c < 3; c++) tot[c] += r[c] * vs[k].w;
  }
  return tot;
}

function secondHighest(tot, winner) {
  let best = -1, bestV = -Infinity, second = -1, secondV = -Infinity;
  for (let i = 0; i < 3; i++) {
    if (tot[i] > bestV) { secondV = bestV; second = best; bestV = tot[i]; best = i; }
    else if (tot[i] > secondV) { secondV = tot[i]; second = i; }
  }
  return second;
}

function irvRunnerUp(vs, ranks) {
  let rem = new Set([0, 1, 2]);
  let lastElim = -1;
  while (rem.size > 1) {
    const tot = [0, 0, 0];
    vs.forEach((v, k) => {
      for (const c of ranks[k]) { if (rem.has(c)) { tot[c] += v.w; break; } }
    });
    let elim = -1, min = Infinity;
    for (const c of rem) if (tot[c] < min) { min = tot[c]; elim = c; }
    lastElim = elim;
    rem.delete(elim);
  }
  return lastElim;
}

function condorcetRunnerUp(vs, ranks, winner) {
  if (winner === -1) return -1;
  const margin = Array.from({ length: 3 }, () => new Array(3).fill(0));
  vs.forEach((v, k) => {
    const r = ranks[k];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        if (r.indexOf(i) < r.indexOf(j)) margin[i][j] += v.w;
      }
  });
  let best = -1, bestWins = -1;
  for (let i = 0; i < 3; i++) {
    if (i === winner) continue;
    let wins = 0;
    for (let j = 0; j < 3; j++) {
      if (i === j) continue;
      if (margin[i][j] > margin[j][i]) wins++;
    }
    if (wins > bestWins) { bestWins = wins; best = i; }
  }
  return best;
}

function approvalHonest(v, opts, top2) {
  const r = [0, 0, 0];
  if (top2) { r[v.order[0]] = 1; r[v.order[1]] = 1; }
  else { const d = opts?.d ?? 0.3; v.dists.forEach((dist, i) => { if (dist <= d + 1e-10) r[i] = 1; }); }
  return r;
}

function elevatePlurality(b, v, w, r) {
  if (w === -1 || r === -1) return { ballot: b, changed: false };
  const top2 = v.order.indexOf(w) < v.order.indexOf(r) ? w : r;
  const nb = oneHot(top2);
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateApproval(b, v, w, r, opts) {
  if (w === -1) return { ballot: b, changed: false };
  const cutoff = prefers(r, v, w) ? r : w;
  const nb = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (prefers(i, v, cutoff) || i === cutoff) nb[i] = 1;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateScore(b, v, w, r, opts) {
  if (w === -1) return { ballot: b, changed: false };
  const cutoff = prefers(r, v, w) ? r : w;
  const levels = opts?.levels ?? 10;
  const nb = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (prefers(i, v, cutoff) || i === cutoff) nb[i] = levels;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateRanked(b, v, w, r) {
  if (w === -1 || !prefers(r, v, w)) return { ballot: b, changed: false };
  const t = [0, 1, 2].find(c => c !== w && c !== r);
  const nb = [r, t, w]; // raise runner-up to top, bury leader to bottom
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function setKey(b) {
  return b.map(x => (x > 0 ? 1 : 0)).join(",");
}

export const METHODS = {
  plurality: {
    ballot: v => oneHot(v.order[0]),
    winner: (vs, ballots) => tally(vs, ballots),
    elevate: elevatePlurality,
    runnerUp: (vs, ballots, opts, winner) => secondHighest(tallyTotals(vs, ballots), winner),
    key: b => argmax(b),
  },
  approvalTop2: {
    ballot: (v, opts) => approvalHonest(v, opts, true),
    winner: (vs, ballots) => tally(vs, ballots),
    elevate: (b, v, w, r, opts) => elevateApproval(b, v, w, r, opts),
    runnerUp: (vs, ballots, opts, winner) => secondHighest(tallyTotals(vs, ballots), winner),
    key: setKey,
  },
  approval: {
    ballot: (v, opts) => approvalHonest(v, opts, false),
    winner: (vs, ballots) => tally(vs, ballots),
    elevate: (b, v, w, r, opts) => elevateApproval(b, v, w, r, opts),
    runnerUp: (vs, ballots, opts, winner) => secondHighest(tallyTotals(vs, ballots), winner),
    key: setKey,
  },
  score: {
    ballot: (v, opts) => {
      const D = opts?.D ?? 2;
      const levels = opts?.levels ?? 10;
      const round = opts?.round ?? true;
      return v.dists.map(dist => {
        const s = Math.max(0, (1 - dist / D) * levels);
        return round ? Math.round(s) : s;
      });
    },
    winner: (vs, ballots) => tally(vs, ballots),
    elevate: elevateScore,
    runnerUp: (vs, ballots, opts, winner) => secondHighest(tallyTotals(vs, ballots), winner),
    key: b => argmax(b),
  },
  irv: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => irvWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => irvRunnerUp(vs, ballots),
    key: b => b[0],
  },
  condorcet: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => condorcetWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => condorcetRunnerUp(vs, ballots, winner),
    key: b => b[0],
  },
};

const HONEST = {
  Plurality: { method: METHODS.plurality },
  IRV: { method: METHODS.irv },
  Condorcet: { method: METHODS.condorcet },
  ApprovalTop2: { method: METHODS.approvalTop2 },
  "ApprovalDist0.3": { method: METHODS.approval, opts: { d: 0.3 } },
  "ApprovalDist1.0": { method: METHODS.approval, opts: { d: 1.0 } },
  Score: { method: METHODS.score, opts: { D: 2, levels: 10, round: false } },
};

export function winnersFromVs(vs) {
  const out = {};
  for (const name of Object.keys(HONEST)) {
    const { method, opts } = HONEST[name];
    const ballots = vs.map(v => method.ballot(v, opts));
    out[name] = method.winner(vs, ballots, opts);
  }
  return out;
}

export const HONEST_METHODS = {};
for (const [name, { method, opts }] of Object.entries(HONEST)) {
  HONEST_METHODS[name] = (positions, elec = ELEC) => {
    const vs = assess(positions, elec);
    const ballots = vs.map(v => method.ballot(v, opts));
    return method.winner(vs, ballots, opts);
  };
}

export function winners(positions, elec = ELEC) {
  return winnersFromVs(assess(positions, elec));
}
