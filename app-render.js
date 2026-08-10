/* ============ render: KPIs, tables, page wiring ============ */
(function (P) {
  const $ = id => document.getElementById(id);

  function kpiCard(cls, lbl, val, note) {
    return `<div class="kpi ${cls}"><div class="lbl">${lbl}</div>
      <div class="val">${val}</div><div class="note">${note || ''}</div></div>`;
  }

  function lastOf(rows) {
    return rows.length ? rows[rows.length - 1].d : P.latestDate();
  }
  function currentWeekRows(rows) {
    const last = lastOf(rows); if (!last) return [];
    const ws = P.weekStart(last);
    return rows.filter(r => r.ws === ws);
  }
  function currentMonthRows(rows) {
    const last = lastOf(rows); if (!last) return [];
    const m = P.ymd(last).getMonth() + 1;
    return rows.filter(r => r.m === m);
  }

  /* ---------- OVERVIEW KPIs ---------- */
  P.renderOverviewKpis = function (rows) {
    const sms = P.byCh(rows, 'SMS CB'), inb = P.byCh(rows, 'Inbound');
    const brands = P.brandRank(rows);
    const topBrand = brands[0];
    const branch = P.sum(sms) >= P.sum(inb)
      ? { n: 'SMS CB Escalated', v: P.sum(sms) } : { n: 'Inbound Sales', v: P.sum(inb) };
    const cm = currentMonthRows(rows);
    const lastRow = lastOf(rows);
    const cmName = lastRow ? P.MONTHS[P.ymd(lastRow).getMonth()] : '—';

    $('kpiOverview').innerHTML =
      kpiCard('c1', 'Total Sales', P.money(P.sum(rows)), 'All filtered sales value') +
      kpiCard('c2', 'Total Number of Sales', P.num(rows.length), 'Orders counted') +
      kpiCard('c3', 'SMS CB Escalated Sales', P.money(P.sum(sms)), P.num(sms.length) + ' orders') +
      kpiCard('c4', 'Inbound Sales', P.money(P.sum(inb)), P.num(inb.length) + ' orders') +
      kpiCard('c5', 'Best Performing Brand', topBrand ? topBrand.brand : '—',
              topBrand ? P.money(topBrand.amt) + ' • ' + P.pct(topBrand.share) : '') +
      kpiCard('c6', 'Best Performing Branch', branch.n, P.money(branch.v)) +
      kpiCard('c2', 'Current Month Sales (' + cmName + ')', P.money(P.sum(cm)), P.num(cm.length) + ' orders') +
      kpiCard('c1', 'Year-to-Date Sales', P.money(P.sum(P.raw)), P.num(P.raw.length) + ' orders (unfiltered 2026)');
  };

  /* ---------- CHANNEL KPIs ---------- */
  P.renderChannelKpis = function (elId, rows) {
    const cw = currentWeekRows(rows);
    $(elId).innerHTML =
      kpiCard('c1', 'Total Sales (count)', P.num(rows.length), 'Orders in scope') +
      kpiCard('c2', 'Total Sales Amount', P.money(P.sum(rows)), '') +
      kpiCard('c3', 'Current Sales Amount', P.money(P.sum(cw)), P.num(cw.length) + ' orders this week');
  };

  /* ---------- week vs week delta cards ---------- */
  P.renderWeekDelta = function (elId, rowsA, rowsB, labA, labB) {
    const el = $(elId); if (!el) return;
    const aAmt = P.sum(rowsA), bAmt = P.sum(rowsB);
    const dAmt = bAmt - aAmt, dCnt = rowsB.length - rowsA.length;
    const pctTxt = (d, base) => {
      if (!base) return d ? 'new' : 'no change';
      const v = (d / base) * 100;
      return (v >= 0 ? '▲ ' : '▼ ') + Math.abs(v).toFixed(1) + '%';
    };
    const cls = d => d > 0 ? 'up' : d < 0 ? 'down' : '';
    const avgA = rowsA.length ? aAmt / rowsA.length : 0;
    const avgB = rowsB.length ? bAmt / rowsB.length : 0;
    const topOf = rows => {
      if (!rows.length) return null;
      const m = new Map();
      rows.forEach(r => m.set(r.b, (m.get(r.b) || 0) + r.amt));
      return [...m.entries()].sort((x, y) => y[1] - x[1])[0];
    };
    const tA = topOf(rowsA), tB = topOf(rowsB);
    el.innerHTML =
      kpiCard('c1', labA, P.money(aAmt), P.num(rowsA.length) + ' orders') +
      kpiCard('c2', labB, P.money(bAmt), P.num(rowsB.length) + ' orders') +
      `<div class="kpi c4"><div class="lbl">Change in Sales</div>
        <div class="val ${cls(dAmt)}">${dAmt >= 0 ? '+' : '−'}${P.money(Math.abs(dAmt))}</div>
        <div class="note ${cls(dAmt)}">${pctTxt(dAmt, aAmt)}</div></div>` +
      `<div class="kpi c5"><div class="lbl">Change in Orders</div>
        <div class="val ${cls(dCnt)}">${dCnt >= 0 ? '+' : '−'}${P.num(Math.abs(dCnt))}</div>
        <div class="note ${cls(dCnt)}">${pctTxt(dCnt, rowsA.length)}</div></div>` +
      `<div class="kpi c3"><div class="lbl">Avg Order Value</div>
        <div class="val">${P.money(avgB)}</div>
        <div class="note ${cls(avgB - avgA)}">vs ${P.money(avgA)}</div></div>` +
      kpiCard('c6', 'Top Brand — ' + labA, tA ? tA[0] : '—',
              tA ? P.money(tA[1]) : 'no sales') +
      kpiCard('c1', 'Top Brand — ' + labB, tB ? tB[0] : '—',
              tB ? P.money(tB[1]) : 'no sales');
  };

  /* ---------- brand table ---------- */
  P.renderBrandTable = function (elId, ranked) {
    const el = $(elId);
    if (!ranked.length) { el.innerHTML = '<tbody><tr><td class="empty">No data for the selected filters</td></tr></tbody>'; return; }
    const max = ranked[0].amt || 1;
    el.innerHTML =
      '<thead><tr><th>#</th><th>Brand</th><th class="num">Sales</th>' +
      '<th class="num">Amount</th><th class="num">Share</th><th>Distribution</th></tr></thead><tbody>' +
      ranked.map((d, i) =>
        `<tr><td>${i + 1}</td><td>${d.brand}</td>
         <td class="num">${P.num(d.cnt)}</td>
         <td class="num">${P.money(d.amt)}</td>
         <td class="num">${P.pct(d.share)}</td>
         <td><div class="bar" style="width:${Math.max(3, (d.amt / max) * 100)}%"></div></td></tr>`
      ).join('') + '</tbody>';
  };

  /* ---------- top brand banner ---------- */
  P.renderTopBrand = function (elId, ranked) {
    const el = $(elId);
    if (!ranked.length) { el.innerHTML = 'Top Brand: —'; return; }
    const t = ranked[0];
    el.innerHTML = `🏆 Top Brand: <b>${t.brand}</b> — ${P.money(t.amt)} across ` +
                   `${P.num(t.cnt)} sales (${P.pct(t.share)} of scope)`;
  };
})(window.APP);
