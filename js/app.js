/* Quadre de comandament de l'atur registrat al Maresme.
   Dades: data/*.js (generades per R/03_prepara_dashboard.R a partir dels CSV). Es carreguen com a <script>
   perque la pagina funcioni oberta amb doble clic (file://), sense servidor. */
'use strict';

const COMARCA = '08MAR';
const MESOS_CA = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const MESOS_CURT = ['gen.','febr.','març','abr.','maig','juny','jul.','ag.','set.','oct.','nov.','des.'];
const REFRESC_MS = 5 * 60 * 1000;

const S = {
  meta: null, nucli: null, mesos: [], i: 0, terr: COMARCA, tab: 'resum',
  desg: {}, geo: null, charts: {}, cmp: [COMARCA, '08121', '08035', '08284'],
  ev: { ind: 'atur', sex: 'T', mm: false }, mapInd: 'vint', pf: { id: 'edat3', sex: 'T', mode: 'v' },
  play: null, rank: { key: 'atur', asc: false }, cmpBase: null, tipOn: false
};

/* ---------- utilitats ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const nf = new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 0 });
const fmtInt = v => v == null || isNaN(v) ? '—' : nf.format(Math.round(v));
const fmtDec = (v, d = 1) => v == null || isNaN(v) ? '—' : v.toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (v, d = 1) => v == null || isNaN(v) ? '—' : fmtDec(v, d) + ' %';
const fmtSgn = (v, d = 1) => v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmtDec(Math.abs(v), d);
const fmtSgnInt = v => v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + nf.format(Math.abs(Math.round(v)));
const fmtMes = m => `${MESOS_CA[m % 100 - 1]} ${Math.floor(m / 100)}`;
const fmtMesCurt = m => `${MESOS_CURT[m % 100 - 1]} ${Math.floor(m / 100)}`;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const coll = new Intl.Collator('ca');
const loadData = name => new Promise((ok, ko) => {      // carrega data/<name>.js i en retorna window.ATUR[name]
  const sc = document.createElement('script');
  sc.src = `data/${name}.js?cb=${Date.now()}`;
  sc.onload = () => { const v = window.ATUR && window.ATUR[name]; sc.remove(); if (window.ATUR) delete window.ATUR[name]; v ? ok(v) : ko(new Error(`data/${name}.js buit`)); };
  sc.onerror = () => { sc.remove(); ko(new Error(`No es pot carregar data/${name}.js`)); };
  document.head.appendChild(sc);
});
const nom = t => (S.meta.territoris.find(x => x.codi === t) || {}).nom || t;
const PAL = () => ['#0b6e8a', '#e08a1e', '#7a5cc2', '#2a9d6f', '#d1495b', '#5b8def', '#8d6e63', '#00a6a6', '#c2185b', '#6d8b00'];

/* ---------- accés a les dades ---------- */
const sexSuf = { T: '', H: 'H', D: 'D' };
function V(t, key, i = S.i) { const s = S.nucli.s[t]; return s ? s[key][i] : null; }
function pct(a, b) { return a == null || b == null || b === 0 ? null : (a / b - 1) * 100; }
function varAbs(t, key, i, lag) { const a = V(t, key, i), b = i - lag >= 0 ? V(t, key, i - lag) : null; return a == null || b == null ? null : a - b; }
function varPct(t, key, i, lag) { return i - lag < 0 ? null : pct(V(t, key, i), V(t, key, i - lag)); }
function arr(t, key) { return S.nucli.s[t][key]; }
const IND = {
  atur: { label: 'Atur registrat', key: 'atur', fmt: fmtInt, sex: true, unit: 'persones' },
  taxa: { label: "Taxa d'atur registral", key: 'taxa', fmt: v => fmtPct(v, 2), sex: true, unit: '%' },
  afi: { label: 'Afiliats (residents)', key: 'afi', fmt: fmtInt, sex: true, unit: 'persones' },
  dno: { label: 'Demandants no ocupats', key: 'dno', fmt: fmtInt, sex: false, unit: 'persones' },
  dem: { label: "Demandants d'ocupació", key: 'dem', fmt: fmtInt, sex: false, unit: 'persones' }
};
const keyOf = (ind, sex) => IND[ind].sex ? IND[ind].key + sexSuf[sex] : IND[ind].key;
const terrOrder = () => S.meta.territoris.map(t => t.codi);
const municipis = () => S.meta.territoris.filter(t => t.codi !== COMARCA).map(t => t.codi);

/* ---------- gràfics ECharts ---------- */
function chart(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  let c = S.charts[id];
  if (c && c.getDom() !== el) { c.dispose(); c = null; }
  if (!c) { c = echarts.init(el, null, { renderer: 'canvas' }); S.charts[id] = c; }
  return c;
}
function baseOpt(extra = {}) {
  const ink = css('--ink'), mut = css('--muted'), line = css('--line');
  return Object.assign({
    color: PAL(), animationDuration: 500,
    textStyle: { fontFamily: css('--font'), color: ink },
    grid: { left: 54, right: 54, top: 36, bottom: 56, containLabel: false },
    legend: { top: 0, textStyle: { color: mut }, icon: 'roundRect', itemWidth: 14, itemHeight: 4 },
    tooltip: { trigger: 'axis', backgroundColor: css('--surface'), borderColor: line, textStyle: { color: ink }, confine: true,
      axisPointer: { type: 'line', lineStyle: { color: mut } } },
    xAxis: { axisLine: { lineStyle: { color: line } }, axisLabel: { color: mut }, axisTick: { show: false } },
    yAxis: { axisLabel: { color: mut }, splitLine: { lineStyle: { color: line } } }
  }, extra);
}
function monthAxis(mesos) {
  return {
    type: 'category', data: mesos.map(fmtMesCurt), boundaryGap: false,
    axisLabel: { color: css('--muted'), interval: i => mesos[i] % 100 === 1 && Math.floor(mesos[i] / 100) % 2 === 1 ? true : false, formatter: (v, i) => String(mesos[i] ? Math.floor(mesos[i] / 100) : v) },
    axisLine: { lineStyle: { color: css('--line') } }, axisTick: { show: false }
  };
}
function resizeAll() { Object.values(S.charts).forEach(c => { try { c.resize(); } catch (e) {} }); drawMap(); }
window.addEventListener('resize', () => { clearTimeout(resizeAll.t); resizeAll.t = setTimeout(resizeAll, 120); });

