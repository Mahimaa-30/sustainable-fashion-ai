/* ================================================
   DASHBOARD.JS — Main Dashboard Charts & KPIs
   ================================================ */

const PALETTE = {
  green:'#00c896', teal:'#00b4d8', lime:'#84cc16',
  amber:'#f59e0b', red:'#ef4444', purple:'#a855f7',
  ratingA:'#00f5a0', ratingB:'#84cc16', ratingC:'#f59e0b', ratingD:'#ef4444'
};

const BASE_OPTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{
    legend:{ labels:{ color:'rgba(232,244,240,0.7)', font:{family:'Inter',size:12}, usePointStyle:true, pointStyleWidth:10 }},
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

function fmtNum(n, d=0){ return Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtShort(n){ if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; return fmtNum(n); }

function animateCount(el, target, dur=1200, pre='', suf='', dec=0){
  const t0=performance.now();
  function tick(now){
    const p=Math.min((now-t0)/dur,1), e=1-Math.pow(1-p,4);
    el.textContent=pre+fmtNum(target*e,dec)+suf;
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function areaGrad(ctx, hex, a1=0.35, a2=0.0){
  const g=ctx.createLinearGradient(0,0,0,ctx.canvas.height);
  const [r,gr,b]=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  g.addColorStop(0,`rgba(${r},${gr},${b},${a1})`);
  g.addColorStop(1,`rgba(${r},${gr},${b},${a2})`);
  return g;
}

// ─── Fetch EDA data & render all ─────────────────
async function loadDashboard() {
  try {
    const res = await fetch('/api/eda');
    const data = await res.json();
    const kpis = data.kpis || {};

    // ── KPI Cards ──
    animateCount(document.getElementById('kv-brands'), kpis.total_brands || 0, 1400);
    animateCount(document.getElementById('kv-carbon'), kpis.avg_carbon || 0, 1200, '', ' MT', 1);
    animateCount(document.getElementById('kv-eco'), kpis.eco_friendly_pct || 0, 1300, '', '%', 1);
    animateCount(document.getElementById('kv-score'), kpis.avg_eco_score || 0, 1200, '', '', 1);
    animateCount(document.getElementById('kv-water'), kpis.avg_water || 0, 1200, '', '', 0);

    renderRatingDoughnut(data.rating_dist || {});
    renderMarketTrend(data.market_dist || {});
    renderEcoTrend(data.forecast_data || {});
    renderMaterialCarbon(data.material_carbon || {});
    renderCountryChart(data.country_count || {});
    renderTopBrands(data.top_brands || []);
    renderCertChart(data.cert_dist || {});
    renderCarbonByRating(data);
  } catch(e) {
    console.error('Dashboard load error:', e);
  }
}

// ─── Rating Doughnut ─────────────────────────────
function renderRatingDoughnut(dist) {
  const ctx = document.getElementById('ratingDoughnutChart');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(dist).map(k => `Rating ${k}`),
      datasets: [{
        data: Object.values(dist),
        backgroundColor: Object.keys(dist).map(k => ({A:PALETTE.ratingA,B:PALETTE.ratingB,C:PALETTE.ratingC,D:PALETTE.ratingD}[k]||'#888')),
        borderColor: 'rgba(5,12,14,0.5)',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      cutout: '65%',
      plugins: {
        legend: { position:'right', labels:{ color:'rgba(232,244,240,0.7)', font:{family:'Inter',size:12}, usePointStyle:true, pointStyleWidth:10 }},
        tooltip: { ...BASE_OPTS.plugins.tooltip,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} brands (${((ctx.raw/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

// ─── Market Trend Bar ────────────────────────────
function renderMarketTrend(dist) {
  const ctx = document.getElementById('marketTrendChart');
  if (!ctx) return;
  const colors = { Growing: PALETTE.green, Stable: PALETTE.teal, Declining: PALETTE.amber };
  const labels = Object.keys(dist);
  const vals   = Object.values(dist);
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Brand Count',
        data: vals,
        backgroundColor: labels.map(l => colors[l] || PALETTE.purple),
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      ...BASE_OPTS,
      plugins: { ...BASE_OPTS.plugins, legend:{display:false} },
      scales: {
        x: { ...BASE_OPTS.scales.x },
        y: { ...BASE_OPTS.scales.y, beginAtZero:true }
      }
    }
  });
}

// ─── Eco-Score Line + Forecast ───────────────────
function renderEcoTrend(fd) {
  const ctx = document.getElementById('ecoTrendChart');
  if (!ctx) return;
  const histYears  = (fd.historical_years  || []).map(String);
  const histVals   = fd.historical_vals   || [];
  const foreYears  = (fd.forecast_years    || []).map(String);
  const foreVals   = fd.forecast_vals    || [];

  const allYears = [...histYears, ...foreYears];
  const histData = [...histVals, ...Array(foreYears.length).fill(null)];
  const foreData = [...Array(histYears.length - 1).fill(null), histVals[histVals.length-1], ...foreVals];

  new Chart(ctx, {
    type:'line',
    data:{
      labels: allYears,
      datasets:[
        {
          label:'Historical Eco-Score',
          data: histData,
          borderColor: PALETTE.green,
          backgroundColor: (context) => areaGrad(context.chart.ctx, PALETTE.green),
          fill:true, tension:0.4, pointRadius:4,
          pointBackgroundColor: PALETTE.green, pointBorderColor:'#0d1f23', pointBorderWidth:2
        },
        {
          label:'Forecast',
          data: foreData,
          borderColor: PALETTE.teal,
          borderDash:[6,3],
          backgroundColor:'rgba(0,180,216,0.1)',
          fill:true, tension:0.4, pointRadius:5,
          pointBackgroundColor: PALETTE.teal, pointBorderColor:'#0d1f23', pointBorderWidth:2
        }
      ]
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { ...BASE_OPTS.scales.x },
        y: { ...BASE_OPTS.scales.y, beginAtZero:false, title:{display:true, text:'Eco-Score', color:'rgba(232,244,240,0.5)', font:{size:11}} }
      }
    }
  });
}

// ─── Material Carbon Bar ─────────────────────────
function renderMaterialCarbon(mc) {
  const ctx = document.getElementById('materialCarbonChart');
  if (!ctx) return;
  const sorted = Object.entries(mc).sort(([,a],[,b])=>b-a);
  const labels = sorted.map(([k])=>k);
  const vals   = sorted.map(([,v])=>v);
  new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Avg Carbon (MT)',
        data: vals,
        backgroundColor: [PALETTE.ratingA, PALETTE.ratingB, PALETTE.ratingC, PALETTE.ratingD, PALETTE.teal, PALETTE.purple, PALETTE.amber],
        borderRadius:10, borderSkipped:false
      }]
    },
    options: {
      ...BASE_OPTS,
      indexAxis:'y',
      plugins: { ...BASE_OPTS.plugins, legend:{display:false} },
      scales: {
        x: { ...BASE_OPTS.scales.x, beginAtZero:true },
        y: { ...BASE_OPTS.scales.y }
      }
    }
  });
}

// ─── Country Brand Count ─────────────────────────
function renderCountryChart(cc) {
  const ctx = document.getElementById('countryChart');
  if (!ctx) return;
  const sorted = Object.entries(cc).sort(([,a],[,b])=>b-a).slice(0,10);
  const labels = sorted.map(([k])=>k);
  const vals   = sorted.map(([,v])=>v);
  const grad   = ctx.getContext('2d').createLinearGradient(0,0,400,0);
  grad.addColorStop(0, PALETTE.green);
  grad.addColorStop(1, PALETTE.teal);
  new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[{ label:'Brands', data:vals, backgroundColor:grad, borderRadius:8, borderSkipped:false }]
    },
    options:{
      ...BASE_OPTS,
      plugins:{...BASE_OPTS.plugins, legend:{display:false}},
      scales:{
        x:{ ...BASE_OPTS.scales.x },
        y:{ ...BASE_OPTS.scales.y, beginAtZero:true }
      }
    }
  });
}

