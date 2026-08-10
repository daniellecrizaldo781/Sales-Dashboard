/* ============ core: data, filters, aggregation ============ */
window.APP = (function () {
  const P = {};
  P.raw = [];        // all validated rows
  P.rows = [];       // rows after filters
  P.meta = {};
  P.state = { month: 'all', week: 'all', quick: 'all', brand: 'all' };

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  P.MONTHS = MONTHS;

  /* ---- pastel palette ---- */
  P.PAL = ['#E48FB1','#A98FE0','#7FB6E3','#7FCBA6','#F0A579','#E5C95A',
           '#C79BD8','#8ED3C7','#F3A6A6','#9FB8E8','#D8C08F','#B0D98F',
           '#E7A2C8','#8FC5E0','#C9B08F'];
  P.CH = { 'SMS CB': '#E48FB1', 'Inbound': '#7FB6E3' };

  /* ---- formatting ---- */
  P.money = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  P.money0 = v => '$' + Math.round(v || 0).toLocaleString('en-US');
  P.num = v => (v || 0).toLocaleString('en-US');
  P.pct = v => (v * 100).toFixed(1) + '%';

  /* ---- date helpers (timezone-safe: parse as plain Y-M-D, never Date.parse UTC) ---- */
  function ymd(s) { const a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  P.ymd = ymd;
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  P.iso = iso;
  // Monday-start week key for a YYYY-MM-DD string
  function weekStart(s) {
    const d = ymd(s), dow = (d.getDay() + 6) % 7;   // Mon=0
    d.setDate(d.getDate() - dow);
    return iso(d);
  }
  P.weekStart = weekStart;
  P.weekEnd = ws => { const d = ymd(ws); d.setDate(d.getDate() + 6); return iso(d); };
  P.fmtShort = s => { const d = ymd(s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  P.weekLabel = ws => P.fmtShort(ws) + ' – ' + P.fmtShort(P.weekEnd(ws));

  /* ---- load + validate ---- */
  P.load = function () {
    const src = (window.SALES_DATA || {});
    P.meta = { generated: src.generated || null, issues: src.issues || {}, year: src.year || 2026 };
    const out = [], bad = { rows: 0 };
    (src.rows || []).forEach(r => {
      if (!r || !r.d || !/^\d{4}-\d{2}-\d{2}$/.test(r.d)) { bad.rows++; return; }
      const amt = Number(r.amt);
      if (!isFinite(amt) || amt < 0) { bad.rows++; return; }
      const ch = r.ch === 'SMS CB' || r.ch === 'Inbound' ? r.ch : null;
      if (!ch) { bad.rows++; return; }
      out.push({
        ch, d: r.d, m: Number(r.m) || (ymd(r.d).getMonth() + 1),
        b: (r.b && String(r.b).trim()) || 'Unspecified',
        amt, ws: weekStart(r.d), ord: r.ord || '', by: r.by || ''
      });
    });
    out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    P.raw = out;
    P.meta.dropped = bad.rows;
    return out;
  };

  /* ---- derived lists ---- */
  P.allWeeks = () => [...new Set(P.raw.map(r => r.ws))].sort();
  P.allBrands = () => [...new Set(P.raw.map(r => r.b))].sort();
  P.allMonths = () => [...new Set(P.raw.map(r => r.m))].sort((a, b) => a - b);
  P.latestDate = () => P.raw.length ? P.raw[P.raw.length - 1].d : null;

  /* ---- apply filters ---- */
  P.applyFilters = function () {
    const s = P.state;
    let from = null, to = null;
    const weeks = P.allWeeks();
    const last = P.latestDate();

    if (s.quick === 'cw' && last) { from = weekStart(last); to = P.weekEnd(from); }
    else if (s.quick === 'pw' && weeks.length) {
      const i = weeks.indexOf(weekStart(last));
      const w = weeks[Math.max(0, i - 1)];
      from = w; to = P.weekEnd(w);
    }
    else if (s.quick === 'cm' && last) { const m = ymd(last).getMonth() + 1; s.month = String(m); }

    P.rows = P.raw.filter(r => {
      if (s.month !== 'all' && r.m !== +s.month) return false;
      if (s.week !== 'all' && r.ws !== s.week) return false;
      if (s.brand !== 'all' && r.b !== s.brand) return false;
      if (from && r.d < from) return false;
      if (to && r.d > to) return false;
      return true;
    });
    P.scopeFrom = from; P.scopeTo = to;
    return P.rows;
  };

  P.scopeText = function () {
    const s = P.state, bits = [];
    bits.push(s.month === 'all' ? 'All 2026' : MONTHS[+s.month - 1] + ' 2026');
    if (s.week !== 'all') bits.push('Week of ' + P.weekLabel(s.week));
    if (s.quick === 'cw') bits.push('Current week');
    if (s.quick === 'pw') bits.push('Previous week');
    if (s.brand !== 'all') bits.push('Brand: ' + s.brand);
    return 'Showing: ' + bits.join(' • ') + ' — ' + P.num(P.rows.length) + ' sales, ' +
           P.money(P.sum(P.rows)) + '.';
  };

  /* ---- aggregation helpers ---- */
  P.sum = rows => rows.reduce((a, r) => a + r.amt, 0);
  P.byCh = (rows, ch) => rows.filter(r => r.ch === ch);

  P.groupSum = function (rows, keyFn) {
    const m = new Map();
    rows.forEach(r => {
      const k = keyFn(r);
      const o = m.get(k) || { amt: 0, cnt: 0 };
      o.amt += r.amt; o.cnt++; m.set(k, o);
    });
    return m;
  };

  P.monthSeries = function (rows) {
    const g = P.groupSum(rows, r => r.m);
    return { amt: MONTHS.map((_, i) => +(((g.get(i + 1) || {}).amt || 0).toFixed(2))),
             cnt: MONTHS.map((_, i) => (g.get(i + 1) || {}).cnt || 0) };
  };

  P.weekSeries = function (rows) {
    const weeks = [...new Set(rows.map(r => r.ws))].sort();
    const g = P.groupSum(rows, r => r.ws);
    return {
      keys: weeks,
      labels: weeks.map(w => P.weekLabel(w)),
      amt: weeks.map(w => +((g.get(w) || {}).amt || 0).toFixed(2)),
      cnt: weeks.map(w => (g.get(w) || {}).cnt || 0)
    };
  };

  P.brandRank = function (rows) {
    const g = P.groupSum(rows, r => r.b);
    const total = P.sum(rows) || 1;
    return [...g.entries()]
      .map(([b, o]) => ({ brand: b, amt: +o.amt.toFixed(2), cnt: o.cnt, share: o.amt / total }))
      .sort((a, b) => b.amt - a.amt);
  };

  P.best = function (list, key) {
    if (!list.length) return null;
    return list.reduce((a, b) => (b[key] > a[key] ? b : a));
  };

  return P;
})();
