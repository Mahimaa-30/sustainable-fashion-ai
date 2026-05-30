/* ================================================
   BENCHMARKS.JS — Model Performance Comparison
   ================================================ */

const PALETTE = {
  green:'#00c896', teal:'#00b4d8', lime:'#84cc16',
  amber:'#f59e0b', red:'#ef4444', purple:'#a855f7',
  ratingA:'#00f5a0', ratingB:'#84cc16', ratingC:'#f59e0b', ratingD:'#ef4444'
};

const BASE_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{
    legend:{ labels:{ color:'rgba(232,244,240,0.7)', font:{family:'Inter',size:12}, usePointStyle:true }},
    tooltip:{
      backgroundColor:'rgba(5,12,14,0.95)', borderColor:'rgba(0,200,150,0.3)', borderWidth:1,
      titleColor:'#e8f4f0', bodyColor:'rgba(232,244,240,0.75)',
      padding:12, cornerRadius:10,
      titleFont:{family:'Space Grotesk',size:13,weight:'700'},
      bodyFont:{family:'Inter',size:12}
    }
  },
  scales:{
    x:{ ticks:{color:'rgba(232,244,240,0.5)',font:{family:'Inter',size:11}}, grid:{color:'rgba(0,200,150,0.06)'}, border:{color:'rgba(0,200,150,0.1)'} },
    y:{ ticks:{color:'rgba(232,244,240,0.5)',font:{family:'Inter',size:11}}, grid:{color:'rgba(0,200,150,0.06)'}, border:{color:'rgba(0,200,150,0.1)'} }
  }
};

function fmtPct(v) { return (v * 100).toFixed(2) + '%'; }
function fmtNum(n, d=0) { return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

const MODEL_COLORS = [PALETTE.green, PALETTE.teal, PALETTE.purple];

// ─── Tab switching ────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('[id^="bench-tab-"]').forEach(t => t.style.display = 'none');
    const el = document.getElementById(`bench-tab-${tab}`);
    if (el) el.style.display = 'block';
  });
});

// ─── Main Load ────────────────────────────────────
async function loadBenchmarks() {
  try {
    const res  = await fetch('/api/benchmarks');
    const data = await res.json();
    const cls  = data.classification || {};
    const reg  = data.regression     || {};
    const meta = data.meta           || {};

    renderClassificationCards(cls, meta);
    renderClassificationChart(cls);
    renderRegressionCards(reg, meta);
    renderRegressionChart(reg);
    renderConfusionMatrices(cls);
    renderFeatureImportance(cls);

    // Best model alerts
    const bestCls = document.getElementById('best-cls-name');
    const bestReg = document.getElementById('best-reg-name');
    if (bestCls) bestCls.textContent = meta.best_cls_model || 'Random Forest';
    if (bestReg) bestReg.textContent = meta.best_reg_model || 'Random Forest';

  } catch(e) {
    console.error('Benchmarks load error:', e);
  }
}

// ─── Classification Model Cards ───────────────────
function renderClassificationCards(cls, meta) {
  const container = document.getElementById('cls-model-cards');
  if (!container) return;

  const models = Object.entries(cls).filter(([k]) => k !== 'feature_importance');
  const bestName = meta.best_cls_model || '';

  container.innerHTML = models.map(([name, metrics], i) => {
    const isBest = name === bestName;
    const acc  = (metrics.accuracy || 0);
    const f1   = (metrics.f1 || 0);
    const prec = (metrics.precision || 0);
    const rec  = (metrics.recall || 0);
    const color = MODEL_COLORS[i % MODEL_COLORS.length];

    return `
    <div class="model-card ${isBest ? 'best' : ''}">
      ${isBest ? '<div class="model-badge">🏆 Best Model</div>' : ''}
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem">
        <div style="width:44px;height:44px;border-radius:12px;background:${color}20;border:1px solid ${color}40;display:flex;align-items:center;justify-content:center;font-size:1.4rem">
          ${i===0?'🌲':i===1?'⚡':'📈'}
        </div>
        <div>
          <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Classification</div>
        </div>
      </div>
      ${metricBar('Accuracy',  acc,  color)}
      ${metricBar('F1-Score',  f1,   color)}
      ${metricBar('Precision', prec, color)}
      ${metricBar('Recall',    rec,  color)}
      <div style="margin-top:1rem;padding:0.75rem;background:${color}10;border-radius:10px;border:1px solid ${color}25;text-align:center">
        <span style="font-size:1.8rem;font-weight:800;color:${color};font-family:'Space Grotesk',sans-serif">${fmtPct(acc)}</span>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem">Overall Accuracy</div>
      </div>
    </div>`;
  }).join('');

  // Animate bars after render
  animateBars();
}

function metricBar(label, val, color) {
  const pct = (val * 100).toFixed(2);
  return `
    <div class="metric-row">
      <span class="metric-name">${label}</span>
      <div class="metric-track">
        <div class="metric-fill" style="width:0%;background:${color}" data-target="${pct}"></div>
      </div>
      <span class="metric-val">${pct}%</span>
    </div>`;
}

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.metric-fill[data-target]').forEach(bar => {
      bar.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = bar.dataset.target + '%';
    });
  }, 200);
}