/* ---------- taules ordenables ---------- */
function table(el, cols, rows, opt = {}) {
  const st = opt.state || { key: cols[0].k, asc: true };
  const sorted = [...rows].sort((a, b) => {
    const x = a[st.key], y = b[st.key];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const r = typeof x === 'string' ? coll.compare(x, y) : x - y;
    return st.asc ? r : -r;
  });
  const mx = {}; cols.filter(c => c.bar).forEach(c => mx[c.k] = Math.max(...rows.map(r => Math.abs(r[c.k] || 0)), 1));
  el.innerHTML = '<thead><tr>' + cols.map(c => `<th data-k="${c.k}" class="${st.key === c.k ? 'sorted' + (st.asc ? ' asc' : '') : ''}">${esc(c.label)}</th>`).join('') + '</tr></thead><tbody>' +
    sorted.map(r => `<tr data-id="${esc(r.id ?? '')}" class="${opt.sel && opt.sel(r) ? 'sel' : ''}">` + cols.map(c => {
      const v = r[c.k]; let s = c.fmt ? c.fmt(v, r) : esc(v ?? '—');
      if (c.bar && v != null) s = `<span class="bar" style="width:${Math.max(2, 46 * Math.abs(v) / mx[c.k])}px"></span>` + s;
      return `<td class="${c.cls ? c.cls(v, r) : ''}">${s}</td>`; }).join('') + '</tr>').join('') + '</tbody>';
  $$('th', el).forEach(th => th.onclick = () => { const k = th.dataset.k; st.asc = st.key === k ? !st.asc : (typeof rows[0]?.[k] === 'string'); st.key = k; table(el, cols, rows, opt); });
  if (opt.onRow) $$('tbody tr', el).forEach(tr => tr.onclick = () => opt.onRow(tr.dataset.id));
  return st;
}
const clsVar = v => v == null ? '' : v > 0 ? 'up-bad' : v < 0 ? 'dn-good' : 'flat';

/* ---------- càrrega de dades ---------- */
async function carregaNucli() {
  S.meta = await loadData('meta');
  S.nucli = await loadData('nucli');
  S.mesos = S.nucli.mesos;
}
async function getDesg(id) {
  if (!S.desg[id]) S.desg[id] = await loadData(`desg_${id}`);
  return S.desg[id];
}
async function init() {
  let th = null; try { th = localStorage.getItem('tema'); } catch (e) {}
  if (th) document.documentElement.dataset.theme = th;
  try { await carregaNucli(); } catch (e) {
    $('main').innerHTML = `<div class="empty"><h3>No s'han pogut carregar les dades</h3><p>Comprova que existeix la carpeta <code>dashboard/data</code> al costat d'aquest fitxer. Si no, executa <code>Rscript R/03_prepara_dashboard.R</code> (o l'script de descàrrega) per generar-la.</p><p class="note">${esc(e.message)}</p></div>`;
    return;
  }
  S.i = S.mesos.length - 1;
  const rg = $('#mesRange'); rg.max = S.mesos.length - 1; rg.value = S.i;
  rg.oninput = () => { S.i = +rg.value; renderAll(); };
  $('#selTerr').innerHTML = S.meta.territoris.map(t => `<option value="${t.codi}">${esc(t.nom)}</option>`).join('');
  $('#selTerr').onchange = e => { S.terr = e.target.value; renderAll(); };
  $('#btnTheme').onclick = () => { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('tema', d.dataset.theme); } catch (e) {} Object.values(S.charts).forEach(c => c.dispose()); S.charts = {}; renderAll(); };
  $$('#nav button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  setupControls();
  // carrega en segon pla els desglossaments dels indicadors del resum
  await Promise.all(['edat3', 'ambit_nac', 'inscripcio'].map(id => getDesg(id).catch(() => null)));
  try { S.geo = await loadData('municipis'); } catch (e) { S.geo = null; }
  renderAll();
  setInterval(comprovaActualitzacio, REFRESC_MS);
}
function setTab(t) {
  S.tab = t;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('section.tab').forEach(s => s.classList.toggle('on', s.id === 'tab-' + t));
  if (t !== 'mapa') stopPlay();
  renderTab();
  window.scrollTo({ top: 0 });
}
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 4500); }
async function comprovaActualitzacio() {
  try {
    const m = await loadData('meta');
    $('#statusTxt').textContent = 'Comprovat ' + new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
    if (m.signatura !== S.meta.signatura) {
      const ultim = S.i === S.mesos.length - 1;
      await carregaNucli(); S.desg = {};
      await Promise.all(['edat3', 'ambit_nac', 'inscripcio'].map(id => getDesg(id).catch(() => null)));
      if (ultim) S.i = S.mesos.length - 1; else S.i = Math.min(S.i, S.mesos.length - 1);
      const rg = $('#mesRange'); rg.max = S.mesos.length - 1; rg.value = S.i;
      renderAll(); toast('Dades actualitzades: ' + fmtMes(S.meta.ultim_mes));
    }
  } catch (e) { $('#statusTxt').textContent = "No s'han pogut comprovar dades noves"; }
}

/* ---------- render ---------- */
function renderAll() {
  const m = S.mesos[S.i];
  $('#mesLabel').textContent = fmtMes(m);
  $('#mesRange').value = S.i;
  $('#selTerr').value = S.terr;
  $('#hdrData').textContent = `última dada: ${fmtMes(S.meta.ultim_mes)}`;
  if ($('#statusTxt').textContent === '—') $('#statusTxt').textContent = 'Actualitzat ' + S.meta.generat.slice(0, 16).replace('T', ' ');
  renderTab();
}
function renderTab() {
  ({ resum: renderResum, mapa: renderMapa, evolucio: renderEvolucio, comparativa: renderComparativa, perfil: renderPerfil, dades: renderDades }[S.tab])();
}

