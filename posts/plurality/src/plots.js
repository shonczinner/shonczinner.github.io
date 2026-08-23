import { COLORS, NAMES, METHODS, assess } from "./methods.js";
import { ELEC } from "./electorate.js";

export const CODE_OF = w => (w < 0 ? 3 : w);
export const COLORSCALE = [
  [0.0, COLORS[0]], [0.249, COLORS[0]],
  [0.25, COLORS[1]], [0.499, COLORS[1]],
  [0.5, COLORS[2]], [0.749, COLORS[2]],
  [0.75, "#000000"], [1.0, "#000000"],
];

function heatData(names, codeRows, cs) {
  return [{
    type: "heatmap",
    x: cs,
    y: names,
    z: codeRows,
    zmin: 0,
    zmax: 3,
    colorscale: COLORSCALE,
    showscale: false,
    xgap: 0,
    ygap: 2,
    hoverinfo: "x+y",
  }];
}

function candMarks(B, names) {
  const top = names.length - 0.5, bot = -0.5;
  const marks = [
    { x: 0, name: "A", color: COLORS[0] },
    { x: B, name: "B", color: COLORS[1] },
  ];
  const shapes = [], annotations = [];
  for (const m of marks) {
    shapes.push({ type: "line", x0: m.x, x1: m.x, y0: bot, y1: top, line: { color: "#000", width: 3, dash: "dot" } });
    shapes.push({ type: "line", x0: m.x, x1: m.x, y0: bot, y1: top, line: { color: m.color, width: 1.5, dash: "dot" } });
    annotations.push({ x: m.x, y: top, text: m.name, showarrow: false, yanchor: "bottom", font: { color: m.color, size: 12 } });
  }
  return { shapes, annotations };
}

export function candShapesAt(positions, top, bot) {
  const marks = [
    { x: positions[0], name: "A", color: COLORS[0] },
    { x: positions[1], name: "B", color: COLORS[1] },
    { x: positions[2], name: "C", color: COLORS[2] },
  ];
  const shapes = [], annotations = [];
  for (const m of marks) {
    shapes.push({ type: "line", x0: m.x, x1: m.x, y0: bot, y1: top, line: { color: "#000", width: 3, dash: "dot" } });
    shapes.push({ type: "line", x0: m.x, x1: m.x, y0: bot, y1: top, line: { color: m.color, width: 1.5, dash: "dot" } });
    annotations.push({ x: m.x, y: top, text: m.name, showarrow: false, yanchor: "bottom", font: { color: m.color, size: 12 } });
  }
  return { shapes, annotations };
}

function heatLayout(title, cs, B, names) {
  const { shapes, annotations } = candMarks(B, names);
  return {
    title: { text: title, font: { size: 14 } },
    margin: { l: 130, r: 20, t: 50, b: 44 },
    height: 94 + names.length * 34,
    xaxis: { title: "candidate C position", range: [cs[0], cs[cs.length - 1]], zeroline: false, gridcolor: "#eee" },
    yaxis: { range: [-0.5, names.length - 0.5], tickfont: { size: 11 } },
    shapes,
    annotations,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
  };
}

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const APPROVAL_SCALE = [
  [0.0, "#e0e0e0"], [0.249, "#e0e0e0"],
  [0.25, COLORS[0]], [0.499, COLORS[0]],
  [0.5, COLORS[1]], [0.749, COLORS[1]],
  [0.75, COLORS[2]], [1.0, COLORS[2]],
];

function stripFigureData(elec, positions, zRows, yLabels, scale, title, height) {
  const x = elec.xs;
  const { shapes, annotations } = candShapesAt(positions, yLabels.length - 0.5, -0.5);
  const data = [{
    type: "heatmap",
    x,
    y: yLabels,
    z: zRows,
    zmin: 0,
    zmax: 3,
    colorscale: scale,
    showscale: false,
    xgap: 0,
    ygap: 2,
    hoverinfo: "x+y",
  }];
  const layout = {
    title: { text: title, font: { size: 13 } },
    margin: { l: 60, r: 20, t: 38, b: 40 },
    height,
    xaxis: { title: "voter opinion", range: [x[0], x[x.length - 1]], zeroline: false, gridcolor: "#eee" },
    yaxis: { automargin: true },
    shapes,
    annotations,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
  };
  return { data, layout };
}

