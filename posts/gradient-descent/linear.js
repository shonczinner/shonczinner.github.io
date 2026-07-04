(() => {
  const slopeEl = document.getElementById("slope");
  const interceptEl = document.getElementById("intercept");

  const slopeVal = document.getElementById("slopeVal");
  const interceptVal = document.getElementById("interceptVal");
  const maeEl = document.getElementById("mae");

  const PLOT1 = "lin_plot1";
  const PLOT2 = "lin_plot2";
  const PLOT3 = "lin_plot3";
  const PLOT4 = "lin_plot4";

  function mulberry32(seed) {
    return function () {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(42);

  const TRUE_SLOPE = 2.4;
  const TRUE_INTERCEPT = 35;

  const data = [];
  for (let x = 0; x <= 180; x += 4) {
    const noise = (rand() - 0.5) * 60;
    data.push({
      x,
      y: TRUE_SLOPE * x + TRUE_INTERCEPT + noise
    });
  }

  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);

  const xRange = [0, Math.max(...xs)];
  const yRange = [Math.min(...ys) - 40, Math.max(...ys) + 40];

  const lossHistory = [];

  function predict(x, m, b) {
    return m * x + b;
  }

  function sumAbsError(residuals) {
    return residuals.reduce((a, b) => a + Math.abs(b), 0);
  }

  function update() {
    const m = parseFloat(slopeEl.value);
    const b = parseFloat(interceptEl.value);

    const mMin = parseFloat(slopeEl.min);
    const mMax = parseFloat(slopeEl.max);
    const bMin = parseFloat(interceptEl.min);
    const bMax = parseFloat(interceptEl.max);

    slopeVal.textContent = m.toFixed(2);
    interceptVal.textContent = b.toFixed(2);

    const yhat = xs.map(x => predict(x, m, b));
    const residuals = ys.map((y, i) => y - yhat[i]);

    const loss = sumAbsError(residuals);
    maeEl.textContent = `Sum absolute error: ${loss.toFixed(2)}`;

    lossHistory.push(loss);

    // =========================
    // PLOT 1
    // =========================
    const traces1 = [];

    for (let i = 0; i < xs.length; i++) {
      traces1.push({
        x: [xs[i], xs[i]],
        y: [yhat[i], ys[i]],
        mode: "lines",
        hoverinfo: "skip",
        line: { color: "rgba(0,0,0,0.25)", width: 1 }
      });
    }

    traces1.push({
      x: xs,
      y: ys,
      mode: "markers",
      marker: { size: 6 }
    });

    traces1.push({
      x: xRange,
      y: xRange.map(x => predict(x, m, b)),
      mode: "lines",
      line: { color: "red", width: 3 }
    });

    Plotly.react(PLOT1, traces1, {
      title: "House size vs home price",
      xaxis: { title: "Size (m²)", range: xRange, fixedrange: true },
      yaxis: { title: "Price ($k)", range: yRange, fixedrange: true },
      margin: { t: 40, r: 10, l: 40, b: 40 },
      autosize: true,
      showlegend: false
    }, { displayModeBar: false, responsive: true });

    // =========================
    // PLOT 2
    // =========================
    Plotly.react(PLOT2, [{
      x: lossHistory.map((_, i) => i),
      y: lossHistory,
      mode: "lines+markers",
      line: { color: "rgba(0,100,255,0.8)" }
    }], {
      title: "sum absolute error over adjustments",
      xaxis: { title: "step", fixedrange: true },
      yaxis: { title: "", fixedrange: true, tickformat: ".2s" },
      margin: { t: 40, r: 10, l: 40, b: 40 },
      autosize: true,
      showlegend: false
    }, { displayModeBar: false, responsive: true });

    // =========================
    // PLOT 3
    // =========================
    const bVals = [];
    const bLoss = [];

    const bStep = (bMax - bMin) / 80;
    for (let bTest = bMin; bTest <= bMax; bTest += bStep) {
      const preds = xs.map(x => m * x + bTest);
      const res = ys.map((y, i) => y - preds[i]);
      bVals.push(bTest);
      bLoss.push(sumAbsError(res));
    }

    Plotly.react(PLOT3, [
      {
        x: bVals,
        y: bLoss,
        mode: "lines",
        line: { color: "#337ab7" }
      },
      {
        x: [b],
        y: [loss],
        mode: "markers",
        marker: { size: 10, color: "red" }
      }
    ], {
      xaxis: { range: [bMin, bMax], fixedrange: true },
      yaxis: { fixedrange: true, showticklabels: false },
      margin: { t: 10, r: 10, l: 35, b: 25 },
      autosize: true,
      showlegend: false
    }, { displayModeBar: false, responsive: true });

    // =========================
    // PLOT 4
    // =========================
    const mVals = [];
    const mLoss = [];

    const mStep = (mMax - mMin) / 80;
    for (let mTest = mMin; mTest <= mMax; mTest += mStep) {
      const preds = xs.map(x => mTest * x + b);
      const res = ys.map((y, i) => y - preds[i]);
      mVals.push(mTest);
      mLoss.push(sumAbsError(res));
    }

    Plotly.react(PLOT4, [
      {
        x: mVals,
        y: mLoss,
        mode: "lines",
        line: { color: "#337ab7" }
      },
      {
        x: [m],
        y: [loss],
        mode: "markers",
        marker: { size: 10, color: "red" }
      }
    ], {
      xaxis: { range: [mMin, mMax], fixedrange: true },
      yaxis: { fixedrange: true },
      margin: { t: 10, r: 10, l: 35, b: 25 },
      autosize: true,
      showlegend: false
    }, { displayModeBar: false, responsive: true });
  }

  slopeEl.addEventListener("input", update);
  interceptEl.addEventListener("input", update);

  window.addEventListener("resize", () => {
    [PLOT1, PLOT2, PLOT3, PLOT4].forEach(id => {
      Plotly.Plots.resize(id);
    });
  });

  update();
})();