/* ======================= RESUM ======================= */
function desgVal(id, t, i, filtre, sx = 'T') {          // suma de categories que compleixen 'filtre(idx, cat)'
  const d = S.desg[id]; if (!d || !d.v[t]) return null;
  let s = 0, ok = false;
  d.cats.forEach((c, ci) => { if (!filtre(ci, c)) return;
    const h = d.v[t][0][ci][i], f = d.v[t][1][ci][i];
    const v = sx === 'H' ? h : sx === 'D' ? f : (h == null || f == null ? null : h + f);
    if (v != null) { s += v; ok = true; } });
  return ok ? s : null;
}
function kpiCard(lab, val, unit, d1, d2, spark, fmtv) {
  return `<div class="card kpi"><div class="lab">${lab}</div><div class="val">${val}<small>${unit || ''}</small></div><div class="d">${d1}${d2}</div>${spark ? `<div class="spark" id="${spark}"></div>` : ''}</div>`;
}
function dlt(lbl, abs, p, fmtA, goodDown = true) {
  const cls = abs == null || abs === 0 || goodDown === null ? 'flat' : (abs > 0) === goodDown ? 'up-bad' : 'dn-good';
  return `<span class="${cls}">${lbl} <b>${fmtA(abs)}${p != null ? ' (' + fmtSgn(p) + ' %)' : ''}</b></span>`;
}
function renderResum() {
  const t = S.terr, i = S.i;
  const a = V(t, 'atur', i);
  const am = varAbs(t, 'atur', i, 1), pm = varPct(t, 'atur', i, 1), ai = varAbs(t, 'atur', i, 12), pi = varPct(t, 'atur', i, 12);
  const tx = V(t, 'taxa', i), txi = varAbs(t, 'taxa', i, 12);
  const af = V(t, 'afi', i), afi = varPct(t, 'afi', i, 12);
  const pd = a ? V(t, 'aturD', i) / a * 100 : null; const pdi = (() => { const a0 = V(t, 'atur', i - 12), d0 = V(t, 'aturD', i - 12); return i >= 12 && a0 ? pd - d0 / a0 * 100 : null; })();
  const joves = desgVal('edat3', t, i, ci => ci === 0), jov0 = i >= 12 ? desgVal('edat3', t, i - 12, ci => ci === 0) : null;
  const ldur = desgVal('inscripcio', t, i, ci => ci >= 4), ldur0 = i >= 12 ? desgVal('inscripcio', t, i - 12, ci => ci >= 4) : null;
  const ext = desgVal('ambit_nac', t, i, (ci, c) => /^No comunitari/.test(c.l)), ext0 = i >= 12 ? desgVal('ambit_nac', t, i - 12, (ci, c) => /^No comunitari/.test(c.l)) : null;
  const sh = (v, tot) => v != null && tot ? v / tot * 100 : null;
  $('#kpis').innerHTML = [
    kpiCard('Atur registrat', fmtInt(a), 'persones', dlt('Mes', am, pm, fmtSgnInt), dlt('Any', ai, pi, fmtSgnInt), 'spA'),
    kpiCard("Taxa d'atur registral", tx == null ? '—' : fmtDec(tx, 2), tx == null ? '' : '%', dlt('Any', txi, null, v => v == null ? '—' : fmtSgn(v, 2) + ' pp'), '', 'spT'),
    kpiCard('Afiliats (residents)', fmtInt(af), 'persones', dlt('Any', afi == null ? null : af - af / (1 + afi / 100), afi, fmtSgnInt, false), '', 'spF'),
    kpiCard("Dones en l'atur", fmtDec(pd, 1), '%', dlt('Any', pdi, null, v => v == null ? '—' : fmtSgn(v, 1) + ' pp', null), '', null),
    kpiCard('Menors de 25 anys', fmtInt(joves), 'persones', `<span>Pes <b>${fmtPct(sh(joves, a))}</b></span>`, dlt('Any', jov0 == null || joves == null ? null : joves - jov0, pct(joves, jov0), fmtSgnInt), null),
    kpiCard('Llarga durada (+12 mesos)', fmtInt(ldur), 'persones', `<span>Pes <b>${fmtPct(sh(ldur, a))}</b></span>`, dlt('Any', ldur0 == null || ldur == null ? null : ldur - ldur0, pct(ldur, ldur0), fmtSgnInt), null),
    kpiCard("Demandants d'ocupació", fmtInt(V(t, 'dem', i)), 'persones', `<span>No ocupats <b>${fmtInt(V(t, 'dno', i))}</b></span>`, dlt('Any', varAbs(t, 'dem', i, 12), varPct(t, 'dem', i, 12), fmtSgnInt), null),
    kpiCard('Nacionalitat no comunitària', fmtInt(ext), 'persones', `<span>Pes <b>${fmtPct(sh(ext, a))}</b></span>`, dlt('Any', ext0 == null || ext == null ? null : ext - ext0, pct(ext, ext0), fmtSgnInt), null)
  ].join('');
  const sp = (id, key, col) => { const c = chart(id); if (!c) return; const from = Math.max(0, i - 59); const d = arr(t, key).slice(from, i + 1);
    c.setOption({ grid: { left: 6, right: 6, top: 4, bottom: 2 }, xAxis: { type: 'category', show: false, boundaryGap: false, data: d.map((_, k) => k) }, yAxis: { type: 'value', show: false, scale: true },
      series: [{ type: 'line', data: d, showSymbol: false, smooth: true, lineStyle: { width: 2, color: col }, areaStyle: { color: col, opacity: .12 } }], tooltip: { show: false }, animation: false }, true); };
  sp('spA', 'atur', css('--accent')); sp('spT', 'taxa', css('--accent2')); sp('spF', 'afi', css('--good'));

  $('#resumTitol').textContent = `Evolució de l'atur registrat · ${nom(t)}`;
  const mesos = S.mesos.slice(0, i + 1);
  chart('chResum1').setOption(baseOpt({
    xAxis: monthAxis(mesos), yAxis: [{ type: 'value', axisLabel: { color: css('--muted'), formatter: fmtInt }, splitLine: { lineStyle: { color: css('--line') } } },
      { type: 'value', axisLabel: { color: css('--muted'), formatter: v => v + ' %' }, splitLine: { show: false }, scale: true }],
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: 'transparent', start: 0, end: 100 }],
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: v => fmtDec(v, 2) }),
    series: [{ name: 'Atur registrat', type: 'line', data: arr(t, 'atur').slice(0, i + 1), showSymbol: false, lineStyle: { width: 2.4 }, areaStyle: { opacity: .08 }, tooltip: { valueFormatter: fmtInt } },
      { name: "Taxa d'atur (%)", type: 'line', yAxisIndex: 1, data: arr(t, 'taxa').slice(0, i + 1), showSymbol: false, lineStyle: { width: 1.8, type: 'dashed', color: css('--accent2') }, itemStyle: { color: css('--accent2') }, tooltip: { valueFormatter: v => fmtDec(v, 2) + ' %' } }]
  }), true);
  const m72 = mesos.slice(-72), o72 = mesos.length - m72.length;
  const vi = m72.map((m, k) => varPct(t, 'atur', k + o72, 12));
  chart('chResum2').setOption(baseOpt({
    grid: { left: 46, right: 14, top: 18, bottom: 34 }, legend: { show: false },
    xAxis: Object.assign(monthAxis(m72), { boundaryGap: true }), yAxis: { type: 'value', axisLabel: { color: css('--muted'), formatter: v => v + ' %' }, splitLine: { lineStyle: { color: css('--line') } } },
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: v => fmtSgn(v) + ' %' }),
    series: [{ type: 'bar', data: vi.map(v => v == null ? null : { value: v, itemStyle: { color: v > 0 ? css('--bad') : css('--good') } }), barCategoryGap: '20%' }]
  }), true);

  // rànquing
  $('#rankSub').textContent = fmtMes(S.mesos[i]);
  const rows = terrOrder().map(c => ({ id: c, n: nom(c), atur: V(c, 'atur', i), vm: varPct(c, 'atur', i, 1), vi: varPct(c, 'atur', i, 12), vai: varAbs(c, 'atur', i, 12),
    taxa: V(c, 'taxa', i), pd: V(c, 'atur', i) ? V(c, 'aturD', i) / V(c, 'atur', i) * 100 : null, pes: V(COMARCA, 'atur', i) ? V(c, 'atur', i) / V(COMARCA, 'atur', i) * 100 : null }));
  const q = ($('#rankSearch').value || '').toLowerCase();
  const filt = rows.filter(r => !q || r.n.toLowerCase().includes(q));
  S.rank = table($('#tblRank'), [
    { k: 'n', label: 'Territori' }, { k: 'atur', label: 'Atur', fmt: fmtInt, bar: true },
    { k: 'vm', label: 'Var. mensual', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar },
    { k: 'vi', label: 'Var. interanual', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar },
    { k: 'vai', label: 'Var. interanual (pers.)', fmt: fmtSgnInt, cls: clsVar },
    { k: 'taxa', label: 'Taxa atur', fmt: v => v == null ? '—' : fmtDec(v, 2) + ' %' },
    { k: 'pd', label: '% dones', fmt: v => fmtPct(v) }, { k: 'pes', label: 'Pes comarca', fmt: v => fmtPct(v) }
  ], filt, { state: S.rank.key ? S.rank : { key: 'atur', asc: false }, sel: r => r.id === S.terr, onRow: id => { S.terr = id; renderAll(); } });
}

