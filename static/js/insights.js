/* ================================================
   INSIGHTS.JS — AI Insights, What-If, Leaderboards
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

function fmtNum(n,d=0){ return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtShort(n){ if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; return fmtNum(n); }

function animateCount(el, target, dur=1200, pre='', suf='', dec=0){
  const t0=performance.now();
  function tick(now){
    const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,4);
    el.textContent=pre+(target*e).toFixed(dec)+suf;
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const ratingColors = { A:PALETTE.ratingA, B:PALETTE.ratingB, C:PALETTE.ratingC, D:PALETTE.ratingD };
const ratingBg     = { A:'rgba(0,245,160,0.15)', B:'rgba(132,204,22,0.15)', C:'rgba(245,158,11,0.15)', D:'rgba(239,68,68,0.15)' };

let edaData = null;
let whatifChart = null;

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadEDA();
  loadLeaderboard();
  document.getElementById('btn-run-whatif')?.addEventListener('click', runWhatIf);
});

// ─── Load EDA ─────────────────────────────────────
async function loadEDA() {
  const res = await fetch('/api/eda');
  edaData = await res.json();
  const kpis = edaData.kpis || {};
  const rd   = edaData.rating_dist || {};

  // Insight numbers
  const totalA = (rd.A || 0) + (rd.B || 0);
  const total  = Object.values(rd).reduce((a,b)=>a+b, 0);
  const topPct = total > 0 ? ((totalA / total) * 100).toFixed(1) : '—';

  const el = (id) => document.getElementById(id);
  if (el('ins-top-pct')) animateCount(el('ins-top-pct'), parseFloat(topPct), 1200,'','%',1);
  if (el('ins-eco-pct')) animateCount(el('ins-eco-pct'), kpis.eco_friendly_pct||0, 1200,'','%',1);
  if (el('ins-rec-pct')) animateCount(el('ins-rec-pct'), kpis.recycling_pct||0, 1200,'','%',1);
  if (el('ins-score'))   animateCount(el('ins-score'),   kpis.avg_eco_score||0, 1400,'','',1);

  // Populate what-if dropdowns from options API
  try {
    const optRes = await fetch('/api/options');
    const opts = await optRes.json();
    populateSelect('wi-country', opts.countries || [], 'USA');
    populateSelect('wi-material', opts.materials || [], 'Organic Cotton');
    populateSelect('wi-cert', opts.certifications || [], 'GOTS');
  } catch(e) {}

  renderCountryLeaderboard();
  renderCertImpactChart();
  renderForecastSection();
  renderMaterialRankingTable();
}

function populateSelect(id, items, def) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(v => `<option value="${v}"${v===def?' selected':''}>${v}</option>`).join('');
}

// ─── Leaderboard ──────────────────────────────────
async function loadLeaderboard() {
  try {
    const res = await fetch('/api/brands/top');
    const brands = await res.json();
    renderLeaderboard(brands);
  } catch(e) {}
}

function renderLeaderboard(brands) {
  const el = document.getElementById('leaderboard-body');
  if (!el) return;
  el.innerHTML = brands.map((b, i) => `
    <div class="leaderboard-item">
      <div class="leaderboard-rank ${i<3?'rank-'+(i+1):'rank-other'}">${i+1}</div>
      <div style="flex:1">
        <div style="font-weight:600;color:var(--text-primary);font-size:0.9rem">${b.Brand_Name}</div>
        <div style="font-size:0.75rem;color:var(--text-secondary)">${b.Country} · ${b.Material_Type} · ${b.Certifications}</div>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="text-align:right">
          <div style="font-size:1rem;font-weight:700;color:var(--text-accent)">${Number(b.Eco_Score).toFixed(1)}</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">ECO SCORE</div>
        </div>
        <div class="rating-badge ${getRatingClass(b.Sustainability_Rating)}">${b.Sustainability_Rating}</div>
      </div>
    </div>
  `).join('');
}

function getRatingClass(r) {
  return { A:'rating-a', B:'rating-b', C:'rating-c', D:'rating-d' }[r] || 'rating-c';
}

// ─── Country Leaderboard ──────────────────────────
function renderCountryLeaderboard() {
  const el = document.getElementById('country-leaderboard');
  if (!el || !edaData) return;

  const cc  = edaData.country_avg_carbon || {};
  const cnt = edaData.country_count      || {};
  const cr  = edaData.country_avg_rating || {};

  // Sort by avg rating (ascending = better)
  const sorted = Object.entries(cr).sort(([,a],[,b]) => a - b).slice(0, 10);
  const maxCount = Math.max(...sorted.map(([country]) => cnt[country] || 0));

  el.innerHTML = sorted.map(([country, score], i) => {
    const count = cnt[country] || 0;
    const carbon = fmtNum(cc[country] || 0, 1);
    const barW = ((count / maxCount) * 100).toFixed(1);
    return `
    <div class="country-bar-row">
      <div style="display:flex;align-items:center;gap:0.5rem;width:90px;flex-shrink:0">
        <span class="leaderboard-rank ${i<3?'rank-'+(i+1):'rank-other'}" style="width:24px;height:24px;font-size:0.7rem">${i+1}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${country}</span>
      </div>
      <div class="country-track">
        <div class="country-fill" style="width:0%" data-target="${barW}"></div>
      </div>
      <div style="text-align:right;flex-shrink:0;width:70px">
        <div style="font-size:0.78rem;font-weight:600;color:var(--text-accent)">${count} brands</div>
        <div style="font-size:0.65rem;color:var(--text-muted)">${carbon} MT</div>
      </div>
    </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    el.querySelectorAll('.country-fill[data-target]').forEach(bar => {
      bar.style.transition = 'width 1s cubic-bezier(0.4,0,0.2,1)';
      bar.style.width = bar.dataset.target + '%';
    });
  }, 300);
}

// ─── Certification Impact Chart ───────────────────
function renderCertImpactChart() {
  const el = document.getElementById('cert-impact-chart');
  if (!el || !edaData) return;

  const cr = edaData.cert_rating || {};
  const cd = edaData.cert_dist   || {};
  const sorted = Object.entries(cr).sort(([,a],[,b]) => a - b);

  new Chart(el, {
    type:'bar',
    data:{
      labels: sorted.map(([k]) => k),
      datasets:[
        {
          label:'Avg Rating Index (lower=better)',
          data: sorted.map(([,v]) => v),
          backgroundColor: sorted.map((_,i) => [
            PALETTE.ratingA, PALETTE.lime, PALETTE.teal, PALETTE.amber, PALETTE.purple, PALETTE.red
          ][i % 6]),
          borderRadius:10, borderSkipped:false, yAxisID:'y'
        },
        {
          label:'Brand Count',
          data: sorted.map(([k]) => cd[k] || 0),
          type:'line',
          borderColor: PALETTE.teal, backgroundColor:'rgba(0,180,216,0.1)',
          tension:0.4, fill:false, pointRadius:5, yAxisID:'y1',
          pointBackgroundColor:PALETTE.teal, pointBorderColor:'#0d1f23', pointBorderWidth:2
        }
      ]
    },
    options:{
      ...BASE_OPTS,
      scales:{
        x:{ ...BASE_OPTS.scales.x },
        y:{ ...BASE_OPTS.scales.y, title:{display:true,text:'Rating Index',color:'rgba(232,244,240,0.4)',font:{size:10}} },
        y1:{ ...BASE_OPTS.scales.y, position:'right', grid:{drawOnChartArea:false},
          title:{display:true,text:'Brands',color:'rgba(0,180,216,0.5)',font:{size:10}} }
      }
    }
  });
}

// ─── Forecast Section ─────────────────────────────
function renderForecastSection() {
  const el = document.getElementById('insight-forecast-chart');
  const cardsEl = document.getElementById('forecast-cards');
  if (!el || !edaData) return;

  const fd = edaData.forecast_data || {};
  const allYears = [...(fd.historical_years||[]).map(String), ...(fd.forecast_years||[]).map(String)];
  const histD = [...(fd.historical_vals||[]), ...Array((fd.forecast_years||[]).length).fill(null)];
  const foreD = [...Array((fd.historical_years||[]).length - 1).fill(null), (fd.historical_vals||[]).at(-1), ...(fd.forecast_vals||[])];

  new Chart(el, {
    type:'line',
    data:{
      labels: allYears,
      datasets:[
        { label:'Historical', data:histD, borderColor:PALETTE.green,
          backgroundColor:(c)=>{ const g=c.chart.ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'rgba(0,200,150,0.25)');g.addColorStop(1,'rgba(0,200,150,0)');return g; },
          fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:PALETTE.green },
        { label:'Forecast', data:foreD, borderColor:PALETTE.teal, borderDash:[6,4],
          backgroundColor:'rgba(0,180,216,0.1)',fill:true,tension:0.4,
          pointRadius:5,pointBackgroundColor:PALETTE.teal }
      ]
    },
    options:{ ...BASE_OPTS }
  });

  // Forecast year cards
  if (cardsEl && fd.forecast_years && fd.forecast_vals) {
    cardsEl.innerHTML = fd.forecast_years.map((yr, i) => `
      <div style="background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:0.9rem;text-align:center">
        <div style="font-size:1.3rem;font-weight:800;color:var(--text-accent);font-family:'Space Grotesk',sans-serif">${fd.forecast_vals[i]}</div>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem">${yr} Forecast</div>
      </div>
    `).join('');
  }
}

// ─── Material Ranking Table ───────────────────────
function renderMaterialRankingTable() {
  const tbody = document.getElementById('material-ranking-body');
  if (!tbody || !edaData) return;

  const mc  = edaData.material_carbon || {};
  const mw  = edaData.material_water  || {};
  const mwt = edaData.material_waste  || {};
  const cnt = edaData.material_count  || {};

  // Compute sustainability index (lower = worse)
  const maxC = Math.max(...Object.values(mc));
  const maxW = Math.max(...Object.values(mw));
  const maxWt = Math.max(...Object.values(mwt));

  const ranked = Object.keys(mc).map(mat => {
    const idx = (
      (1 - (mc[mat] || 0) / maxC) * 40 +
      (1 - (mw[mat] || 0) / maxW) * 35 +
      (1 - (mwt[mat] || 0) / maxWt) * 25
    ).toFixed(1);
    return { mat, carbon: mc[mat], water: mw[mat], waste: mwt[mat], count: cnt[mat] || 0, idx: parseFloat(idx) };
  }).sort((a, b) => b.idx - a.idx);

  const barColors = [PALETTE.ratingA, PALETTE.lime, PALETTE.teal, PALETTE.amber, PALETTE.red, PALETTE.purple, PALETTE.purple];

  tbody.innerHTML = ranked.map((r, i) => {
    const idxColor = r.idx >= 50 ? PALETTE.ratingA : r.idx >= 35 ? PALETTE.ratingB : r.idx >= 20 ? PALETTE.ratingC : PALETTE.ratingD;
    return `<tr>
      <td><span class="leaderboard-rank ${i<3?'rank-'+(i+1):'rank-other'}" style="width:28px;height:28px;font-size:0.75rem">${i+1}</span></td>
      <td style="font-weight:600;color:var(--text-primary)">${r.mat}</td>
      <td>${fmtNum(r.carbon, 1)}</td>
      <td>${fmtShort(r.water)}</td>
      <td>${fmtNum(r.waste, 0)}</td>
      <td>${fmtNum(r.count)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:0.6rem">
          <div style="flex:1;height:8px;background:rgba(0,200,150,0.1);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${r.idx}%;background:${idxColor};border-radius:4px;transition:width 1s"></div>
          </div>
          <span style="font-weight:700;color:${idxColor};width:36px;text-align:right">${r.idx}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ────────────────────────────────────────────────
// WHAT-IF SIMULATOR
// ────────────────────────────────────────────────
async function runWhatIf() {
  const btn = document.getElementById('btn-run-whatif');
  btn.disabled = true;
  btn.textContent = '⏳ Simulating…';

  const formData = {
    country:      document.getElementById('wi-country')?.value   || 'USA',
    year:         2024,
    material:     document.getElementById('wi-material')?.value  || 'Organic Cotton',
    eco_friendly: document.getElementById('wi-eco')?.value       || 'Yes',
    water:        parseFloat(document.getElementById('wi-water')?.value  || 2000000),
    waste:        parseFloat(document.getElementById('wi-waste')?.value  || 50000),
    recycling:    document.getElementById('wi-recycling')?.value || 'Yes',
    product_lines: 5,
    avg_price:    150,
    market:       document.getElementById('wi-market')?.value    || 'Stable',
    cert:         document.getElementById('wi-cert')?.value      || 'GOTS'
  };

  try {
    const res = await fetch('/api/whatif', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(formData)
    });
    const results = await res.json();
    renderWhatIfResults(results);
  } catch(e) {
    document.getElementById('whatif-results').innerHTML =
      `<div class="alert alert-danger">⚠️ Simulation failed: ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '🧪 Run Simulation';
  }
}

function renderWhatIfResults(results) {
  const el = document.getElementById('whatif-results');
  if (!el || !results.length) return;

  const rColors = { A:PALETTE.ratingA, B:PALETTE.ratingB, C:PALETTE.ratingC, D:PALETTE.ratingD };
  const rBg = {
    A:'rgba(0,245,160,0.15)', B:'rgba(132,204,22,0.15)',
    C:'rgba(245,158,11,0.15)', D:'rgba(239,68,68,0.15)'
  };

  el.innerHTML = results.map(r => `
    <div class="whatif-result-row">
      <span class="whatif-carbon-val">Carbon: <strong style="color:var(--text-primary)">${fmtNum(r.carbon)} MT</strong></span>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <span style="font-size:0.75rem;color:var(--text-muted)">→</span>
        <div style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9px;background:${rBg[r.rating]||rBg.C};color:${rColors[r.rating]||rColors.C};font-weight:900;font-size:1rem;font-family:'Space Grotesk',sans-serif;border:1px solid ${rColors[r.rating]||rColors.C}40">${r.rating}</div>
      </div>
    </div>
  `).join('');

  // What-if chart
  const chartEl = document.getElementById('whatif-chart');
  if (!chartEl) return;

  if (whatifChart) { whatifChart.destroy(); }

  const ratingEncMap = { A:4, B:3, C:2, D:1 };
  whatifChart = new Chart(chartEl, {
    type:'line',
    data:{
      labels: results.map(r => `${fmtNum(r.carbon)} MT`),
      datasets:[{
        label:'Predicted Rating (A=4, B=3, C=2, D=1)',
        data: results.map(r => ratingEncMap[r.rating] || 1),
        borderColor: PALETTE.green,
        backgroundColor:(c)=>{ const g=c.chart.ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'rgba(0,200,150,0.3)');g.addColorStop(1,'rgba(0,200,150,0)');return g; },
        fill:true, tension:0.4, pointRadius:6,
        pointBackgroundColor: results.map(r => rColors[r.rating] || rColors.C),
        pointBorderColor:'#0d1f23', pointBorderWidth:2, pointHoverRadius:8
      }]
    },
    options:{
      ...BASE_OPTS,
      scales:{
        x:{ ...BASE_OPTS.scales.x },
        y:{ ...BASE_OPTS.scales.y, beginAtZero:false, min:0.5, max:4.5,
          ticks:{ ...BASE_OPTS.scales.y.ticks, stepSize:1, callback:v => ['','D','C','B','A',''][Math.round(v)] || '' }
        }
      },
      plugins:{
        ...BASE_OPTS.plugins,
        tooltip:{ ...BASE_OPTS.plugins.tooltip, callbacks:{
          label: (ctx) => {
            const r = results[ctx.dataIndex];
            return ` Carbon: ${fmtNum(r.carbon)} MT → Rating: ${r.rating}`;
          }
        }}
      }
    }
  });
}
