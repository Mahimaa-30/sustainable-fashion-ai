/* ================================================
   SHARED UTILITIES — loaded on every page
   ================================================ */

// ─── Chart.js Global Defaults ───────────────────
const PALETTE = {
  green:    '#00c896',
  teal:     '#00b4d8',
  lime:     '#84cc16',
  amber:    '#f59e0b',
  red:      '#ef4444',
  purple:   '#a855f7',
  pink:     '#ec4899',
  blue:     '#3b82f6',
  ratingA:  '#00f5a0',
  ratingB:  '#84cc16',
  ratingC:  '#f59e0b',
  ratingD:  '#ef4444'
};

const RATING_COLORS = { A: PALETTE.ratingA, B: PALETTE.ratingB, C: PALETTE.ratingC, D: PALETTE.ratingD };

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: 'rgba(232,244,240,0.7)',
        font: { family: 'Inter', size: 12 },
        usePointStyle: true,
        pointStyleWidth: 10
      }
    },
    tooltip: {
      backgroundColor: 'rgba(5,12,14,0.95)',
      borderColor: 'rgba(0,200,150,0.3)',
      borderWidth: 1,
      titleColor: '#e8f4f0',
      bodyColor: 'rgba(232,244,240,0.75)',
      padding: 12,
      cornerRadius: 10,
      titleFont: { family: 'Space Grotesk', size: 13, weight: '700' },
      bodyFont: { family: 'Inter', size: 12 }
    }
  },
  scales: {
    x: {
      ticks: { color: 'rgba(232,244,240,0.5)', font: { family: 'Inter', size: 11 } },
      grid: { color: 'rgba(0,200,150,0.06)' },
      border: { color: 'rgba(0,200,150,0.1)' }
    },
    y: {
      ticks: { color: 'rgba(232,244,240,0.5)', font: { family: 'Inter', size: 11 } },
      grid: { color: 'rgba(0,200,150,0.06)' },
      border: { color: 'rgba(0,200,150,0.1)' }
    }
  }
};

// Deep-merge Chart defaults
function chartOpts(overrides = {}) {
  return deepMerge(JSON.parse(JSON.stringify(CHART_DEFAULTS)), overrides);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// ─── Gradient helpers ────────────────────────────
function makeGradient(ctx, color1, color2, isHorizontal = false) {
  const { width, height } = ctx.canvas;
  const grad = isHorizontal
    ? ctx.createLinearGradient(0, 0, width, 0)
    : ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, color1);
  grad.addColorStop(1, color2);
  return grad;
}

function areaGradient(ctx, color, alpha1 = 0.35, alpha2 = 0.0) {
  const h = ctx.canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const rgb = hexToRgb(color);
  grad.addColorStop(0, `rgba(${rgb},${alpha1})`);
  grad.addColorStop(1, `rgba(${rgb},${alpha2})`);
  return grad;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ─── Number Formatting ───────────────────────────
function fmtNum(n, decimals = 0) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtShort(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return fmtNum(n);
}

// ─── Animated counter ────────────────────────────
function animateCount(el, target, duration = 1200, prefix = '', suffix = '', decimals = 0) {
  const start = 0;
  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    const val = start + (target - start) * ease;
    el.textContent = prefix + fmtNum(val, decimals) + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ─── Rating Class Helpers ────────────────────────
function ratingClass(r) {
  return `rating-${r.toLowerCase()}`;
}

function ratingLabel(r) {
  const map = {
    A: 'Excellent Sustainability',
    B: 'Good Sustainability',
    C: 'Average Sustainability',
    D: 'Poor Sustainability'
  };
  return map[r] || 'Unknown';
}

function ratingColor(r) {
  return RATING_COLORS[r] || '#888';
}

// ─── Active nav highlight ────────────────────────
(function () {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.remove('active');
    if (a.getAttribute('href') === path) a.classList.add('active');
  });
})();

// ─── Intersection Observer for fade-in ──────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.animate-fade-up').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  io.observe(el);
});
