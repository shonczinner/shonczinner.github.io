(() => {
  const root = document.getElementById("gol-app");

  root.innerHTML = `
    <div class="gol-container">
      <div class="gol-controls">
        <button id="playBtn">Play</button>
        <button id="stepBtn">Step</button>
        <button id="randomBtn">Random</button>
        <button id="clearBtn">Clear</button>

        <label>
          Speed
          <input id="speed" type="range" min="1" max="30" value="10">
          <span id="speedValue">10</span>
        </label>
      </div>

      <div class="gol-canvas-wrapper">
        <canvas id="canvas"></canvas>
      </div>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    .gol-container {
      border: 1px solid #ddd;
    }

    .gol-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px;
      align-items: center;
    }

    .gol-controls button {
      padding: 8px 12px;
      cursor: pointer;
    }

    .gol-canvas-wrapper {
      height: 600px;
    }

    .gol-canvas-wrapper canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
    }
  `;
  document.head.appendChild(style);

  const canvas = root.querySelector("#canvas");
  const ctx = canvas.getContext("2d");

  const playBtn = root.querySelector("#playBtn");
  const stepBtn = root.querySelector("#stepBtn");
  const randomBtn = root.querySelector("#randomBtn");
  const clearBtn = root.querySelector("#clearBtn");

  const speedSlider = root.querySelector("#speed");
  const speedValue = root.querySelector("#speedValue");

  const CELL_SIZE = 12;

  let cols;
  let rows;
  let grid = [];
  let running = false;
  let lastStep = 0;
  let drawMode = null;

  function resize() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    const newCols = Math.floor(canvas.width / CELL_SIZE);
    const newRows = Math.floor(canvas.height / CELL_SIZE);

    const newGrid = Array.from({ length: newRows }, (_, y) =>
      Array.from({ length: newCols }, (_, x) =>
        grid[y]?.[x] || 0
      )
    );

    cols = newCols;
    rows = newRows;
    grid = newGrid;

    draw();
  }

  function createEmptyGrid() {
    return Array.from({ length: rows }, () =>
      Array(cols).fill(0)
    );
  }

  function randomize() {
    grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () =>
        Math.random() > 0.75 ? 1 : 0
      )
    );
    draw();
  }

  function clearGrid() {
    grid = createEmptyGrid();
    draw();
  }

  function countNeighbors(x, y) {
    let count = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;

        if (
          nx >= 0 &&
          nx < cols &&
          ny >= 0 &&
          ny < rows
        ) {
          count += grid[ny][nx];
        }
      }
    }

    return count;
  }

  function step() {
    const next = createEmptyGrid();

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const alive = grid[y][x];
        const neighbors = countNeighbors(x, y);

        if (alive) {
          next[y][x] =
            neighbors === 2 || neighbors === 3 ? 1 : 0;
        } else {
          next[y][x] =
            neighbors === 3 ? 1 : 0;
        }
      }
    }

    grid = next;
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x]) {
          ctx.fillStyle = "#00ff88";
          ctx.fillRect(
            x * CELL_SIZE,
            y * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
          );
        }
      }
    }

    ctx.strokeStyle = "#222";

    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, rows * CELL_SIZE);
      ctx.stroke();
    }

    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(cols * CELL_SIZE, y * CELL_SIZE);
      ctx.stroke();
    }
  }

  function animate(timestamp) {
    if (running) {
      const fps = Number(speedSlider.value);
      const interval = 1000 / fps;

      if (timestamp - lastStep >= interval) {
        step();
        draw();
        lastStep = timestamp;
      }
    }

    requestAnimationFrame(animate);
  }

  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: Math.floor((e.clientX - rect.left) / CELL_SIZE),
      y: Math.floor((e.clientY - rect.top) / CELL_SIZE)
    };
  }

  function paint(e) {
    const { x, y } = cellFromEvent(e);

    if (
      x < 0 || x >= cols ||
      y < 0 || y >= rows
    ) return;

    grid[y][x] = drawMode;
    draw();
  }

  canvas.addEventListener("mousedown", e => {
    const { x, y } = cellFromEvent(e);

    drawMode = grid[y][x] ? 0 : 1;
    paint(e);
  });

  canvas.addEventListener("mousemove", e => {
    if (drawMode !== null) paint(e);
  });

  window.addEventListener("mouseup", () => {
    drawMode = null;
  });

  playBtn.addEventListener("click", () => {
    running = !running;
    playBtn.textContent = running ? "Pause" : "Play";
  });

  stepBtn.addEventListener("click", () => {
    if (!running) {
      step();
      draw();
    }
  });

  randomBtn.addEventListener("click", randomize);
  clearBtn.addEventListener("click", clearGrid);

  speedSlider.addEventListener("input", () => {
    speedValue.textContent = speedSlider.value;
  });

  window.addEventListener("resize", resize);

  resize();
  randomize();
  requestAnimationFrame(animate);
})();