/* ======================= MAPA ======================= */
const MAPIND = {
  vint: { label: "Variació interanual de l'atur (%)", div: true, val: (t, i) => varPct(t, 'atur', i, 12), fmt: v => v == null ? '—' : fmtSgn(v) + ' %' },
  vmens: { label: "Variació mensual de l'atur (%)", div: true, val: (t, i) => varPct(t, 'atur', i, 1), fmt: v => v == null ? '—' : fmtSgn(v) + ' %' },
  atur: { label: 'Atur registrat (persones)', div: false, val: (t, i) => V(t, 'atur', i), fmt: fmtInt },
  taxa: { label: "Taxa d'atur registral (%)", div: false, val: (t, i) => V(t, 'taxa', i), fmt: v => v == null ? '—' : fmtDec(v, 2) + ' %' },
  pdones: { label: "Dones en l'atur (%)", div: false, val: (t, i) => V(t, 'atur', i) ? V(t, 'aturD', i) / V(t, 'atur', i) * 100 : null, fmt: v => fmtPct(v) },
  pes: { label: "Pes sobre l'atur de la comarca (%)", div: false, val: (t, i) => V(COMARCA, 'atur', i) ? V(t, 'atur', i) / V(COMARCA, 'atur', i) * 100 : null, fmt: v => fmtPct(v) }
};
const mapDomCache = {};
function mapDomain(k) {
  if (MAPIND[k].div) {                       // variacions: escala simetrica segons el mes actual (mes contrast)
    const v = municipis().map(t => MAPIND[k].val(t, S.i)).filter(x => x != null && isFinite(x)).map(Math.abs).sort((a, b) => a - b);
    const m = v.length ? Math.max(2, v[Math.min(v.length - 1, Math.floor(.9 * v.length))]) : 10;
    return [-m, m];
  }
  if (mapDomCache[k]) return mapDomCache[k];
  const f = MAPIND[k].val, vals = [];
  municipis().forEach(t => S.mesos.forEach((m, i) => { if (i < S.mesos.length - 96) return; const v = f(t, i); if (v != null && isFinite(v)) vals.push(v); }));
  vals.sort((a, b) => a - b);
  const q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  let lo = q(.02), hi = q(.98);
  if (MAPIND[k].div) { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
  return (mapDomCache[k] = [lo, hi]);
}
function mapColor(k, v) {
  if (v == null || !isFinite(v)) return css('--surface2');
  const [lo, hi] = mapDomain(k);
  const x = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return MAPIND[k].div ? d3.interpolateRdYlGn(1 - x) : d3.interpolateYlGnBu(.1 + .85 * x);
}
function renderMapa() {
  const sel = $('#mapInd');
  if (!sel.options.length) {
    sel.innerHTML = Object.entries(MAPIND).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
    sel.value = S.mapInd; sel.onchange = () => { S.mapInd = sel.value; renderMapa(); };
    $('#mapLabels').onchange = drawMap;
    $('#btnPlay').onclick = togglePlay;
  }
  if (!S.geo) { $('#mapsvg').outerHTML = '<div class="empty" id="mapsvg">Falta el fitxer del mapa (dashboard/data/municipis.js).</div>'; return; }
  drawMap(); mapSide();
}
function drawMap() {
  const svg = d3.select('#mapsvg'); if (S.tab !== 'mapa' || svg.empty() || !S.geo) return;
  const node = svg.node(), w = node.clientWidth || 800, h = node.clientHeight || 600;
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[14, 14], [w - 14, h - 14]], S.geo);
  const path = d3.geoPath(proj), k = S.mapInd, i = S.i;
  svg.attr('viewBox', `0 0 ${w} ${h}`);
  const gs = svg.selectAll('path.muni').data(S.geo.features, d => d.properties.codi);
  gs.enter().append('path').attr('class', 'muni')
    .on('mousemove', (ev, d) => showTip(ev, d)).on('mouseleave', hideTip)
    .on('click', (ev, d) => { S.terr = d.properties.codi; $('#selTerr').value = S.terr; mapSide(); drawMap(); })
    .merge(gs).attr('d', path).attr('fill', d => mapColor(k, MAPIND[k].val(d.properties.codi, i)))
    .classed('sel', d => d.properties.codi === S.terr || S.terr === COMARCA && false);
  svg.selectAll('path.muni.sel').raise();            // el municipi seleccionat es dibuixa a sobre dels veins
  const show = $('#mapLabels').checked;
  const tl = svg.selectAll('text').data(show ? S.geo.features : [], d => d.properties.codi);
  tl.exit().remove();
  tl.enter().append('text').merge(tl).attr('transform', d => { const c = path.centroid(d); return `translate(${c[0]},${c[1] + 3})`; })
    .text(d => { const b = path.bounds(d), amp = b[1][0] - b[0][0], nm_ = d.properties.nom;
      return (amp > nm_.length * 5.4 || d.properties.codi === S.terr) ? nm_ : ''; });
  svg.selectAll('text').raise();
  // llegenda
  const [lo, hi] = mapDomain(k);
  const stops = d3.range(0, 1.001, .1).map(x => mapColor(k, lo + x * (hi - lo)));
  $('#legBar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  $('#legMin').textContent = MAPIND[k].fmt(lo); $('#legMax').textContent = MAPIND[k].fmt(hi);
}
function showTip(ev, d) {
  const c = d.properties.codi, k = S.mapInd, i = S.i, tip = $('#tip');
  tip.innerHTML = `<b>${esc(d.properties.nom)}</b>${esc(MAPIND[k].label)}: <b style="display:inline">${MAPIND[k].fmt(MAPIND[k].val(c, i))}</b><br>Atur: ${fmtInt(V(c, 'atur', i))} · Taxa: ${fmtDec(V(c, 'taxa', i), 2)} %`;
  tip.style.display = 'block'; tip.style.left = Math.min(ev.clientX + 14, innerWidth - 270) + 'px'; tip.style.top = (ev.clientY + 14) + 'px';
}
const hideTip = () => { $('#tip').style.display = 'none'; };
function mapSide() {
  const t = S.terr, i = S.i, el = $('#mapSide');
  el.innerHTML = `<h3 style="font-size:17px">${esc(nom(t))}</h3><div class="sub">${fmtMes(S.mesos[i])}</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px;margin:8px 0">` + [
      ['Atur registrat', fmtInt(V(t, 'atur', i))], ["Taxa d'atur", fmtPct(V(t, 'taxa', i), 2)],
      ['Var. mensual', fmtSgn(varPct(t, 'atur', i, 1)) + ' %'], ['Var. interanual', fmtSgn(varPct(t, 'atur', i, 12)) + ' %'],
      ['% dones', fmtPct(V(t, 'atur', i) ? V(t, 'aturD', i) / V(t, 'atur', i) * 100 : null)], ['Afiliats', fmtInt(V(t, 'afi', i))]
    ].map(([l, v]) => `<div><div class="note" style="text-transform:uppercase;letter-spacing:.04em;font-size:11px">${l}</div><div style="font-size:19px;font-weight:700">${v}</div></div>`).join('') +
    `</div><div class="chart short" id="chMap1"></div>
    <button class="icon-btn" id="btnMapCom" style="margin-top:8px">Veure tota la comarca</button>`;
  $('#btnMapCom').onclick = () => { S.terr = COMARCA; $('#selTerr').value = COMARCA; mapSide(); drawMap(); };
  chart('chMap1').setOption(baseOpt({ grid: { left: 44, right: 10, top: 14, bottom: 26 }, legend: { show: false }, xAxis: monthAxis(S.mesos), yAxis: { type: 'value', axisLabel: { color: css('--muted'), formatter: fmtInt }, splitLine: { lineStyle: { color: css('--line') } } },
    series: [{ type: 'line', data: arr(t, 'atur'), showSymbol: false, lineStyle: { width: 2 }, areaStyle: { opacity: .1 },
      markPoint: { symbolSize: 36, data: [{ coord: [i, V(t, 'atur', i)], value: '' }] } }], tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: fmtInt }) }), true);
}
function togglePlay() { if (S.play) return stopPlay(); if (S.i >= S.mesos.length - 1) S.i = 0;
  $('#btnPlay').textContent = '⏸ Atura'; S.play = setInterval(() => { if (S.i >= S.mesos.length - 1) return stopPlay(); S.i++; renderAll(); }, 450); }