function emit(divId, fig) {
  return `Plotly.newPlot(${JSON.stringify(divId)}, ${JSON.stringify(fig.data)}, ${JSON.stringify(fig.layout)}, {displayModeBar:false, responsive:true});`;
}

export function pluralityBallotData(elec, positions, opts = {}) {
  const title = opts.title ?? `Plurality ballot — A=0, B=${positions[1]}, C=${positions[2]}`;
  const codes = opts.ballots ? opts.ballots.map(b => b.indexOf(1)) : assess(positions, elec).map(v => v.order[0]);
  return stripFigureData(elec, positions, [codes.map(CODE_OF)], ["top"], COLORSCALE, title, 120);
}

export function rankedBallotData(elec, positions) {
  const vs = assess(positions, elec);
  const rows = [vs.map(v => v.order[2]), vs.map(v => v.order[1]), vs.map(v => v.order[0])];
  const title = `Ranked ballot (IRV/Condorcet order) — A=0, B=${positions[1]}, C=${positions[2]}`;
  return stripFigureData(elec, positions, rows.map(r => r.map(CODE_OF)), ["3rd", "2nd", "1st"], COLORSCALE, title, 180);
}

export function approvalBallotData(elec, positions, methodName, d, title) {
  const vs = assess(positions, elec);
  const opts = methodName === "approval" ? { d } : {};
  const ballots = vs.map(v => METHODS[methodName].ballot(v, opts));
  const rows = [0, 1, 2].map(c => ballots.map(b => (b[c] > 0 ? c + 1 : 0)));
  return stripFigureData(elec, positions, rows, ["A", "B", "C"], APPROVAL_SCALE, title, 180);
}

export function scoreBallotData(elec, positions, opts = { D: 2, levels: 10 }) {
  const vs = assess(positions, elec);
  const ballots = vs.map(v => METHODS.score.ballot(v, opts));
  const x = elec.xs;
  const traces = [0, 1, 2].map(c => ({
    x,
    y: ballots.map(b => b[c]),
    name: NAMES[c],
    mode: "lines",
    line: { width: 1, color: COLORS[c], shape: "hv" },
    fillcolor: COLORS[c],
    stackgroup: "score",
  }));
  const maxStacked = Math.max(...ballots.map(b => b[0] + b[1] + b[2]));
  const { shapes, annotations } = candShapesAt(positions, maxStacked, 0);
  const layout = {
    title: { text: `Score ballot (D=${opts.D}, 0–${opts.levels}) — A=0, B=${positions[1]}, C=${positions[2]}`, font: { size: 13 } },
    margin: { l: 50, r: 20, t: 38, b: 40 },
    height: 240,
    xaxis: { title: "voter opinion", range: [x[0], x[x.length - 1]], zeroline: false },
    yaxis: { title: "stacked score (Σ A+B+C)", range: [0, maxStacked] },
    shapes,
    annotations,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    showlegend: true,
  };
  return { data: traces, layout };
}

export function densityWeightedData(elec, positions, methodNameOrBallots, opts, title, stacked = true) {
  const vs = assess(positions, elec);
  const ballots = Array.isArray(methodNameOrBallots)
    ? methodNameOrBallots
    : vs.map(v => METHODS[methodNameOrBallots].ballot(v, opts));
  const x = elec.xs;
  const ws = elec.ws;
  const step = true;
  const raw = Array.isArray(methodNameOrBallots) ? false : methodNameOrBallots.startsWith("approval");
  const traces = [0, 1, 2].map(c => {
    const y = ballots.map((b, i) => {
      if (raw) return b[c] * ws[i];
      const s = b.reduce((a, bb) => a + bb, 0);
      const share = s > 0 ? b[c] / s : 0;
      return share * ws[i];
    });
    return stacked
      ? { x, y, name: NAMES[c], mode: "lines", line: { width: 1, color: COLORS[c], shape: step ? "hv" : "linear" }, fillcolor: COLORS[c], stackgroup: "dw" }
      : { x, y, name: NAMES[c], mode: "lines", line: { color: COLORS[c], width: 1, shape: step ? "hv" : "linear" }, fill: "tozeroy", fillcolor: hexToRgba(COLORS[c], 0.25) };
  });
  const maxW = Math.max(...ws);
  const { shapes, annotations } = candShapesAt(positions, maxW, 0);
  const layout = {
    title: { text: title, font: { size: 13 } },
    margin: { l: 60, r: 20, t: 38, b: 40 },
    height: 240,
    xaxis: { title: "voter opinion", range: [x[0], x[x.length - 1]], zeroline: false },
    yaxis: { title: "voter count (PDF × ballot share)" },
    shapes,
    annotations,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    showlegend: true,
  };
  return { data: traces, layout };
}

