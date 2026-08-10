/* ============ charts (ECharts) ============ */
(function (P) {
  const inst = {};
  const BASE_TXT = { color: '#3A3350', fontFamily: '"Segoe UI",Inter,system-ui,sans-serif' };

  function get(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (!inst[id]) inst[id] = echarts.init(el, null, { renderer: 'canvas' });
    return inst[id];
  }
  P.resizeAll = () => Object.values(inst).forEach(c => c.resize());
  window.addEventListener('resize', () => P.resizeAll());

  const tip = {
    trigger: 'axis',
    backgroundColor: '#fff',
    borderColor: '#EDE6F0',
    borderWidth: 1,
    textStyle: BASE_TXT,
    extraCssText: 'box-shadow:0 4px 18px rgba(120,100,150,.16);border-radius:10px;'
  };
  const grid = { left: 10, right: 18, bottom: 8, top: 46, containLabel: true };
  const legend = { top: 6, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { ...BASE_TXT, fontSize: 12 } };
  const axisLbl = { color: '#6A6382', fontSize: 11 };
  const splitLine = { lineStyle: { color: '#F1ECF6' } };

  function catAxis(data, rotate) {
    return { type: 'category', data, axisLabel: { ...axisLbl, rotate: rotate || 0, hideOverlap: true },
             axisLine: { lineStyle: { color: '#E5DDEC' } }, axisTick: { show: false } };
  }
  function moneyAxis(name) {
    return { type: 'value', name: name || '', nameTextStyle: { ...axisLbl },
             axisLabel: { ...axisLbl, formatter: v => '$' + (v >= 1000 ? (v / 1000) + 'k' : v) },
             splitLine };
  }
  function cntAxis(name) {
    return { type: 'value', name: name || '', nameTextStyle: { ...axisLbl },
             axisLabel: axisLbl, splitLine: { show: false } };
  }
  function empty(id) {
    const c = get(id); if (!c) return true;
    c.clear();
    c.setOption({
      title: { text: 'No data for the selected filters', left: 'center', top: 'middle',
               textStyle: { ...BASE_TXT, fontSize: 13, fontWeight: 400, color: '#9A93AE' } }
    });
    return true;
  }
  P.emptyChart = empty;

  function bar(color, name, data, extra) {
    return Object.assign({
      name, type: 'bar', data, barMaxWidth: 42,
      itemStyle: { color, borderRadius: [6, 6, 0, 0] },
      emphasis: { itemStyle: { color } },
      animationDuration: 500
    }, extra || {});
  }
  function line(color, name, data, extra) {
    return Object.assign({
      name, type: 'line', data, smooth: true, symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 3, color }, itemStyle: { color },
      animationDuration: 500
    }, extra || {});
  }
  P.bar = bar; P.line = line;

  /* ---------- overview: monthly, 3 series ---------- */
  P.chartMonthlyOverview = function (id, rows, metric) {
    const c = get(id); if (!c) return;
    const sms = P.monthSeries(P.byCh(rows, 'SMS CB'));
    const inb = P.monthSeries(P.byCh(rows, 'Inbound'));
    const all = P.monthSeries(rows);
    const k = metric === 'cnt' ? 'cnt' : 'amt';
    const fmt = k === 'cnt' ? P.num : P.money;
    if (!rows.length) return empty(id);
    c.clear();
    c.setOption({
      tooltip: { ...tip, valueFormatter: fmt },
      legend: { ...legend, data: ['SMS CB', 'Inbound', 'Combined'] },
      grid,
      xAxis: catAxis(P.MONTHS.map(m => m.slice(0, 3)), 0),
      yAxis: k === 'cnt' ? cntAxis('# of sales') : moneyAxis('Sales amount'),
      series: [
        bar(P.CH['SMS CB'], 'SMS CB', sms[k]),
        bar(P.CH['Inbound'], 'Inbound', inb[k]),
        line('#A98FE0', 'Combined', all[k], { areaStyle: { color: 'rgba(169,143,224,.10)' } })
      ]
    });
  };

  /* ---------- overview: SMS CB vs Inbound comparison ---------- */
  P.chartCompare = function (id, rows, basis) {
    const c = get(id); if (!c) return;
    if (!rows.length) return empty(id);
    let cats, smsA, inbA, smsC, inbC, rot = 0;
    if (basis === 'month') {
      cats = P.MONTHS.map(m => m.slice(0, 3));
      const a = P.monthSeries(P.byCh(rows, 'SMS CB')), b = P.monthSeries(P.byCh(rows, 'Inbound'));
      smsA = a.amt; inbA = b.amt; smsC = a.cnt; inbC = b.cnt;
    } else {
      const weeks = [...new Set(rows.map(r => r.ws))].sort();
      cats = weeks.map((w, i) => 'Week ' + (i + 1));
      const ga = P.groupSum(P.byCh(rows, 'SMS CB'), r => r.ws);
      const gb = P.groupSum(P.byCh(rows, 'Inbound'), r => r.ws);
      smsA = weeks.map(w => +((ga.get(w) || {}).amt || 0).toFixed(2));
      inbA = weeks.map(w => +((gb.get(w) || {}).amt || 0).toFixed(2));
      smsC = weeks.map(w => (ga.get(w) || {}).cnt || 0);
      inbC = weeks.map(w => (gb.get(w) || {}).cnt || 0);
      cats = weeks.map((w, i) => 'W' + (i + 1) + '\n' + P.fmtShort(w));
      rot = 0;
    }
    c.clear();
    c.setOption({
      tooltip: { ...tip },
      legend: { ...legend, data: ['SMS CB $', 'Inbound $', 'SMS CB #', 'Inbound #'] },
      grid,
      xAxis: catAxis(cats, rot),
      yAxis: [moneyAxis('Amount'), cntAxis('# sales')],
      series: [
        bar(P.CH['SMS CB'], 'SMS CB $', smsA),
        bar(P.CH['Inbound'], 'Inbound $', inbA),
        line('#F0A579', 'SMS CB #', smsC, { yAxisIndex: 1, lineStyle: { width: 2, type: 'dashed', color: '#F0A579' } }),
        line('#7FCBA6', 'Inbound #', inbC, { yAxisIndex: 1, lineStyle: { width: 2, type: 'dashed', color: '#7FCBA6' } })
      ]
    });
  };

  /* ---------- branch share donut ---------- */
  P.chartBranchShare = function (id, rows) {
    const c = get(id); if (!c) return;
    if (!rows.length) return empty(id);
    const data = ['SMS CB', 'Inbound'].map(ch => {
      const rr = P.byCh(rows, ch);
      return { name: ch, value: +P.sum(rr).toFixed(2), cnt: rr.length,
               itemStyle: { color: P.CH[ch] } };
    }).filter(d => d.value > 0 || d.cnt > 0);
    c.clear();
    c.setOption({
      tooltip: {
        trigger: 'item', backgroundColor: '#fff', borderColor: '#EDE6F0', textStyle: BASE_TXT,
        extraCssText: 'box-shadow:0 4px 18px rgba(120,100,150,.16);border-radius:10px;',
        formatter: p => `<b>${p.name}</b><br/>Amount: ${P.money(p.value)}<br/>Sales: ${P.num(p.data.cnt)}<br/>Share: ${p.percent}%`
      },
      legend: { ...legend, bottom: 0, top: 'auto' },
      series: [{
        type: 'pie', radius: ['48%', '72%'], center: ['50%', '46%'],
        avoidLabelOverlap: true, padAngle: 2,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%', color: '#3A3350', fontSize: 12 },
        emphasis: { scale: true, scaleSize: 6 },
        data
      }]
    });
  };

  /* ---------- brand horizontal bar ---------- */
  P.chartBrandBar = function (id, ranked) {
    const c = get(id); if (!c) return;
    if (!ranked.length) return empty(id);
    const top = ranked.slice(0, 12).reverse();
    c.clear();
    c.setOption({
      tooltip: {
        ...tip, trigger: 'item',
        formatter: p => {
          const d = top[p.dataIndex];
          return `<b>${d.brand}</b><br/>Amount: ${P.money(d.amt)}<br/>Sales: ${P.num(d.cnt)}<br/>Share: ${P.pct(d.share)}`;
        }
      },
      grid: { left: 10, right: 70, top: 16, bottom: 10, containLabel: true },
      xAxis: { type: 'value', axisLabel: { ...axisLbl, formatter: v => '$' + (v >= 1000 ? v / 1000 + 'k' : v) }, splitLine },
      yAxis: { type: 'category', data: top.map(d => d.brand),
               axisLabel: { ...axisLbl, width: 130, overflow: 'truncate' },
               axisLine: { show: false }, axisTick: { show: false } },
      series: [{
        type: 'bar', data: top.map((d, i) => ({ value: d.amt,
          itemStyle: { color: P.PAL[(top.length - 1 - i) % P.PAL.length], borderRadius: [0, 6, 6, 0] } })),
        barMaxWidth: 22,
        label: { show: true, position: 'right', formatter: p => P.money0(p.value), color: '#6A6382', fontSize: 11 },
        animationDuration: 500
      }]
    });
  };

  /* ---------- weekly bars for a single channel ---------- */
  P.chartWeekly = function (id, rows, color) {
    const c = get(id); if (!c) return;
    if (!rows.length) return empty(id);
    const w = P.weekSeries(rows);
    c.clear();
    c.setOption({
      tooltip: {
        ...tip,
        formatter: ps => {
          const i = ps[0].dataIndex;
          return `<b>Week ${i + 1}</b><br/>${w.labels[i]}<br/>Amount: ${P.money(w.amt[i])}<br/>Sales: ${P.num(w.cnt[i])}`;
        }
      },
      legend: { ...legend, data: ['Sales amount', '# of sales'] },
      grid,
      dataZoom: w.keys.length > 12 ? [{ type: 'slider', height: 16, bottom: 4, borderColor: 'transparent',
        fillerColor: 'rgba(169,143,224,.18)', handleStyle: { color: '#A98FE0' } }] : undefined,
      xAxis: catAxis(w.keys.map((k, i) => 'W' + (i + 1) + '\n' + P.fmtShort(k))),
      yAxis: [moneyAxis('Amount'), cntAxis('#')],
      series: [
        bar(color, 'Sales amount', w.amt),
        line('#A98FE0', '# of sales', w.cnt, { yAxisIndex: 1 })
      ]
    });
  };

  /* ---------- monthly + MoM for a single channel ---------- */
  P.chartMonthlyMoM = function (id, rows, color) {
    const c = get(id); if (!c) return;
    if (!rows.length) return empty(id);
    const m = P.monthSeries(rows);
    const mom = m.amt.map((v, i) => {
      if (i === 0) return null;
      const p = m.amt[i - 1];
      if (!p) return null;
      return +(((v - p) / p) * 100).toFixed(1);
    });
    c.clear();
    c.setOption({
      tooltip: { ...tip, valueFormatter: null },
      legend: { ...legend, data: ['Sales amount', '# of sales', 'MoM %'] },
      grid,
      xAxis: catAxis(P.MONTHS.map(x => x.slice(0, 3))),
      yAxis: [moneyAxis('Amount'),
              { type: 'value', axisLabel: { ...axisLbl, formatter: '{value}%' }, splitLine: { show: false } }],
      series: [
        bar(color, 'Sales amount', m.amt),
        line('#7FCBA6', '# of sales', m.cnt, { yAxisIndex: 1, lineStyle: { width: 2, color: '#7FCBA6' } }),
        line('#F0A579', 'MoM %', mom, { yAxisIndex: 1, connectNulls: true,
             lineStyle: { width: 2, type: 'dashed', color: '#F0A579' } })
      ]
    });
  };

  /* ---------- week vs week ---------- */
  P.chartWeekVsWeek = function (id, rowsA, rowsB, labA, labB) {
    const c = get(id); if (!c) return;
    if (!rowsA.length && !rowsB.length) return empty(id);
    const brands = [...new Set([...rowsA, ...rowsB].map(r => r.b))];
    const sumB = (rows, b) => +rows.filter(r => r.b === b)
      .reduce((a, r) => a + r.amt, 0).toFixed(2);
    const ranked = brands
      .map(b => ({ b, a: sumB(rowsA, b), c: sumB(rowsB, b) }))
      .sort((x, y) => (y.a + y.c) - (x.a + x.c))
      .slice(0, 10);
    const cats = ['SMS CB', 'Inbound', ...ranked.map(r => r.b)];
    const chSum = (rows, ch) => +rows.filter(r => r.ch === ch)
      .reduce((a, r) => a + r.amt, 0).toFixed(2);
    const dA = [chSum(rowsA, 'SMS CB'), chSum(rowsA, 'Inbound'), ...ranked.map(r => r.a)];
    const dB = [chSum(rowsB, 'SMS CB'), chSum(rowsB, 'Inbound'), ...ranked.map(r => r.c)];
    c.clear();
    c.setOption({
      tooltip: { ...tip, valueFormatter: P.money },
      legend: { ...legend, data: [labA, labB] },
      grid: { left: 10, right: 18, bottom: 8, top: 46, containLabel: true },
      xAxis: catAxis(cats, cats.some(s => s.length > 10) ? 22 : 0),
      yAxis: moneyAxis('Sales amount'),
      series: [
        bar('#E48FB1', labA, dA),
        bar('#A98FE0', labB, dB)
      ]
    });
  };

  /* ---------- month vs month ---------- */
  P.chartMonthVsMonth = function (id, rowsA, rowsB, labA, labB) {
    const c = get(id); if (!c) return;
    if (!rowsA.length && !rowsB.length) return empty(id);
    const brands = [...new Set([...rowsA, ...rowsB].map(r => r.b))];
    const sB = (rows, b) => +rows.filter(r => r.b === b)
      .reduce((a, r) => a + r.amt, 0).toFixed(2);
    const ranked = brands
      .map(b => ({ b, a: sB(rowsA, b), c: sB(rowsB, b) }))
      .sort((x, y) => (y.a + y.c) - (x.a + x.c))
      .slice(0, 10);
    const cats = ['Total', ...ranked.map(r => r.b)];
    const tot = rows => +rows.reduce((a, r) => a + r.amt, 0).toFixed(2);
    const dA = [tot(rowsA), ...ranked.map(r => r.a)];
    const dB = [tot(rowsB), ...ranked.map(r => r.c)];
    c.clear();
    c.setOption({
      tooltip: { ...tip, valueFormatter: P.money },
      legend: { ...legend, data: [labA, labB] },
      grid: { left: 10, right: 18, bottom: 8, top: 46, containLabel: true },
      xAxis: catAxis(cats, cats.some(s => s.length > 10) ? 22 : 0),
      yAxis: moneyAxis('Sales amount'),
      series: [bar('#E48FB1', labA, dA), bar('#A98FE0', labB, dB)]
    });
  };

  /* ---------- brand donut ---------- */
  P.chartBrandPie = function (id, ranked) {
    const c = get(id); if (!c) return;
    if (!ranked.length) return empty(id);
    const data = ranked.map((d, i) => ({
      name: d.brand, value: +d.amt.toFixed(2), cnt: d.cnt,
      itemStyle: { color: P.PAL[i % P.PAL.length] }
    }));
    c.clear();
    c.setOption({
      tooltip: {
        trigger: 'item', backgroundColor: '#fff', borderColor: '#EDE6F0', textStyle: BASE_TXT,
        extraCssText: 'box-shadow:0 4px 18px rgba(120,100,150,.16);border-radius:10px;',
        formatter: p => `<b>${p.name}</b><br/>Sales count: ${P.num(p.data.cnt)}<br/>Amount: ${P.money(p.value)}<br/>Percentage: ${p.percent}%`
      },
      legend: { type: 'scroll', bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10,
                textStyle: { ...BASE_TXT, fontSize: 11.5 } },
      series: [{
        type: 'pie', radius: ['46%', '70%'], center: ['50%', '44%'],
        avoidLabelOverlap: true, padAngle: 2,
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{d}%', color: '#6A6382', fontSize: 11 },
        labelLine: { length: 8, length2: 8 },
        emphasis: { scale: true, scaleSize: 6, label: { fontWeight: 700 } },
        data
      }]
    });
  };
})(window.APP);
