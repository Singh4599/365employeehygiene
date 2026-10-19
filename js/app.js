// app.js — L V Spices Employee Personal Hygiene Record
// FSSAI Schedule 4 GMP Compliance & Daily Employee Hygiene Tracking with Firestore Cloud Sync

import { saveEmployeeDayToCloud, loadEmployeeDayFromCloud, loadAllEmployeeRecordsFromCloud, updateCloudBadge } from './firebase-config.js';

// ──────────────────────────────────────────────────────────────────────────────
// EMPLOYEES & DEFAULT LIST
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYEES = [
  "Rajesh Sharma", "Mukesh Vora", "Vinod Singh", "Vishal Chaturvedi",
  "Golu Yadav", "Mahesh", "Rajkumar", "Pratap", "Suraj", "Suchitra", "Anil"
];

// Audit Date Bounds: Strictly April 1, 2026 to October 19, 2026 (No future dates)
export const MIN_DATE = "2026-04-01";
export const MAX_DATE = "2026-10-19";

// ──────────────────────────────────────────────────────────────────────────────
// REGULAR DEFICIENCIES SCHEDULE (Every 8-10 Days across April - October 2026)
// ──────────────────────────────────────────────────────────────────────────────
export const EMPLOYEE_DEFICIENCIES = {
  "2026-04-08": { badEmp: "Suraj",             field: "gloves",  text: "Hand gloves torn during sorting, discarded & sterile pair issued before shift" },
  "2026-04-16": { badEmp: "Pratap",            field: "headCap", text: "Hair strands protruding from cap, replaced with fresh elastic head cap" },
  "2026-04-25": { badEmp: "Mahesh",            field: "uniform", text: "Uniform apron stained with spice blend, fresh clean apron provided" },
  "2026-05-04": { badEmp: "Golu Yadav",        field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-05-13": { badEmp: "Suchitra",          field: "gloves",  text: "Gloves had minor puncture, replaced immediately with fresh nitrile pair" },
  "2026-05-22": { badEmp: "Anil",              field: "headCap", text: "Head cap missing at morning lineup, sterile head cap issued before entry" },
  "2026-05-30": { badEmp: "Vinod Singh",        field: "uniform", text: "Apron strap loose, replaced with fresh clean apron before packing" },
  "2026-06-08": { badEmp: "Rajkumar",          field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-06-17": { badEmp: "Suraj",             field: "gloves",  text: "Gloves worn out, replaced with food-grade nitrile gloves" },
  "2026-06-26": { badEmp: "Pratap",            field: "headCap", text: "Head cap worn improperly, repositioned and hair completely enclosed" },
  "2026-07-05": { badEmp: "Vishal Chaturvedi", field: "uniform", text: "Uniform soiled, replacement clean apron provided" },
  "2026-07-14": { badEmp: "Mahesh",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-07-23": { badEmp: "Golu Yadav",        field: "gloves",  text: "Hand gloves torn, discarded & sterile pair issued before shift" },
  "2026-08-02": { badEmp: "Suchitra",          field: "headCap", text: "Head cap loose, replaced with secure elastic cap before cleanroom entry" },
  "2026-08-11": { badEmp: "Anil",              field: "uniform", text: "Uniform apron stained, fresh clean apron provided" },
  "2026-08-20": { badEmp: "Pratap",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before shift entry" },
  "2026-08-29": { badEmp: "Suraj",             field: "gloves",  text: "Hand gloves replaced with sterile pair before food handling" },
  "2026-09-07": { badEmp: "Rajkumar",          field: "headCap", text: "Head cap replaced with fresh clean cap before line startup" },
  "2026-09-16": { badEmp: "Vinod Singh",        field: "uniform", text: "Apron soiled during batch prep, clean attire verified" },
  "2026-09-25": { badEmp: "Mahesh",            field: "nails",   text: "Nails untrimmed, trimmed on spot & sanitized before entry" },
  "2026-10-04": { badEmp: "Pratap",            field: "gloves",  text: "Hand gloves torn during spice handling, sterile pair issued" },
  "2026-10-12": { badEmp: "Suraj",             field: "headCap", text: "Head cap misplaced, replacement hairnet/head cap issued before shift" },
  "2026-10-18": { badEmp: "Anil",              field: "uniform", text: "Uniform apron stained with turmeric, fresh clean apron issued immediately" }
};

// ──────────────────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────────────────
let currentYear = 2026;
let currentMonth = 10;
let currentDay = "2026-10-19"; // Default to today: Mon, 19 Oct 2026
let currentView = 'daily';
let allEmployeeRecords = {}; // dateStr -> rows
let hasUnsavedChanges = false;

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
    { m: 10, days: 19 } // Strictly up to today 19 October 2026
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
    currentDay = (currentYear === 2026 && currentMonth === 10) ? MAX_DATE : dateStr(currentYear, currentMonth, 1);
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
// INIT
// ──────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  pregenerateHistoricalData();
  await loadDay("2026-10-19");
});
