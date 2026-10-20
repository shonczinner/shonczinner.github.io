import { ELEC } from "./electorate.js";

export const COLORS = ["#2ca02c", "#d62728", "#ff7f0e"];
export const NAMES = ["A", "B", "C"];

// Non-winner results, so the report can tell the three failure modes apart. A candidate index is
// 0..2; these are strictly negative. Anything below zero means "no winner" to callers.
export const CYCLE = -1; // no unique winner because the majority relation cycles
export const TIE = -2; // two or more candidates level at the top of the rule's own ordering
export const NONCONVERGENT = -3; // strategic iteration never settled (strategic layer only)

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

// IRV: eliminate the last-placed candidate until somebody holds a majority of the votes still
// counting, transferring as preferences allow. counting is the weight still in play, i.e. the
// totals of the surviving candidates only.
function irvTrace(vs, ranks) {
  let rem = new Set([0, 1, 2]);
  const rounds = [];
  while (rem.size > 1) {
    const tot = [0, 0, 0];
    vs.forEach((v, k) => {
      for (const c of ranks[k]) { if (rem.has(c)) { tot[c] += v.w; break; } }
    });
    const sum = tot.reduce((a, b) => a + b, 0);
    let leader = -1, max = -Infinity;
    for (const c of rem) if (tot[c] > max) { max = tot[c]; leader = c; }
    const majority = max > sum / 2;
    const round = { remaining: [...rem], totals: tot.slice(), counting: sum, leader, majority };
    rounds.push(round);
    if (majority) return { winner: leader, rounds };
    let elim = -1, min = Infinity;
    for (const c of rem) if (tot[c] < min) { min = tot[c]; elim = c; }
    round.elim = elim;
    rem.delete(elim);
  }
  return { winner: [...rem][0], rounds };
}