function stopPlay() { if (S.play) { clearInterval(S.play); S.play = null; } const b = $('#btnPlay'); if (b) b.textContent = '▶ Animació'; }

/* ======================= EVOLUCIÓ ======================= */
function setupControls() {
  $('#evInd').innerHTML = Object.entries(IND).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
  $('#evInd').onchange = e => { S.ev.ind = e.target.value; if (!IND[S.ev.ind].sex) S.ev.sex = 'T'; renderEvolucio(); };
  $$('#evSex button').forEach(b => b.onclick = () => { S.ev.sex = b.dataset.s; renderEvolucio(); });
  $('#evMM').onchange = e => { S.ev.mm = e.target.checked; renderEvolucio(); };
  $('#rankSearch').oninput = renderResum;
  // comparativa
  $('#cmpInd').onchange = renderComparativa; $('#cmpBase').onchange = e => { S.cmpBase = +e.target.value; renderComparativa(); };
  $('#cmpAdd').onchange = e => { const v = e.target.value; if (v && !S.cmp.includes(v)) S.cmp.push(v); renderComparativa(); };
  // perfil
  $$('#pfSex button').forEach(b => b.onclick = () => { S.pf.sex = b.dataset.s; renderPerfil(); });
  $$('#pfMode button').forEach(b => b.onclick = () => { S.pf.mode = b.dataset.m; renderPerfil(); });
  $('#pfDesg').innerHTML = S.meta.desglossaments.map(d => `<option value="${d.id}">${esc(d.nom)}</option>`).join('');
  $('#pfDesg').value = S.pf.id; $('#pfDesg').onchange = e => { S.pf.id = e.target.value; renderPerfil(); };
  $('#btnCsv').onclick = descarregaCsv;
}
function movingAvg(a, n) { return a.map((_, i) => { if (i < n - 1) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) { if (a[k] == null) return null; s += a[k]; } return s / n; }); }
function renderEvolucio() {
  const t = S.terr, e = S.ev, I = IND[e.ind], i = S.i;
  $('#evInd').value = e.ind;
  $$('#evSex button').forEach(b => { b.classList.toggle('on', b.dataset.s === e.sex); b.disabled = !I.sex && b.dataset.s !== 'T'; b.style.opacity = !I.sex && b.dataset.s !== 'T' ? .4 : 1; });
  $('#evMM').checked = e.mm;
  const mesos = S.mesos.slice(0, i + 1);
  const mk = (nm, key, col) => { let d = arr(t, key).slice(0, i + 1); if (e.mm) d = movingAvg(d, 12);
    return { name: nm, type: 'line', data: d, showSymbol: false, lineStyle: { width: 2.2 }, areaStyle: e.sex === 'HD' ? undefined : { opacity: .07 }, itemStyle: col ? { color: col } : undefined }; };
  const ser = e.sex === 'HD' ? [mk('Homes', keyOf(e.ind, 'H'), PAL()[0]), mk('Dones', keyOf(e.ind, 'D'), PAL()[1])] :
    [mk(`${I.label}${e.sex === 'H' ? ' · Homes' : e.sex === 'D' ? ' · Dones' : ''}`, keyOf(e.ind, e.sex))];
  chart('chEv1').setOption(baseOpt({ xAxis: monthAxis(mesos), grid: { left: 60, right: 24, top: 36, bottom: 62 },
    yAxis: { type: 'value', scale: e.ind === 'taxa', axisLabel: { color: css('--muted'), formatter: e.ind === 'taxa' ? v => v + ' %' : fmtInt }, splitLine: { lineStyle: { color: css('--line') } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 10, borderColor: 'transparent' }],
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: I.fmt }), series: ser,
    title: { text: `${nom(t)} · ${I.label}${e.mm ? ' (mitjana mòbil 12 mesos)' : ''}`, left: 'center', top: 0, textStyle: { fontSize: 13, color: css('--muted'), fontWeight: 600 } }, legend: { show: false } }), true);
  // variació interanual
  const key = keyOf(e.ind, e.sex === 'HD' ? 'T' : e.sex);
  const vi = mesos.map((m, k) => e.ind === 'taxa' ? varAbs(t, key, k, 12) : varPct(t, key, k, 12));
  chart('chEv2').setOption(baseOpt({ grid: { left: 50, right: 14, top: 16, bottom: 34 }, legend: { show: false }, xAxis: monthAxis(mesos),
    yAxis: { type: 'value', axisLabel: { color: css('--muted'), formatter: v => v + (e.ind === 'taxa' ? ' pp' : ' %') }, splitLine: { lineStyle: { color: css('--line') } } },
    dataZoom: [{ type: 'inside', startValue: Math.max(0, mesos.length - 72) }], tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: v => fmtSgn(v, e.ind === 'taxa' ? 2 : 1) + (e.ind === 'taxa' ? ' pp' : ' %') }),
    series: [{ type: 'bar', data: vi.map(v => v == null ? null : { value: v, itemStyle: { color: (e.ind === 'afi') ? (v > 0 ? css('--good') : css('--bad')) : (v > 0 ? css('--bad') : css('--good')) } }) }] }), true);
  // estacionalitat
  const anys = [...new Set(S.mesos.map(m => Math.floor(m / 100)))].slice(-7);
  const ks = keyOf(e.ind, e.sex === 'HD' ? 'T' : e.sex);
  chart('chEv3').setOption(baseOpt({ grid: { left: 54, right: 14, top: 40, bottom: 30 }, xAxis: { type: 'category', data: MESOS_CURT, axisLabel: { color: css('--muted') }, axisLine: { lineStyle: { color: css('--line') } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: css('--muted'), formatter: e.ind === 'taxa' ? v => v + ' %' : fmtInt }, splitLine: { lineStyle: { color: css('--line') } } },
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: I.fmt }),
    series: anys.map((y, n) => ({ name: String(y), type: 'line', showSymbol: false, lineStyle: { width: n === anys.length - 1 ? 3 : 1.6, opacity: n === anys.length - 1 ? 1 : .75 },
      data: MESOS_CA.map((_, mm) => { const idx = S.mesos.indexOf(y * 100 + mm + 1); return idx >= 0 ? arr(t, ks)[idx] : null; }) })) }), true);
}

