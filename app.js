/* ═══════════════════════════════════════════════════════
   ResearchAI — Frontend Application
   app.js
═══════════════════════════════════════════════════════ */

const API = '';   // same origin (Flask serves both)
let currentPage  = 1;
let searchTimer  = null;
let currentPaperId = null;
let selectedRating = 0;
let charts = {};

// ─── Section routing ─────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === name);
  });
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'papers') { loadDomains(); loadPapers(); }
  if (name === 'stats')  loadStats();
  if (name === 'home')   loadHomeData();
}

// ─── Auth state ───────────────────────────────────────
async function checkAuth() {
  try {
    const res  = await fetch(`${API}/api/me`);
    const data = await res.json();
    if (data.user_id) {
      document.getElementById('navAuth').classList.add('hidden');
      document.getElementById('navUser').classList.remove('hidden');
      document.getElementById('userBadge').textContent = '@' + data.username;
    } else {
      document.getElementById('navAuth').classList.remove('hidden');
      document.getElementById('navUser').classList.add('hidden');
    }
  } catch(e) {}
}

async function doLogin(e) {
  e.preventDefault();
  const email = document.getElementById('l-email').value;
  const pw    = document.getElementById('l-pw').value;
  const res   = await fetch(`${API}/api/login`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ email, password: pw })
  });
  const data = await res.json();
  const msg  = document.getElementById('loginMsg');
  if (res.ok) {
    msg.className = 'form-msg success';
    msg.textContent = 'Logged in as ' + data.username;
    msg.classList.remove('hidden');
    setTimeout(() => { closeModal('loginModal'); checkAuth(); showToast('Welcome back, ' + data.username + '!'); }, 800);
  } else {
    msg.className = 'form-msg error';
    msg.textContent = data.error;
    msg.classList.remove('hidden');
  }
}

async function doRegister(e) {
  e.preventDefault();
  const username = document.getElementById('r-username').value;
  const email    = document.getElementById('r-email').value;
  const pw       = document.getElementById('r-pw').value;
  const res  = await fetch(`${API}/api/register`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ username, email, password: pw })
  });
  const data = await res.json();
  const msg  = document.getElementById('regMsg');
  if (res.ok) {
    msg.className = 'form-msg success';
    msg.textContent = 'Account created!';
    msg.classList.remove('hidden');
    setTimeout(() => { closeModal('registerModal'); checkAuth(); showToast('Welcome, ' + data.username + '!'); }, 800);
  } else {
    msg.className = 'form-msg error';
    msg.textContent = data.error;
    msg.classList.remove('hidden');
  }
}

async function logout() {
  await fetch(`${API}/api/logout`, { method: 'POST' });
  checkAuth();
  showToast('Logged out');
}

// ─── Modals ───────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden')); });

// ─── Toast ────────────────────────────────────────────
function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

// ─── Home data ────────────────────────────────────────
async function loadHomeData() {
  try {
    const [statsRes, papersRes] = await Promise.all([
      fetch(`${API}/api/stats`),
      fetch(`${API}/api/papers?limit=4&page=1`)
    ]);
    const stats  = await statsRes.json();
    const papers = await papersRes.json();

    animateCounter('hsPapers',    stats.total_papers);
    animateCounter('hsSummaries', stats.total_summaries);
    document.getElementById('hsScore').textContent = stats.avg_bert?.toFixed(2) ?? '—';
    animateCounter('hsUsers',    stats.total_users);

    const grid = document.getElementById('recentPapers');
    grid.innerHTML = '';
    (papers.papers || []).forEach(p => grid.insertAdjacentHTML('beforeend', paperCardHTML(p)));
  } catch(e) {
    document.getElementById('recentPapers').innerHTML = '<p class="empty-state">Could not load papers. Is the server running?</p>';
  }
}

function animateCounter(id, target) {
  const el  = document.getElementById(id);
  const dur = 1200;
  const step = Math.ceil(target / (dur / 16));
  let cur = 0;
  const tick = () => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur < target) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─── Papers ───────────────────────────────────────────
