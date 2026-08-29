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
  return {
    winner,
    iterations,
    converged,
    changedMass: total ? changedMass / total : 0,
    ballots,
    steps,
    log,
  };
}
