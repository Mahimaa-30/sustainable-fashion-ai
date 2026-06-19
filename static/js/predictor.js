/* ================================================
   PREDICTOR.JS — Sustainability Rating Predictor
   ================================================ */

const PALETTE = {
  green:'#00c896', teal:'#00b4d8', lime:'#84cc16',
  amber:'#f59e0b', red:'#ef4444',
  ratingA:'#00f5a0', ratingB:'#84cc16', ratingC:'#f59e0b', ratingD:'#ef4444'
};

function fmtNum(n,d=0){ return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

// ─── Load dropdown options ───────────────────────
async function loadOptions() {
  try {
    const res = await fetch('/api/options');
    const opts = await res.json();

    populateSelect('inp-country', opts.countries || []);
    populateSelect('inp-material', opts.materials || []);
    populateSelect('inp-cert', opts.certifications || []);

    // Set sensible defaults
    setSelectVal('inp-country', 'USA');
    setSelectVal('inp-material', 'Organic Cotton');
    setSelectVal('inp-cert', 'GOTS');
  } catch(e) {
    console.error('Options load failed:', e);
  }
}

function populateSelect(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(v => `<option value="${v}">${v}</option>`).join('');
}

function setSelectVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const opt = [...el.options].find(o => o.value === val);
  if (opt) el.value = val;
}

// ─── Range slider live labels ────────────────────
function bindRangeSlider(id, labelId, formatter) {
  const range = document.getElementById(id);
  const label = document.getElementById(labelId);
  if (!range || !label) return;
  const update = () => { label.textContent = formatter(range.value); };
  range.addEventListener('input', update);
  update();
}

// ─── Collect form data ───────────────────────────
function collectFormData() {
  return {
    country:       document.getElementById('inp-country')?.value   || 'USA',
    year:          document.getElementById('inp-year')?.value      || 2024,
    material:      document.getElementById('inp-material')?.value  || 'Organic Cotton',
    eco_friendly:  document.getElementById('inp-eco')?.value       || 'Yes',
    carbon:        parseFloat(document.getElementById('inp-carbon')?.value || 200),
    water:         parseFloat(document.getElementById('inp-water')?.value  || 2000000),
    waste:         parseFloat(document.getElementById('inp-waste')?.value  || 50000),
    recycling:     document.getElementById('inp-recycling')?.value || 'Yes',
    product_lines: parseInt(document.getElementById('inp-lines')?.value   || 5),
    avg_price:     parseFloat(document.getElementById('inp-price')?.value  || 150),
    market:        document.getElementById('inp-market')?.value    || 'Stable',
    cert:          document.getElementById('inp-cert')?.value      || 'GOTS'
  };
}