// ─── Top Brands Table ────────────────────────────
function renderTopBrands(brands) {
  const tbody = document.getElementById('top-brands-body');
  if (!tbody) return;
  const ratingColors = { A:'rating-a', B:'rating-b', C:'rating-c', D:'rating-d' };
  tbody.innerHTML = brands.map((b, i) => `
    <tr>
      <td><span class="leaderboard-rank ${i<3?'rank-'+(i+1):'rank-other'}">${i+1}</span></td>
      <td style="font-weight:600;color:var(--text-primary)">${b.Brand_Name}</td>
      <td><span class="badge badge-blue">${b.Country}</span></td>
      <td><span class="rating-badge ${ratingColors[b.Sustainability_Rating]||''}">${b.Sustainability_Rating}</span></td>
      <td><strong style="color:var(--text-accent)">${Number(b.Eco_Score).toFixed(1)}</strong></td>
      <td>${fmtNum(b.Carbon_Footprint_MT,1)}</td>
      <td>${b.Material_Type}</td>
      <td><span class="badge badge-green">${b.Certifications}</span></td>
    </tr>
  `).join('');
}

// ─── Cert Doughnut ───────────────────────────────
function renderCertChart(cd) {
  const ctx = document.getElementById('certChart');
  if (!ctx) return;
  const cColors = [PALETTE.green, PALETTE.teal, PALETTE.lime, PALETTE.amber, PALETTE.purple, PALETTE.red];
  new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: Object.keys(cd),
      datasets:[{
        data: Object.values(cd),
        backgroundColor: cColors.slice(0, Object.keys(cd).length),
        borderColor:'rgba(5,12,14,0.5)', borderWidth:3, hoverOffset:8
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{
        legend:{ position:'right', labels:{ color:'rgba(232,244,240,0.7)', font:{family:'Inter',size:11}, usePointStyle:true }},
        tooltip:{ ...BASE_OPTS.plugins.tooltip }
      }
    }
  });
}

// ─── Carbon by Rating Group ──────────────────────
function renderCarbonByRating(data) {
  const ctx = document.getElementById('carbonByRatingChart');
  if (!ctx) return;

  // Estimate from material data — use material carbon sorted
  const mc = data.material_carbon || {};
  const sorted = Object.entries(mc).sort(([,a],[,b])=>a-b);

  new Chart(ctx, {
    type:'radar',
    data:{
      labels: sorted.map(([k])=>k),
      datasets:[{
        label:'Avg Carbon Footprint',
        data: sorted.map(([,v])=>v),
        backgroundColor:'rgba(0,200,150,0.15)',
        borderColor: PALETTE.green,
        pointBackgroundColor: PALETTE.green,
        pointBorderColor:'#0d1f23', pointBorderWidth:2,
        pointRadius:5
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{...BASE_OPTS.plugins.tooltip} },
      scales:{
        r:{
          ticks:{ color:'rgba(232,244,240,0.4)', backdropColor:'transparent', font:{size:10} },
          grid:{ color:'rgba(0,200,150,0.08)' },
          pointLabels:{ color:'rgba(232,244,240,0.65)', font:{family:'Inter',size:11} },
          angleLines:{ color:'rgba(0,200,150,0.08)' }
        }
      }
    }
  });
}

// ─── Bootstrap ───────────────────────────────────
document.addEventListener('DOMContentLoaded', loadDashboard);