// ─── Classification Chart ─────────────────────────
function renderClassificationChart(cls) {
  const el = document.getElementById('cls-comparison-chart');
  if (!el) return;

  const models = Object.keys(cls).filter(k => k !== 'feature_importance');
  const metrics = ['accuracy','f1','precision','recall'];
  const metricLabels = ['Accuracy','F1-Score','Precision','Recall'];

  new Chart(el, {
    type:'bar',
    data:{
      labels: metricLabels,
      datasets: models.map((name, i) => ({
        label: name,
        data: metrics.map(m => Number(((cls[name][m]||0)*100).toFixed(2))),
        backgroundColor: MODEL_COLORS[i] + 'cc',
        borderColor: MODEL_COLORS[i],
        borderWidth: 2, borderRadius: 8, borderSkipped: false
      }))
    },
    options:{
      ...BASE_OPTS,
      scales:{
        x:{ ...BASE_OPTS.scales.x },
        y:{ ...BASE_OPTS.scales.y, beginAtZero:false, min:50, max:100,
          ticks:{ ...BASE_OPTS.scales.y.ticks, callback: v => v + '%' } }
      },
      plugins:{
        ...BASE_OPTS.plugins,
        tooltip:{ ...BASE_OPTS.plugins.tooltip, callbacks:{
          label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(2)}%`
        }}
      }
    }
  });
}

// ─── Regression Cards ─────────────────────────────
function renderRegressionCards(reg, meta) {
  const container = document.getElementById('reg-model-cards');
  if (!container) return;

  const bestName = meta.best_reg_model || '';
  const models = Object.entries(reg);

  container.innerHTML = models.map(([name, metrics], i) => {
    const isBest = name === bestName;
    const color = MODEL_COLORS[i % MODEL_COLORS.length];
    return `
    <div class="model-card ${isBest ? 'best' : ''}">
      ${isBest ? '<div class="model-badge">🏆 Best Regressor</div>' : ''}
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
        <div style="width:44px;height:44px;border-radius:12px;background:${color}20;border:1px solid ${color}40;display:flex;align-items:center;justify-content:center;font-size:1.4rem">
          ${i===0?'🌲':'⚡'}
        </div>
        <div>
          <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem">${name}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em">Regression (Carbon Footprint)</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem">
        <div class="reg-metric">
          <div class="reg-metric-val" style="color:${color}">${fmtNum(metrics.rmse||0,2)}</div>
          <div class="reg-metric-lbl">RMSE</div>
        </div>
        <div class="reg-metric">
          <div class="reg-metric-val" style="color:${color}">${fmtNum(metrics.mae||0,2)}</div>
          <div class="reg-metric-lbl">MAE</div>
        </div>
        <div class="reg-metric">
          <div class="reg-metric-val" style="color:${color}">${Number(metrics.r2||0).toFixed(4)}</div>
          <div class="reg-metric-lbl">R² Score</div>
        </div>
      </div>
      <div style="margin-top:1rem">
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:0.5rem">R² Goodness of Fit</div>
        <div class="metric-track">
          <div class="metric-fill" style="width:0%;background:${color}" data-target="${((metrics.r2||0)*100).toFixed(1)}"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  animateBars();
}

// ─── Regression Chart ─────────────────────────────
function renderRegressionChart(reg) {
  const el = document.getElementById('reg-comparison-chart');
  if (!el) return;

  const models = Object.keys(reg);
  new Chart(el, {
    type:'bar',
    data:{
      labels: ['RMSE (lower is better)', 'MAE (lower is better)', 'R² × 100 (higher is better)'],
      datasets: models.map((name, i) => ({
        label: name,
        data: [
          Number((reg[name].rmse||0).toFixed(2)),
          Number((reg[name].mae||0).toFixed(2)),
          Number(((reg[name].r2||0)*100).toFixed(2))
        ],
        backgroundColor: MODEL_COLORS[i] + 'cc',
        borderColor: MODEL_COLORS[i],
        borderWidth: 2, borderRadius: 8, borderSkipped: false
      }))
    },
    options:{
      ...BASE_OPTS,
      scales:{
        x:{ ...BASE_OPTS.scales.x },
        y:{ ...BASE_OPTS.scales.y, beginAtZero:true }
      }
    }
  });
}

// ─── Confusion Matrices ───────────────────────────
function renderConfusionMatrices(cls) {
  const container = document.getElementById('bench-tab-confusion');
  if (!container) return;

  const models = Object.entries(cls).filter(([k]) => k !== 'feature_importance');
  const ratings = ['A','B','C','D'];

  container.innerHTML = `<div class="grid-3" style="gap:1.25rem">` + models.map(([name, metrics], i) => {
    const cm = metrics.confusion_matrix || [];
    if (!cm.length) return '';
    const color = MODEL_COLORS[i % MODEL_COLORS.length];

    let cmHtml = `<table style="border-collapse:separate;border-spacing:6px;margin:0 auto">`;
    // Header
    cmHtml += '<tr><th style="color:var(--text-muted);font-size:0.7rem;padding:0.4rem"></th>';
    ratings.forEach(r => { cmHtml += `<th style="color:var(--text-muted);font-size:0.7rem;padding:0.4rem;text-align:center">Pred ${r}</th>`; });
    cmHtml += '</tr>';

    const maxVal = Math.max(...cm.flat());
    cm.forEach((row, ri) => {
      cmHtml += `<tr><th style="color:var(--text-muted);font-size:0.7rem;padding:0.4rem;text-align:right;white-space:nowrap">Act ${ratings[ri]}</th>`;
      row.forEach((val, ci) => {
        const intensity = maxVal > 0 ? val / maxVal : 0;
        let bg;
        if (ri === ci) {
          // Diagonal - correct predictions
          bg = `rgba(0,200,150,${0.15 + intensity * 0.7})`;
        } else {
          bg = `rgba(239,68,68,${Math.min(intensity * 0.8, 0.6)})`;
        }
        cmHtml += `<td style="width:52px;height:52px;text-align:center;background:${bg};border-radius:8px;font-weight:700;color:rgba(232,244,240,0.9);vertical-align:middle;font-size:0.9rem">${val}</td>`;
      });
      cmHtml += '</tr>';
    });
    cmHtml += '</table>';

    return `
    <div class="card" style="border-color:${color}30">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">${i===0?'🌲':i===1?'⚡':'📈'}</div> ${name}</div>
        <span style="color:${color};font-size:0.8rem;font-weight:600">${fmtPct(metrics.accuracy||0)}</span>
      </div>
      <div class="card-body" style="display:flex;flex-direction:column;align-items:center;gap:1rem">
        ${cmHtml}
        <div style="font-size:0.72rem;color:var(--text-muted);text-align:center">Green = Correct | Red = Misclassified</div>
      </div>
    </div>`;
  }).join('') + '</div>';
}

// ─── Feature Importance ───────────────────────────
function renderFeatureImportance(cls) {
  const fi = cls.feature_importance || {};
  const fiEl = document.getElementById('fi-bars');
  const chartEl = document.getElementById('fi-chart');
  const labelEl = document.getElementById('fi-model-label');

  const sorted = Object.entries(fi).sort(([,a],[,b]) => b - a);
  const maxFI  = sorted[0]?.[1] || 1;

  const FEATURE_LABELS = {
    'Country_Enc': 'Country', 'Year': 'Year', 'Material_Enc': 'Material Type',
    'Eco_Friendly_Enc': 'Eco-Friendly Mfg', 'Carbon_Footprint_MT': 'Carbon Footprint',
    'Water_Usage_Liters': 'Water Usage', 'Waste_Production_KG': 'Waste Production',
    'Recycling_Enc': 'Recycling Programs', 'Product_Lines': 'Product Lines',
    'Average_Price_USD': 'Avg Price', 'Market_Enc': 'Market Trend', 'Cert_Enc': 'Certification'
  };

  if (fiEl) {
    fiEl.innerHTML = sorted.map(([key, val]) => `
      <div class="fi-bar">
        <span class="fi-name" title="${FEATURE_LABELS[key]||key}">${FEATURE_LABELS[key]||key}</span>
        <div class="fi-track">
          <div class="fi-fill" style="width:0%" data-target="${((val/maxFI)*100).toFixed(1)}"></div>
        </div>
        <span class="fi-val">${(val*100).toFixed(2)}%</span>
      </div>
    `).join('');
    animateBars();
  }

  if (chartEl) {
    new Chart(chartEl, {
      type:'bar',
      data:{
        labels: sorted.map(([k]) => FEATURE_LABELS[k]||k),
        datasets:[{
          label:'Feature Importance',
          data: sorted.map(([,v]) => parseFloat((v*100).toFixed(4))),
          backgroundColor: sorted.map((_, i) => {
            const hue = 160 - (i * 15);
            return `hsl(${Math.max(hue,0)}, 80%, 55%)`;
          }),
          borderRadius:8, borderSkipped:false
        }]
      },
      options:{
        ...BASE_OPTS,
        indexAxis:'y',
        plugins:{ ...BASE_OPTS.plugins, legend:{display:false},
          tooltip:{ ...BASE_OPTS.plugins.tooltip, callbacks:{
            label: ctx => ` Importance: ${ctx.raw.toFixed(4)}%`
          }}
        },
        scales:{
          x:{ ...BASE_OPTS.scales.x, beginAtZero:true, ticks:{...BASE_OPTS.scales.x.ticks, callback:v=>v+'%'} },
          y:{ ...BASE_OPTS.scales.y }
        }
      }
    });
  }
}

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadBenchmarks);