function irvWinner(vs, ranks) {
  return irvTrace(vs, ranks).winner;
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
  return CYCLE;
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

function rcipeTrace(vs, ranks) {
  const n = 3;
  let rem = new Set([0, 1, 2]);
  const rounds = [];
  while (rem.size > 1) {
    const margin = pairwiseMargins(vs, ranks);
    // Step 1: find Condorcet loser among remaining
    let loser = -1;
    for (const x of rem) {
      let losesToAll = true;
      for (const y of rem) {
        if (x === y) continue;
        if (margin[x][y] >= margin[y][x]) { losesToAll = false; break; }
      }
      if (losesToAll) { loser = x; break; }
    }
    if (loser >= 0) {
      rounds.push({ remaining: [...rem], totals: [0, 0, 0], loser, reason: "condorcet-loser" });
      rem.delete(loser);
      continue;
    }
    // Step 2: no Condorcet loser — count top choices among remaining
    const tot = [0, 0, 0];
    vs.forEach((v, k) => {
      for (const c of ranks[k]) { if (rem.has(c)) { tot[c] += v.w; break; } }
    });
    let min = Infinity;
    for (const c of rem) if (tot[c] < min) min = tot[c];
    const tied = [...rem].filter(c => tot[c] === min);
    // Step 3: tie-break
    if (tied.length === 1) {
      loser = tied[0];
    } else {
      // largest pairwise opposition among tied, then smallest pairwise support
      const opposition = {};
      for (const x of tied) {
        opposition[x] = 0;
        vs.forEach((v, k) => {
          const r = ranks[k];
          for (const y of tied) {
            if (x === y) continue;
            if (r.indexOf(y) < r.indexOf(x)) opposition[x] += v.w;
          }
        });
      }
      let maxOpp = -Infinity;
      for (const x of tied) if (opposition[x] > maxOpp) maxOpp = opposition[x];
      let tied2 = tied.filter(x => opposition[x] === maxOpp);
      if (tied2.length === 1) {
        loser = tied2[0];
      } else {
        const support = {};
        for (const x of tied2) {
          support[x] = 0;
          vs.forEach((v, k) => {
            const r = ranks[k];
            for (const y of tied2) {
              if (x === y) continue;
              if (r.indexOf(y) < r.indexOf(x)) support[x] += v.w;
            }
          });
        }
        let minSup = Infinity;
        for (const x of tied2) if (support[x] < minSup) minSup = support[x];
        let tied3 = tied2.filter(x => support[x] === minSup);
        loser = tied3[0]; // external tie-break (alphabetical by index)
      }
    }
    rounds.push({ remaining: [...rem], totals: tot.slice(), loser, reason: "fewest-top-choice" });
    rem.delete(loser);
  }
  return { winner: [...rem][0], rounds };
}

function rcipeWinner(vs, ranks) {
  return rcipeTrace(vs, ranks).winner;
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
  // No single maximal/source candidate: either the majority relation cycles outright (nobody
  // left un-beaten / with zero indegree) or two candidates end up level at the top.
  return winners.length === 1 ? winners[0] : (winners.length === 0 ? CYCLE : TIE);
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
  // No single maximal/source candidate: either the majority relation cycles outright (nobody
  // left un-beaten / with zero indegree) or two candidates end up level at the top.
  return winners.length === 1 ? winners[0] : (winners.length === 0 ? CYCLE : TIE);
}

function pairwiseRunnerUp(vs, ranks, winner) {
  if (winner < 0) return -1;
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
  if (winner < 0) return -1;
  const tot = scoreTotals(vs, ballots);
  let best = -1, bestV = -Infinity;
  for (let i = 0; i < 3; i++) {
    if (i === winner) continue;
    if (tot[i] > bestV) { bestV = tot[i]; best = i; }
  }
  return best;
}

// STAR: top-two by total score advance to a pairwise runoff on the ballots.
function starRunoff(vs, ballots) {
  const tot = scoreTotals(vs, ballots);
  const order = [0, 1, 2].sort((a, b) => tot[b] - tot[a]);
  const f1 = order[0], f2 = order[1];
  let v1 = 0, v2 = 0;
  for (let k = 0; k < vs.length; k++) {
    const s1 = ballots[k][f1], s2 = ballots[k][f2];
    if (s1 > s2) v1 += vs[k].w;
    else if (s2 > s1) v2 += vs[k].w;
  }
  const winner = v1 > v2 ? f1 : (v2 > v1 ? f2 : (tot[f1] > tot[f2] ? f1 : (tot[f2] > tot[f1] ? f2 : TIE)));
  return { tot, f1, f2, v1, v2, winner };
}

function starWinner(vs, ballots) {
  return starRunoff(vs, ballots).winner;
}

// The same runoff as a trace round, so the log can show which two advanced on total score and by
// what head-to-head margin the runoff went. Grade comparisons, so pairwiseMargins() does not apply.
function starTrace(vs, ballots) {
  const { tot, f1, f2, v1, v2, winner } = starRunoff(vs, ballots);
  return {
    winner,
    rounds: [{
      remaining: [f1, f2], totals: tot.slice(),
      low: f2, high: f1, marginLowHigh: v2, marginHighLow: v1,
      elim: winner === f2 ? f1 : f2,
    }],
  };
}

// Weighted median grade (g), plus the graduated majority judgment tie-break value: the median
// found by linearly interpolating the grade CDF at the 50% point, i.e. g pulled down towards
// g - 1 by the share of weight still below half at that grade. Null if the candidate has no weight.
function medianGrades(vs, ballots, c) {
  const grades = new Map();
  let totalW = 0;
  for (let k = 0; k < vs.length; k++) {
    if (vs[k].w <= 0) continue;
    const g = ballots[k][c];
    grades.set(g, (grades.get(g) ?? 0) + vs[k].w);
    totalW += vs[k].w;
  }
  if (totalW === 0) return null;
  const sorted = [...grades.entries()].sort((a, b) => a[0] - b[0]);
  const half = totalW / 2;
  let below = 0;
  for (const [g, w] of sorted) {
    if (below + w >= half) return { median: g, interp: g - 1 + (half - below) / w };
    below += w;
  }
  return null;
}

// Highest Median (graduated majority judgment): elect the candidate with the highest weighted
// median grade. Leaders tied on the median are separated by the graduated tie-break — the
// interpolated median — which favours the candidate with more weight above its median and less
// below it, and so never breaks a tie the way a total-score comparison does. Remaining ties are
// identical grade distributions and fall back to total score, then to the earliest candidate.
function highestMedianWinner(vs, ballots) {
  const med = [null, null, null];
  for (let c = 0; c < 3; c++) med[c] = medianGrades(vs, ballots, c);
  const tot = scoreTotals(vs, ballots);
  let best = -1;
  for (let c = 0; c < 3; c++) {
    if (med[c] === null) continue;
    if (best === -1
      || med[c].median > med[best].median
      || (med[c].median === med[best].median
        && (med[c].interp > med[best].interp
          || (med[c].interp === med[best].interp
            && (tot[c] > tot[best] || (tot[c] === tot[best] && c < best)))))) best = c;
  }
  return best;
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
  return bestV === secondV ? TIE : best;
}

function bordaRunnerUp(vs, ballots, winner) {
  if (winner < 0) return -1;
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
  if (winner < 0) return -1;
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
  if (w < 0 || r < 0) return { ballot: b, changed: false };
  const top2 = v.order.indexOf(w) < v.order.indexOf(r) ? w : r;
  const nb = oneHot(top2);
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateApproval(b, v, w, r, opts) {
  if (w < 0) return { ballot: b, changed: false };
  const cutoff = prefers(r, v, w) ? r : w;
  const nb = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (prefers(i, v, cutoff) || i === cutoff) nb[i] = 1;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateScore(b, v, w, r, opts) {
  if (w < 0) return { ballot: b, changed: false };
  const cutoff = prefers(r, v, w) ? r : w;
  const levels = opts?.levels ?? 10;
  const nb = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (prefers(i, v, cutoff) || i === cutoff) nb[i] = levels;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateSTAR(b, v, w, r, opts) {
  if (w < 0 || r < 0) return { ballot: b, changed: false };
  if (!prefers(r, v, w)) return { ballot: b, changed: false };
  const levels = opts?.levels ?? 10;
  const nb = [0, 0, 0];
  nb[v.order[0]] = levels;
  nb[v.order[1]] = levels - 1;
  nb[v.order[2]] = 0;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateBTRScore(b, v, w, r, opts) {
  if (w < 0 || r < 0) return { ballot: b, changed: false };
  if (!prefers(r, v, w)) return { ballot: b, changed: false };
  const levels = opts?.levels ?? 10;
  const t = [0, 1, 2].find(c => c !== w && c !== r);
  const nb = [0, 0, 0];
  nb[w] = 0;
  nb[r] = levels;
  nb[t] = prefers(t, v, w) ? levels : 1;
  return { ballot: nb, changed: !b.every((x, i) => x === nb[i]) };
}

function elevateRanked(b, v, w, r, opts) {
  if (w < 0 || r < 0) return { ballot: b, changed: false };
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
    trace: (vs, ballots) => irvTrace(vs, ballots),
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
  rcipe: {
    ballot: v => v.order.slice(),
    winner: (vs, ballots) => rcipeWinner(vs, ballots),
    elevate: elevateRanked,
    runnerUp: (vs, ballots, opts, winner) => pairwiseRunnerUp(vs, ballots, winner),
    trace: (vs, ballots) => rcipeTrace(vs, ballots),
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
    elevate: elevateSTAR,
    runnerUp: (vs, ballots, opts, winner) => scoreRunnerUp(vs, ballots, winner),
    trace: (vs, ballots) => starTrace(vs, ballots),
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
    elevate: elevateBTRScore,
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
  RCIPE: { method: METHODS.rcipe },
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