/* ======================= COMPARATIVA ======================= */
function cmpVal(ind, t, i) {
  if (ind === 'atur') return V(t, 'atur', i);
  if (ind === 'taxa') return V(t, 'taxa', i);
  if (ind === 'vint') return varPct(t, 'atur', i, 12);
  if (ind === 'pdones') return V(t, 'atur', i) ? V(t, 'aturD', i) / V(t, 'atur', i) * 100 : null;
  if (ind === 'idx') { const b = S.mesos.indexOf(S.cmpBase), v0 = b >= 0 ? V(t, 'atur', b) : null; return v0 ? V(t, 'atur', i) / v0 * 100 : null; }
}
const CMPFMT = { idx: v => fmtDec(v, 1), atur: fmtInt, taxa: v => fmtDec(v, 2) + ' %', vint: v => fmtSgn(v) + ' %', pdones: v => fmtDec(v, 1) + ' %' };
function renderComparativa() {
  const ind = $('#cmpInd').value, i = S.i;
  if (!$('#cmpBase').options.length) {
    $('#cmpBase').innerHTML = S.mesos.map(m => `<option value="${m}">${fmtMes(m)}</option>`).join('');
    S.cmpBase = S.mesos.includes(201901) ? 201901 : S.mesos[0]; $('#cmpBase').value = S.cmpBase;
  }
  $('#cmpBaseBox').style.display = ind === 'idx' ? '' : 'none';
  const dis = terrOrder().filter(c => !S.cmp.includes(c));
  $('#cmpAdd').innerHTML = '<option value="">— selecciona —</option>' + dis.map(c => `<option value="${c}">${esc(nom(c))}</option>`).join('');
  const col = c => PAL()[S.cmp.indexOf(c) % PAL().length];
  $('#cmpChips').innerHTML = S.cmp.map(c => `<span class="chip"><i style="background:${col(c)}"></i>${esc(nom(c))}<button data-c="${c}" title="Treu">×</button></span>`).join('');
  $$('#cmpChips button').forEach(b => b.onclick = () => { S.cmp = S.cmp.filter(x => x !== b.dataset.c); renderComparativa(); });
  const mesos = S.mesos.slice(0, i + 1);
  chart('chCmp1').setOption(baseOpt({ xAxis: monthAxis(mesos), grid: { left: 60, right: 24, top: 40, bottom: 62 },
    yAxis: { type: 'value', scale: true, axisLabel: { color: css('--muted'), formatter: v => ind === 'taxa' || ind === 'vint' || ind === 'pdones' ? v + ' %' : fmtInt(v) }, splitLine: { lineStyle: { color: css('--line') } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 10, borderColor: 'transparent' }],
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: CMPFMT[ind] }),
    series: S.cmp.map(c => ({ name: nom(c), type: 'line', showSymbol: false, itemStyle: { color: col(c) }, lineStyle: { width: c === COMARCA ? 3.4 : 2, type: c === COMARCA ? 'solid' : 'solid' }, data: mesos.map((m, k) => cmpVal(ind, c, k)),
      markLine: ind === 'idx' ? undefined : undefined })),
    legend: { top: 0 } }), true);
  // rànquing
  const rk = municipis().map(c => ({ c, v: cmpVal(ind, c, i) })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
  const cv = cmpVal(ind, COMARCA, i);
  $('#cmpRankTitol').textContent = `Rànquing · ${fmtMes(S.mesos[i])}`;
  chart('chCmp2').setOption(baseOpt({ grid: { left: 130, right: 40, top: 16, bottom: 20 }, legend: { show: false },
    xAxis: { type: 'value', axisLabel: { color: css('--muted') }, splitLine: { lineStyle: { color: css('--line') } } },
    yAxis: { type: 'category', inverse: true, data: rk.map(r => nom(r.c)), axisLabel: { color: css('--ink'), fontSize: 11, interval: 0 }, axisTick: { show: false }, axisLine: { show: false } },
    tooltip: { trigger: 'item', valueFormatter: CMPFMT[ind], backgroundColor: css('--surface'), textStyle: { color: css('--ink') }, borderColor: css('--line') },
    series: [{ type: 'bar', barCategoryGap: '25%', data: rk.map(r => ({ value: r.v, itemStyle: { color: S.cmp.includes(r.c) ? col(r.c) : css('--muted'), opacity: S.cmp.includes(r.c) ? 1 : .45 } })),
      markLine: cv != null ? { symbol: 'none', lineStyle: { color: css('--accent2'), type: 'dashed' }, label: { formatter: 'Comarca', color: css('--accent2') }, data: [{ xAxis: cv }] } : undefined }] }), true);
  // dispersió
  const pts = municipis().map(c => ({ c, x: V(c, 'taxa', i), y: varPct(c, 'atur', i, 12), a: V(c, 'atur', i) })).filter(p => p.x != null && p.y != null);
  const amax = Math.max(...pts.map(p => p.a), 1);
  chart('chCmp3').setOption(baseOpt({ grid: { left: 64, right: 24, top: 20, bottom: 46 }, legend: { show: false },
    xAxis: { type: 'value', scale: true, name: "Taxa d'atur registral (%)", nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: css('--muted') }, axisLabel: { color: css('--muted') }, splitLine: { lineStyle: { color: css('--line') } } },
    yAxis: { type: 'value', scale: true, name: 'Var. interanual (%)', nameLocation: 'middle', nameGap: 40, nameRotate: 90, nameTextStyle: { color: css('--muted') }, axisLabel: { color: css('--muted') }, splitLine: { lineStyle: { color: css('--line') } } },
    tooltip: { trigger: 'item', backgroundColor: css('--surface'), textStyle: { color: css('--ink') }, borderColor: css('--line'), formatter: p => `<b>${esc(nom(p.data.c))}</b><br>Taxa: ${fmtDec(p.data.value[0], 2)} %<br>Var. interanual: ${fmtSgn(p.data.value[1])} %<br>Atur: ${fmtInt(p.data.a)}` },
    series: [{ type: 'scatter', data: pts.map(p => ({ value: [p.x, p.y], c: p.c, a: p.a, symbolSize: 10 + 34 * Math.sqrt(p.a / amax), itemStyle: { color: S.cmp.includes(p.c) ? col(p.c) : css('--muted'), opacity: S.cmp.includes(p.c) ? .9 : .45 },
      label: { show: S.cmp.includes(p.c), formatter: nom(p.c), position: 'top', color: css('--ink'), fontSize: 11 } })),
      markLine: { symbol: 'none', silent: true, lineStyle: { color: css('--line') }, data: [{ yAxis: 0 }] } }] }), true);
  // taula
  const rows = S.cmp.map(c => ({ id: c, n: nom(c), atur: V(c, 'atur', i), vm: varPct(c, 'atur', i, 1), vi: varPct(c, 'atur', i, 12), taxa: V(c, 'taxa', i), pd: V(c, 'atur', i) ? V(c, 'aturD', i) / V(c, 'atur', i) * 100 : null,
    idx: cmpVal('idx', c, i), afi: V(c, 'afi', i) }));
  table($('#tblCmp'), [{ k: 'n', label: 'Territori' }, { k: 'atur', label: 'Atur', fmt: fmtInt }, { k: 'vm', label: 'Var. mensual', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar },
    { k: 'vi', label: 'Var. interanual', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar }, { k: 'taxa', label: 'Taxa atur', fmt: v => v == null ? '—' : fmtDec(v, 2) + ' %' },
    { k: 'pd', label: '% dones', fmt: v => fmtPct(v) }, { k: 'afi', label: 'Afiliats', fmt: fmtInt }, { k: 'idx', label: 'Índex (base 100)', fmt: v => fmtDec(v, 1) }], rows, { state: { key: 'atur', asc: false } });
}

