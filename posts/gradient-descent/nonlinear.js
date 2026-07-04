// Complete parallel dataset
const dataset = {
    pet:  { features: [1.0, 0.1], targets: { cat: 1.0, airplane: 0.0 } },
    flew: { features: [0.1, 1.0], targets: { cat: 0.0, airplane: 1.0 } }
};

let lossHistory = [];
let stepCounter = 0;
const MAX_HISTORY = 200;

const sliders = {
    w11: document.getElementById('w11'),
    w12: document.getElementById('w12'),
    w21: document.getElementById('w21'),
    w22: document.getElementById('w22')
};

const labels = {
    w11: document.getElementById('w11Val'),
    w12: document.getElementById('w12Val'),
    w21: document.getElementById('w21Val'),
    w22: document.getElementById('w22Val')
};

function leaky_relu(v) {
    return v > 0 ? v : 0.1 * v;
}

function evaluateContext(w11, w12, w21, w22, contextData) {
    const x1 = contextData.features[0];
    const x2 = contextData.features[1];

    const z_cat = w11 * x1 + w12 * x2;
    const z_air = w21 * x1 + w22 * x2;

    const out_cat = leaky_relu(z_cat);
    const out_air = leaky_relu(z_air);

    const loss =
        Math.abs(out_cat - contextData.targets.cat) +
        Math.abs(out_air - contextData.targets.airplane);

    return { out_cat, out_air, loss };
}

function computeTotalLoss(w11, w12, w21, w22) {
    const pet = evaluateContext(w11, w12, w21, w22, dataset.pet);
    const flew = evaluateContext(w11, w12, w21, w22, dataset.flew);

    return {
        pet,
        flew,
        totalLoss: (pet.loss + flew.loss) * 0.5
    };
}

function getPartialDependenceData(activeKey, current) {
    const xValues = [];
    const yValues = [];

    const min = parseFloat(sliders[activeKey].min);
    const max = parseFloat(sliders[activeKey].max);

    const steps = 60;
    const step = (max - min) / steps;

    for (let i = 0; i <= steps; i++) {
        const w = min + i * step;

        const temp = { ...current, [activeKey]: w };
        const res = computeTotalLoss(
            temp.w11, temp.w12, temp.w21, temp.w22
        );

        xValues.push(w);
        yValues.push(res.totalLoss);
    }

    return { x: xValues, y: yValues };
}

const baseLayout = {
    margin: { l: 30, r: 10, t: 10, b: 25 },
    xaxis: { fixedrange: true },
    yaxis: { fixedrange: true },
    showlegend: false,
    height: 150
};

function update() {
    const w11 = parseFloat(sliders.w11.value);
    const w12 = parseFloat(sliders.w12.value);
    const w21 = parseFloat(sliders.w21.value);
    const w22 = parseFloat(sliders.w22.value);

    const current = { w11, w12, w21, w22 };

    // update labels
    Object.keys(current).forEach(k => {
        if (labels[k]) {
            labels[k].innerText = current[k].toFixed(2);
        }
    });

    const evals = computeTotalLoss(w11, w12, w21, w22);

    // bounded history (prevents mobile slowdown)
    lossHistory.push({ x: stepCounter++, y: evals.totalLoss });
    if (lossHistory.length > MAX_HISTORY) lossHistory.shift();

    // main readout
    const lossEl = document.getElementById('nl_loss');
    if (lossEl) {
        lossEl.innerText = `Total Dataset Error = ${evals.totalLoss.toFixed(4)}`;
    }

    // table outputs
    document.getElementById('out_pet_cat').innerText = evals.pet.out_cat.toFixed(2);
    document.getElementById('out_pet_air').innerText = evals.pet.out_air.toFixed(2);
    document.getElementById('loss_pet').innerText = evals.pet.loss.toFixed(2);

    document.getElementById('out_flew_cat').innerText = evals.flew.out_cat.toFixed(2);
    document.getElementById('out_flew_air').innerText = evals.flew.out_air.toFixed(2);
    document.getElementById('loss_flew').innerText = evals.flew.loss.toFixed(2);

    // partial dependence plots
    Object.keys(current).forEach(key => {
        const d = getPartialDependenceData(key, current);

        const traceLine = {
            x: d.x,
            y: d.y,
            mode: 'lines',
            line: { color: '#0275d8', width: 2 },
            hoverinfo: 'skip'
        };

        const tracePoint = {
            x: [current[key]],
            y: [evals.totalLoss],
            mode: 'markers',
            marker: { color: '#d9534f', size: 8 }
        };

        Plotly.react(`plot_${key}`, [traceLine, tracePoint], baseLayout, {
            displayModeBar: false,
            responsive: true
        });
    });

    // loss history plot
    const traceHistory = {
        x: lossHistory.map(d => d.x),
        y: lossHistory.map(d => d.y),
        mode: 'lines',
        line: { color: '#d9534f', width: 2 }
    };

    const historyLayout = {
        margin: { l: 40, r: 10, t: 10, b: 30 },
        xaxis: { title: 'Steps / Slider Edits', fixedrange: true },
        yaxis: { title: 'Error History', fixedrange: true },
        showlegend: false,
        height: 180
    };

    Plotly.react('nl_loss_history', [traceHistory], historyLayout, {
        displayModeBar: false,
        responsive: true
    });
}

Object.values(sliders).forEach(s => {
    if (s) s.addEventListener('input', update);
});

update();