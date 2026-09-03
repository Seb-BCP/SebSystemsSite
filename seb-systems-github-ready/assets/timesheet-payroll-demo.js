(function () {
  'use strict';

  var days = [
    { key: 'monday', label: 'Monday', shortLabel: 'Mon', kind: 'weekday' },
    { key: 'tuesday', label: 'Tuesday', shortLabel: 'Tue', kind: 'weekday' },
    { key: 'wednesday', label: 'Wednesday', shortLabel: 'Wed', kind: 'weekday' },
    { key: 'thursday', label: 'Thursday', shortLabel: 'Thu', kind: 'weekday' },
    { key: 'friday', label: 'Friday', shortLabel: 'Fri', kind: 'weekday' },
    { key: 'saturday', label: 'Saturday', shortLabel: 'Sat', kind: 'saturday' },
    { key: 'sunday', label: 'Sunday', shortLabel: 'Sun', kind: 'sunday' }
  ];

  var clientOptions = ['Harbour Civil (demo)', 'Crestline Works (demo)', 'Northpoint Projects (demo)'];
  var classifications = [
    { name: 'Civil Labourer', payRate: 36.5, chargeRate: 57.5, industry: 'Construction' },
    { name: 'Machine Operator', payRate: 43, chargeRate: 68, industry: 'Construction' },
    { name: 'Truck Driver', payRate: 39.5, chargeRate: 62.5, industry: 'Non Construction' },
    { name: 'Trade Assistant', payRate: 34.5, chargeRate: 55, industry: 'Non Construction' }
  ];
  var workerSeeds = [
    { id: 'demo-01', client: clientOptions[0], site: 'Harbour Upgrade', worker: 'Sample Worker 01', classification: 'Civil Labourer' },
    { id: 'demo-02', client: clientOptions[1], site: 'Crestline Depot', worker: 'Sample Worker 02', classification: 'Machine Operator' },
    { id: 'demo-03', client: clientOptions[0], site: 'Harbour Upgrade', worker: 'Sample Worker 03', classification: 'Truck Driver' },
    { id: 'demo-04', client: clientOptions[2], site: 'Northpoint Estate', worker: 'Sample Worker 04', classification: 'Trade Assistant' },
    { id: 'demo-05', client: clientOptions[2], site: 'Northpoint Estate', worker: 'Sample Worker 05', classification: 'Civil Labourer', incomplete: true }
  ];

  function createReportSettings() {
    return {
      constructionOnCostPercent: 1.2115,
      nonConstructionOnCostPercent: 1.2036,
      overtimeOnCostPercent: 1.0823,
      adjustmentValue: 0,
      onCostLocks: { construction: true, nonConstruction: true, overtime: true }
    };
  }

  var rows = [];
  var resetRows = [];
  var state = {
    showSite: false,
    incompleteOnly: false,
    timesheetSearch: '',
    paysheetSearch: '',
    chargeSearch: '',
    paysheetFull: false,
    chargesFull: false,
    reportSettings: createReportSettings()
  };
  var toastTimer = null;

  var timesheetHead = document.querySelector('[data-demo-timesheet-head]');
  var timesheetBody = document.querySelector('[data-demo-timesheet-body]');
  var paysheetHead = document.querySelector('[data-demo-paysheet-head]');
  var paysheetBody = document.querySelector('[data-demo-paysheet-body]');
  var chargesHead = document.querySelector('[data-demo-charges-head]');
  var chargesBody = document.querySelector('[data-demo-charges-body]');
  var toast = document.querySelector('[data-demo-toast-region]');

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character];
    });
  }

  function money(value) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value || 0);
  }

  function number(value) {
    var parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function displayHours(value) {
    var safe = number(value);
    return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
  }

  function randomHalfHour(min, max) {
    return Math.round((min + Math.random() * (max - min)) * 2) / 2;
  }

  function getClassification(name) {
    return classifications.find(function (classification) { return classification.name === name; }) || classifications[0];
  }

  function makeSampleHours(index, incomplete) {
    var hours = {};
    if (incomplete) {
      days.forEach(function (day) { hours[day.key] = 0; });
      return hours;
    }

    days.slice(0, 5).forEach(function (day, dayIndex) {
      var base = [8, 8.5, 9.5, 8, 9][(dayIndex + index) % 5];
      hours[day.key] = Math.max(0, Math.min(14, base + randomHalfHour(-1.5, 2.5)));
    });
    hours.saturday = index === 3 || Math.random() > 0.68 ? randomHalfHour(4, 8) : 0;
    hours.sunday = Math.random() > 0.9 ? randomHalfHour(4, 7) : 0;
    return hours;
  }

  function createSampleRows() {
    return workerSeeds.map(function (seed, index) {
      var classification = getClassification(seed.classification);
      return Object.assign({}, seed, {
        payRate: classification.payRate,
        chargeRate: classification.chargeRate,
        locked: false,
        hours: makeSampleHours(index, Boolean(seed.incomplete))
      });
    });
  }

  function calculateRow(row) {
    var result = { normal: 0, timeHalf: 0, double: 0, totalHours: 0 };

    days.forEach(function (day) {
      var hours = Math.max(0, Math.min(16, number(row.hours[day.key])));
      result.totalHours += hours;

      if (day.kind === 'weekday') {
        result.normal += Math.min(hours, 7.6);
        result.timeHalf += Math.max(0, Math.min(hours - 7.6, 2));
        result.double += Math.max(0, hours - 9.6);
      } else if (day.kind === 'saturday') {
        result.timeHalf += Math.min(hours, 2);
        result.double += Math.max(0, hours - 2);
      } else {
        result.double += hours;
      }
    });

    result.normalPay = result.normal * row.payRate;
    result.timeHalfPay = result.timeHalf * row.payRate * 1.5;
    result.doublePay = result.double * row.payRate * 2;
    result.travelPay = 0;
    result.allowancePay = 0;
    result.pay = result.normalPay + result.timeHalfPay + result.doublePay + result.travelPay + result.allowancePay;
    result.normalCharge = result.normal * row.chargeRate;
    result.timeHalfCharge = result.timeHalf * row.chargeRate * 1.5;
    result.doubleCharge = result.double * row.chargeRate * 2;
    result.travelCharge = 0;
    result.allowanceCharge = 0;
    result.charge = result.normalCharge + result.timeHalfCharge + result.doubleCharge + result.travelCharge + result.allowanceCharge;
    return result;
  }

  function calculateAll() {
    return rows.map(function (row) { return Object.assign({}, row, { totals: calculateRow(row) }); });
  }

  function matchesSearch(row, query) {
    if (!query) return true;
    var normalized = query.toLowerCase();
    return [row.client, row.site, row.worker, row.classification].some(function (value) {
      return String(value || '').toLowerCase().includes(normalized);
    });
  }

  function clientOptionsMarkup(selected) {
    return clientOptions.map(function (client) {
      return '<option value="' + escapeHtml(client) + '"' + (client === selected ? ' selected' : '') + '>' + escapeHtml(client) + '</option>';
    }).join('');
  }

  function classificationOptionsMarkup(selected) {
    return classifications.map(function (classification) {
      return '<option value="' + escapeHtml(classification.name) + '"' + (classification.name === selected ? ' selected' : '') + '>' + escapeHtml(classification.name) + '</option>';
    }).join('');
  }

  function renderTimesheetHeader() {
    var header = '<tr><th class="col-lock" aria-label="Lock"></th><th class="col-client">Client</th>';
    if (state.showSite) header += '<th class="col-site">Site</th>';
    header += '<th class="col-worker">Worker</th><th class="col-classification">Classification</th>';
    days.forEach(function (day) { header += '<th class="col-day">' + day.shortLabel + '</th>'; });
    header += '<th class="col-total">Total</th><th class="col-allowances">Allowances</th><th class="col-delete">Delete</th></tr>';
    timesheetHead.innerHTML = header;
  }

  function renderTimesheetSummary() {
    var calculated = calculateAll();
    var collected = calculated.filter(function (row) { return row.totals.totalHours > 0; }).length;
    document.querySelector('[data-demo-expected-count]').textContent = String(rows.length);
    document.querySelector('[data-demo-employee-count]').textContent = String(rows.length);
    document.querySelector('[data-demo-collected-count]').textContent = collected + ' / ' + rows.length;
  }

  function renderTimesheets() {
    renderTimesheetHeader();
    var visibleRows = rows.filter(function (row) {
      var hasHours = calculateRow(row).totalHours > 0;
      return matchesSearch(row, state.timesheetSearch) && (!state.incompleteOnly || !hasHours);
    });
    var colspan = state.showSite ? 15 : 14;

    if (!visibleRows.length) {
      timesheetBody.innerHTML = '<tr><td class="demo-no-rows" colspan="' + colspan + '">No sample time sheets match these filters.</td></tr>';
      return;
    }

    timesheetBody.innerHTML = visibleRows.map(function (row) {
      var total = calculateRow(row).totalHours;
      var disabled = row.locked ? ' disabled' : '';
      var rowClass = total === 0 ? ' class="incomplete-row"' : '';
      var cells = '<tr' + rowClass + '>' +
        '<td class="col-lock"><button class="row-lock-btn' + (row.locked ? '' : ' is-unlocked') + '" type="button" data-demo-action="toggle-lock" data-row-id="' + row.id + '" aria-label="' + (row.locked ? 'Unlock row' : 'Lock row') + '">' + (row.locked ? '🔒' : '🔓') + '</button></td>' +
        '<td class="col-client"><label class="demo-visually-hidden" for="' + row.id + '-client">Client for ' + escapeHtml(row.worker) + '</label><select id="' + row.id + '-client" class="demo-cell-select" data-demo-field="client" data-row-id="' + row.id + '"' + disabled + '>' + clientOptionsMarkup(row.client) + '</select></td>';
      if (state.showSite) cells += '<td class="col-site"><label class="demo-visually-hidden" for="' + row.id + '-site">Site for ' + escapeHtml(row.worker) + '</label><input id="' + row.id + '-site" class="demo-worker-input" type="text" value="' + escapeHtml(row.site) + '" data-demo-field="site" data-row-id="' + row.id + '"' + disabled + '></td>';
      cells += '<td class="col-worker"><label class="demo-visually-hidden" for="' + row.id + '-worker">Worker</label><input id="' + row.id + '-worker" class="demo-worker-input" type="text" value="' + escapeHtml(row.worker) + '" data-demo-field="worker" data-row-id="' + row.id + '"' + disabled + '></td>' +
        '<td class="col-classification"><label class="demo-visually-hidden" for="' + row.id + '-classification">Classification for ' + escapeHtml(row.worker) + '</label><select id="' + row.id + '-classification" class="demo-cell-select" data-demo-field="classification" data-row-id="' + row.id + '"' + disabled + '>' + classificationOptionsMarkup(row.classification) + '</select></td>';
      days.forEach(function (day) {
        var inputId = row.id + '-' + day.key;
        cells += '<td class="col-day"><label class="demo-visually-hidden" for="' + inputId + '">' + day.label + ' hours for ' + escapeHtml(row.worker) + '</label><input id="' + inputId + '" class="hours-input" type="number" min="0" max="16" step="0.5" inputmode="decimal" value="' + displayHours(row.hours[day.key]) + '" data-demo-hour data-row-id="' + row.id + '" data-day="' + day.key + '"' + disabled + '></td>';
      });
      cells += '<td class="col-total total-hours" data-demo-row-total="' + row.id + '">' + displayHours(total) + '</td>' +
        '<td class="col-allowances"><button class="allowances-toggle-btn" type="button" data-demo-toast="Allowances are not included in this sample run.">0 Allowances</button></td>' +
        '<td class="col-delete"><button class="delete-btn" type="button" data-demo-action="delete-row" data-row-id="' + row.id + '" aria-label="Delete ' + escapeHtml(row.worker) + '">×</button></td></tr>';
      return cells;
    }).join('');
  }

  function outputRows(query) {
    return calculateAll().filter(function (row) { return row.totals.totalHours > 0 && matchesSearch(row, query); });
  }

  function emptyTableRow(colspan) {
    return '<tr><td class="demo-no-rows" colspan="' + colspan + '">No sample rows match this search.</td></tr>';
  }

  function renderPaySheets() {
    var results = outputRows(state.paysheetSearch);
    var totalPay = results.reduce(function (sum, row) { return sum + row.totals.pay; }, 0);
    document.querySelector('[data-demo-paysheet-entry-count]').textContent = String(results.length);
    document.querySelector('[data-demo-paysheet-employee-count]').textContent = String(results.length);
    document.querySelector('[data-demo-paysheet-wages]').textContent = money(totalPay);

    if (state.paysheetFull) {
      paysheetHead.innerHTML = '<tr><th>Worker</th><th>Classification</th><th>Normal Hours</th><th>Normal Rate</th><th>Normal Pay</th><th>T&amp;H Hours</th><th>T&amp;H Rate</th><th>T&amp;H Pay</th><th>Double Hours</th><th>Double Rate</th><th>Double Pay</th><th>Travel Total</th><th>Total Allowance</th><th>Total Pay</th></tr>';
      paysheetBody.innerHTML = results.length ? results.map(function (row) {
        var totals = row.totals;
        return '<tr><td>' + escapeHtml(row.worker) + '</td><td>' + escapeHtml(row.classification) + '</td><td>' + displayHours(totals.normal) + '</td><td>' + money(row.payRate) + '</td><td>' + money(totals.normalPay) + '</td><td>' + displayHours(totals.timeHalf) + '</td><td>' + money(row.payRate * 1.5) + '</td><td>' + money(totals.timeHalfPay) + '</td><td>' + displayHours(totals.double) + '</td><td>' + money(row.payRate * 2) + '</td><td>' + money(totals.doublePay) + '</td><td>' + money(totals.travelPay) + '</td><td>' + money(totals.allowancePay) + '</td><td class="demo-money">' + money(totals.pay) + '</td></tr>';
      }).join('') : emptyTableRow(14);
    } else {
      paysheetHead.innerHTML = '<tr><th>Worker</th><th>Classification</th><th>Normal Pay</th><th>T&amp;H Pay</th><th>Travel Total</th><th>Total Allowance</th><th>Total Pay</th></tr>';
      paysheetBody.innerHTML = results.length ? results.map(function (row) {
        var totals = row.totals;
        return '<tr><td>' + escapeHtml(row.worker) + '</td><td>' + escapeHtml(row.classification) + '</td><td>' + money(totals.normalPay) + '</td><td>' + money(totals.timeHalfPay + totals.doublePay) + '</td><td>' + money(totals.travelPay) + '</td><td>' + money(totals.allowancePay) + '</td><td class="demo-money">' + money(totals.pay) + '</td></tr>';
      }).join('') : emptyTableRow(7);
    }
  }

  function renderCharges() {
    var results = outputRows(state.chargeSearch);
    var totalCharge = results.reduce(function (sum, row) { return sum + row.totals.charge; }, 0);
    document.querySelector('[data-demo-charge-entry-count]').textContent = String(results.length);
    document.querySelector('[data-demo-charge-sales]').textContent = money(totalCharge);
    document.querySelector('[data-demo-charge-sales-gst]').textContent = money(totalCharge * 1.1);

    if (state.chargesFull) {
      chargesHead.innerHTML = '<tr><th>Client</th><th>Worker</th><th>Classification</th><th>Normal Hours</th><th>Normal Rate</th><th>Normal Charge</th><th>T&amp;H Hours</th><th>T&amp;H Rate</th><th>T&amp;H Charge</th><th>Double Hours</th><th>Double Rate</th><th>Double Charge</th><th>Travel Total</th><th>Total Allowance</th><th>Total Charge</th></tr>';
      chargesBody.innerHTML = results.length ? results.map(function (row) {
        var totals = row.totals;
        return '<tr><td>' + escapeHtml(row.client) + '</td><td>' + escapeHtml(row.worker) + '</td><td>' + escapeHtml(row.classification) + '</td><td class="charge-metric-cell">' + displayHours(totals.normal) + '</td><td class="charge-metric-cell">' + money(row.chargeRate) + '</td><td class="charge-metric-cell">' + money(totals.normalCharge) + '</td><td class="charge-metric-cell">' + displayHours(totals.timeHalf) + '</td><td class="charge-metric-cell">' + money(row.chargeRate * 1.5) + '</td><td class="charge-metric-cell">' + money(totals.timeHalfCharge) + '</td><td class="charge-metric-cell">' + displayHours(totals.double) + '</td><td class="charge-metric-cell">' + money(row.chargeRate * 2) + '</td><td class="charge-metric-cell">' + money(totals.doubleCharge) + '</td><td class="charge-metric-cell">' + money(totals.travelCharge) + '</td><td class="charge-metric-cell">' + money(totals.allowanceCharge) + '</td><td class="demo-money">' + money(totals.charge) + '</td></tr>';
      }).join('') : emptyTableRow(15);
    } else {
      chargesHead.innerHTML = '<tr><th>Client</th><th>Worker</th><th>Classification</th><th>Normal Charge</th><th>T&amp;H Charge</th><th>Travel Total</th><th>Total Allowance</th><th>Total Charge</th></tr>';
      chargesBody.innerHTML = results.length ? results.map(function (row) {
        var totals = row.totals;
        return '<tr><td>' + escapeHtml(row.client) + '</td><td>' + escapeHtml(row.worker) + '</td><td>' + escapeHtml(row.classification) + '</td><td class="charge-metric-cell">' + money(totals.normalCharge) + '</td><td class="charge-metric-cell">' + money(totals.timeHalfCharge + totals.doubleCharge) + '</td><td class="charge-metric-cell">' + money(totals.travelCharge) + '</td><td class="charge-metric-cell">' + money(totals.allowanceCharge) + '</td><td class="demo-money">' + money(totals.charge) + '</td></tr>';
      }).join('') : emptyTableRow(8);
    }
  }

  function setReportValue(attribute, value) {
    var element = document.querySelector('[data-demo-report-' + attribute + ']');
    if (element) element.textContent = value;
  }

  function formatReportWeekEnding() {
    var value = document.querySelector('[data-demo-week-ending]').value;
    if (!value) return 'Week ending —';
    var date = new Date(value + 'T12:00:00');
    return 'Week ending ' + new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function calculateReportData() {
    var totalHours = 0;
    var totalWages = 0;
    var normalConstructionWages = 0;
    var normalNonConstructionWages = 0;
    var overtimeWages = 0;
    var totalCharge = 0;

    calculateAll().forEach(function (row) {
      var totals = row.totals;
      var classification = getClassification(row.classification);
      var normalBundle = totals.normalPay + totals.travelPay + totals.allowancePay;

      totalHours += totals.totalHours;
      totalWages += totals.pay;
      totalCharge += totals.charge;
      overtimeWages += totals.timeHalfPay + totals.doublePay;

      if (classification.industry === 'Construction') {
        normalConstructionWages += normalBundle;
      } else {
        normalNonConstructionWages += normalBundle;
      }
    });

    var settings = state.reportSettings;
    var menOut = totalHours > 0 ? totalHours / 38 : 0;
    var gst = totalCharge * 0.1;
    var grossSales = totalCharge + gst;
    var constructionWoc = normalConstructionWages * settings.constructionOnCostPercent;
    var nonConstructionWoc = normalNonConstructionWages * settings.nonConstructionOnCostPercent;
    var overtimeWoc = overtimeWages * settings.overtimeOnCostPercent;
    var totalWoc = constructionWoc + nonConstructionWoc + overtimeWoc;
    var grossProfit = totalCharge - totalWoc + settings.adjustmentValue;

    return {
      totalHours: totalHours,
      menOut: menOut,
      totalWages: totalWages,
      normalConstructionWages: normalConstructionWages,
      normalNonConstructionWages: normalNonConstructionWages,
      overtimeWages: overtimeWages,
      constructionPercentage: totalWages > 0 && grossSales > 0 ? (normalConstructionWages / totalWages) * 100 : 0,
      nonConstructionPercentage: totalWages > 0 && grossSales > 0 ? (normalNonConstructionWages / totalWages) * 100 : 0,
      totalCharge: totalCharge,
      gst: gst,
      grossSales: grossSales,
      constructionWoc: constructionWoc,
      nonConstructionWoc: nonConstructionWoc,
      overtimeWoc: overtimeWoc,
      totalWoc: totalWoc,
      grossProfit: grossProfit,
      profitPerMan: menOut > 0 ? grossProfit / menOut : 0
    };
  }

  function renderReports() {
    var report = calculateReportData();
    setReportValue('week-ending', formatReportWeekEnding());
    setReportValue('total-hours', report.totalHours.toFixed(2));
    setReportValue('men-out', report.menOut.toFixed(1));
    setReportValue('total-wages', money(report.totalWages));
    setReportValue('normal-construction', money(report.normalConstructionWages));
    setReportValue('normal-non-construction', money(report.normalNonConstructionWages));
    setReportValue('overtime-wages', money(report.overtimeWages));
    setReportValue('construction-percent', report.constructionPercentage.toFixed(1) + '%');
    setReportValue('non-construction-percent', report.nonConstructionPercentage.toFixed(1) + '%');
    setReportValue('construction-woc', money(report.constructionWoc));
    setReportValue('non-construction-woc', money(report.nonConstructionWoc));
    setReportValue('overtime-woc', money(report.overtimeWoc));
    setReportValue('total-woc', money(report.totalWoc));
    setReportValue('total-charge', money(report.totalCharge));
    setReportValue('gst', money(report.gst));
    setReportValue('gross-sales', money(report.grossSales));
    setReportValue('gross-profit', money(report.grossProfit));
    setReportValue('profit-per-man', money(report.profitPerMan));
  }

  function syncReportControls() {
    document.querySelectorAll('[data-demo-report-control]').forEach(function (input) {
      input.value = String(state.reportSettings[input.getAttribute('data-demo-report-control')]);
    });
    document.querySelectorAll('[data-demo-on-cost-lock]').forEach(function (button) {
      var type = button.getAttribute('data-demo-on-cost-lock');
      var locked = state.reportSettings.onCostLocks[type] !== false;
      var label = type === 'nonConstruction' ? 'non-construction' : type;
      button.textContent = locked ? '🔒' : '🔓';
      button.classList.toggle('is-unlocked', !locked);
      button.setAttribute('aria-label', (locked ? 'Unlock ' : 'Lock ') + label + ' on cost');
      button.setAttribute('title', (locked ? 'Unlock ' : 'Lock ') + label + ' on cost');
      button.previousElementSibling.disabled = locked;
    });
  }

  function renderAll() {
    renderTimesheetSummary();
    renderTimesheets();
    renderPaySheets();
    renderCharges();
    renderReports();
  }

  function findRow(id) {
    return rows.find(function (row) { return row.id === id; });
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 3200);
  }

  function resetDemo(message) {
    rows = clone(resetRows);
    state.showSite = false;
    state.incompleteOnly = false;
    state.timesheetSearch = '';
    state.paysheetSearch = '';
    state.chargeSearch = '';
    state.paysheetFull = false;
    state.chargesFull = false;
    state.reportSettings = createReportSettings();
    document.querySelector('[data-demo-timesheet-search]').value = '';
    document.querySelector('[data-demo-paysheet-search]').value = '';
    document.querySelector('[data-demo-charge-search]').value = '';
    document.querySelector('[data-demo-incomplete-filter]').checked = false;
    document.querySelector('[data-demo-toggle-site]').textContent = 'Show Site';
    document.querySelector('[data-demo-toggle-paysheet-full]').textContent = 'See full table';
    document.querySelector('[data-demo-toggle-charges-full]').textContent = 'See full table';
    syncReportControls();
    renderAll();
    showToast(message);
  }

  timesheetBody.addEventListener('input', function (event) {
    var input = event.target;
    var row = findRow(input.getAttribute('data-row-id'));
    if (!row) return;

    if (input.matches('[data-demo-hour]')) {
      var safeHours = Math.max(0, Math.min(16, number(input.value)));
      row.hours[input.getAttribute('data-day')] = safeHours;
      input.value = displayHours(safeHours);
      var totalCell = document.querySelector('[data-demo-row-total="' + row.id + '"]');
      if (totalCell) totalCell.textContent = displayHours(calculateRow(row).totalHours);
      renderTimesheetSummary();
      renderPaySheets();
      renderCharges();
      renderReports();
    } else if (input.matches('[data-demo-field="worker"], [data-demo-field="site"]')) {
      row[input.getAttribute('data-demo-field')] = input.value;
      renderPaySheets();
      renderCharges();
    }
  });

  timesheetBody.addEventListener('change', function (event) {
    var field = event.target.getAttribute('data-demo-field');
    if (!field) return;
    var row = findRow(event.target.getAttribute('data-row-id'));
    if (!row) return;

    if (field === 'classification') {
      var classification = getClassification(event.target.value);
      row.classification = classification.name;
      row.payRate = classification.payRate;
      row.chargeRate = classification.chargeRate;
      renderPaySheets();
      renderCharges();
      renderReports();
    } else if (field === 'client') {
      row.client = event.target.value;
      renderPaySheets();
      renderCharges();
    }
  });

  timesheetBody.addEventListener('click', function (event) {
    var toastButton = event.target.closest('[data-demo-toast]');
    if (toastButton) {
      showToast(toastButton.getAttribute('data-demo-toast'));
      return;
    }
    var actionButton = event.target.closest('[data-demo-action]');
    if (!actionButton) return;
    var row = findRow(actionButton.getAttribute('data-row-id'));
    if (!row) return;
    if (actionButton.getAttribute('data-demo-action') === 'toggle-lock') {
      row.locked = !row.locked;
      renderTimesheets();
      showToast(row.locked ? 'Sample row locked.' : 'Sample row unlocked.');
    }
    if (actionButton.getAttribute('data-demo-action') === 'delete-row') {
      rows = rows.filter(function (candidate) { return candidate.id !== row.id; });
      renderAll();
      showToast('Sample row removed. Reset the demo to restore it.');
    }
  });

  document.querySelector('[data-demo-timesheet-search]').addEventListener('input', function (event) {
    state.timesheetSearch = event.target.value;
    renderTimesheets();
  });
  document.querySelector('[data-demo-paysheet-search]').addEventListener('input', function (event) {
    state.paysheetSearch = event.target.value;
    renderPaySheets();
  });
  document.querySelector('[data-demo-charge-search]').addEventListener('input', function (event) {
    state.chargeSearch = event.target.value;
    renderCharges();
  });
  document.querySelector('[data-demo-incomplete-filter]').addEventListener('change', function (event) {
    state.incompleteOnly = event.target.checked;
    renderTimesheets();
  });
  document.querySelector('[data-demo-toggle-site]').addEventListener('click', function (event) {
    state.showSite = !state.showSite;
    event.currentTarget.textContent = state.showSite ? 'Hide Site' : 'Show Site';
    renderTimesheets();
  });
  document.querySelector('[data-demo-toggle-paysheet-full]').addEventListener('click', function (event) {
    state.paysheetFull = !state.paysheetFull;
    event.currentTarget.textContent = state.paysheetFull ? 'Show compact table' : 'See full table';
    renderPaySheets();
  });
  document.querySelector('[data-demo-toggle-charges-full]').addEventListener('click', function (event) {
    state.chargesFull = !state.chargesFull;
    event.currentTarget.textContent = state.chargesFull ? 'Show compact table' : 'See full table';
    renderCharges();
  });
  document.querySelector('[data-demo-randomise]').addEventListener('click', function () {
    rows = createSampleRows();
    resetRows = clone(rows);
    renderAll();
    showToast('New fictional sample week loaded.');
  });
  document.querySelector('[data-demo-reset]').addEventListener('click', function () {
    resetDemo('Demo reset.');
  });
  document.querySelector('[data-demo-week-ending]').addEventListener('change', function (event) {
    renderReports();
    showToast('Demo week ending set to ' + event.target.value + '.');
  });
  document.querySelectorAll('[data-demo-report-control]').forEach(function (input) {
    input.addEventListener('change', function (event) {
      var field = event.currentTarget.getAttribute('data-demo-report-control');
      var value = Math.max(0, number(event.currentTarget.value));
      state.reportSettings[field] = value;
      event.currentTarget.value = String(value);
      renderReports();
      showToast(field === 'adjustmentValue' ? 'Report adjustment updated.' : 'On cost updated for this demo.');
    });
  });
  document.querySelectorAll('[data-demo-on-cost-lock]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      var type = event.currentTarget.getAttribute('data-demo-on-cost-lock');
      var locked = state.reportSettings.onCostLocks[type] !== false;
      state.reportSettings.onCostLocks[type] = !locked;
      syncReportControls();
      showToast(locked ? 'On cost unlocked for this demo.' : 'On cost locked.');
    });
  });
  document.querySelectorAll('[data-demo-toast]').forEach(function (button) {
    button.addEventListener('click', function () { showToast(button.getAttribute('data-demo-toast')); });
  });

  rows = createSampleRows();
  resetRows = clone(rows);
  syncReportControls();
  renderAll();
}());
