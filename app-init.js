/* ============ init: filters, nav, refresh ============ */
(function (P) {
  const $ = id => document.getElementById(id);
  const ui = { ovMetric: 'amt', cmpBasis: 'week', brandScope: 'both', page: 'overview',
               wkA: null, wkB: null };

  /* ---------- populate filter dropdowns ---------- */
  function buildFilters() {
    const mSel = $('fMonth');
    mSel.innerHTML = '<option value="all">All 2026</option>' +
      P.MONTHS.map((m, i) => `<option value="${i + 1}">${m} 2026</option>`).join('');

    const wSel = $('fWeek');
    const weeks = P.allWeeks();
    wSel.innerHTML = '<option value="all">All weeks</option>' +
      weeks.map((w, i) => `<option value="${w}">Week ${i + 1} — ${P.weekLabel(w)}</option>`).join('');

    const bSel = $('fBrand');
    bSel.innerHTML = '<option value="all">All brands</option>' +
      P.allBrands().map(b => `<option value="${b.replace(/"/g, '&quot;')}">${b}</option>`).join('');

    const wa = $('wkA'), wb = $('wkB');
    const wopts = weeks.map((w, i) =>
      `<option value="${w}">Week ${i + 1} — ${P.weekLabel(w)}</option>`).join('');
    wa.innerHTML = wopts; wb.innerHTML = wopts;
    if (weeks.length) {
      wa.value = weeks[Math.max(0, weeks.length - 2)];
      wb.value = weeks[weeks.length - 1];
      ui.wkA = wa.value; ui.wkB = wb.value;
    }

    // per-channel week + month selectors
    ['sms', 'inb'].forEach(pfx => {
      const ch = pfx === 'sms' ? 'SMS CB' : 'Inbound';
      const cr = P.raw.filter(r => r.ch === ch);
      const cw = [...new Set(cr.map(r => r.ws))].filter(Boolean).sort();
      const co = cw.map((w, i) => `<option value="${w}">W${i + 1} — ${P.weekLabel(w)}</option>`).join('');
      const a = $(pfx + 'WkA'), b = $(pfx + 'WkB');
      a.innerHTML = co; b.innerHTML = co;
      if (cw.length) {
        a.value = cw[Math.max(0, cw.length - 2)];
        b.value = cw[cw.length - 1];
        ui[pfx + 'WkA'] = a.value; ui[pfx + 'WkB'] = b.value;
      }
      const cmo = [...new Set(cr.map(r => r.m))].sort((x, y) => x - y);
      const mo = cmo.map(m => `<option value="${m}">${P.MONTHS[m - 1]} 2026</option>`).join('');
      const ma = $(pfx + 'MoA'), mb = $(pfx + 'MoB');
      ma.innerHTML = mo; mb.innerHTML = mo;
      if (cmo.length) {
        ma.value = String(cmo[Math.max(0, cmo.length - 2)]);
        mb.value = String(cmo[cmo.length - 1]);
        ui[pfx + 'MoA'] = ma.value; ui[pfx + 'MoB'] = mb.value;
      }
    });
  }

  /* ---------- status pill ---------- */
  function renderStatus() {
    const el = $('dataStatus');
    const iss = P.meta.issues || {};
    const skipped = (iss.invalid_or_missing_date || 0) + (iss.duplicate_skipped || 0) +
                    (P.meta.dropped || 0);
    if (!P.raw.length) { el.className = 'pill err'; el.textContent = 'No data loaded'; return; }
    if (skipped) {
      el.className = 'pill warn';
      el.title = JSON.stringify(iss, null, 1);
      el.textContent = `${P.num(P.raw.length)} valid sales • ${P.num(skipped)} rows skipped`;
    } else {
      el.className = 'pill';
      el.textContent = `${P.num(P.raw.length)} valid sales`;
    }
    const g = P.meta.generated;
    $('lastUpdated').textContent = g
      ? new Date(g).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : '—';
  }

  /* ---------- master re-render ---------- */
  /* ---------- week vs week (independent of the top filters) ---------- */
  function renderWeekCompare() {
    const a = ui.wkA, b = ui.wkB;
    if (!a || !b) return;
    const brand = P.state.brand;
    const pickWeek = w => P.raw.filter(r =>
      r.ws === w && (brand === 'all' || r.b === brand));
    const rowsA = pickWeek(a), rowsB = pickWeek(b);
    const labA = P.weekLabel(a), labB = P.weekLabel(b);
    P.renderWeekDelta('wkDelta', rowsA, rowsB, labA, labB);
    P.chartWeekVsWeek('chWeekVsWeek', rowsA, rowsB, labA, labB);
  }

  /* ---------- per-channel week / month comparison ---------- */
  function renderChannelCompare(pfx, ch) {
    const brand = P.state.brand;
    const pool = P.raw.filter(r => r.ch === ch && (brand === 'all' || r.b === brand));
    const wA = ui[pfx + 'WkA'], wB = ui[pfx + 'WkB'];
    if (wA && wB) {
      const ra = pool.filter(r => r.ws === wA), rb = pool.filter(r => r.ws === wB);
      P.renderWeekDelta(pfx + 'WkDelta', ra, rb, P.weekLabel(wA), P.weekLabel(wB));
      P.chartWeekVsWeek('ch' + (pfx === 'sms' ? 'Sms' : 'Inb') + 'Week',
                        ra, rb, P.weekLabel(wA), P.weekLabel(wB));
    }
    const mA = ui[pfx + 'MoA'], mB = ui[pfx + 'MoB'];
    if (mA && mB) {
      const ra = pool.filter(r => r.m === +mA), rb = pool.filter(r => r.m === +mB);
      const la = P.MONTHS[+mA - 1], lb = P.MONTHS[+mB - 1];
      P.renderWeekDelta(pfx + 'MoDelta', ra, rb, la, lb);
      P.chartMonthVsMonth('ch' + (pfx === 'sms' ? 'Sms' : 'Inb') + 'Month', ra, rb, la, lb);
    }
  }

  function render() {
    const rows = P.applyFilters();
    $('scopeNote').textContent = P.scopeText();

    if (ui.page === 'overview') {
      P.renderOverviewKpis(rows);
      P.chartMonthlyOverview('chOvMonthly', rows, ui.ovMetric);
      renderWeekCompare();
      P.chartCompare('chCompare', rows, ui.cmpBasis);
      P.chartBranchShare('chBranchShare', rows);
      const scoped = ui.brandScope === 'both' ? rows : P.byCh(rows, ui.brandScope);
      const ranked = P.brandRank(scoped);
      P.chartBrandBar('chBrandBar', ranked);
      P.renderBrandTable('tblBrands', ranked);
    } else if (ui.page === 'smscb') {
      const r = P.byCh(rows, 'SMS CB'), ranked = P.brandRank(r);
      P.renderChannelKpis('kpiSms', r);
      renderChannelCompare('sms', 'SMS CB');
      P.chartBrandPie('chSmsPie', ranked);
      P.renderTopBrand('topSms', ranked);
      P.renderBrandTable('tblSms', ranked);
    } else {
      const r = P.byCh(rows, 'Inbound'), ranked = P.brandRank(r);
      P.renderChannelKpis('kpiInb', r);
      renderChannelCompare('inb', 'Inbound');
      P.chartBrandPie('chInbPie', ranked);
      P.renderTopBrand('topInb', ranked);
      P.renderBrandTable('tblInb', ranked);
    }
    setTimeout(() => P.resizeAll(), 30);
  }
  P.render = render;

  /* ---------- nav ---------- */
  function wireNav() {
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        ui.page = t.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + ui.page).classList.add('active');
        render();
      });
    });
  }

  function wireSeg(id, key) {
    const box = $(id); if (!box) return;
    box.addEventListener('click', e => {
      const b = e.target.closest('.segbtn'); if (!b) return;
      box.querySelectorAll('.segbtn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      ui[key] = b.dataset.v;
      render();
    });
  }

  /* ---------- filters ---------- */
  function wireFilters() {
    $('fMonth').addEventListener('change', e => {
      P.state.month = e.target.value;
      if (P.state.quick === 'cm') { P.state.quick = 'all'; $('fQuick').value = 'all'; }
      render();
    });
    $('fWeek').addEventListener('change', e => {
      P.state.week = e.target.value;
      if (e.target.value !== 'all' && ['cw', 'pw'].includes(P.state.quick)) {
        P.state.quick = 'all'; $('fQuick').value = 'all';
      }
      render();
    });
    $('fBrand').addEventListener('change', e => { P.state.brand = e.target.value; render(); });
    $('fQuick').addEventListener('change', e => {
      P.state.quick = e.target.value;
      if (e.target.value !== 'all') { P.state.week = 'all'; $('fWeek').value = 'all'; }
      if (['all', 'cw', 'pw'].includes(e.target.value)) {
        P.state.month = 'all'; $('fMonth').value = 'all';
      }
      if (e.target.value === 'cm') {
        const last = P.latestDate();
        if (last) { P.state.month = String(P.ymd(last).getMonth() + 1); $('fMonth').value = P.state.month; }
      }
      render();
    });
    $('wkA').addEventListener('change', e => { ui.wkA = e.target.value; renderWeekCompare(); });
    $('wkB').addEventListener('change', e => { ui.wkB = e.target.value; renderWeekCompare(); });
    [['sms', 'SMS CB'], ['inb', 'Inbound']].forEach(([pfx, ch]) => {
      ['WkA', 'WkB', 'MoA', 'MoB'].forEach(k => {
        $(pfx + k).addEventListener('change', e => {
          ui[pfx + k] = e.target.value;
          renderChannelCompare(pfx, ch);
        });
      });
    });
    $('btnReset').addEventListener('click', () => {
      P.state = { month: 'all', week: 'all', quick: 'all', brand: 'all' };
      $('fMonth').value = 'all'; $('fWeek').value = 'all'; $('fQuick').value = 'all';
      $('fBrand').value = 'all';
      render();
    });
  }

  /* ---------- refresh: re-pull data.js (rebuilt by GitHub Actions) ---------- */
  function refresh() {
    const btn = $('btnRefresh');
    btn.disabled = true; btn.textContent = '↻ Refreshing…';
    const s = document.createElement('script');
    s.src = 'data.js?t=' + Date.now();
    s.onload = () => {
      P.load(); buildFilters(); renderStatus(); render();
      btn.disabled = false; btn.textContent = '↻ Refresh Data';
    };
    s.onerror = () => {
      btn.disabled = false; btn.textContent = '↻ Refresh Data';
      const el = $('dataStatus'); el.className = 'pill err'; el.textContent = 'Refresh failed';
    };
    document.body.appendChild(s);
  }

  /* ---------- boot ---------- */
  function boot() {
    try {
      P.load();
    } catch (err) {
      const el = $('dataStatus'); el.className = 'pill err';
      el.textContent = 'Data failed to load'; console.error(err); return;
    }
    buildFilters(); renderStatus(); wireNav();
    wireSeg('ovMetric', 'ovMetric'); wireSeg('cmpBasis', 'cmpBasis'); wireSeg('brandScope', 'brandScope');
    wireFilters();
    $('btnRefresh').addEventListener('click', refresh);
    render();
    // optional auto-refresh every 15 minutes
    setInterval(refresh, 15 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.APP);
