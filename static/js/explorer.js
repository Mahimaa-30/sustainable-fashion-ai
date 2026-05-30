/* ================================================
   EXPLORER.JS — EDA Explorer Interactive Charts
   ================================================ */

const PALETTE = {
  green:'#00c896', teal:'#00b4d8', lime:'#84cc16',
  amber:'#f59e0b', red:'#ef4444', purple:'#a855f7', blue:'#3b82f6',
  ratingA:'#00f5a0', ratingB:'#84cc16', ratingC:'#f59e0b', ratingD:'#ef4444'
};
const MAT_COLORS  = [PALETTE.green,PALETTE.teal,PALETTE.lime,PALETTE.amber,PALETTE.purple,PALETTE.blue,PALETTE.red];
const COUNTRY_COLORS = ['#00c896','#00b4d8','#84cc16','#a855f7','#f59e0b','#3b82f6','#ec4899','#10b981','#f97316','#06b6d4'];

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

function areaGrad(ctx, hex, a1=0.3, a2=0.0){
  const g=ctx.createLinearGradient(0,0,0,ctx.canvas.height);
  const [r,gr,b]=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
  g.addColorStop(0,`rgba(${r},${gr},${b},${a1})`);
  g.addColorStop(1,`rgba(${r},${gr},${b},${a2})`);
  return g;
}

let edaData = null;
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ─── Tab switching ────────────────────────────────
function initTabs() {
  document.querySelectorAll('#eda-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#eda-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(t => t.style.display='none');
      document.getElementById(`tab-${tab}`).style.display='block';
      renderTab(tab);
    });
  });
}

function renderTab(tab) {
  if (!edaData) return;
  switch(tab) {
    case 'materials':  renderMaterialsTab(); break;
    case 'countries':  renderCountriesTab(); break;
    case 'scatter':    renderScatterTab();   break;
    case 'trends':     renderTrendsTab();    break;
    case 'certs':      renderCertsTab();     break;
    case 'heatmap':    renderHeatmapTab();   break;
  }
}

// ─── LOAD ALL DATA ────────────────────────────────
async function loadEDA() {
  const res  = await fetch('/api/eda');
  edaData    = await res.json();
  const kpis = edaData.kpis || {};

  // Quick stats
  document.getElementById('es-total').textContent    = fmtNum(kpis.total_brands || 0);
  document.getElementById('es-countries').textContent = kpis.countries || '—';
  document.getElementById('es-years').textContent    = kpis.years_span || '—';
  document.getElementById('es-eco-pct').textContent  = (kpis.eco_friendly_pct || 0).toFixed(1) + '%';
  document.getElementById('es-rec-pct').textContent  = (kpis.recycling_pct || 0).toFixed(1) + '%';
  document.getElementById('es-avg-price').textContent= '$' + fmtNum(kpis.avg_price || 0, 0);

  // Default tab
  renderMaterialsTab();
}

