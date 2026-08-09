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
    const brands = P.brandRank(rows);
    const top = brands[0];
    const w = P.weekSeries(rows);
    let bestWeekIdx = -1, bestWeekVal = -1;
    w.amt.forEach((v, i) => { if (v > bestWeekVal) { bestWeekVal = v; bestWeekIdx = i; } });
    const cw = currentWeekRows(rows), cm = currentMonthRows(rows);
    const avgWeek = w.amt.length ? P.sum(rows) / w.amt.length : 0;

    $(elId).innerHTML =
      kpiCard('c1', 'Total Sales (count)', P.num(rows.length), 'Orders in scope') +
      kpiCard('c2', 'Total Sales Amount', P.money(P.sum(rows)), '') +
      kpiCard('c3', 'Current Week Sales', P.money(P.sum(cw)), P.num(cw.length) + ' orders') +
      kpiCard('c4', 'Current Month Sales', P.money(P.sum(cm)), P.num(cm.length) + ' orders') +
      kpiCard('c5', 'Average Weekly Sales', P.money(avgWeek), w.amt.length + ' active weeks') +
      kpiCard('c6', 'Best Performing Brand', top ? top.brand : '—',
              top ? P.money(top.amt) + ' • ' + P.pct(top.share) : '') +
      kpiCard('c2', 'Best Performing Week',
              bestWeekIdx >= 0 ? 'Week ' + (bestWeekIdx + 1) : '—',
              bestWeekIdx >= 0 ? w.labels[bestWeekIdx] + ' • ' + P.money(bestWeekVal) : '');
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