async function loadDomains() {
  try {
    const res  = await fetch(`${API}/api/domains`);
    const data = await res.json();
    const sel  = document.getElementById('filterDomain');
    // keep first option
    while (sel.options.length > 1) sel.remove(1);
    data.forEach(d => sel.insertAdjacentHTML('beforeend', `<option>${d}</option>`));
  } catch(e) {}
}

async function loadPapers(page = 1) {
  currentPage = page;
  const q      = document.getElementById('searchInput')?.value  || '';
  const domain = document.getElementById('filterDomain')?.value || '';
  const year   = document.getElementById('filterYear')?.value   || '';
  const grid   = document.getElementById('papersGrid');
  grid.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const url = `${API}/api/papers?page=${page}&limit=9&q=${encodeURIComponent(q)}&domain=${encodeURIComponent(domain)}&year=${encodeURIComponent(year)}`;
    const res  = await fetch(url);
    const data = await res.json();
    grid.innerHTML = '';
    if (!data.papers?.length) {
      grid.innerHTML = '<div class="empty-state"><h3>No papers found</h3><p>Try adjusting your filters</p></div>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }
    data.papers.forEach(p => grid.insertAdjacentHTML('beforeend', paperCardHTML(p)));
    renderPagination(data.pages, page);
  } catch(e) {
    grid.innerHTML = '<div class="empty-state"><h3>Connection Error</h3><p>Could not reach the API server.</p></div>';
  }
}

function paperCardHTML(p) {
  const stars = ratingStars(p.avg_rating);
  const rouge = p.rouge_score ? `<span class="score-badge">ROUGE ${parseFloat(p.rouge_score).toFixed(2)}</span>` : '';
  const bert  = p.bert_score  ? `<span class="score-badge" style="background:rgba(129,140,248,.08);color:var(--accent2)">BERT ${parseFloat(p.bert_score).toFixed(2)}</span>` : '';
  return `
  <div class="paper-card" onclick="openPaper(${p.id})">
    <div class="pc-top">
      <span class="pc-domain">${esc(p.domain||'General')}</span>
      <span class="pc-year">${p.year||''}</span>
    </div>
    <div class="pc-title">${esc(p.title)}</div>
    <div class="pc-authors">${esc(p.authors||'')}</div>
    <div class="pc-summary">${esc(p.summary_preview || p.abstract_preview || '')}</div>
    <div class="pc-footer">
      <div class="pc-scores">${rouge}${bert}</div>
      <div class="pc-rating">${stars}</div>
    </div>
  </div>`;
}

function ratingStars(avg) {
  if (!avg) return '';
  const n = Math.round(avg);
  return '★'.repeat(n) + '<span class="star-empty">' + '★'.repeat(5-n) + '</span>';
}

function renderPagination(pages, cur) {
  const cont = document.getElementById('pagination');
  if (pages <= 1) { cont.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn${i===cur?' active':''}" onclick="loadPapers(${i})">${i}</button>`;
  }
  cont.innerHTML = html;
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadPapers(1), 350);
}

// ─── Paper Detail ─────────────────────────────────────
async function openPaper(id) {
  currentPaperId = id;
  selectedRating = 0;
  openModal('paperModal');
  document.getElementById('paperModalContent').innerHTML = '<div class="loading-spinner"></div>';
  try {
    const res  = await fetch(`${API}/api/papers/${id}`);
    const p    = await res.json();
    if (!res.ok) throw new Error(p.error);
    document.getElementById('paperModalContent').innerHTML = paperDetailHTML(p);
    // attach star interaction
    document.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => highlightStars(+btn.dataset.v));
      btn.addEventListener('mouseleave', () => highlightStars(selectedRating));
      btn.addEventListener('click', () => { selectedRating = +btn.dataset.v; highlightStars(selectedRating); });
    });
  } catch(e) {
    document.getElementById('paperModalContent').innerHTML = `<p style="color:var(--accent3)">Error: ${e.message}</p>`;
  }
}