/* ======================= PERFIL ======================= */
async function renderPerfil() {
  const id = S.pf.id, t = S.terr, i = S.i, sx = S.pf.sex, md = S.pf.mode;
  $('#pfDesg').value = id;
  $$('#pfSex button').forEach(b => b.classList.toggle('on', b.dataset.s === sx));
  $$('#pfMode button').forEach(b => b.classList.toggle('on', b.dataset.m === md));
  let d; try { d = await getDesg(id); } catch (e) { $('#pfNote').style.display = ''; $('#pfNote').textContent = 'No s\'ha pogut carregar aquest desglossament.'; return; }
  if (S.tab !== 'perfil') return;
  const val = (ci, k) => { const v = d.v[t]; if (!v) return null; const h = v[0][ci][k], f = v[1][ci][k]; return sx === 'H' ? h : sx === 'D' ? f : (h == null || f == null ? null : h + f); };
  const dMes = S.meta.desglossaments.find(x => x.id === id).ultim_mes;
  const note = $('#pfNote');
  if (S.mesos[i] > dMes) { note.style.display = ''; note.textContent = `Aquest desglossament només està disponible fins a ${fmtMes(dMes)} (el servidor encara no ha publicat els mesos posteriors). Es mostra l'últim mes disponible.`; } else note.style.display = 'none';
  const ii = Math.min(i, S.mesos.indexOf(dMes) >= 0 ? S.mesos.indexOf(dMes) : i);
  const tot = d.cats.reduce((s, _, ci) => s + (val(ci, ii) || 0), 0);
  const rows = d.cats.map((c, ci) => { const v = val(ci, ii), v0 = ii >= 12 ? val(ci, ii - 12) : null, vm0 = ii >= 1 ? val(ci, ii - 1) : null;
    return { id: c.k, n: c.l, v, p: tot ? v / tot * 100 : null, vm: v != null && vm0 != null ? v - vm0 : null, vi: v != null && v0 != null ? v - v0 : null, vip: pct(v, v0), ci }; });
  const many = rows.length > 14;
  const order = [...rows].sort((a, b) => (b.v || 0) - (a.v || 0));
  const natural = d.cats.length <= 14 && !/Edat|Durada|formatiu|Experi/.test(d.nom) ? false : true;  // categories ordenades de forma natural (edat, durada...)
  const lst = natural && !many ? rows : order;
  const data = lst.map(r => md === 'p' ? r.p : md === 'vi' ? r.vip : r.v);
  const fm = md === 'p' ? v => fmtPct(v) : md === 'vi' ? v => v == null ? '—' : fmtSgn(v) + ' %' : fmtInt;
  const catLab = lst.map(r => r.n.length > 38 ? r.n.slice(0, 36) + '…' : r.n);
  const height = Math.max(340, lst.length * 24 + 60);
  $('#chPf1').style.height = Math.min(height, 700) + 'px'; $('#chPf2').style.height = Math.min(height, 700) + 'px';
  chart('chPf1').resize();
  chart('chPf1').setOption(baseOpt({ grid: { left: 190, right: 60, top: 28, bottom: 20 }, legend: { show: false },
    title: { text: `${nom(t)} · ${fmtMes(S.mesos[ii])}${sx === 'H' ? ' · Homes' : sx === 'D' ? ' · Dones' : ''}`, left: 'center', top: 0, textStyle: { fontSize: 13, color: css('--muted'), fontWeight: 600 } },
    xAxis: { type: 'value', axisLabel: { color: css('--muted') }, splitLine: { lineStyle: { color: css('--line') } } },
    yAxis: { type: 'category', inverse: true, data: catLab, axisLabel: { color: css('--ink'), fontSize: 11.5, interval: 0 }, axisTick: { show: false }, axisLine: { show: false } },
    tooltip: { trigger: 'item', valueFormatter: fm, backgroundColor: css('--surface'), textStyle: { color: css('--ink') }, borderColor: css('--line') },
    series: [{ type: 'bar', barCategoryGap: '28%', data: data.map(v => ({ value: v, itemStyle: { color: md === 'vi' ? (v > 0 ? css('--bad') : css('--good')) : css('--accent') } })),
      label: { show: true, position: 'right', formatter: p => fm(p.value), color: css('--muted'), fontSize: 11 } }] }), true);
  // evolució de categories
  const mesos = S.mesos.slice(0, ii + 1);
  const topC = [...rows].sort((a, b) => (b.v || 0) - (a.v || 0)).slice(0, 6).map(r => r.ci);
  chart('chPf2').resize();
  chart('chPf2').setOption(baseOpt({ grid: { left: 54, right: 20, top: 74, bottom: 56 }, xAxis: monthAxis(mesos),
    title: { text: 'Evolució per categoria (clica la llegenda per afegir-ne o treure\'n)', left: 'center', top: 0, textStyle: { fontSize: 13, color: css('--muted'), fontWeight: 600 } },
    legend: { type: 'scroll', top: 24, textStyle: { color: css('--muted'), fontSize: 11 }, selected: Object.fromEntries(d.cats.map((c, ci) => [c.l.length > 38 ? c.l.slice(0, 36) + '…' : c.l, topC.includes(ci)])) },
    yAxis: { type: 'value', axisLabel: { color: css('--muted'), formatter: fmtInt }, splitLine: { lineStyle: { color: css('--line') } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: 'transparent' }],
    tooltip: Object.assign(baseOpt().tooltip, { valueFormatter: fmtInt, order: 'valueDesc' }),
    series: [...d.cats.keys()].sort((x, y) => (val(y, ii) || 0) - (val(x, ii) || 0)).map(ci => ({ name: d.cats[ci].l.length > 38 ? d.cats[ci].l.slice(0, 36) + '…' : d.cats[ci].l, type: 'line', showSymbol: false, lineStyle: { width: 2 }, data: mesos.map((m, k) => val(ci, k)) })) }), true);
  $('#pfTblTitol').textContent = `Detall · ${d.nom}`;
  table($('#tblPf'), [{ k: 'n', label: 'Categoria' }, { k: 'v', label: 'Persones', fmt: fmtInt, bar: true }, { k: 'p', label: '% del total', fmt: v => fmtPct(v) },
    { k: 'vm', label: 'Var. mensual', fmt: fmtSgnInt, cls: clsVar }, { k: 'vi', label: 'Var. interanual', fmt: fmtSgnInt, cls: clsVar }, { k: 'vip', label: 'Var. interanual %', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar }],
    lst, { state: { key: 'v', asc: false } });
}

