// app.js — LV Spices Employee Personal Hygiene Register
// Label Maker style UI — Monthly grid + daily auto-fill + weekly random X

// ──────────────────────────────────────────────────────────────────────────────
// EMPLOYEES
// ──────────────────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  "Rajesh Sharma", "Mukesh Vora", "Vinod Singh", "Vishal Chaturvedi",
  "Golu Yadav", "Mahesh", "Rajkumar", "Pratap", "Suraj", "Suchitra", "Anil"
];

// Corrective actions per category
const CORRECTIVE_ACTIONS = {
  uniform: ["Advised to wear clean and ironed uniform", "Employee reminded — uniform changed before starting work", "Counselled about uniform hygiene standards"],
  hygiene: ["Advised to wash hands properly with soap before starting", "Employee reminded about hand hygiene protocol", "Demonstrated proper handwashing technique"],
  nails:   ["Advised to trim nails and remove nail paint", "Employee reminded — nails trimmed before next shift", "Nails inspected and trimmed on spot"],
  health:  ["Employee advised to consult doctor", "Mild fever noted — employee sent home for rest", "Employee recovering — restricted from direct food contact"],
};

// ──────────────────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────────────────
const now = new Date();
let currentMonth = now.getMonth() + 1;  // 1-12
let currentYear  = now.getFullYear();
let currentDay   = now.toISOString().split('T')[0];
let currentView  = 'monthly';

// ──────────────────────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function formatMonthYear(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
function getWeekNum(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - start) / 86400000) + start.getDay() + 1) / 7);
}
function todayStr() {
  return new Date().toISOString().split('T')[0];
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ──────────────────────────────────────────────────────────────────────────────
// AUTO-FILL LOGIC
// ──────────────────────────────────────────────────────────────────────────────
function shouldHaveIssue(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const weekNum = getWeekNum(dateString);
  const year = d.getFullYear();
  // Issues on Mondays only, alternate weeks
  const day = d.getDay();
  return day === 1 && weekNum % 2 === 0;
}

function getIssueEmployee(dateString) {
  const weekNum = getWeekNum(dateString);
  const year = new Date(dateString + 'T00:00:00').getFullYear();
  // Deterministic selection — skip Mukesh Vora (he's checker)
  const eligible = EMPLOYEES.filter(e => e !== 'Mukesh Vora');
  const idx = (weekNum + year) % eligible.length;
  return eligible[idx];
}

function getIssueCategory(dateString) {
  const weekNum = getWeekNum(dateString);
  const categories = ['uniform', 'hygiene', 'nails', 'health'];
  return categories[weekNum % categories.length];
}

function buildDayData(dateString) {
  // Future dates — no data
  if (dateString > todayStr()) return null;

  const hasIssue = shouldHaveIssue(dateString);
  const issueEmp = hasIssue ? getIssueEmployee(dateString) : null;
  const issueCat = hasIssue ? getIssueCategory(dateString) : null;
  const correctives = hasIssue ? CORRECTIVE_ACTIONS[issueCat] : null;
  const weekNum = getWeekNum(dateString);
  const corrAction = correctives ? correctives[weekNum % correctives.length] : '';

  return EMPLOYEES.map(name => {
    const isIssueEmp = hasIssue && name === issueEmp;
    return {
      name,
      uniform: isIssueEmp && issueCat === 'uniform' ? 'FAIL' : 'OK',
      hygiene: isIssueEmp && issueCat === 'hygiene' ? 'FAIL' : 'OK',
      nails:   isIssueEmp && issueCat === 'nails'   ? 'FAIL' : 'OK',
      health:  isIssueEmp && issueCat === 'health'  ? 'FAIL' : 'OK',
      corrective: isIssueEmp ? corrAction : '',
      checkedBy: 'Mukesh Vora',
    };
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE
// ──────────────────────────────────────────────────────────────────────────────
const LS_KEY = 'lv_employee_hygiene';

function loadDay(dateString) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return all[dateString] || null;
  } catch { return null; }
}

function saveDay(dateString, rows) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[dateString] = rows;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch(e) { console.error(e); }
}

function getDayData(dateString) {
  return loadDay(dateString) || buildDayData(dateString);
}

function getAllSavedDates() {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return Object.keys(all).sort().reverse();
  } catch { return []; }
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER — MONTHLY GRID
// ──────────────────────────────────────────────────────────────────────────────
let monthlyData = {}; // dateStr -> rows

function renderMonthly() {
  const totalDays = daysInMonth(currentYear, currentMonth);
  const today = todayStr();
  
  document.getElementById('period-display').textContent = formatMonthYear(currentYear, currentMonth);
  document.getElementById('rh-month').textContent = formatMonthYear(currentYear, currentMonth);
  document.getElementById('side-month-days').textContent = totalDays;

  // Build data for all days up to today
  monthlyData = {};
  const pastDays = [];
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    if (ds <= today) {
      monthlyData[ds] = getDayData(ds);
      pastDays.push(d);
    }
  }

  // Build grid table
  const table = document.getElementById('monthly-grid');
  
  // Header — dates (show all days of month, grey future)
  let headerHtml = `<thead><tr>
    <th class="name-col">Employee</th>`;
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    const dow = new Date(ds + 'T00:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isToday = ds === today;
    const isFuture = ds > today;
    headerHtml += `<th class="${isToday ? 'today-col day-col-header' : 'day-col-header'} ${isWeekend ? 'weekend' : ''}" style="${isFuture ? 'opacity:.35' : ''}">${d}</th>`;
  }
  headerHtml += `</tr></thead>`;

  // Body — rows per employee
  let bodyHtml = '<tbody>';
  let totalOk = 0, totalFail = 0;
  const issuesList = [];

  EMPLOYEES.forEach(name => {
    let hasIssue = false;
    bodyHtml += `<tr class="${hasIssue ? 'row-has-issue' : ''}"><td class="name-col">${name}</td>`;
    
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(currentYear, currentMonth, d);
      const isFuture = ds > today;
      
      if (isFuture) {
        bodyHtml += `<td style="opacity:.2; color:#ccc">—</td>`;
        continue;
      }

      const rows = monthlyData[ds] || [];
      const empRow = rows.find(r => r.name === name);
      
      if (!empRow) {
        bodyHtml += `<td>—</td>`;
        continue;
      }

      // Check if any field is FAIL
      const fields = ['uniform', 'hygiene', 'nails', 'health'];
      const failField = fields.find(f => empRow[f] === 'FAIL');
      
      if (failField) {
        hasIssue = true;
        totalFail++;
        bodyHtml += `<td class="cell-fail" title="${failField}">✗</td>`;
        issuesList.push({ date: ds, emp: name, cat: failField, action: empRow.corrective });
      } else {
        totalOk++;
        bodyHtml += `<td class="cell-ok">✓</td>`;
      }
    }
    bodyHtml += `</tr>`;
  });
  bodyHtml += '</tbody>';

  table.innerHTML = headerHtml + bodyHtml;

  // Stats
  renderStatPills(totalOk, totalFail, pastDays.length * EMPLOYEES.length);
  renderIssuesBlock(issuesList);
}

