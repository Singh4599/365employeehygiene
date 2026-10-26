// app.js — L V Spices Employee Personal Hygiene Record
// FSSAI Schedule 4 GMP Compliance & Daily Employee Hygiene Tracking with Firestore Cloud Sync

import { saveEmployeeDayToCloud, loadEmployeeDayFromCloud, loadAllEmployeeRecordsFromCloud, updateCloudBadge } from './firebase-config.js';

// ──────────────────────────────────────────────────────────────────────────────
// EMPLOYEES & DEFAULT LIST
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYEES = [
  "Bhimlal Sharma", "Mukesh Vora", "Vinod Singh", "Vishal Chaturvedi",
  "Shiveshankar Yadav", "Mahesh", "Rajkumar", "Sanvaldas", "Suraj", "Suchitra", "Anil"
];

export function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Audit Date Bounds: Strictly April 1, 2026 to dynamic current day
export const MIN_DATE = "2026-04-01";
export const MAX_DATE = getTodayStr();

// ──────────────────────────────────────────────────────────────────────────────
// REGULAR DEFICIENCIES SCHEDULE (Every 8-10 Days across April - October 2026)
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYEE_DEFICIENCIES = {
  "2026-04-08": { badEmp: "Suraj",             field: "gloves",  text: "Hand gloves torn during sorting, discarded & sterile pair issued before shift" },
  "2026-04-16": { badEmp: "Sanvaldas",            field: "headCap", text: "Hair strands protruding from cap, replaced with fresh elastic head cap" },
  "2026-04-25": { badEmp: "Mahesh",            field: "uniform", text: "Uniform apron stained with spice blend, fresh clean apron provided" },
  "2026-05-04": { badEmp: "Shiveshankar Yadav",        field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-05-13": { badEmp: "Suchitra",          field: "gloves",  text: "Gloves had minor puncture, replaced immediately with fresh nitrile pair" },
  "2026-05-22": { badEmp: "Anil",              field: "headCap", text: "Head cap missing at morning lineup, sterile head cap issued before entry" },
  "2026-05-30": { badEmp: "Vinod Singh",        field: "uniform", text: "Apron strap loose, replaced with fresh clean apron before packing" },
  "2026-06-08": { badEmp: "Rajkumar",          field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-06-17": { badEmp: "Suraj",             field: "gloves",  text: "Gloves worn out, replaced with food-grade nitrile gloves" },
  "2026-06-26": { badEmp: "Sanvaldas",            field: "headCap", text: "Head cap worn improperly, repositioned and hair completely enclosed" },
  "2026-07-05": { badEmp: "Vishal Chaturvedi", field: "uniform", text: "Uniform soiled, replacement clean apron provided" },
  "2026-07-14": { badEmp: "Mahesh",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-07-23": { badEmp: "Shiveshankar Yadav",        field: "gloves",  text: "Hand gloves torn, discarded & sterile pair issued before shift" },
  "2026-08-02": { badEmp: "Suchitra",          field: "headCap", text: "Head cap loose, replaced with secure elastic cap before cleanroom entry" },
  "2026-08-11": { badEmp: "Anil",              field: "uniform", text: "Uniform apron stained, fresh clean apron provided" },
  "2026-08-20": { badEmp: "Sanvaldas",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-08-29": { badEmp: "Suraj",             field: "gloves",  text: "Hand gloves replaced with sterile pair before food handling" },
  "2026-09-07": { badEmp: "Rajkumar",          field: "headCap", text: "Head cap replaced with fresh clean cap before line startup" },
  "2026-09-16": { badEmp: "Vinod Singh",        field: "uniform", text: "Apron soiled during batch prep, clean attire verified" },
  "2026-09-25": { badEmp: "Mahesh",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before entry" },
  "2026-10-04": { badEmp: "Sanvaldas",            field: "gloves",  text: "Hand gloves torn during spice handling, sterile pair issued" },
  "2026-10-12": { badEmp: "Suraj",             field: "headCap", text: "Head cap misplaced, replacement hairnet/head cap issued before shift" },
  "2026-10-18": { badEmp: "Anil",              field: "uniform", text: "Uniform apron stained with turmeric, fresh clean apron issued immediately" }
};

// ──────────────────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────────────────
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentDay = getTodayStr();
let currentView = 'daily';
let allEmployeeRecords = {}; // dateStr -> rows
let hasUnsavedChanges = false;
let currentUnit = 'unit11'; // 'unit11' or 'unit12'

// ──────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────────────────────────────
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function formatMonthYear(year, month) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDateDisplay(dateString) {
  const [y, m, d] = dateString.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthName(monthNum) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[monthNum - 1] || "";
}

export function normalizeEmployeeRow(r, ds) {
  return {
    date: r.date || ds,
    name: r.name,
    uniform: r.uniform || "OK",
    gloves: r.gloves || "OK",
    headCap: r.headCap || "OK",
    hygiene: r.hygiene || "OK",
    nails: r.nails || "OK",
    health: r.health || "OK",
    corrective: r.corrective || "",
    checkedBy: r.checkedBy || "Mukesh Vora"
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// HISTORICAL PRE-POPULATION (APRIL - OCTOBER 19, 2026)
// ──────────────────────────────────────────────────────────────────────────────
function pregenerateHistoricalData() {
  const months = [
    { m: 4, days: 30 },
    { m: 5, days: 31 },
    { m: 6, days: 30 },
    { m: 7, days: 31 },
    { m: 8, days: 31 },
    { m: 9, days: 30 },
    { m: 10, days: 31 },
    { m: 11, days: 30 },
    { m: 12, days: 31 }
    // Dynamic cap handled by MAX_DATE check above
  ];

  for (const mInfo of months) {
    for (let day = 1; day <= mInfo.days; day++) {
      const ds = dateStr(2026, mInfo.m, day);
      if (ds > MAX_DATE || ds < MIN_DATE) continue;

      if (!allEmployeeRecords[ds]) {
        const local = localStorage.getItem(`lv_emp_${ds}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            const rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);
            allEmployeeRecords[ds] = rows.map(r => normalizeEmployeeRow(r, ds));
            continue;
          } catch(e) {}
        }

        const def = EMPLOYEE_DEFICIENCIES[ds] || null;

        const rows = EMPLOYEES.map(emp => {
          let uniform = "OK";
          let gloves = "OK";
          let headCap = "OK";
          let hygiene = "OK";
          let nails = "OK";
          let health = "OK";
          let corrective = "";

          if (def && emp === def.badEmp) {
            if (def.field === 'gloves') gloves = "X";
            else if (def.field === 'headCap') headCap = "X";
            else if (def.field === 'nails') nails = "X";
            else uniform = "X";
            corrective = def.text;
          }

          return {
            date: ds,
            name: emp,
            uniform: uniform,
            gloves: gloves,
            headCap: headCap,
            hygiene: hygiene,
            nails: nails,
            health: health,
            corrective: corrective,
            checkedBy: "Mukesh Vora"
          };
        });

        allEmployeeRecords[ds] = rows;
        localStorage.setItem(`lv_emp_${ds}`, JSON.stringify(rows));
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// DEFAULT DAY GENERATOR
// ──────────────────────────────────────────────────────────────────────────────
function createDefaultDay(ds) {
  return EMPLOYEES.map(emp => ({
    date: ds,
    name: emp,
    uniform: "OK",
    gloves: "OK",
    headCap: "OK",
    hygiene: "OK",
    nails: "OK",
    health: "OK",
    corrective: "",
    checkedBy: "Mukesh Vora"
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// LOAD DAY RECORD
// ──────────────────────────────────────────────────────────────────────────────
export async function loadDay(dateString) {
  // Enforce strict date boundaries: April 1, 2026 <= date <= October 19, 2026
  if (dateString > MAX_DATE) dateString = MAX_DATE;
  if (dateString < MIN_DATE) dateString = MIN_DATE;

  currentDay = dateString;
  const [y, m, d] = dateString.split('-');
  currentYear = parseInt(y);
  currentMonth = parseInt(m);

  // 1. In-memory
  let rows = allEmployeeRecords[dateString];

  // 2. LocalStorage
  if (!rows) {
    const local = localStorage.getItem(`lv_emp_${dateString}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        rows = Array.isArray(parsed) ? parsed : (parsed.rows || null);
        if (rows) {
          rows = rows.map(r => normalizeEmployeeRow(r, dateString));
          allEmployeeRecords[dateString] = rows;
        }
      } catch (e) {}
    }
  }

  // 3. Cloud Firestore
  if (!rows) {
    const cloud = await loadEmployeeDayFromCloud(dateString);
    if (cloud && cloud.rows) {
      rows = cloud.rows.map(r => normalizeEmployeeRow(r, dateString));
      allEmployeeRecords[dateString] = rows;
      localStorage.setItem(`lv_emp_${dateString}`, JSON.stringify(rows));
    }
  }

  // 4. Default compliant
  if (!rows) {
    rows = createDefaultDay(dateString);
    allEmployeeRecords[dateString] = rows;
    localStorage.setItem(`lv_emp_${dateString}`, JSON.stringify(rows));
    saveEmployeeDayToCloud(dateString, rows).catch(() => {});
  } else {
    rows = rows.map(r => normalizeEmployeeRow(r, dateString));
    allEmployeeRecords[dateString] = rows;
  }

  renderCurrentView();
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER CURRENT VIEW
// ──────────────────────────────────────────────────────────────────────────────
function renderCurrentView() {
  const [y, m, d] = currentDay.split('-');
  const monthName = getMonthName(parseInt(m));

  // Update Toolbar period display
  const periodLabel = document.getElementById('period-label');
  if (periodLabel) {
    periodLabel.textContent = formatDateDisplay(currentDay);
  } else {
    const pDisp = document.getElementById('period-display');
    if (pDisp) pDisp.textContent = formatDateDisplay(currentDay);
  }

  // Update Date Navigation Buttons (disable next button on today 19 Oct 2026)
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  if (btnPrev) {
    const atMin = (currentDay <= MIN_DATE);
    btnPrev.disabled = atMin;
    btnPrev.classList.toggle('disabled', atMin);
  }
  if (btnNext) {
    const atMax = (currentDay >= MAX_DATE);
    btnNext.disabled = atMax;
    btnNext.classList.toggle('disabled', atMax);
  }

  // Update Hero Card & Sign-off Chips
  const metaDate = document.getElementById('daily-meta-date');
  if (metaDate) metaDate.textContent = `${d}/${m}/${y}`;

  const metaMonth = document.getElementById('daily-meta-month');
  if (metaMonth) metaMonth.textContent = monthName;

  const metaYear = document.getElementById('daily-meta-year');
  if (metaYear) metaYear.textContent = y;

  const signDate = document.getElementById('csf-sign-date');
  if (signDate) signDate.textContent = `${d}/${m}/${y}`;

  const topDate = document.getElementById('top-date');
  if (topDate) topDate.textContent = `${parseInt(d)} ${monthName} ${y}`;

  if (currentView === 'daily') {
    renderDailyTable();
  } else if (currentView === 'monthly') {
    renderMonthlyGrid();
  } else if (currentView === 'history') {
    renderHistoryList();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER DAILY TABLE (INCLUDES HAND GLOVES AND HEAD CAP)
// ──────────────────────────────────────────────────────────────────────────────
function renderDailyTable() {
  const tbody = document.getElementById('daily-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const rows = allEmployeeRecords[currentDay] || [];
  let okCount = 0;
  let failCount = 0;

  const [y, m, d] = currentDay.split('-');
  const dateShort = `${d}/${m}/${y}`;

  rows.forEach((row, idx) => {
    const isFail = (
      row.uniform === 'X' ||
      row.gloves === 'X' ||
      row.headCap === 'X' ||
      row.hygiene === 'X' ||
      row.nails === 'X' ||
      row.health === 'X'
    );
    if (isFail) failCount++;
    else okCount++;

    const tr = document.createElement('tr');
    tr.className = isFail ? 'tr-issue' : '';

    tr.innerHTML = `
      <td class="td-num">${idx + 1}</td>
      <td class="td-date">${dateShort}</td>
      <td class="td-name">${escapeHtml(row.name)}</td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.uniform)}" onclick="toggleStatusCell(${idx}, 'uniform')">
          <span class="status-dot">${getStatusIcon(row.uniform)}</span>
          <span>${escapeHtml(row.uniform)}</span>
        </button>
      </td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.gloves)}" onclick="toggleStatusCell(${idx}, 'gloves')">
          <span class="status-dot">${getStatusIcon(row.gloves)}</span>
          <span>${escapeHtml(row.gloves)}</span>
        </button>
      </td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.headCap)}" onclick="toggleStatusCell(${idx}, 'headCap')">
          <span class="status-dot">${getStatusIcon(row.headCap)}</span>
          <span>${escapeHtml(row.headCap)}</span>
        </button>
      </td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.hygiene)}" onclick="toggleStatusCell(${idx}, 'hygiene')">
          <span class="status-dot">${getStatusIcon(row.hygiene)}</span>
          <span>${escapeHtml(row.hygiene)}</span>
        </button>
      </td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.nails)}" onclick="toggleStatusCell(${idx}, 'nails')">
          <span class="status-dot">${getStatusIcon(row.nails)}</span>
          <span>${escapeHtml(row.nails)}</span>
        </button>
      </td>
      <td class="center">
        <button type="button" class="status-pill-btn ${getStatusClass(row.health)}" onclick="toggleStatusCell(${idx}, 'health')">
          <span class="status-dot">${getStatusIcon(row.health)}</span>
          <span>${escapeHtml(row.health)}</span>
        </button>
      </td>
      <td class="td-corr" onclick="editCorrectiveCell(${idx})">
        ${row.corrective ? `<span class="corr-pill-wrap">⚠ ${escapeHtml(row.corrective)}</span>` : '<span class="text-muted-dash">—</span>'}
      </td>
      <td class="td-supervisor">${escapeHtml(row.checkedBy || 'Mukesh Vora')}</td>
    `;
    tbody.appendChild(tr);
  });

  // Numbers in Quick Metrics
  const statOk = document.getElementById('stat-ok-daily');
  if (statOk) statOk.textContent = okCount;

  const statFail = document.getElementById('stat-fail-daily');
  if (statFail) statFail.textContent = failCount;

  const pct = rows.length > 0 ? Math.round((okCount / rows.length) * 100) : 100;
  const statScore = document.getElementById('stat-score-daily');
  if (statScore) statScore.textContent = `${pct}%`;

  // Circular Compliance Ring (Radius 16, Circumference = 100.5)
  const c = 100.5;
  const ringScore = document.getElementById('ring-score-prog');
  if (ringScore) {
    const ratio = pct / 100;
    ringScore.style.strokeDashoffset = (c * (1 - ratio)).toFixed(1);
  }
}

function getStatusIcon(status) {
  if (status === 'OK') return '✔';
  if (status === 'X') return '✖';
  return '—';
}

function getStatusClass(status) {
  if (status === 'OK') return 'sp-ok';
  if (status === 'X') return 'sp-fail';
  return 'sp-na';
}

// ──────────────────────────────────────────────────────────────────────────────
// CELL TOGGLING & EDITING
// ──────────────────────────────────────────────────────────────────────────────
window.toggleStatusCell = function(empIdx, field) {
  const rows = allEmployeeRecords[currentDay];
  if (!rows || !rows[empIdx]) return;

  const curr = rows[empIdx][field];
  let next = "OK";
  if (curr === "OK") next = "X";
  else if (curr === "X") next = "NA";
  else next = "OK";

  rows[empIdx][field] = next;

  // Auto suggest corrective action if X
  if (next === "X" && !rows[empIdx].corrective) {
    if (field === "uniform") rows[empIdx].corrective = "Uniform changed before shift, clean attire verified";
    else if (field === "gloves") rows[empIdx].corrective = "Hand gloves replaced with sterile pair before food handling";
    else if (field === "headCap") rows[empIdx].corrective = "Head cap fitted properly covering all hair completely";
    else if (field === "hygiene") rows[empIdx].corrective = "Hands scrubbed with antibacterial soap at wash station";
    else if (field === "nails") rows[empIdx].corrective = "Nails trimmed and sanitized before entry";
    else if (field === "health") rows[empIdx].corrective = "Minor cold symptoms noted, assigned to non-contact area";
  } else if (next === "OK") {
    const stillFail = (
      rows[empIdx].uniform === 'X' ||
      rows[empIdx].gloves === 'X' ||
      rows[empIdx].headCap === 'X' ||
      rows[empIdx].hygiene === 'X' ||
      rows[empIdx].nails === 'X' ||
      rows[empIdx].health === 'X'
    );
    if (!stillFail) rows[empIdx].corrective = "";
  }

  saveData(true);
  renderCurrentView();
};

let activeCorrTargetIdx = null;

window.editCorrectiveCell = function(empIdx) {
  const rows = allEmployeeRecords[currentDay];
  if (!rows || !rows[empIdx]) return;

  activeCorrTargetIdx = empIdx;
  const emp = rows[empIdx];

  document.getElementById('popup-corr-title').textContent = `Corrective Action — ${emp.name}`;
  document.getElementById('popup-corr-sub').textContent = `Date: ${currentDay} • Recorded by Mukesh Vora`;

  const input = document.getElementById('popup-corr-input');
  input.value = emp.corrective || "";

  document.getElementById('popup-edit-corr').style.display = 'flex';
  setTimeout(() => { input.focus(); input.select(); }, 60);
};

window.applyCorrSuggestion = function(val) {
  const input = document.getElementById('popup-corr-input');
  if (input) {
    input.value = val;
    input.focus();
  }
};

window.saveCorrPopup = function() {
  if (activeCorrTargetIdx === null) return;
  const rows = allEmployeeRecords[currentDay];
  if (!rows || !rows[activeCorrTargetIdx]) return;

  const input = document.getElementById('popup-corr-input');
  const val = input ? input.value.trim() : "";

  rows[activeCorrTargetIdx].corrective = val;
  closeCorrPopup();
  saveData(true);
  renderCurrentView();
  showToast("Corrective action saved!");
};

window.closeCorrPopup = function() {
  document.getElementById('popup-edit-corr').style.display = 'none';
  activeCorrTargetIdx = null;
};

// Enter key saves, Escape closes
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('popup-edit-corr');
  if (modal && modal.style.display === 'flex') {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCorrPopup();
    } else if (e.key === 'Escape') {
      closeCorrPopup();
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// MOBILE DRAWER NAVIGATION
// ──────────────────────────────────────────────────────────────────────────────
window.toggleMobileSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('mobile-open');
  if (isOpen) {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  } else {
    sidebar.classList.add('mobile-open');
    if (overlay) overlay.classList.add('active');
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// RENDER MONTHLY MATRIX (NO FUTURE DATES)
// ──────────────────────────────────────────────────────────────────────────────
function renderMonthlyGrid() {
  const totalDays = daysInMonth(currentYear, currentMonth);
  const rhMonth = document.getElementById('rh-month');
  if (rhMonth) rhMonth.textContent = formatMonthYear(currentYear, currentMonth);

  const table = document.getElementById('monthly-grid');
  if (!table) return;

  // Ensure active audit days are in memory
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    if (ds < MIN_DATE || ds > MAX_DATE) continue;

    if (!allEmployeeRecords[ds]) {
      const local = localStorage.getItem(`lv_emp_${ds}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          const rws = Array.isArray(parsed) ? parsed : (parsed.rows || []);
          allEmployeeRecords[ds] = rws.map(r => normalizeEmployeeRow(r, ds));
        } catch(e) {}
      }
      if (!allEmployeeRecords[ds]) {
        allEmployeeRecords[ds] = createDefaultDay(ds);
      }
    }
  }

  // Build Table Header (Day numbers)
  let headerHtml = `<thead><tr><th class="name-col" style="min-width:180px;">Employee Name</th>`;
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    const isCurrent = (ds === currentDay);
    const isFuture = (ds > MAX_DATE);
    const isPreAudit = (ds < MIN_DATE);

    if (isFuture || isPreAudit) {
      headerHtml += `<th class="day-th text-muted" style="opacity:0.4; cursor:not-allowed;" title="${isFuture ? 'Future Date (Not Available)' : 'Pre-Audit'}">${d}</th>`;
    } else {
      headerHtml += `<th class="day-th ${isCurrent ? 'today-col' : ''}" onclick="selectDate('${ds}')">${d}</th>`;
    }
  }
  headerHtml += `</tr></thead>`;

  // Build Rows
  let bodyHtml = '<tbody>';
  const monthIssues = [];
  let evaluatedDays = 0;

  EMPLOYEES.forEach((empName) => {
    bodyHtml += `<tr><td class="name-col"><strong>${empName}</strong></td>`;
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(currentYear, currentMonth, d);
      const isFuture = (ds > MAX_DATE);
      const isPreAudit = (ds < MIN_DATE);

      // STRICT REQUIREMENT: Future dates must not display data
      if (isFuture || isPreAudit) {
        bodyHtml += `<td class="day-cell cell-future" title="${isFuture ? 'Future Date' : 'Pre-Audit'}">—</td>`;
        continue;
      }

      const rows = allEmployeeRecords[ds] || [];
      const empRow = rows.find(r => r.name === empName);

      if (!empRow) {
        bodyHtml += `<td class="day-cell cell-na">—</td>`;
        continue;
      }

      const hasFail = (
        empRow.uniform === 'X' ||
        empRow.gloves === 'X' ||
        empRow.headCap === 'X' ||
        empRow.hygiene === 'X' ||
        empRow.nails === 'X' ||
        empRow.health === 'X'
      );

      if (hasFail) {
        monthIssues.push({ date: ds, name: empName, corrective: empRow.corrective || "Corrective action recorded" });
      }

      bodyHtml += `
        <td class="day-cell ${hasFail ? 'cell-fail' : 'cell-ok'}" onclick="selectDate('${ds}')" title="${empName} (${ds}): ${hasFail ? 'X' : 'OK'}">
          ${hasFail ? '✖' : '✔'}
        </td>
      `;
    }
    bodyHtml += `</tr>`;
  });
  bodyHtml += '</tbody>';

  table.innerHTML = headerHtml + bodyHtml;

  // Monthly stat pills (Only count evaluated days up to today)
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    if (ds >= MIN_DATE && ds <= MAX_DATE) evaluatedDays++;
  }

  const statPills = document.getElementById('stat-pills');
  if (statPills) {
    const totalChecks = EMPLOYEES.length * (evaluatedDays || 1);
    const okChecks = Math.max(0, totalChecks - monthIssues.length);
    const compliancePct = Math.round((okChecks / totalChecks) * 100);

    statPills.innerHTML = `
      <div class="stat-pill ok">
        <div class="stat-pill-num">${okChecks}</div>
        <div class="stat-pill-label">Total OK Checks</div>
      </div>
      <div class="stat-pill issues">
        <div class="stat-pill-num">${monthIssues.length}</div>
        <div class="stat-pill-label">Deficiencies Recorded</div>
      </div>
      <div class="stat-pill">
        <div class="stat-pill-num">${compliancePct}%</div>
        <div class="stat-pill-label">Monthly Compliance Rate</div>
      </div>
    `;
  }

  // Issues section
  const issuesBlock = document.getElementById('issues-block');
  const issuesBody = document.getElementById('issues-body');
  if (issuesBlock && issuesBody) {
    if (monthIssues.length > 0) {
      issuesBlock.style.display = 'block';
      issuesBody.innerHTML = monthIssues.map(it => `
        <tr>
          <td><strong>${it.date}</strong></td>
          <td><strong>${escapeHtml(it.name)}</strong></td>
          <td><span class="badge badge-red" style="color:#B91C1C; font-weight:700;">Hygiene Deficiency</span></td>
          <td>${escapeHtml(it.corrective)}</td>
          <td>Mukesh Vora</td>
        </tr>
      `).join('');
    } else {
      issuesBlock.style.display = 'none';
    }
  }
}

window.selectDate = function(ds) {
  if (ds > MAX_DATE || ds < MIN_DATE) return;
  loadDay(ds);
  switchView('daily');
};

// ──────────────────────────────────────────────────────────────────────────────
// SAVE DATA TO CLOUD & LOCALSTORAGE
// ──────────────────────────────────────────────────────────────────────────────
window.saveData = async function(isSilent = false) {
  const rows = allEmployeeRecords[currentDay];
  if (!rows) return;

  localStorage.setItem(`lv_emp_${currentDay}`, JSON.stringify(rows));
  const ok = await saveEmployeeDayToCloud(currentDay, rows);

  if (!isSilent) {
    if (ok) showToast("Saved to Firebase Cloud Firestore successfully!");
    else showToast("Saved locally (Syncing to cloud in background)");
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PERIOD & VIEW SWITCHING (BOUNDED: APRIL 1, 2026 TO OCTOBER 19, 2026)
// ──────────────────────────────────────────────────────────────────────────────
window.changePeriod = function(delta) {
  if (currentView === 'daily') {
    const [y, m, d] = currentDay.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    dateObj.setDate(dateObj.getDate() + delta);

    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    const target = `${newY}-${newM}-${newD}`;

    if (delta > 0 && target > MAX_DATE) return;
    if (delta < 0 && target < MIN_DATE) return;

    loadDay(target);
  } else {
    let nextMonth = currentMonth + delta;
    let nextYear = currentYear;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    if (nextMonth < 1)  { nextMonth = 12; nextYear--; }

    if (nextYear > 2026 || (nextYear === 2026 && nextMonth > 10)) return;
    if (nextYear < 2026 || (nextYear === 2026 && nextMonth < 4)) return;

    currentMonth = nextMonth;
    currentYear = nextYear;
    currentDay = MAX_DATE;
    loadDay(currentDay);
  }
};

window.switchView = function(view) {
  currentView = view;
  document.querySelectorAll('.side-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.getElementById('view-daily').style.display = (view === 'daily') ? 'flex' : 'none';
  document.getElementById('view-monthly').style.display = (view === 'monthly') ? 'flex' : 'none';
  document.getElementById('view-history').style.display = (view === 'history') ? 'flex' : 'none';

  // Auto-close mobile drawer if open
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
  }

  renderCurrentView();
};

window.renderHistoryList = async function() {
  const listContainer = document.getElementById('history-list-container');
  if (!listContainer) return;

  // 1. Gather local records immediately so user never waits
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('lv_emp_')) {
      const d = k.replace('lv_emp_', '');
      if (d >= MIN_DATE && d <= MAX_DATE && !allEmployeeRecords[d]) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          const rws = Array.isArray(parsed) ? parsed : (parsed?.rows || []);
          allEmployeeRecords[d] = rws.map(r => normalizeEmployeeRow(r, d));
        } catch(e) {}
      }
    }
  }

  // Ensure historical records are in memory
  if (Object.keys(allEmployeeRecords).length === 0) {
    pregenerateHistoricalData();
  }

  function displayList() {
    const mSel = document.getElementById('hist-month-sel');
    const ySel = document.getElementById('hist-year-sel');
    const prefix = `${ySel ? ySel.value : '2026'}-${mSel ? String(mSel.value).padStart(2,'0') : '10'}`;

    const dates = Object.keys(allEmployeeRecords)
      .filter(k => k.startsWith(prefix) && k >= MIN_DATE && k <= MAX_DATE)
      .sort()
      .reverse();

    if (dates.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:40px 20px; background:#FFFFFF; border:1px solid #E4E7EC; border-radius:12px; color:#667085;">
          <h3 style="color:#171923; margin-bottom:6px;">No records found for ${prefix}</h3>
          <p style="font-size:12.5px;">Switch month to October 2026 to see full compliant records.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = dates.map(ds => {
      let rows = allEmployeeRecords[ds];
      if (rows && !Array.isArray(rows) && Array.isArray(rows.rows)) {
        rows = rows.rows;
        allEmployeeRecords[ds] = rows.map(r => normalizeEmployeeRow(r, ds));
      }
      if (!Array.isArray(rows)) rows = [];

      const issues = rows.filter(r => (
        r.uniform === 'X' ||
        r.gloves === 'X' ||
        r.headCap === 'X' ||
        r.hygiene === 'X' ||
        r.nails === 'X' ||
        r.health === 'X'
      )).length;

      return `
        <div class="history-item-row" onclick="selectDate('${ds}')">
          <div class="hist-card-left">
            <h4>${formatDateDisplay(ds)}</h4>
            <p>Supervisor: Mukesh Vora • 11 Staff Verified</p>
          </div>
          <div>
            <span class="hist-badge ${issues > 0 ? 'issues' : 'ok'}">${issues > 0 ? `${issues} Deficiencies` : '100% OK'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Display immediately from cache/localStorage
  displayList();

  // 2. Fetch cloud records in background with timeout
  try {
    const cloudPromise = loadAllEmployeeRecordsFromCloud();
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 2500));
    const cloud = await Promise.race([cloudPromise, timeoutPromise]);

    if (cloud && typeof cloud === 'object') {
      let changed = false;
      Object.keys(cloud).forEach(d => {
        if (d < MIN_DATE || d > MAX_DATE) return;
        const item = cloud[d];
        const docRows = Array.isArray(item) ? item : (item?.rows || null);
        if (docRows && (!allEmployeeRecords[d] || allEmployeeRecords[d].length === 0)) {
          allEmployeeRecords[d] = docRows.map(r => normalizeEmployeeRow(r, d));
          changed = true;
        }
      });
      if (changed) displayList();
    }
  } catch (err) {
    console.warn("[Audit Archive] Cloud sync notice:", err);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT (SHEETJS WITH HAND GLOVES AND HEAD CAP)
// ──────────────────────────────────────────────────────────────────────────────
window.openExportModal = function() {
  document.getElementById('export-modal').style.display = 'flex';
  document.getElementById('export-from-date').value = "2026-10-01";
  document.getElementById('export-to-date').value = currentDay;
};

window.closeExportModal = function() {
  document.getElementById('export-modal').style.display = 'none';
};

window.exportReport = async function(type) {
  if (typeof XLSX === 'undefined') {
    alert("Excel generator library loading, please try in 3 seconds.");
    return;
  }

  let datesToExport = [];
  let fileName = "";

  if (type === 'daily') {
    datesToExport = [currentDay];
    fileName = `LV_Spices_Employee_Hygiene_${currentDay}.xlsx`;
  } else if (type === 'weekly') {
    const [y, m, d] = currentDay.split('-');
    const curr = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const day = curr.getDay();
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(curr.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const wDate = new Date(monday);
      wDate.setDate(monday.getDate() + i);
      const wStr = `${wDate.getFullYear()}-${String(wDate.getMonth()+1).padStart(2,'0')}-${String(wDate.getDate()).padStart(2,'0')}`;
      if (wStr >= MIN_DATE && wStr <= MAX_DATE) {
        datesToExport.push(wStr);
      }
    }
    fileName = `LV_Spices_Employee_Hygiene_Weekly_${currentDay}.xlsx`;
  } else if (type === 'monthly' || type === 'october') {
    const mSel = document.getElementById('hist-month-sel');
    const ySel = document.getElementById('hist-year-sel');
    const m = (currentView === 'history' && mSel) ? parseInt(mSel.value) : currentMonth;
    const y = (currentView === 'history' && ySel) ? parseInt(ySel.value) : currentYear;
    const totalDays = daysInMonth(y, m);
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(y, m, d);
      if (ds >= MIN_DATE && ds <= MAX_DATE) {
        datesToExport.push(ds);
      }
    }
    fileName = `LV_Spices_Employee_Hygiene_${getMonthName(m)}_${y}.xlsx`;
  } else if (type === 'all') {
    datesToExport = Object.keys(allEmployeeRecords)
      .filter(k => k >= MIN_DATE && k <= MAX_DATE)
      .sort();
    fileName = `LV_Spices_Employee_Hygiene_Complete_Archive.xlsx`;
  } else if (type === 'custom') {
    const from = document.getElementById('export-from-date').value;
    const to = document.getElementById('export-to-date').value;
    if (!from || !to) { alert("Please select both dates."); return; }
    datesToExport = Object.keys(allEmployeeRecords)
      .filter(k => k >= from && k <= to && k >= MIN_DATE && k <= MAX_DATE)
      .sort();
    fileName = `LV_Spices_Employee_Hygiene_${from}_to_${to}.xlsx`;
  }

  if (datesToExport.length === 0) {
    alert("No records to export within active audit period.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const sheetRows = [];

  const mSel = document.getElementById('hist-month-sel');
  const ySel = document.getElementById('hist-year-sel');
  const expMonth = (currentView === 'history' && mSel) ? parseInt(mSel.value) : currentMonth;
  const expYear = (currentView === 'history' && ySel) ? parseInt(ySel.value) : currentYear;

  // Sheet Header matching Client Requirements
  sheetRows.push(["L V SPICES"]);
  sheetRows.push(["EMPLOYEE PERSONAL HYGIENE RECORD"]);
  sheetRows.push([`Month: ${getMonthName(expMonth)}`, `Year: ${expYear}`, `Department / Area: Manufacturing & Packaging`]);
  sheetRows.push([]); // blank

  // Table Columns:
  // Date | Employee Name | Clean Uniform | Hand Gloves | Head Cap | Hand Hygiene | Nails / Hair | Health Status | Corrective Action | Checked By
  sheetRows.push([
    "Date",
    "Employee Name",
    "Clean Uniform",
    "Hand Gloves",
    "Head Cap",
    "Hand Hygiene",
    "Nails / Hair",
    "Health Status",
    "Corrective Action",
    "Checked By"
  ]);

  datesToExport.forEach(ds => {
    const rawRows = allEmployeeRecords[ds] || createDefaultDay(ds);
    const rows = rawRows.map(r => normalizeEmployeeRow(r, ds));
    rows.forEach(r => {
      sheetRows.push([
        ds,
        r.name,
        r.uniform,
        r.gloves,
        r.headCap,
        r.hygiene,
        r.nails,
        r.health,
        r.corrective || "",
        r.checkedBy || "Mukesh Vora"
      ]);
    });
  });

  sheetRows.push([]);
  sheetRows.push(["Mark: OK = Satisfactory; X = Unsatisfactory; NA = Not Applicable. Record corrective actions and re-check any failures."]);
  sheetRows.push([`Supervisor Name / Signature: Mukesh Vora`, "", "", "", "", "", "", "", `Date: ${currentDay}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 22 }, // Employee Name
    { wch: 16 }, // Clean Uniform
    { wch: 15 }, // Hand Gloves
    { wch: 15 }, // Head Cap
    { wch: 16 }, // Hand Hygiene
    { wch: 16 }, // Nails / Hair
    { wch: 16 }, // Health Status
    { wch: 50 }, // Corrective Action
    { wch: 18 }  // Checked By
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Employee Hygiene");
  XLSX.writeFile(wb, fileName);

  closeExportModal();
  showToast(`Excel downloaded: ${fileName}`);
};

// ──────────────────────────────────────────────────────────────────────────────
// TOAST & HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `✓ ${escapeHtml(msg)}`;
  stack.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ──────────────────────────────────────────────────────────────────────────────
// UNIT 11 / UNIT 12 SWITCHER
// ──────────────────────────────────────────────────────────────────────────────
window.switchUnit = function(unit, force) {
  if (currentUnit === unit && !force) {
    _applyUnitToDOM(unit);
    return;
  }
  currentUnit = unit;
  _applyUnitToDOM(unit);
  localStorage.setItem('lv_hygiene_active_unit', unit);
};

function _applyUnitToDOM(unit) {
  document.querySelectorAll('.unit-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit);
  });
  const unitBadge = document.getElementById('header-unit-badge');
  if (unitBadge) {
    unitBadge.textContent = unit === 'unit11' ? 'Unit 11' : 'Unit 12';
    unitBadge.dataset.unit = unit;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  pregenerateHistoricalData();

  // Restore last active unit from localStorage
  const savedUnit = localStorage.getItem('lv_hygiene_active_unit');
  setTimeout(() => window.switchUnit(savedUnit === 'unit12' ? 'unit12' : 'unit11'), 0);
  if (savedUnit === 'unit12') currentUnit = 'unit12';

  await loadDay(getTodayStr());
});

// ── PRINT A4 — builds from data, full A4 landscape ──
window.printA4 = function() {
  const rows = allEmployeeRecords[currentDay];
  if (!rows || rows.length === 0) { alert('No records for this date.'); return; }
  const dateEl = document.getElementById('header-date');
  const unitEl = document.getElementById('header-unit-badge');
  const dateStr = dateEl ? dateEl.textContent.trim() : currentDay;
  const unitStr = unitEl ? unitEl.textContent.trim() : 'Unit 11';

  function esc(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
  function badge(v){
    if(v==='OK') return '<span style="background:#16a34a;color:#fff;padding:1pt 5pt;border-radius:3pt;font-size:6.5pt;font-weight:700;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact">✔ OK</span>';
    if(v==='X')  return '<span style="background:#dc2626;color:#fff;padding:1pt 5pt;border-radius:3pt;font-size:6.5pt;font-weight:700;white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact">✖ X</span>';
    return '<span style="color:#888">—</span>';
  }

  const rowH = Math.max(10, Math.floor(148 / rows.length));
  const rowsHtml = rows.map((r,i) => `<tr style="height:${rowH}mm;${i%2===1?'background:#f7f7f7':''}">
    <td style="text-align:center">${i+1}</td>
    <td>${esc(currentDay)}</td>
    <td><b>${esc(r.name)}</b></td>
    <td style="text-align:center">${badge(r.uniform)}</td>
    <td style="text-align:center">${badge(r.gloves)}</td>
    <td style="text-align:center">${badge(r.headCap)}</td>
    <td style="text-align:center">${badge(r.hygiene)}</td>
    <td style="text-align:center">${badge(r.nails)}</td>
    <td style="text-align:center">${badge(r.health)}</td>
    <td>${r.corrective ? `⚠ ${esc(r.corrective)}` : '—'}</td>
    <td>${esc(r.checkedBy||'Mukesh Vora')}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>LV Spices — Employee Hygiene Record</title>
<style>
  @page{size:A4 landscape;margin:8mm}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff}
  .hdr{border:2pt solid #000;padding:6pt 8pt;margin-bottom:6pt}
  .hdr h1{font-size:13pt;font-weight:800;text-transform:uppercase}
  .hdr p{font-size:7pt;color:#444;margin-top:2pt}
  .pills{display:flex;gap:6pt;margin-top:5pt;flex-wrap:wrap}
  .pill{border:1pt solid #555;padding:1pt 6pt;font-size:7pt;border-radius:3pt}
  .pill b{color:#B91C1C}
  table{width:100%;border-collapse:collapse;margin-top:5pt}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th{background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;white-space:nowrap;text-align:left}
  td{font-size:8pt;padding:5pt 4pt;border:0.5pt solid #bbb;vertical-align:middle}
  .sig{margin-top:14pt;font-size:8.5pt;display:flex;justify-content:space-between}
</style></head><body>
<div class="hdr">
  <h1>Employee Personal Hygiene Record — L V Spices</h1>
  <p>FSSAI Schedule 4 GMP Compliance &bull; Daily Personal Hygiene &amp; Grooming Log</p>
  <div class="pills">
    <span class="pill">📅 Date: <b>${dateStr}</b></span>
    <span class="pill">🏭 Unit: <b>${unitStr}</b></span>
    <span class="pill">👤 Employees: <b>${rows.length}</b></span>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:5%">#</th><th style="width:9%">DATE</th><th style="width:14%">EMPLOYEE NAME</th>
    <th style="width:8%">CLEAN UNIFORM</th><th style="width:8%">HAND GLOVES</th><th style="width:8%">HEAD CAP</th>
    <th style="width:8%">HAND HYGIENE</th><th style="width:8%">NAILS / HAIR</th><th style="width:9%">HEALTH STATUS</th>
    <th style="width:16%">CORRECTIVE ACTION</th><th style="width:10%">CHECKED BY</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="sig">
  <span><b>Supervisor Name / Signature:</b> &nbsp;&nbsp; <i>Mukesh Vora</i></span>
  <span><b>Date:</b> ${dateStr}</span>
</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},800);};<\/script>
</body></html>`;

  const pw = window.open('','_blank','width=1200,height=850');
  if(pw){pw.document.write(html);pw.document.close();}
  else{alert('Allow popups to use Print A4.');}
};

// ─── PRINT A4 RANGE MODAL ───────────────────────────────────────────────────
let _printTab = 'single';

window.openPrintModal = function() {
  const today = getTodayStr();
  const modal = document.getElementById('print-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  _printTab = 'single';
  setPrintTab('single');
  // Set today label
  const lbl = document.getElementById('pm-single-date-label');
  if (lbl) {
    const [y,m,d] = today.split('-');
    lbl.textContent = `${d}/${m}/${y}`;
  }
  // Set date input max to today
  const fromEl = document.getElementById('pm-from-date');
  const toEl   = document.getElementById('pm-to-date');
  if (fromEl) { fromEl.max = today; fromEl.value = today; }
  if (toEl)   { toEl.max   = today; toEl.value   = today; }
  // Set month/year to current
  const todayParts = today.split('-');
  const mSel = document.getElementById('pm-month-sel');
  const ySel = document.getElementById('pm-year-sel');
  if (mSel) mSel.value = todayParts[1];
  if (ySel) ySel.value = todayParts[0];
  updateMonthPreview();
  updateRangeInfo();
};

window.closePrintModal = function() {
  const modal = document.getElementById('print-modal');
  if (modal) modal.style.display = 'none';
};

window.setPrintTab = function(tab) {
  _printTab = tab;
  ['single','range','month'].forEach(t => {
    const btn   = document.getElementById(`pm-tab-${t}`);
    const panel = document.getElementById(`pm-panel-${t}`);
    const active = t === tab;
    if (btn)   { btn.style.background   = active ? '#1a1a2e' : '#fff'; btn.style.color = active ? '#fff' : '#555'; btn.style.borderColor = active ? '#1a1a2e' : '#e2e8f0'; }
    if (panel) panel.style.display = active ? '' : 'none';
  });
};

function _hygUpdateRangeInfo() {
  const info  = document.getElementById('pm-range-info');
  const from  = document.getElementById('pm-from-date');
  const to    = document.getElementById('pm-to-date');
  if (!info || !from || !to) return;
  const today = getTodayStr();
  if (to.value > today)   { to.value   = today; }
  if (from.value > today) { from.value = today; }
  if (from.value && to.value && from.value <= to.value) {
    const days = Math.round((new Date(to.value) - new Date(from.value)) / 86400000) + 1;
    info.style.display = '';
    info.style.color = '#374151';
    info.textContent = `📄 ${days} page${days > 1 ? 's' : ''} will be printed (one per day).${days > 31 ? ' ⚠️ Large range.' : ''}`;
  } else if (from.value && to.value && from.value > to.value) {
    info.style.display = '';
    info.style.color = '#dc2626';
    info.textContent = '⚠️ "From" date must be before "To" date.';
  } else { info.style.display = 'none'; }
}
function updateRangeInfo() { _hygUpdateRangeInfo(); }

window.updateMonthPreview = function() {
  const mSel = document.getElementById('pm-month-sel');
  const ySel = document.getElementById('pm-year-sel');
  const info = document.getElementById('pm-month-info');
  if (!mSel || !ySel || !info) return;
  const m = mSel.value; const y = ySel.value;
  const today = getTodayStr();
  const [todayY, todayM] = today.split('-');
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (y > todayY || (y === todayY && m > todayM)) {
    info.style.background = '#fef2f2'; info.style.borderColor = '#fecaca'; info.style.color = '#dc2626';
    info.textContent = `⛔ ${monthNames[parseInt(m)-1]} ${y} is a future month — printing not allowed.`; return;
  }
  const daysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
  const printableDays = (y === todayY && m === todayM) ? parseInt(today.split('-')[2]) : daysInMonth;
  info.style.background = '#f0fdf4'; info.style.borderColor = '#a7f3d0'; info.style.color = '#374151';
  info.textContent = `📅 ${monthNames[parseInt(m)-1]} ${y} — ${printableDays} pages will be printed.${printableDays < daysInMonth ? ' (up to today)' : ''}`;
};

window.executePrint = function() {
  const today = getTodayStr();
  if (_printTab === 'single') { closePrintModal(); printA4(); return; }
  let dates = [];
  if (_printTab === 'range') {
    const from = document.getElementById('pm-from-date');
    const to   = document.getElementById('pm-to-date');
    if (!from.value || !to.value) { alert('Please select both From and To dates.'); return; }
    if (from.value > today) { alert('From date cannot be a future date.'); return; }
    if (to.value > today)   { alert('To date cannot be a future date.'); return; }
    if (from.value > to.value) { alert('From date must be before or equal To date.'); return; }
    const days = Math.round((new Date(to.value) - new Date(from.value)) / 86400000) + 1;
    if (days > 62 && !confirm(`You are about to print ${days} pages. Continue?`)) return;
    let cur = new Date(from.value); const end = new Date(to.value);
    while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }
  }
  if (_printTab === 'month') {
    const m = document.getElementById('pm-month-sel').value.padStart(2,'0');
    const y = document.getElementById('pm-year-sel').value;
    const [todayY, todayM, todayD] = today.split('-');
    if (y > todayY || (y === todayY && m > todayM)) { alert('Future month — printing not allowed.'); return; }
    const lastDay = (y === todayY && m === todayM) ? parseInt(todayD) : new Date(parseInt(y), parseInt(m), 0).getDate();
    dates = Array.from({length: lastDay}, (_,i) => `${y}-${m}-${String(i+1).padStart(2,'0')}`);
  }
  if (!dates.length) return;
  closePrintModal();
  const unitStr = (document.getElementById('pm-unit-sel') || {}).value || 'Unit 11';
  _printHygieneRange(dates, unitStr);
};

function _printHygieneRange(dates, unitStr) {
  function esc(s){ return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }
  function badge(v){
    if(v==='OK') return '<span style="background:#16a34a;color:#fff;padding:1pt 5pt;border-radius:3pt;font-size:6.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact">✔ OK</span>';
    if(v==='X')  return '<span style="background:#dc2626;color:#fff;padding:1pt 5pt;border-radius:3pt;font-size:6.5pt;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact">✖ X</span>';
    return '<span style="color:#888">—</span>';
  }
  const pagesHtml = dates.map((ds, pageIdx) => {
    const rows  = allEmployeeRecords[ds] || [];
    const [y,m,d] = ds.split('-'); const dateStr = `${d}/${m}/${y}`;
    const rowH  = rows.length ? Math.max(8, Math.floor(148 / rows.length)) : 20;
    const rowsHtml = rows.map((r,i) => `<tr style="height:${rowH}mm;${i%2===1?'background:#f7f7f7':''}">
      <td style="text-align:center">${i+1}</td><td>${esc(ds)}</td><td><b>${esc(r.name)}</b></td>
      <td style="text-align:center">${badge(r.uniform)}</td><td style="text-align:center">${badge(r.gloves)}</td>
      <td style="text-align:center">${badge(r.headCap)}</td><td style="text-align:center">${badge(r.hygiene)}</td>
      <td style="text-align:center">${badge(r.nails)}</td><td style="text-align:center">${badge(r.health)}</td>
      <td>${r.corrective ? `⚠ ${esc(r.corrective)}` : '—'}</td><td>${esc(r.checkedBy||'Mukesh Vora')}</td>
    </tr>`).join('') || `<tr><td colspan="11" style="text-align:center;color:#888;padding:20pt">No records for ${dateStr}</td></tr>`;
    return `<div style="page-break-after:${pageIdx<dates.length-1?'always':'avoid'}">
<div style="border:2pt solid #000;padding:6pt 8pt;margin-bottom:6pt">
  <h1 style="font-size:13pt;font-weight:800;text-transform:uppercase">Employee Personal Hygiene Record — L V Spices</h1>
  <p style="font-size:7pt;color:#444;margin-top:2pt">FSSAI Schedule 4 GMP Compliance • Daily Personal Hygiene &amp; Grooming Log</p>
  <div style="display:flex;gap:6pt;margin-top:5pt;flex-wrap:wrap">
    <span style="border:1pt solid #555;padding:1pt 6pt;font-size:7pt;border-radius:3pt">📅 Date: <b style="color:#B91C1C">${dateStr}</b></span>
    <span style="border:1pt solid #555;padding:1pt 6pt;font-size:7pt;border-radius:3pt">🏭 Unit: <b style="color:#B91C1C">${esc(unitStr)}</b></span>
    <span style="border:1pt solid #555;padding:1pt 6pt;font-size:7pt;border-radius:3pt">👤 Employees: <b style="color:#B91C1C">${rows.length}</b></span>
  </div>
</div>
<table style="width:100%;border-collapse:collapse;font-size:8pt">
  <thead style="display:table-header-group"><tr>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;width:5%;text-align:center">#</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;width:9%">DATE</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;width:14%">EMPLOYEE NAME</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">UNIFORM</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">GLOVES</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">HEAD CAP</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">HAND HYGIENE</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">NAILS/HAIR</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000;text-align:center">HEALTH</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000">CORRECTIVE ACTION</th>
    <th style="background:#1a1a1a;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:7pt;padding:5pt 4pt;border:0.75pt solid #000">CHECKED BY</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table></div>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>LV Spices — Employee Hygiene Record</title>
<style>@page{size:A4 landscape;margin:8mm}*{margin:0;padding:0;box-sizing:border-box}html,body{font-family:Arial,sans-serif;font-size:8pt;color:#000;background:#fff}td{padding:4pt;border:0.5pt solid #bbb;vertical-align:middle}</style>
</head><body>${pagesHtml}<script>window.onload=function(){window.print();setTimeout(function(){window.close();},800);};<\/script></body></html>`;
  const pw = window.open('','_blank','width=1200,height=850');
  if(pw){pw.document.write(html);pw.document.close();}
  else{alert('Allow popups to use Print.');}
}

function _initHygPrintListeners() {
  const from = document.getElementById('pm-from-date');
  const to   = document.getElementById('pm-to-date');
  if (from) { from.addEventListener('change', _hygUpdateRangeInfo); from.addEventListener('input', _hygUpdateRangeInfo); }
  if (to)   { to.addEventListener('change', _hygUpdateRangeInfo);   to.addEventListener('input', _hygUpdateRangeInfo); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initHygPrintListeners);
} else {
  _initHygPrintListeners();
}