/* ======================= DADES ======================= */
function renderDades() {
  const t = S.terr;
  $('#metaInfo').innerHTML = `Última dada d'atur: <b>${fmtMes(S.meta.ultim_mes)}</b> · afiliats fins a <b>${fmtMes(S.meta.ultim_mes_afiliats)}</b> (el darrer mes és provisional) · dades preparades el ${esc(S.meta.generat)}.`;
  $('#serieSub').textContent = nom(t);
  const rows = S.mesos.map((m, k) => ({ id: m, mes: m, atur: V(t, 'atur', k), h: V(t, 'aturH', k), d: V(t, 'aturD', k), afi: V(t, 'afi', k), taxa: V(t, 'taxa', k), vi: varPct(t, 'atur', k, 12) })).reverse();
  table($('#tblSerie'), [{ k: 'mes', label: 'Mes', fmt: fmtMes }, { k: 'atur', label: 'Atur', fmt: fmtInt }, { k: 'h', label: 'Homes', fmt: fmtInt }, { k: 'd', label: 'Dones', fmt: fmtInt },
    { k: 'afi', label: 'Afiliats', fmt: fmtInt }, { k: 'taxa', label: 'Taxa (%)', fmt: v => v == null ? '—' : fmtDec(v, 2) }, { k: 'vi', label: 'Var. interanual %', fmt: v => v == null ? '—' : fmtSgn(v) + ' %', cls: clsVar }], rows, { state: { key: 'mes', asc: false } });
}
function descarregaCsv() {
  const t = S.terr, cap = ['Mes', 'Atur registrat', 'Atur homes', 'Atur dones', 'Demandants no ocupats', "Demandants d'ocupació", 'Afiliats', 'Taxa atur registral (%)'];
  const l = S.mesos.map((m, k) => [m, V(t, 'atur', k), V(t, 'aturH', k), V(t, 'aturD', k), V(t, 'dno', k), V(t, 'dem', k), V(t, 'afi', k), V(t, 'taxa', k)].map(v => v == null ? '' : v).join(';'));
  const blob = new Blob(['﻿' + cap.join(';') + '\n' + l.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `atur_${t}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

init();