// ─── Reset form ────────────────────────────────── 
function resetForm() {
  document.getElementById('inp-carbon').value = 200;
  document.getElementById('inp-water').value  = 2000000;
  document.getElementById('inp-waste').value  = 50000;
  document.getElementById('inp-lines').value  = 5;
  document.getElementById('inp-price').value  = 150;
  setSelectVal('inp-eco', 'Yes');
  setSelectVal('inp-recycling', 'Yes');
  setSelectVal('inp-market', 'Stable');
  // Trigger label updates
  ['inp-carbon','inp-water','inp-waste'].forEach(id => {
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
  hideResults();
}

function hideResults() {
  document.getElementById('empty-state').style.display = 'block';
  document.getElementById('results-content').style.display = 'none';
}

// ─── Run Prediction ──────────────────────────────
async function runPrediction() {
  const btn = document.getElementById('btn-predict');
  const btnText = document.getElementById('predict-btn-text');

  // Loading state
  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0"></span> Analyzing…';

  const formData = collectFormData();

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Prediction failed');
    }

    const data = await res.json();
    renderResults(data, formData);
  } catch(e) {
    alert('Prediction error: ' + e.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = '🔮 Predict Rating';
  }
}

// ─── Render Results ──────────────────────────────
function renderResults(data, formData) {
  document.getElementById('empty-state').style.display = 'none';
  const rc = document.getElementById('results-content');
  rc.style.display = 'block';

  const rating = data.rating || 'C';
  const eco    = data.eco_score || 0;
  const carbon = data.predicted_carbon || 0;

  // Rating badge
  const badge = document.getElementById('result-rating-badge');
  badge.className = `rating-result-big`;
  const bcMap = { A:'rgba(0,245,160,0.15)', B:'rgba(132,204,22,0.15)', C:'rgba(245,158,11,0.15)', D:'rgba(239,68,68,0.15)' };
  const clMap = { A:'#00f5a0', B:'#84cc16', C:'#f59e0b', D:'#ef4444' };
  badge.style.background = bcMap[rating] || bcMap.C;
  badge.style.color = clMap[rating] || clMap.C;
  badge.style.border = `2px solid ${clMap[rating]}40`;
  badge.textContent = rating;

  document.getElementById('result-rating-text').textContent = ratingLabel(rating);
  document.getElementById('result-rating-desc').textContent = ratingDesc(rating, eco);

  // Metrics
  document.getElementById('result-carbon').textContent    = fmtNum(carbon, 1) + ' MT';
  document.getElementById('result-ecoscore').textContent  = eco.toFixed(1);
  document.getElementById('result-grade-color').textContent = gradeLabel(eco);
  document.getElementById('result-grade-color').style.color = clMap[rating];

  // Confidence bars
  renderConfidenceBars(data.rating_confidence || {}, rating);

  // Eco-Score ring
  animateRing(eco);

  // Progress breakdown
  const maxC = 500, maxW = 5000000, maxWaste = 100000;
  const carbonPct  = Math.max(0, (1 - formData.carbon / maxC)) * 100;
  const waterPct   = Math.max(0, (1 - formData.water / maxW)) * 100;
  const wastePct   = Math.max(0, (1 - formData.waste / maxWaste)) * 100;
  const ecoPct     = formData.eco_friendly === 'Yes' ? 100 : 0;
  const recPct     = formData.recycling === 'Yes' ? 100 : 0;

  setProgress('carbon', carbonPct);
  setProgress('water', waterPct);
  setProgress('waste', wastePct);
  setProgress('eco', ecoPct);
  setProgress('rec', recPct);

  // Recommendations
  renderRecommendations(data.recommendations || []);

  // Smooth scroll to results
  rc.scrollIntoView({ behavior:'smooth', block:'start' });
}

function ratingLabel(r) {
  return { A:'Excellent Sustainability', B:'Good Sustainability', C:'Average Sustainability', D:'Poor Sustainability' }[r] || 'Unknown';
}
function ratingDesc(r, eco) {
  if (r === 'A') return `Outstanding environmental performance. Eco-score: ${eco.toFixed(1)}/100 — top-tier sustainability leader.`;
  if (r === 'B') return `Good sustainability practices. Eco-score: ${eco.toFixed(1)}/100 — above industry average standards.`;
  if (r === 'C') return `Average sustainability. Eco-score: ${eco.toFixed(1)}/100 — significant improvements are possible.`;
  return `Below-average sustainability. Eco-score: ${eco.toFixed(1)}/100 — urgent improvements needed across all dimensions.`;
}
function gradeLabel(eco) {
  if (eco >= 70) return '🌍 Eco Leader';
  if (eco >= 50) return '🌿 Eco Positive';
  if (eco >= 30) return '⚠️ Needs Improvement';
  return '🚨 High Impact';
}

// ─── Confidence Bars ─────────────────────────────
function renderConfidenceBars(conf, predicted) {
  const container = document.getElementById('confidence-bars');
  if (!container) return;
  const clMap = { A:'#00f5a0', B:'#84cc16', C:'#f59e0b', D:'#ef4444' };
  const sorted = Object.entries(conf).sort(([a],[b]) => a.localeCompare(b));
  container.innerHTML = sorted.map(([r, pct]) => `
    <div class="confidence-bar">
      <span class="confidence-label" style="color:${clMap[r]};font-weight:${r===predicted?'800':'500'}">${r}</span>
      <div class="confidence-track">
        <div class="confidence-fill" style="width:0%;background:${clMap[r]}" data-target="${pct}"></div>
      </div>
      <span class="confidence-pct">${pct.toFixed(1)}%</span>
    </div>
  `).join('');

  // Animate bars with delay
  setTimeout(() => {
    container.querySelectorAll('.confidence-fill').forEach(bar => {
      bar.style.transition = 'width 0.8s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = bar.dataset.target + '%';
    });
  }, 100);
}

// ─── Eco Ring Animation ──────────────────────────
function animateRing(eco) {
  const circle = document.getElementById('eco-ring-circle');
  const numEl  = document.getElementById('eco-ring-num');
  if (!circle || !numEl) return;

  const circumference = 2 * Math.PI * 58; // r=58
  const offset = circumference * (1 - eco / 100);

  numEl.textContent = '0';
  circle.style.strokeDashoffset = circumference;

  // Color based on score
  let stroke;
  if (eco >= 70) stroke = 'url(#grad1)';
  else if (eco >= 50) stroke = '#84cc16';
  else if (eco >= 30) stroke = '#f59e0b';
  else stroke = '#ef4444';
  circle.setAttribute('stroke', stroke);

  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)';
    circle.style.strokeDashoffset = offset;
  }, 200);

  // Count up number
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min((now - t0) / 1200, 1);
    const e = 1 - Math.pow(1 - p, 4);
    numEl.textContent = (eco * e).toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── Progress Bars ───────────────────────────────
function setProgress(key, pct) {
  const fill  = document.getElementById(`pfill-${key}`);
  const label = document.getElementById(`pb-${key}`);
  if (fill)  { setTimeout(() => { fill.style.width = pct.toFixed(1) + '%'; }, 300); }
  if (label) { label.textContent = pct.toFixed(1) + '%'; }
}

// ─── Recommendations ─────────────────────────────
function renderRecommendations(recs) {
  const grid = document.getElementById('recommendations-grid');
  if (!grid) return;
  if (!recs.length) {
    grid.innerHTML = '<div class="alert alert-success">✅ All sustainability parameters are within optimal range!</div>';
    return;
  }
  grid.innerHTML = recs.map(r => `
    <div class="rec-card">
      <span class="rec-icon">${r.icon}</span>
      <div>
        <div class="rec-title">${r.title}</div>
        <div class="rec-detail">${r.detail}</div>
      </div>
    </div>
  `).join('');
}

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadOptions();

  bindRangeSlider('inp-carbon', 'lbl-carbon', v => fmtNum(Number(v), 0));
  bindRangeSlider('inp-water',  'lbl-water',  v => fmtNum(Number(v), 0));
  bindRangeSlider('inp-waste',  'lbl-waste',  v => fmtNum(Number(v), 0));

  document.getElementById('btn-predict')?.addEventListener('click', runPrediction);
  document.getElementById('btn-reset')?.addEventListener('click', resetForm);

  // Allow Enter key on number inputs
  document.querySelectorAll('.form-control').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') runPrediction(); });
  });
});