export function rankedDensityWeightedData(elec, positions, title) {
  const vs = assess(positions, elec);
  const x = elec.xs;
  const ws = elec.ws;
  const traces = [];
  for (let r = 2; r >= 0; r--) {
    for (let c = 0; c < 3; c++) {
      const y = vs.map((v, i) => (v.order[r] === c ? ws[i] : 0));
      traces.push({
        x,
        y,
        name: `${NAMES[c]} · rank${r + 1}`,
        mode: "lines",
        line: { width: 0.5, color: COLORS[c], shape: "hv" },
        fillcolor: COLORS[c],
        stackgroup: "rk",
      });
    }
  }
  const maxW = 3 * Math.max(...ws);
  const { shapes, annotations } = candShapesAt(positions, maxW, 0);
  const layout = {
    title: { text: title, font: { size: 13 } },
    margin: { l: 60, r: 20, t: 38, b: 40 },
    height: 320,
    xaxis: { title: "voter opinion", range: [x[0], x[x.length - 1]], zeroline: false },
    yaxis: { title: "voter count (each rank tier = full PDF)" },
    shapes,
    annotations,
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    showlegend: true,
  };
  return { data: traces, layout };
}

export function winnerHeatmap(names, rows, cs, B, title) {
  const codeRows = rows.map(r => r.map(CODE_OF));
  return { data: heatData(names, codeRows, cs), layout: heatLayout(title, cs, B, names) };
}

function snapFigure(divId, snap, elec) {
  const pos = snap.positions;
  const bar = {
    type: "bar",
    x: elec.xs,
    y: elec.ws,
    width: (elec.xs[1] - elec.xs[0]) * 0.9,
    marker: { color: "#69b3a2" },
    name: "voters",
    hovertemplate: "x=%{x}<br>count=%{y}<extra></extra>",
  };
  const dots = {
    type: "scatter",
    mode: "markers+text",
    x: pos,
    y: pos.map(() => Math.max(...elec.ws) * 1.02),
    text: pos.map((p, i) => NAMES[i]),
    textposition: "top center",
    marker: { size: 14, color: pos.map((p, i) => COLORS[i]), line: { color: "#000", width: 1 } },
    name: "candidates",
    hovertemplate: "%{text} at %{x}<extra></extra>",
  };
  const layout = {
    title: { text: `B = ${snap.B}, C = ${snap.C}  —  ${snap.method} winner: ${snap.winner >= 0 ? NAMES[snap.winner] : "none"}`, font: { size: 13 } },
    margin: { l: 50, r: 20, t: 40, b: 40 },
    height: 260,
    xaxis: { title: "voter opinion", range: [elec.xs[0], elec.xs[elec.xs.length - 1]], zeroline: false },
    yaxis: { title: "count" },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    showlegend: false,
  };
  return `Plotly.newPlot(${JSON.stringify(divId)}, ${JSON.stringify([bar, dots])}, ${JSON.stringify(layout)}, {displayModeBar:false, responsive:true});`;
}

export function elecData(elec) {
  const bar = {
    type: "bar",
    x: elec.xs,
    y: elec.ws,
    width: (elec.xs[1] - elec.xs[0]) * 0.9,
    marker: { color: "#69b3a2" },
    hovertemplate: "x=%{x}<br>count=%{y}<extra></extra>",
  };
  const layout = {
    title: { text: `Voter distribution (N = ${elec.total})`, font: { size: 13 } },
    margin: { l: 50, r: 20, t: 40, b: 40 },
    height: 240,
    xaxis: { title: "voter opinion", range: [elec.xs[0], elec.xs[elec.xs.length - 1]], zeroline: false },
    yaxis: { title: "count" },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
  };
  return { data: [bar], layout };
}