// ────────────────────────────────────────────────
// MATERIALS TAB
// ────────────────────────────────────────────────
function renderMaterialsTab() {
  const mc  = edaData.material_carbon || {};
  const mw  = edaData.material_water  || {};
  const mwt = edaData.material_waste  || {};
  const cnt = edaData.material_count  || {};
  const mats = Object.keys(mc);

  ['mat-carbon-chart','mat-water-chart','mat-waste-chart','mat-count-chart'].forEach(destroyChart);

  // Carbon
  const cc = document.getElementById('mat-carbon-chart');
  if (cc) {
    charts['mat-carbon-chart'] = new Chart(cc, {
      type:'bar',
      data:{ labels:mats, datasets:[{
        label:'Avg Carbon (MT)', data:mats.map(m=>mc[m]),
        backgroundColor:MAT_COLORS, borderRadius:10, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, indexAxis:'y', plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{ x:{...BASE_OPTS.scales.x,beginAtZero:true}, y:{...BASE_OPTS.scales.y} } }
    });
  }
  // Water
  const wc = document.getElementById('mat-water-chart');
  if (wc) {
    charts['mat-water-chart'] = new Chart(wc, {
      type:'bar',
      data:{ labels:mats, datasets:[{
        label:'Avg Water (L)', data:mats.map(m=>mw[m]),
        backgroundColor:MAT_COLORS.map(c=>c+'b0'), borderRadius:10, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{
          x:{...BASE_OPTS.scales.x},
          y:{...BASE_OPTS.scales.y,beginAtZero:true,ticks:{...BASE_OPTS.scales.y.ticks, callback:v=>fmtShort(v)}}
        }
      }
    });
  }
  // Waste
  const wsc = document.getElementById('mat-waste-chart');
  if (wsc) {
    charts['mat-waste-chart'] = new Chart(wsc, {
      type:'bar',
      data:{ labels:mats, datasets:[{
        label:'Avg Waste (KG)', data:mats.map(m=>mwt[m]),
        backgroundColor:MAT_COLORS, borderRadius:10, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, indexAxis:'y', plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{ x:{...BASE_OPTS.scales.x,beginAtZero:true}, y:{...BASE_OPTS.scales.y} } }
    });
  }
  // Count
  const mcc = document.getElementById('mat-count-chart');
  if (mcc) {
    const sorted = Object.entries(cnt).sort(([,a],[,b])=>b-a);
    charts['mat-count-chart'] = new Chart(mcc, {
      type:'doughnut',
      data:{ labels:sorted.map(([k])=>k), datasets:[{
        data:sorted.map(([,v])=>v),
        backgroundColor:MAT_COLORS, borderColor:'rgba(5,12,14,0.5)', borderWidth:3, hoverOffset:8
      }]},
      options:{
        responsive:true, maintainAspectRatio:false, cutout:'60%',
        plugins:{
          legend:{ position:'right', labels:{color:'rgba(232,244,240,0.7)',font:{family:'Inter',size:11},usePointStyle:true}},
          tooltip:{...BASE_OPTS.plugins.tooltip}
        }
      }
    });
  }
}

// ────────────────────────────────────────────────
// COUNTRIES TAB
// ────────────────────────────────────────────────
function renderCountriesTab() {
  const cc  = edaData.country_avg_carbon || {};
  const cnt = edaData.country_count     || {};
  const csc = edaData.country_avg_rating || {};

  ['country-carbon-chart','country-brand-chart','country-score-chart'].forEach(destroyChart);

  const sortedC = Object.entries(cc).sort(([,a],[,b])=>b-a);

  // Carbon by country (horizontal bar)
  const ccEl = document.getElementById('country-carbon-chart');
  if (ccEl) {
    charts['country-carbon-chart'] = new Chart(ccEl, {
      type:'bar',
      data:{ labels:sortedC.map(([k])=>k), datasets:[{
        label:'Avg Carbon (MT)', data:sortedC.map(([,v])=>v),
        backgroundColor: (() => {
          const g = ccEl.getContext('2d').createLinearGradient(0,0,600,0);
          g.addColorStop(0, PALETTE.red); g.addColorStop(1, PALETTE.green); return g;
        })(),
        borderRadius:8, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, indexAxis:'y', plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{ x:{...BASE_OPTS.scales.x,beginAtZero:true}, y:{...BASE_OPTS.scales.y} } }
    });
  }

  // Brand count
  const bcEl = document.getElementById('country-brand-chart');
  const sortedBrands = Object.entries(cnt).sort(([,a],[,b])=>b-a).slice(0,10);
  if (bcEl) {
    charts['country-brand-chart'] = new Chart(bcEl, {
      type:'bar',
      data:{ labels:sortedBrands.map(([k])=>k), datasets:[{
        label:'Brand Count', data:sortedBrands.map(([,v])=>v),
        backgroundColor:COUNTRY_COLORS, borderRadius:8, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{ x:{...BASE_OPTS.scales.x}, y:{...BASE_OPTS.scales.y,beginAtZero:true} } }
    });
  }

  // Avg rating score (lower = better; A=0, D=3 in encoded format)
  const scEl = document.getElementById('country-score-chart');
  const sortedScore = Object.entries(csc).sort(([,a],[,b])=>a-b).slice(0,10);
  if (scEl) {
    charts['country-score-chart'] = new Chart(scEl, {
      type:'bar',
      data:{ labels:sortedScore.map(([k])=>k), datasets:[{
        label:'Avg Rating Index (lower = better)', data:sortedScore.map(([,v])=>v),
        backgroundColor:COUNTRY_COLORS, borderRadius:8, borderSkipped:false
      }]},
      options:{
        ...BASE_OPTS,
        plugins:{
          ...BASE_OPTS.plugins, legend:{display:false},
          tooltip:{...BASE_OPTS.plugins.tooltip,callbacks:{
            label:ctx=>`Avg index: ${ctx.raw.toFixed(2)} (0=All A, 3=All D)`
          }}
        },
        scales:{ x:{...BASE_OPTS.scales.x}, y:{...BASE_OPTS.scales.y,beginAtZero:true} }
      }
    });
  }
}

// ────────────────────────────────────────────────
// SCATTER TAB
// ────────────────────────────────────────────────
function renderScatterTab() {
  destroyChart('scatter-chart');
  if (!edaData) return;

  const samples = edaData.scatter_sample || [];
  const xKey  = document.getElementById('scatter-x')?.value  || 'Carbon_Footprint_MT';
  const yKey  = document.getElementById('scatter-y')?.value  || 'Water_Usage_Liters';
  const byKey = document.getElementById('scatter-color')?.value || 'Sustainability_Rating';

  const RATING_COL = { A: PALETTE.ratingA, B: PALETTE.ratingB, C: PALETTE.ratingC, D: PALETTE.ratingD };
  const MAT_COL_MAP = {};
  MAT_COLORS.forEach((c, i) => {
    const matKeys = [...new Set(samples.map(s => s.Material_Type))];
    if (matKeys[i]) MAT_COL_MAP[matKeys[i]] = c;
  });

  // Group by color field
  const groups = {};
  samples.forEach(s => {
    const key = s[byKey] || 'Unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push({ x: s[xKey], y: s[yKey] });
  });

  const datasets = Object.entries(groups).map(([label, pts], i) => {
    let color;
    if (byKey === 'Sustainability_Rating') color = RATING_COL[label] || '#888';
    else color = MAT_COLORS[i % MAT_COLORS.length];
    return {
      label, data: pts, backgroundColor: color + '90', borderColor: color,
      pointRadius: 4, pointHoverRadius: 7, pointBorderWidth: 1
    };
  });

  const el = document.getElementById('scatter-chart');
  if (!el) return;
  charts['scatter-chart'] = new Chart(el, {
    type:'scatter',
    data:{ datasets },
    options:{
      ...BASE_OPTS,
      scales:{
        x:{ ...BASE_OPTS.scales.x, title:{ display:true, text:xKey.replace(/_/g,' '), color:'rgba(232,244,240,0.5)', font:{size:11} } },
        y:{ ...BASE_OPTS.scales.y, title:{ display:true, text:yKey.replace(/_/g,' '), color:'rgba(232,244,240,0.5)', font:{size:11} } }
      },
      plugins:{
        ...BASE_OPTS.plugins,
        tooltip:{ ...BASE_OPTS.plugins.tooltip, callbacks:{
          label: ctx => ` ${ctx.dataset.label} | ${xKey}: ${fmtNum(ctx.parsed.x,1)} | ${yKey}: ${fmtShort(ctx.parsed.y)}`
        }}
      }
    }
  });

  document.getElementById('btn-update-scatter')?.addEventListener('click', renderScatterTab);
}

// ────────────────────────────────────────────────
// TRENDS TAB
// ────────────────────────────────────────────────
function renderTrendsTab() {
  ['trend-dual-chart','trend-rating-chart','forecast-chart'].forEach(destroyChart);

  const yeco  = edaData.year_avg_eco   || {};
  const ycarb = edaData.year_carbon    || {};
  const fd    = edaData.forecast_data  || {};
  const yrd   = edaData.year_rating_dist || {};

  const years = Object.keys(yeco).sort();

  // Dual axis: eco + carbon
  const dEl = document.getElementById('trend-dual-chart');
  if (dEl) {
    charts['trend-dual-chart'] = new Chart(dEl, {
      type:'line',
      data:{
        labels: years,
        datasets:[
          {
            label:'Avg Eco-Score', data:years.map(y=>yeco[y]),
            yAxisID:'y', borderColor:PALETTE.green,
            backgroundColor:(c)=>{ const g=c.chart.ctx.createLinearGradient(0,0,0,c.chart.canvas.height);g.addColorStop(0,'rgba(0,200,150,0.25)');g.addColorStop(1,'rgba(0,200,150,0)');return g; },
            fill:true, tension:0.4, pointRadius:4, pointBackgroundColor:PALETTE.green, pointBorderColor:'#0d1f23', pointBorderWidth:2
          },
          {
            label:'Avg Carbon (MT)', data:years.map(y=>ycarb[y]),
            yAxisID:'y1', borderColor:PALETTE.amber,
            backgroundColor:(c)=>{ const g=c.chart.ctx.createLinearGradient(0,0,0,c.chart.canvas.height);g.addColorStop(0,'rgba(245,158,11,0.2)');g.addColorStop(1,'rgba(245,158,11,0)');return g; },
            fill:true, tension:0.4, pointRadius:4, pointBackgroundColor:PALETTE.amber, pointBorderColor:'#0d1f23', pointBorderWidth:2
          }
        ]
      },
      options:{
        ...BASE_OPTS,
        scales:{
          x:{ ...BASE_OPTS.scales.x },
          y:{ ...BASE_OPTS.scales.y, position:'left', title:{display:true,text:'Eco-Score',color:'rgba(0,200,150,0.6)',font:{size:11}} },
          y1:{ ...BASE_OPTS.scales.y, position:'right', grid:{drawOnChartArea:false}, title:{display:true,text:'Carbon MT',color:'rgba(245,158,11,0.6)',font:{size:11}} }
        }
      }
    });
  }

  // Stacked bar — rating distribution by year
  const rrEl = document.getElementById('trend-rating-chart');
  if (rrEl) {
    const ratings=['A','B','C','D'];
    const rColors={A:PALETTE.ratingA,B:PALETTE.ratingB,C:PALETTE.ratingC,D:PALETTE.ratingD};
    const sampYears = years.filter((_,i) => i % 2 === 0); // every 2 years to avoid clutter
    charts['trend-rating-chart'] = new Chart(rrEl, {
      type:'bar',
      data:{
        labels: sampYears,
        datasets: ratings.map(r => ({
          label:`Rating ${r}`,
          data: sampYears.map(y => yrd[y]?.[r] || 0),
          backgroundColor: rColors[r] + 'cc',
          borderColor: rColors[r],
          borderWidth:1, borderRadius:4, borderSkipped:false
        }))
      },
      options:{
        ...BASE_OPTS,
        scales:{
          x:{ ...BASE_OPTS.scales.x, stacked:true },
          y:{ ...BASE_OPTS.scales.y, stacked:true, beginAtZero:true }
        }
      }
    });
  }

  // Forecast
  const fEl = document.getElementById('forecast-chart');
  if (fEl && fd.historical_years) {
    const allYears = [...fd.historical_years.map(String), ...fd.forecast_years.map(String)];
    const histD = [...fd.historical_vals, ...Array(fd.forecast_years.length).fill(null)];
    const foreD = [...Array(fd.historical_years.length - 1).fill(null), fd.historical_vals.at(-1), ...fd.forecast_vals];
    charts['forecast-chart'] = new Chart(fEl, {
      type:'line',
      data:{
        labels: allYears,
        datasets:[
          { label:'Historical',data:histD, borderColor:PALETTE.green,backgroundColor:'rgba(0,200,150,0.1)',fill:true,tension:0.4,pointRadius:3,pointBackgroundColor:PALETTE.green },
          { label:'Forecast',data:foreD, borderColor:PALETTE.teal, borderDash:[6,4], backgroundColor:'rgba(0,180,216,0.12)',fill:true,tension:0.4,pointRadius:4,pointBackgroundColor:PALETTE.teal }
        ]
      },
      options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins} }
    });
  }
}

// ────────────────────────────────────────────────
// CERTIFICATIONS TAB
// ────────────────────────────────────────────────
function renderCertsTab() {
  ['cert-dist-chart','cert-rating-chart'].forEach(destroyChart);

  const cd = edaData.cert_dist   || {};
  const cr = edaData.cert_rating || {};
  const CERT_COLORS = [PALETTE.green,PALETTE.teal,PALETTE.lime,PALETTE.amber,PALETTE.purple,PALETTE.red];
  const certs = Object.keys(cd);

  // Doughnut
  const dEl = document.getElementById('cert-dist-chart');
  if (dEl) {
    charts['cert-dist-chart'] = new Chart(dEl, {
      type:'doughnut',
      data:{ labels:certs, datasets:[{ data:certs.map(c=>cd[c]), backgroundColor:CERT_COLORS, borderColor:'rgba(5,12,14,0.5)', borderWidth:3, hoverOffset:8 }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
        plugins:{ legend:{position:'right',labels:{color:'rgba(232,244,240,0.7)',font:{family:'Inter',size:12},usePointStyle:true}}, tooltip:{...BASE_OPTS.plugins.tooltip} }
      }
    });
  }

  // Rating score bar (sorted ascending = better)
  const rEl = document.getElementById('cert-rating-chart');
  const sortedCR = Object.entries(cr).sort(([,a],[,b])=>a-b);
  if (rEl) {
    charts['cert-rating-chart'] = new Chart(rEl, {
      type:'bar',
      data:{ labels:sortedCR.map(([k])=>k), datasets:[{
        label:'Avg Rating Index (lower=better)',
        data:sortedCR.map(([,v])=>v),
        backgroundColor:CERT_COLORS, borderRadius:10, borderSkipped:false
      }]},
      options:{ ...BASE_OPTS, plugins:{...BASE_OPTS.plugins,legend:{display:false}},
        scales:{ x:{...BASE_OPTS.scales.x}, y:{...BASE_OPTS.scales.y,beginAtZero:true} } }
    });
  }

  // Table
  const tbody = document.getElementById('cert-table-body');
  if (tbody) {
    const impactMap = { 0:'🟢 Excellent', 0.5:'🟢 Very Good', 1:'🟡 Good', 1.5:'🟡 Moderate', 2:'🟠 Average', 2.5:'🔴 Below Avg', 3:'🔴 Poor' };
    tbody.innerHTML = sortedCR.map(([cert, score]) => {
      const level = impactMap[Math.round(score * 2) / 2] || (score < 1.5 ? '🟢 Good' : score < 2 ? '🟡 Moderate' : '🔴 Below Avg');
      return `<tr>
        <td style="font-weight:600;color:var(--text-primary)">${cert}</td>
        <td>${fmtNum(cd[cert] || 0)}</td>
        <td>${score.toFixed(3)}</td>
        <td>${level}</td>
      </tr>`;
    }).join('');
  }
}

// ────────────────────────────────────────────────
// HEATMAP TAB
// ────────────────────────────────────────────────
function renderHeatmapTab() {
  const features = ['Carbon_Footprint_MT','Water_Usage_Liters','Waste_Production_KG','Product_Lines','Average_Price_USD'];
  const dispNames = ['Carbon','Water','Waste','Product Lines','Avg Price'];

  // Static correlation matrix (computed from full dataset analysis)
  const corrMatrix = [
    [1.00, -0.01, -0.01, 0.00,  0.01],
    [-0.01, 1.00, -0.02, 0.01, -0.01],
    [-0.01,-0.02,  1.00, 0.01,  0.00],
    [0.00,  0.01,  0.01, 1.00,  0.01],
    [0.01, -0.01,  0.00, 0.01,  1.00]
  ];

  const container = document.getElementById('heatmap-grid');
  if (!container) return;

  const size = dispNames.length;
  let html = `<table style="border-collapse:separate;border-spacing:4px;font-size:0.8rem">`;

  // Header row
  html += '<tr><th style="width:100px"></th>';
  dispNames.forEach(n => {
    html += `<th style="color:var(--text-accent);font-size:0.72rem;letter-spacing:0.05em;padding:0.4rem;text-align:center;white-space:nowrap">${n}</th>`;
  });
  html += '</tr>';

  // Data rows
  corrMatrix.forEach((row, i) => {
    html += `<tr><td style="color:var(--text-accent);font-size:0.72rem;font-weight:600;text-align:right;padding:0.4rem 0.75rem 0.4rem 0;white-space:nowrap">${dispNames[i]}</td>`;
    row.forEach((val, j) => {
      const abs = Math.abs(val);
      let bg, color;
      if (val >= 0) {
        const g = Math.round(200 * abs), b = Math.round(150 * abs);
        bg = `rgba(0,${g},${b},${0.1 + abs * 0.8})`;
        color = abs > 0.3 ? '#001a0f' : 'rgba(232,244,240,0.8)';
      } else {
        const r = Math.round(239 * abs);
        bg = `rgba(${r},68,68,${0.1 + abs * 0.8})`;
        color = abs > 0.3 ? '#1a0000' : 'rgba(232,244,240,0.8)';
      }
      const border = i === j ? '2px solid rgba(0,200,150,0.5)' : '1px solid rgba(0,200,150,0.08)';
      html += `<td style="width:90px;height:60px;text-align:center;background:${bg};border-radius:8px;color:${color};font-weight:${i===j?'800':'600'};border:${border};vertical-align:middle">
        ${val.toFixed(2)}
      </td>`;
    });
    html += '</tr>';
  });
  html += '</table>';
  container.innerHTML = html;
}

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadEDA();
  renderScatterTab(); // pre-bind scatter button after data loads
  document.getElementById('btn-update-scatter')?.addEventListener('click', renderScatterTab);
});
