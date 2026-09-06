import { ELEC } from "./electorate.js";
import { assess, METHODS, NAMES } from "./methods.js";

const DEFAULT_OPTS = { approval: { d: 0.3 }, score: { D: 2, levels: 10 }, star: { D: 2, levels: 10 }, highestMedian: { D: 2, levels: 10 }, btrScore: { D: 2, levels: 10 } };

function isRankedBallot(b) {
  return Array.isArray(b) && b.length === 3 && [0, 1, 2].every(c => b.includes(c));
}

function ballotProfile(vs, ballots) {
  const counts = {};
  vs.forEach((v, k) => {
    const key = ballots[k].map(c => NAMES[c]).join("");
    counts[key] = (counts[key] || 0) + v.w;
  });
  return counts;
}

function genericBallotDist(vs, ballots) {
  const counts = {};
  const sample = ballots[0];
  const isRanked = Array.isArray(sample) && sample.length === 3 && [0, 1, 2].every(c => sample.includes(c));
  if (isRanked) return ballotProfile(vs, ballots);
  // For score/approval/plurality: stringify ballot vector; for plurality map one-hot to candidate name
  vs.forEach((v, k) => {
    const b = ballots[k];
    let key;
    if (b.length === 3 && b.filter(x => x === 1).length === 1 && b.filter(x => x === 0).length === 2) {
      // one-hot plurality
      const idx = b.indexOf(1);
      key = NAMES[idx];
    } else if (b.length === 3 && b.every(x => x === 0 || x === 1)) {
      // approval (0/1)
      key = b.map((x, c) => x ? NAMES[c] : "").filter(Boolean).join("+") || "∅";
      if (key === "") key = "∅";
    } else if (b.length === 3) {
      // score
      key = b.map((x, c) => `${NAMES[c]}:${x}`).join(" ");
    } else {
      key = b.join(",");
    }
    counts[key] = (counts[key] || 0) + v.w;
  });
  return counts;
}

function totalsForStep(vs, ballots) {
  // weighted totals per candidate; for ranked use first-choice counts
  const sample = ballots[0];
  const isRanked = Array.isArray(sample) && sample.length === 3 && [0, 1, 2].every(c => sample.includes(c));
  if (isRanked) {
    const tot = [0, 0, 0];
    vs.forEach((v, k) => { const top = ballots[k][0]; tot[top] += v.w; });
    return tot;
  }
  const tot = [0, 0, 0];
  vs.forEach((v, k) => {
    const b = ballots[k];
    for (let c = 0; c < 3; c++) tot[c] += (b[c] || 0) * v.w;
  });
  return tot;
}

export function strategicWinner(positions, methodName = "plurality", maxIter = 100, optsOverride = {}) {
  const method = METHODS[methodName];
  if (!method) throw new Error("unknown method " + methodName);
  const opts = { ...(DEFAULT_OPTS[methodName] ?? {}), ...optsOverride };
  const vs = assess(positions, ELEC);
  const total = vs.reduce((a, v) => a + v.w, 0);
  let ballots = vs.map(v => method.ballot(v, opts));
  const honestKeys = ballots.map(b => method.key(b));
  const steps = [ballots];

  const log = [];
  let iterations = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const winner = method.winner(vs, ballots, opts);
    const runnerUp = method.runnerUp ? method.runnerUp(vs, ballots, opts, winner) : -1;
    let changedPositions = 0;
    let iterMass = 0;
    const next = ballots.map((b, k) => {
      const res = method.elevate(b, vs[k], winner, runnerUp, opts);
      if (res.changed) { changedPositions++; iterMass += vs[k].w; }
      return res.ballot;
    });
    const winnerAfter = method.winner(vs, next, opts);
    const trace = method.trace ? method.trace(vs, ballots, opts) : null;
    const ballotDist = isRankedBallot(ballots[0]) ? ballotProfile(vs, ballots) : null;
    log.push({ iter: iter + 1, winner, runnerUp, changedPositions, nPositions: vs.length, changedMass: total ? iterMass / total : 0, winnerAfter, trace, ballotDist });
    ballots = next;
    steps.push(ballots);
    iterations = iter + 1;
    if (changedPositions === 0) break;
  }

  const converged = iterations < maxIter;
  const winner = converged ? method.winner(vs, ballots, opts) : -1;
  let changedMass = 0;
  ballots.forEach((b, k) => { if (method.key(b) !== honestKeys[k]) changedMass += vs[k].w; });

  // Per-iteration derived data aligned to steps[] for clear reporting:
  // steps[0] is honest, steps[1] after first strategic elevation, etc.
  const winnersPerStep = steps.map(b => method.winner(vs, b, opts));
  const tracesPerStep = steps.map(b => method.trace ? method.trace(vs, b, opts) : null);
  const ballotDistsPerStep = steps.map(b => genericBallotDist(vs, b));
  const totalsPerStep = steps.map(b => totalsForStep(vs, b));

  return {
    winner,
    iterations,
    converged,
    changedMass: total ? changedMass / total : 0,
    ballots,
    steps,
    log,
    winnersPerStep,
    tracesPerStep,
    ballotDistsPerStep,
    totalsPerStep,
  };
}
