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

function pairwiseMargins(vs, ranks) {
  const n = 3;
  const margin = Array.from({ length: n }, () => new Array(n).fill(0));
  vs.forEach((v, k) => {
    const r = ranks[k];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (r.indexOf(i) < r.indexOf(j)) margin[i][j] += v.w;
      }
  });
  return margin;
}

function btrIrvTrace(vs, ranks) {
  let rem = new Set([0, 1, 2]);
  const rounds = [];
  while (rem.size > 1) {
    const margin = pairwiseMargins(vs, ranks);
    const tot = [0, 0, 0];
    vs.forEach((v, k) => {
      for (const c of ranks[k]) { if (rem.has(c)) { tot[c] += v.w; break; } }
    });
    const arr = [...rem].sort((a, b) => tot[a] - tot[b] || a - b);
    const low = arr[0], high = arr[1];
    let elim;
    if (margin[low][high] > margin[high][low]) elim = high;
    else if (margin[high][low] > margin[low][high]) elim = low;
    else elim = low;
    rounds.push({ remaining: [...rem], totals: tot.slice(), low, high, marginLowHigh: margin[low][high], marginHighLow: margin[high][low], elim });
    rem.delete(elim);
  }
  return { winner: [...rem][0], rounds };
}

function btrIrvWinner(vs, ranks) {
  return btrIrvTrace(vs, ranks).winner;
}

function schulzeWinner(vs, ranks) {
  const n = 3;
  const d = pairwiseMargins(vs, ranks);
  const p = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j) p[i][j] = d[i][j] - d[j][i];
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      if (i !== k)
        for (let j = 0; j < n; j++)
          if (j !== k && j !== i)
            if (p[i][j] < Math.min(p[i][k], p[k][j])) p[i][j] = Math.min(p[i][k], p[k][j]);
  const winners = [];
  for (let i = 0; i < n; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (p[i][j] < p[j][i]) { ok = false; break; }
    }
    if (ok) winners.push(i);
  }
  return winners.length === 1 ? winners[0] : -1;
}

function rankedPairsWinner(vs, ranks) {
  const n = 3;
  const margin = pairwiseMargins(vs, ranks);
  const pairs = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && margin[i][j] > margin[j][i]) pairs.push([i, j, margin[i][j] - margin[j][i]]);
  pairs.sort((a, b) => (b[2] - a[2]) || (a[0] - b[0]) || (a[1] - b[1]));
  const g = Array.from({ length: n }, () => []);
  const reaches = (start, target, seen) => {
    if (start === target) return true;
    seen[start] = true;
    for (const nx of g[start]) if (!seen[nx] && reaches(nx, target, seen)) return true;
    return false;
  };
  for (const [i, j] of pairs) {
    if (reaches(j, i, {})) continue;
    g[i].push(j);
  }
  const incoming = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (const j of g[i]) incoming[j]++;
  const winners = [];
  for (let i = 0; i < n; i++) if (incoming[i] === 0) winners.push(i);
  return winners.length === 1 ? winners[0] : -1;
}

function pairwiseRunnerUp(vs, ranks, winner) {
  if (winner === -1) return -1;
  const margin = pairwiseMargins(vs, ranks);
  let best = -1, bestWins = -1;
  for (let i = 0; i < 3; i++) {
    if (i === winner) continue;
    let wins = 0;
    for (let j = 0; j < 3; j++) { if (i === j) continue; if (margin[i][j] > margin[j][i]) wins++; }
    if (wins > bestWins) { bestWins = wins; best = i; }
  }
  return best;
}

function scoreTotals(vs, ballots) {
  const tot = [0, 0, 0];
  for (let k = 0; k < vs.length; k++)
    for (let c = 0; c < 3; c++) tot[c] += ballots[k][c] * vs[k].w;
  return tot;
}

function scoreRunnerUp(vs, ballots, winner) {
  if (winner === -1) return -1;
  const tot = scoreTotals(vs, ballots);
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < 3; i++) {
    if (i === winner) continue;
    if (tot[i] > bestV) { bestV = tot[i]; best = i; }
  }
  return best;
}