function paperDetailHTML(p) {
  const kws = (p.keywords||[]).map(k => `<span class="kw-tag">${esc(k.keyword)}</span>`).join('');
  const fbs = (p.feedback||[]).map(fb => `
    <div class="fb-item">
      <div class="fb-header">
        <span>${esc(fb.username||'Anonymous')}</span>
        <span>${'★'.repeat(fb.rating)} · ${fb.submitted_at?.slice(0,10)||''}</span>
      </div>
      <div class="fb-text">${esc(fb.comment||'')}</div>
    </div>`).join('') || '<p style="color:var(--muted);font-size:13px">No feedback yet. Be the first!</p>';

  const srcLink = p.source_url ? `<a href="${p.source_url}" target="_blank" style="color:var(--accent2);font-size:12px">↗ Source</a>` : '';

  return `
  <span class="pc-domain pm-domain">${esc(p.domain||'')}</span>
  <div class="pm-title">${esc(p.title)}</div>
  <div class="pm-authors">${esc(p.authors||'')}</div>
  <div class="pm-meta">
    <span>${p.year||''}</span>
    <span>${esc(p.source_type||'')}</span>
    <span>${esc(p.model_used||'')}</span>
    ${srcLink}
  </div>
  <div class="pm-scores">
    ${p.rouge_score ? `<span class="score-pill rouge">ROUGE ${parseFloat(p.rouge_score).toFixed(3)}</span>` : ''}
    ${p.bert_score  ? `<span class="score-pill bert">BERT ${parseFloat(p.bert_score).toFixed(3)}</span>`  : ''}
  </div>
  <div class="pm-section">
    <h4>Summary</h4>
    <p>${esc(p.summary_text||'')}</p>
  </div>
  ${p.key_findings ? `<div class="pm-section"><h4>Key Findings</h4><p>${esc(p.key_findings)}</p></div>` : ''}
  ${p.methodology  ? `<div class="pm-section"><h4>Methodology</h4><p>${esc(p.methodology)}</p></div>`  : ''}
  ${p.conclusion   ? `<div class="pm-section"><h4>Conclusion</h4><p>${esc(p.conclusion)}</p></div>`    : ''}
  ${kws ? `<div class="pm-section"><h4>Keywords</h4><div class="pm-keywords">${kws}</div></div>` : ''}
  <hr class="pm-divider"/>
  <div class="pm-feedback-form">
    <h4>Rate this summary</h4>
    <div class="star-rating">
      ${[1,2,3,4,5].map(v => `<button class="star-btn" data-v="${v}">★</button>`).join('')}
    </div>
    <textarea id="fb-comment" class="form-input" rows="2" placeholder="Optional comment…"></textarea>
    <button class="btn btn-primary sm" style="margin-top:8px" onclick="submitFeedback(${p.summary_id})">Submit Feedback</button>
  </div>
  <div class="pm-feedback-list">
    <h4 style="font-size:13px;margin-bottom:10px;color:var(--muted)">Reviews (${p.feedback?.length||0})</h4>
    ${fbs}
  </div>`;
}

function highlightStars(n) {
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.v <= n);
  });
}

async function submitFeedback(summaryId) {
  if (!selectedRating) { showToast('Please select a rating first'); return; }
  const comment = document.getElementById('fb-comment').value;
  const res = await fetch(`${API}/api/feedback`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ summary_id: summaryId, rating: selectedRating, comment })
  });
  if (res.ok) {
    showToast('Feedback submitted! Thank you.');
    openPaper(currentPaperId);
  } else {
    showToast('Could not submit feedback');
  }
}