export function buildReport(report) {
  const draws = [];
  draws.push(emit("elec", elecData(report.elec)));
  for (const entry of report.yee) draws.push(emit(`yee-${entry.B}`, winnerHeatmap(Object.keys(entry.grid.results), Object.values(entry.grid.results), entry.grid.cs, entry.grid.B, `B = ${entry.grid.B}`)));
  const stratByB = new Map();
  for (const sg of report.strat) {
    if (!stratByB.has(sg.B)) stratByB.set(sg.B, []);
    stratByB.get(sg.B).push(sg);
  }
  for (const [B, sgs] of stratByB) draws.push(emit(`strat-B${B}`, winnerHeatmap(sgs.map(sg => sg.honestName), sgs.map(sg => sg.strategic), sgs[0].cs, B, `Strategic voting — B = ${B}`)));

  const be = report.ballotExample;
  let ballotIds = [];
  let dwIds = [];
  if (be) {
    ballotIds = ["ballot-plurality", "ballot-ranked", "ballot-approvaltop2", "ballot-approvaldist", "ballot-score"];
    draws.push(emit(ballotIds[0], pluralityBallotData(report.elec, be)));
    draws.push(emit(ballotIds[1], rankedBallotData(report.elec, be)));
    draws.push(emit(ballotIds[2], approvalBallotData(report.elec, be, "approvalTop2", undefined, `Approval (top 2) ballot — A=0, B=${be[1]}, C=${be[2]}`)));
    draws.push(emit(ballotIds[3], approvalBallotData(report.elec, be, "approval", 0.3, `Approval (dist ≤ 0.3) ballot — A=0, B=${be[1]}, C=${be[2]}`)));
    draws.push(emit(ballotIds[4], scoreBallotData(report.elec, be)));
    dwIds = ["dw-plurality", "dw-ranked", "dw-approvaltop2", "dw-approvaldist", "dw-score"];
    draws.push(emit(dwIds[0], densityWeightedData(report.elec, be, "plurality", undefined, `Plurality — density-weighted (A=0, B=${be[1]}, C=${be[2]})`)));
    draws.push(emit(dwIds[1], rankedDensityWeightedData(report.elec, be, `Ranked (all ranks) — density-weighted (A=0, B=${be[1]}, C=${be[2]})`)));
    draws.push(emit(dwIds[2], densityWeightedData(report.elec, be, "approvalTop2", undefined, `Approval (top 2) — density-weighted (A=0, B=${be[1]}, C=${be[2]})`)));
    draws.push(emit(dwIds[3], densityWeightedData(report.elec, be, "approval", 0.3, `Approval (dist ≤ 0.3) — density-weighted (A=0, B=${be[1]}, C=${be[2]})`)));
    draws.push(emit(dwIds[4], densityWeightedData(report.elec, be, "score", { D: 2, levels: 10 }, `Score (0–10) — density-weighted (A=0, B=${be[1]}, C=${be[2]})`)));
  }

  const sections = [];
  sections.push(`<section><h2>Electorate</h2><div id="elec" class="chart"></div></section>`);
  if (be) {
    sections.push(`<section><h2>Ballot maps (honest, example A=0, B=${be[1]}, C=${be[2]})</h2><p>How each voter's ballot varies with their location (x-axis = voter opinion). Plurality/ranked/approval are Voronoi-style strips; grey in approval means that candidate is not approved by voters at that location.</p>${ballotIds.map(id => `<div id="${id}" class="chart"></div>`).join("\n")}</section>`);
    sections.push(`<section><h2>Ballot maps — density-weighted</h2><p>Same ballots, but each column's height is weighted by the voter count (PDF) at that location, so the silhouette is the electorate distribution and it is partitioned by each candidate's share of the ballot. Total height at any x equals the voter count there. The Ranked panel stacks the three rank tiers (1st/2nd/3rd), each tier a full bell curve segmented by which candidate holds that rank.</p>${dwIds.map(id => `<div id="${id}" class="chart"></div>`).join("\n")}</section>`);
  }
  sections.push(`<section><h2>Honest voting — Yee-type maps</h2><p>Each row: for every position of C, who wins. Green = A, red = B, orange = C, black = no Condorcet winner. Dotted lines mark A (0) and B. Ideally everything is green.</p>
<p><b>Center squeeze.</b> In plurality (and, to a lesser extent, IRV) the centrist A is not safe. Because A sits at the median, a candidate placed to its right - here C (orange) - can peel off the right flank while B (red) holds the left, splitting the vote that would otherwise go to A and letting C win: A gets squeezed out. Push C further right and the right tail abandons it, so the left/center bloc instead delivers the win to B (red). IRV is less prone (it eliminates the deepest outlier first), but the same orange/red intrusion into the center is visible, especially when B is near A. By contrast <b>Approval (top-2) shows center expansion</b>: a candidate sitting between the other two is included in many voters' top-2 sets and can win despite being "squeezed" in a plurality sense - see how B (red) and occasionally C take the center in the top-2 maps.</p>
${report.yee.map(e => `<div id="yee-${e.B}" class="chart"></div>`).join("\n")}</section>`);
  sections.push(`<section><h2>Strategic voting</h2><p>For each method, the winner after strategic voting as C moves (green = A, red = B, orange = C, black = no Condorcet winner). Dotted lines mark A (0) and B. Iteration logs are collected at the bottom of the report.</p>
<p><b>Condorcet methods can fail under strategy.</b> The honest Condorcet map is solidly green (in this 1-D model A is always the Condorcet winner), but the strategic Condorcet row shows black regions - genuine majority cycles. This happens because strategic "bury the leader" voting destroys the single-peakedness of the ballots, so a Condorcet winner need not exist. Notably, strategic <b>Approval and Score do not suffer this</b>: their equilibria still elect the (honest) Condorcet winner A across essentially the whole map - they are, in this setting, more Condorcet-consistent than the Condorcet method itself. If you are attached to Condorcet compliance, a bottom-two-runoff method is the usual remedy: <b>BTR-Score</b> is Condorcet-consistent (it always elects the Condorcet winner when one exists), whereas <b>BTR-IRV is not</b> - it can still elect the "wrong" candidate exactly where the Condorcet cycles appear (the same positions where A is not the strategic winner).</p>
${[...stratByB.entries()].map(([B, sgs]) => `<div id="strat-B${B}" class="chart"></div>`).join("\n")}</section>`);

  const logBlocks = report.strat.map(sg => {
    const n = sg.honest.length;
    const diff = sg.honest.reduce((a, h, i) => a + (h !== sg.strategic[i] ? 1 : 0), 0);
    const nConv = sg.converged.filter(Boolean).length;
    const avgIter = (sg.iterations.reduce((a, b) => a + b, 0) / n).toFixed(1);
    const maxIter = Math.max(...sg.iterations);
    const label = sg.honestName;
    const summary = `winner-changed ${(diff / n * 100).toFixed(1)}%, converged ${(nConv / n * 100).toFixed(0)}%, iters avg ${avgIter}/max ${maxIter}`;
    const logTxt = sg.sample ? sg.sample.log.map(e => `iter ${e.iter}: ${NAMES[e.winner]} → ${NAMES[e.winnerAfter]}  (${e.changedVoters} voters, ${(e.changedMass * 100).toFixed(1)}% mass)`).join("\n") : "";
    return `<details><summary>${label} (B=${sg.B}): ${summary}</summary>\n<pre class="log">${logTxt}</pre></details>`;
  }).join("\n");
  sections.push(`<section><h2>Strategic iteration logs</h2><p>Per-method sample iteration trace (a representative non-converged case, else the max-iteration case) and convergence summary.</p>${logBlocks}</section>`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>1D Spatial Voting — previews</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 1000px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; } h2 { font-size: 1.1rem; margin-top: 2rem; }
  .chart { margin: 0.5rem 0 1.5rem; border: 1px solid #eee; border-radius: 6px; }
  details { margin: -1rem 0 1.5rem; font-size: 12px; }
  pre.log { background: #f7f7f7; padding: 0.5rem 0.8rem; border-radius: 4px; overflow-x: auto; margin: 0.4rem 0; }
  .legend span { display: inline-block; margin-right: 1rem; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: middle; margin-right: 4px; }
</style>
</head><body>
<h1>1D Spatial Voting — non-interactive previews</h1>
<p>A is the median voter (position 0, green). B is fixed on the left (red). C varies (orange).</p>
<p class="legend">
  <span><span class="sw" style="background:${COLORS[0]}"></span>A wins</span>
  <span><span class="sw" style="background:${COLORS[1]}"></span>B wins</span>
  <span><span class="sw" style="background:${COLORS[2]}"></span>C wins</span>
  <span><span class="sw" style="background:#000"></span>no Condorcet winner</span>
</p>
${sections.join("\n")}
<script>
const REPORT = ${JSON.stringify(report)};
${draws.join("\n")}
</script>
</body></html>`;
}