// STAR: top-two by total score advance to a pairwise runoff on the ballots.
function starWinner(vs, ballots) {
  const tot = scoreTotals(vs, ballots);
  const order = [0, 1, 2].sort((a, b) => tot[b] - tot[a]);
  const f1 = order[0], f2 = order[1];
  let v1 = 0, v2 = 0;
  for (let k = 0; k < vs.length; k++) {
    const s1 = ballots[k][f1], s2 = ballots[k][f2];
    if (s1 > s2) v1 += vs[k].w;
    else if (s2 > s1) v2 += vs[k].w;
  }
  if (v1 > v2) return f1;
  if (v2 > v1) return f2;
  return tot[f1] > tot[f2] ? f1 : (tot[f2] > tot[f1] ? f2 : -1);
}

// Highest Median (Majority Judgment): highest weighted median wins; ties broken by
// trimming one ballot from each extreme of the tied candidates until a unique max.
function highestMedianWinner(vs, ballots) {
  const n = 3;
  const dists = [];
  for (let c = 0; c < n; c++) {
    const arr = [];
    for (let k = 0; k < vs.length; k++) if (vs[k].w > 0) arr.push([ballots[k][c], vs[k].w]);
    arr.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    dists.push(arr);
  }
  const rem = dists.map(a => a.map(x => x.slice()));
  let active = [0, 1, 2];
  while (active.length > 1) {
    const med = {};
    for (const c of active) {
      let totalW = 0;
      for (const [, w] of rem[c]) totalW += w;
      let cum = 0, m = null;
      for (const [r, w] of rem[c]) { cum += w; if (cum >= totalW / 2) { m = r; break; } }
      med[c] = m === null ? -Infinity : m;
    }
    let maxM = -Infinity;
    for (const c of active) if (med[c] > maxM) maxM = med[c];
    const top = active.filter(c => med[c] === maxM);
    if (top.length === 1) return top[0];
    for (const c of top) {
      if (rem[c].length) { rem[c][0][1] -= 1; if (rem[c][0][1] <= 0) rem[c].shift(); }
      if (rem[c].length) { rem[c][rem[c].length - 1][1] -= 1; if (rem[c][rem[c].length - 1][1] <= 0) rem[c].pop(); }
    }
    active = active.filter(c => rem[c].length > 0);
    if (active.length === 1) return active[0];
  }
  return active.length === 1 ? active[0] : -1;
}

// BTR-Score: bottom-two by total score; of those two eliminate the pairwise loser
// (by score preference). Condorcet-consistent: always elects the CW when one exists.
function btrScoreWinner(vs, ballots) {
  const n = 3;
  let rem = new Set([0, 1, 2]);
  while (rem.size > 1) {
    const tot = scoreTotals(vs, ballots);
    const margin = Array.from({ length: n }, () => new Array(n).fill(0));
    vs.forEach((v, k) => {
      const b = ballots[k];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          if (i === j || !rem.has(i) || !rem.has(j)) continue;
          if (b[i] > b[j]) margin[i][j] += v.w;
        }
    });
    const arr = [...rem].sort((a, b) => tot[a] - tot[b] || a - b);
    const low = arr[0], high = arr[1];
    let elim;
    if (margin[low][high] > margin[high][low]) elim = high;
    else if (margin[high][low] > margin[low][high]) elim = low;
    else elim = low;
    rem.delete(elim);
  }
  return [...rem][0];
}

// Borda count: candidate at rank r (0 = first) gets (n-1-r) points; highest total wins.
function bordaPoints(vs, ranks) {
  const n = 3;
  const tot = [0, 0, 0];
  vs.forEach((v, k) => {
    const r = ranks[k];
    for (let i = 0; i < n; i++) tot[r[i]] += (n - 1 - i) * v.w;
  });
  return tot;
}

