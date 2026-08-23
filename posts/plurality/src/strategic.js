import { ELEC } from "./electorate.js";
import { assess, METHODS } from "./methods.js";

const DEFAULT_OPTS = { approval: { d: 0.3 }, score: { D: 2, levels: 10 } };

export function strategicWinner(positions, methodName = "plurality", maxIter = 100) {
  const method = METHODS[methodName];
  if (!method) throw new Error("unknown method " + methodName);
  const opts = DEFAULT_OPTS[methodName] ?? {};
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
    let changedVoters = 0;
    let iterMass = 0;
    const next = ballots.map((b, k) => {
      const res = method.elevate(b, vs[k], winner, runnerUp, opts);
      if (res.changed) { changedVoters++; iterMass += vs[k].w; }
      return res.ballot;
    });
    const winnerAfter = method.winner(vs, next, opts);
    log.push({ iter: iter + 1, winner, changedVoters, changedMass: total ? iterMass / total : 0, winnerAfter });
    ballots = next;
    steps.push(ballots);
    iterations = iter + 1;
    if (changedVoters === 0) break;
  }

  const converged = iterations < maxIter;
  const winner = method.winner(vs, ballots, opts);
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