function renderStatPills(ok, fail, total) {
  document.getElementById('stat-pills').innerHTML = `
    <div class="stat-pill ok"><div class="stat-pill-num">${ok}</div><div class="stat-pill-label">OK Entries</div></div>
    <div class="stat-pill issues"><div class="stat-pill-num">${fail}</div><div class="stat-pill-label">Issues</div></div>
    <div class="stat-pill total"><div class="stat-pill-num">${total}</div><div class="stat-pill-label">Total Checks</div></div>
  `;
}

function renderIssuesBlock(issuesList) {
  const block = document.getElementById('issues-block');
  const tbody = document.getElementById('issues-body');
  
  if (issuesList.length === 0) {
    block.style.display = 'none';
    return;
  }
  block.style.display = '';
  
  const catLabels = { uniform: 'Clean Uniform', hygiene: 'Hand Hygiene', nails: 'Nails / Hair', health: 'Health Status' };
  tbody.innerHTML = issuesList.map(issue => `
    <tr>
      <td>${new Date(issue.date + 'T00:00:00').toLocaleDateString('en-IN', {day:'2-digit',month:'short'})}</td>
      <td><strong>${issue.emp}</strong></td>
      <td>${catLabels[issue.cat] || issue.cat}</td>
      <td>${issue.action || '—'}</td>
      <td>Mukesh Vora</td>
    </tr>
  `).join('');
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER — DAILY TABLE
// ──────────────────────────────────────────────────────────────────────────────
let dailyRows = [];

function renderDaily(dateString) {
  currentDay = dateString;
  dailyRows = getDayData(dateString) || EMPLOYEES.map(name => ({
    name, uniform:'OK', hygiene:'OK', nails:'OK', health:'OK', corrective:'', checkedBy:'Mukesh Vora'
  }));

  document.getElementById('daily-date-display').textContent = 
    new Date(dateString + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  document.getElementById('daily-date-title').textContent =
    new Date(dateString + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }).toUpperCase();

  const tbody = document.getElementById('daily-body');
  tbody.innerHTML = '';

  dailyRows.forEach((row, i) => {
    const hasIssue = ['uniform','hygiene','nails','health'].some(f => row[f] === 'FAIL');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="emp-num">${i+1}</div></td>
      <td style="font-weight:600;font-size:13px">${row.name}</td>
      ${['uniform','hygiene','nails','health'].map(field => `
        <td>
          <div class="status-grp">
            <button class="s-btn ${row[field]==='OK'?'ok-active':''}" onclick="setEmpStatus(${i},'${field}','OK')">✓</button>
            <button class="s-btn ${row[field]==='FAIL'?'fail-active':''}" onclick="setEmpStatus(${i},'${field}','FAIL')">✗</button>
            <button class="s-btn ${row[field]==='NA'?'na-active':''}" onclick="setEmpStatus(${i},'${field}','NA')">NA</button>
          </div>
        </td>
      `).join('')}
      <td><input class="corrective-input" value="${row.corrective}" placeholder="${hasIssue ? 'Enter corrective action...' : ''}" onchange="setEmpField(${i},'corrective',this.value)" /></td>
      <td style="font-size:11.5px;color:var(--muted)">Mukesh Vora</td>
    `;
    tbody.appendChild(tr);
  });
}

window.setEmpStatus = function(idx, field, val) {
  dailyRows[idx][field] = val;
  renderDaily(currentDay);
};
window.setEmpField = function(idx, field, val) {
  dailyRows[idx][field] = val;
};

// ──────────────────────────────────────────────────────────────────────────────
// NAV ACTIONS
// ──────────────────────────────────────────────────────────────────────────────
window.changePeriod = function(delta) {
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
  renderMonthly();
};

window.changeDay = function(delta) {
  const d = new Date(currentDay + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const ns = d.toISOString().split('T')[0];
  if (ns > todayStr()) { showToast("Can't go to future", 'error'); return; }
  renderDaily(ns);
};

window.saveData = function() {
  if (currentView === 'monthly') {
    Object.keys(monthlyData).forEach(ds => {
      if (monthlyData[ds]) saveDay(ds, monthlyData[ds]);
    });
    showToast('Month data saved!', 'success');
  } else if (currentView === 'daily') {
    saveDay(currentDay, dailyRows);
    showToast('Day saved!', 'success');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// HISTORY
// ──────────────────────────────────────────────────────────────────────────────
function populateHistoryFilters() {
  const mSel = document.getElementById('hist-month-sel');
  const ySel = document.getElementById('hist-year-sel');
  const n = new Date();
  mSel.innerHTML = MONTHS.map((m, i) =>
    `<option value="${i+1}" ${i === n.getMonth() ? 'selected' : ''}>${m}</option>`
  ).join('');
  ySel.innerHTML = [n.getFullYear()-1, n.getFullYear()].map(y =>
    `<option value="${y}" ${y === n.getFullYear() ? 'selected' : ''}>${y}</option>`
  ).join('');
}

window.renderHistoryList = function() {
  const month = parseInt(document.getElementById('hist-month-sel').value);
  const year  = parseInt(document.getElementById('hist-year-sel').value);
  const totalDays = daysInMonth(year, month);
  const today = todayStr();
  let issues = 0, ok = 0, daysWithData = 0;

  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(year, month, d);
    if (ds > today) continue;
    const rows = getDayData(ds) || [];
    if (rows.length) {
      daysWithData++;
      rows.forEach(r => {
        ['uniform','hygiene','nails','health'].forEach(f => {
          if (r[f] === 'FAIL') issues++;
          else if (r[f] === 'OK') ok++;
        });
      });
    }
  }

  const container = document.getElementById('history-list-container');
  container.innerHTML = daysWithData === 0
    ? `<div style="text-align:center;padding:40px;color:var(--muted)">No data for this period.</div>`
    : `<div class="hist-month-card" onclick="goToMonth(${year},${month})">
        <div class="hist-card-left">
          <h4>${MONTHS[month-1]} ${year}</h4>
          <p>${daysWithData} days tracked · ${ok} OK entries · ${issues} issues</p>
        </div>
        <span class="hist-badge ${issues > 0 ? 'issues' : 'ok'}">${issues > 0 ? `${issues} Issues` : 'All Clear'}</span>
      </div>`;
};

window.goToMonth = function(year, month) {
  currentYear = year; currentMonth = month;
  switchView('monthly');
};

// ──────────────────────────────────────────────────────────────────────────────
// VIEW SWITCHING
// ──────────────────────────────────────────────────────────────────────────────
window.switchView = function(view) {
  currentView = view;
  document.querySelectorAll('.side-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');
  document.getElementById('view-monthly').style.display = view === 'monthly' ? '' : 'none';
  document.getElementById('view-daily').style.display   = view === 'daily'   ? '' : 'none';
  document.getElementById('view-history').style.display = view === 'history' ? '' : 'none';

  if (view === 'monthly') renderMonthly();
  else if (view === 'daily') renderDaily(currentDay);
  else if (view === 'history') { populateHistoryFilters(); renderHistoryList(); }
};

// ──────────────────────────────────────────────────────────────────────────────
// CLOCK
// ──────────────────────────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  document.getElementById('top-date').textContent = n.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  document.getElementById('top-time').textContent = n.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}
setInterval(updateClock, 1000);
updateClock();

// ──────────────────────────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const t = document.createElement('div');
  t.className = `toast-item ${type}`;
  t.textContent = msg;
  stack.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ──────────────────────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────────────────────
function init() {
  renderMonthly();
  populateHistoryFilters();
}
init();
