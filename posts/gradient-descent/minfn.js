(() => {
  const slider = document.getElementById("slider");
  const valueDisplay = document.getElementById("valuex");
  const valueDisplayf = document.getElementById("valuef");
  const history = [];

  function f(x) {
    return Math.abs(x);
  }

  function drawMain(x0) {
    const xs = [];
    const ys = [];

    for (let x = -4; x <= 4; x += 0.05) {
      xs.push(x);
      ys.push(f(x));
    }

    const curve = {
      x: xs,
      y: ys,
      mode: "lines",
      line: { color: "#333", width: 2 },
      name: "f(x)"
    };

    const point = {
      x: [x0],
      y: [f(x0)],
      mode: "markers",
      marker: { color: "red", size: 10 },
      name: "current"
    };

    const layout = {
      xaxis: {
        range: [-4, 4],
        fixedrange: true,
        autorange: false
      },
      yaxis: {
        title: "f(x)",
        fixedrange: true
      },
      margin: { t: 20, r: 10, l: 35, b: 30 },
      showlegend: false,
      autosize: true
    };

    Plotly.react("plot", [curve, point], layout, {
      displayModeBar: false,
      responsive: true
    });
  }

  function drawHistory() {
    const trace = {
      x: history.map((_, i) => i),
      y: history,
      mode: "lines+markers",
      line: { color: "rgba(0, 100, 255, 0.8)" }
    };

    const layout = {
      title: "f(x) over steps",
      xaxis: { title: "step", fixedrange: true },
      yaxis: { title: "f(x)", fixedrange: true },
      margin: { t: 40, r: 10, l: 45, b: 35 },
      showlegend: false,
      autosize: true
    };

    Plotly.react("plot2", [trace], layout, {
      displayModeBar: false,
      responsive: true
    });
  }

  function update() {
    const x = parseFloat(slider.value);
    const y = f(x);

    history.push(y);

    drawMain(x);
    drawHistory();

    valueDisplay.textContent = `x = ${x.toFixed(2)}`;
    valueDisplayf.textContent = `f(x) = ${y.toFixed(2)}`;
  }

  slider.addEventListener("input", update);

  window.addEventListener("resize", () => {
    Plotly.Plots.resize("plot");
    Plotly.Plots.resize("plot2");
  });

  update();
})();