function bordaWinner(vs, ballots) {
  const tot = bordaPoints(vs, ballots);
  let best = -1, bestV = -Infinity, second = -1, secondV = -Infinity;
  for (let i = 0; i < 3; i++) {
    if (tot[i] > bestV) { secondV = bestV; second = best; bestV = tot[i]; best = i; }
    else if (tot[i] > secondV) { secondV = tot[i]; second = i; }
  }
  return bestV === secondV ? -1 : best;
}

function bordaRunnerUp(vs, ballots, winner) {
  if (winner === -1) return -1;
  const tot = bordaPoints(vs, ballots);
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < 3; i++) {
    if (i === winner) continue;
    if (tot[i] > bestV) { bestV = tot[i]; best = i; }
  }
  return best;
}

function scoreKey(b) {
  return b.map(x => Math.round(x * 1000) / 1000).join(",");
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

function elevateRanked(b, v, w, r, opts) {
  if (w === -1 || r === -1) return { ballot: b, changed: false };
  const strat = (opts && opts.rankedStrategy === "buryLeastTopTwo") ? "buryLeastTopTwo" : "buryLeader";
  if (strat === "buryLeastTopTwo") {
    const bury = prefers(r, v, w) ? w : r; // least-preferred of {winner, runner-up}
    const nb = v.order.filter(c => c !== bury).concat([bury]); // move it to the bottom, rest honest
    return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
  }
  if (!prefers(r, v, w)) return { ballot: b, changed: false };
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
  btrirv: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => btrIrvWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => pairwiseRunnerUp(vs, ballots, winner),
    trace: (vs, ballots) => btrIrvTrace(vs, ballots),
    key: b => b[0],
  },
  schulze: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => schulzeWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => pairwiseRunnerUp(vs, ballots, winner),
    key: b => b[0],
  },
  rankedPairs: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => rankedPairsWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => pairwiseRunnerUp(vs, ballots, winner),
    key: b => b[0],
  },
  star: {
    ballot: (v, opts) => METHODS.score.ballot(v, opts),
    winner: (vs, ballots) => starWinner(vs, ballots),
    elevate: elevateScore,
    runnerUp: (vs, ballots, opts, winner) => scoreRunnerUp(vs, ballots, winner),
    key: scoreKey,
  },
  highestMedian: {
    ballot: (v, opts) => METHODS.score.ballot(v, opts),
    winner: (vs, ballots) => highestMedianWinner(vs, ballots),
    elevate: elevateScore,
    runnerUp: (vs, ballots, opts, winner) => scoreRunnerUp(vs, ballots, winner),
    key: scoreKey,
  },
  btrScore: {
    ballot: (v, opts) => METHODS.score.ballot(v, opts),
    winner: (vs, ballots) => btrScoreWinner(vs, ballots),
    elevate: elevateScore,
    runnerUp: (vs, ballots, opts, winner) => scoreRunnerUp(vs, ballots, winner),
    key: scoreKey,
  },
  borda: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => bordaWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => bordaRunnerUp(vs, ballots, winner),
    key: b => b[0],
  },
};

const HONEST = {
  Plurality: { method: METHODS.plurality },
  IRV: { method: METHODS.irv },
  Condorcet: { method: METHODS.condorcet },
  BTRIRV: { method: METHODS.btrirv },
  Schulze: { method: METHODS.schulze },
  RankedPairs: { method: METHODS.rankedPairs },
  Borda: { method: METHODS.borda },
  ApprovalTop2: { method: METHODS.approvalTop2 },
  "ApprovalDist0.3": { method: METHODS.approval, opts: { d: 0.3 } },
  "ApprovalDist1.0": { method: METHODS.approval, opts: { d: 1.0 } },
  Score: { method: METHODS.score, opts: { D: 2, levels: 10, round: false } },
  STAR: { method: METHODS.star, opts: { D: 2, levels: 10, round: false } },
  HighestMedian: { method: METHODS.highestMedian, opts: { D: 2, levels: 10, round: false } },
  BTRScore: { method: METHODS.btrScore, opts: { D: 2, levels: 10, round: false } },
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