// ─── Submit Paper ─────────────────────────────────────
async function submitPaper(e) {
  e.preventDefault();
  const btnText   = document.getElementById('submitBtnText');
  const btnLoader = document.getElementById('submitBtnLoader');
  const msgEl     = document.getElementById('submitMsg');
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  msgEl.classList.add('hidden');

  const body = {
    title:      document.getElementById('f-title').value,
    authors:    document.getElementById('f-authors').value,
    abstract:   document.getElementById('f-abstract').value,
    domain:     document.getElementById('f-domain').value,
    year:       document.getElementById('f-year').value,
    source_url: document.getElementById('f-url').value,
  };
  try {
    const res  = await fetch(`${API}/api/papers`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      msgEl.className = 'form-msg success';
      msgEl.textContent = 'Paper submitted and summarized! ID: ' + data.paper_id;
      msgEl.classList.remove('hidden');
      document.getElementById('submitForm').reset();
      showToast('Paper summarized successfully!');
    } else if (res.status === 401) {
      msgEl.className = 'form-msg error';
      msgEl.textContent = 'Please login to submit papers.';
      msgEl.classList.remove('hidden');
      openModal('loginModal');
    } else {
      throw new Error(data.error || 'Submission failed');
    }
  } catch(err) {
    msgEl.className = 'form-msg error';
    msgEl.textContent = err.message;
    msgEl.classList.remove('hidden');
  } finally {
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
}

// ─── Stats & Charts ───────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${API}/api/stats`);
    const data = await res.json();
    // KPIs
    document.getElementById('statsKpis').innerHTML = `
      <div class="kpi-card"><div class="kpi-num">${data.total_papers}</div><div class="kpi-label">Total Papers</div></div>
      <div class="kpi-card"><div class="kpi-num">${data.total_summaries}</div><div class="kpi-label">Summaries</div></div>
      <div class="kpi-card"><div class="kpi-num">${data.total_users}</div><div class="kpi-label">Users</div></div>
      <div class="kpi-card"><div class="kpi-num">${data.avg_rouge?.toFixed(3)}</div><div class="kpi-label">Avg ROUGE</div></div>
      <div class="kpi-card"><div class="kpi-num">${data.avg_bert?.toFixed(3)}</div><div class="kpi-label">Avg BERT</div></div>`;

    const palette = ['#6ee7b7','#818cf8','#f472b6','#fbbf24','#34d399','#a78bfa'];

    // Domain chart
    destroyChart('domainChart');
    charts.domain = new Chart(document.getElementById('domainChart'), {
      type: 'doughnut',
      data: {
        labels: data.domains.map(d => d.domain),
        datasets: [{ data: data.domains.map(d => d.cnt), backgroundColor: palette, borderWidth: 0 }]
      },
      options: { plugins: { legend: { labels: { color: '#7a7f92', font: { family: "'DM Sans'" } } } } }
    });

    // Model chart
    destroyChart('modelChart');
    charts.model = new Chart(document.getElementById('modelChart'), {
      type: 'bar',
      data: {
        labels: data.models.map(m => m.model_used||'Unknown'),
        datasets: [{ data: data.models.map(m => m.cnt), backgroundColor: palette, borderRadius: 6, borderWidth: 0 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#7a7f92' }, grid: { color: 'rgba(255,255,255,.04)' } },
          y: { ticks: { color: '#7a7f92', stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' } }
        }
      }
    });

    // Yearly chart
    destroyChart('yearChart');
    charts.year = new Chart(document.getElementById('yearChart'), {
      type: 'line',
      data: {
        labels: data.yearly.map(y => y.year),
        datasets: [{
          label: 'Papers', data: data.yearly.map(y => y.cnt),
          borderColor: '#6ee7b7', backgroundColor: 'rgba(110,231,183,.08)',
          fill: true, tension: 0.4, pointBackgroundColor: '#6ee7b7', pointRadius: 5
        }]
      },
      options: {
        plugins: { legend: { labels: { color: '#7a7f92' } } },
        scales: {
          x: { ticks: { color: '#7a7f92' }, grid: { color: 'rgba(255,255,255,.04)' } },
          y: { ticks: { color: '#7a7f92', stepSize: 1 }, grid: { color: 'rgba(255,255,255,.04)' } }
        }
      }
    });
  } catch(e) {
    document.getElementById('statsKpis').innerHTML = '<p style="color:var(--accent3)">Could not load stats. Is the Flask server running?</p>';
  }
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ─── Utility ──────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ─────────────────────────────────────────────
(async function init() {
  await checkAuth();
  loadHomeData();
})();
