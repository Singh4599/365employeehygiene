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

// ──────────────────────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────────────────────
let currentYear = 2026;
let currentMonth = 10;
let currentDay = "2026-10-18";
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

// ──────────────────────────────────────────────────────────────────────────────
// OCTOBER 2026 PRE-POPULATION
// ──────────────────────────────────────────────────────────────────────────────
function pregenerateOctober2026Data() {
  for (let day = 1; day <= 18; day++) {
    const ds = dateStr(2026, 10, day);
    if (!allEmployeeRecords[ds]) {
      const isIssueDay = (day === 5 || day === 12); // Mon Oct 5 and Mon Oct 12

      const rows = EMPLOYEES.map(emp => {
        let uniform = "OK";
        let hygiene = "OK";
        let nails = "OK";
        let health = "OK";
        let corrective = "";

        if (isIssueDay && day === 5 && emp === "Pratap") {
          nails = "X";
          corrective = "Nails untrimmed, trimmed on spot & sanitized before shift";
        } else if (isIssueDay && day === 12 && emp === "Suraj") {
          uniform = "X";
          corrective = "Uniform soiled, replacement clean apron provided";
        }

        return {
          date: ds,
          name: emp,
          uniform: uniform,
          hygiene: hygiene,
          nails: nails,
          health: health,
          corrective: corrective,
          checkedBy: "Mukesh Vora"
        };
      });

      allEmployeeRecords[ds] = rows;
      localStorage.setItem(`lv_emp_${ds}`, JSON.stringify(rows));
      saveEmployeeDayToCloud(ds, rows).catch(() => {});
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
        rows = JSON.parse(local);
        allEmployeeRecords[dateString] = rows;
      } catch (e) {}
    }
  }

  // 3. Cloud Firestore
  if (!rows) {
    const cloud = await loadEmployeeDayFromCloud(dateString);
    if (cloud && cloud.rows) {
      rows = cloud.rows;
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
  }

  renderCurrentView();
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER CURRENT VIEW
// ──────────────────────────────────────────────────────────────────────────────
function renderCurrentView() {
  // Update header text
  const [y, m, d] = currentDay.split('-');
  const monthName = getMonthName(parseInt(m));

  document.getElementById('period-display').textContent = formatDateDisplay(currentDay);
  document.getElementById('daily-meta-date').textContent = `${d}/${m}/${y}`;
  document.getElementById('daily-meta-month').textContent = monthName;
  document.getElementById('daily-meta-year').textContent = y;
  document.getElementById('csf-sign-date').textContent = `${d}/${m}/${y}`;
  document.getElementById('top-date').textContent = `${d} ${monthName} ${y}`;

  if (currentView === 'daily') {
    renderDailyTable();
  } else if (currentView === 'monthly') {
    renderMonthlyGrid();
  } else if (currentView === 'history') {
    renderHistoryList();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// RENDER DAILY TABLE (MATCHING CLIENT PDF SHEET EXACTLY)
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
    const isFail = (row.uniform === 'X' || row.hygiene === 'X' || row.nails === 'X' || row.health === 'X');
    if (isFail) failCount++;
    else okCount++;

    const tr = document.createElement('tr');
    tr.className = isFail ? 'tr-issue' : '';

    tr.innerHTML = `
      <td class="center font-bold text-muted">${dateShort}</td>
      <td class="emp-name-cell"><strong>${escapeHtml(row.name)}</strong></td>
      <td class="center">
        <button class="status-btn ${getStatusClass(row.uniform)}" onclick="toggleStatusCell(${idx}, 'uniform')">${escapeHtml(row.uniform)}</button>
      </td>
      <td class="center">
        <button class="status-btn ${getStatusClass(row.hygiene)}" onclick="toggleStatusCell(${idx}, 'hygiene')">${escapeHtml(row.hygiene)}</button>
      </td>
      <td class="center">
        <button class="status-btn ${getStatusClass(row.nails)}" onclick="toggleStatusCell(${idx}, 'nails')">${escapeHtml(row.nails)}</button>
      </td>
      <td class="center">
        <button class="status-btn ${getStatusClass(row.health)}" onclick="toggleStatusCell(${idx}, 'health')">${escapeHtml(row.health)}</button>
      </td>
      <td class="editable-cell" onclick="editCorrectiveCell(${idx})">
        ${row.corrective ? `<span class="issue-text">${escapeHtml(row.corrective)}</span>` : '<span class="text-muted">—</span>'}
      </td>
      <td class="center font-semibold">${escapeHtml(row.checkedBy || 'Mukesh Vora')}</td>
    `;
    tbody.appendChild(tr);
  });

  // Metrics
  document.getElementById('stat-ok-daily').textContent = okCount;
  document.getElementById('stat-fail-daily').textContent = failCount;
  const pct = rows.length > 0 ? Math.round((okCount / rows.length) * 100) : 100;
  document.getElementById('stat-score-daily').textContent = `${pct}%`;
}

function getStatusClass(status) {
  if (status === 'OK') return 'sb-ok';
  if (status === 'X') return 'sb-fail';
  return 'sb-na';
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
    else if (field === "hygiene") rows[empIdx].corrective = "Hands scrubbed with antibacterial soap at wash station";
    else if (field === "nails") rows[empIdx].corrective = "Nails trimmed and sanitized before entry";
    else if (field === "health") rows[empIdx].corrective = "Minor cold symptoms noted, assigned to non-contact area";
  } else if (next === "OK") {
    // Check if other fields are fail
    const stillFail = (rows[empIdx].uniform === 'X' || rows[empIdx].hygiene === 'X' || rows[empIdx].nails === 'X' || rows[empIdx].health === 'X');
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
// RENDER MONTHLY MATRIX
// ──────────────────────────────────────────────────────────────────────────────
function renderMonthlyGrid() {
  const totalDays = daysInMonth(currentYear, currentMonth);
  document.getElementById('rh-month').textContent = formatMonthYear(currentYear, currentMonth);

  const table = document.getElementById('monthly-grid');
  if (!table) return;

  // Ensure all month days are loaded in cache
  for (let d = 1; d <= totalDays; d++) {
    const ds = dateStr(currentYear, currentMonth, d);
    if (!allEmployeeRecords[ds]) {
      const local = localStorage.getItem(`lv_emp_${ds}`);
      if (local) {
        try { allEmployeeRecords[ds] = JSON.parse(local); } catch(e) {}
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
    headerHtml += `<th class="day-th ${isCurrent ? 'active-day-col' : ''}" onclick="selectDate('${ds}')">${d}</th>`;
  }
  headerHtml += `</tr></thead>`;

  // Build Rows
  let bodyHtml = '<tbody>';
  const monthIssues = [];

  EMPLOYEES.forEach((empName, empIdx) => {
    bodyHtml += `<tr><td class="name-col"><strong>${empName}</strong></td>`;
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(currentYear, currentMonth, d);
      const rows = allEmployeeRecords[ds] || [];
      const empRow = rows.find(r => r.name === empName);

      if (!empRow) {
        bodyHtml += `<td class="day-cell">—</td>`;
        continue;
      }

      const hasFail = (empRow.uniform === 'X' || empRow.hygiene === 'X' || empRow.nails === 'X' || empRow.health === 'X');
      if (hasFail) {
        monthIssues.push({ date: ds, name: empName, corrective: empRow.corrective || "Corrective action recorded" });
      }

      bodyHtml += `
        <td class="day-cell ${hasFail ? 'cell-fail' : 'cell-ok'}" onclick="selectDate('${ds}')" title="${empName} (${ds}): ${hasFail ? 'X' : 'OK'}">
          ${hasFail ? '✗' : '✓'}
        </td>
      `;
    }
    bodyHtml += `</tr>`;
  });
  bodyHtml += '</tbody>';

  table.innerHTML = headerHtml + bodyHtml;

  // Issues section
  const issuesBlock = document.getElementById('issues-block');
  const issuesBody = document.getElementById('issues-body');
  if (issuesBlock && issuesBody) {
    if (monthIssues.length > 0) {
      issuesBlock.style.display = 'block';
      issuesBody.innerHTML = monthIssues.map(it => `
        <tr>
          <td><strong>${it.date}</strong></td>
          <td>${it.name}</td>
          <td><span class="badge badge-red">Hygiene Alert</span></td>
          <td>${it.corrective}</td>
          <td>Mukesh Vora</td>
        </tr>
      `).join('');
    } else {
      issuesBlock.style.display = 'none';
    }
  }
}

window.selectDate = function(ds) {
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
// PERIOD & VIEW SWITCHING
// ──────────────────────────────────────────────────────────────────────────────
window.changePeriod = function(delta) {
  if (currentView === 'daily') {
    const [y, m, d] = currentDay.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    dateObj.setDate(dateObj.getDate() + delta);

    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    loadDay(`${newY}-${newM}-${newD}`);
  } else {
    currentMonth += delta;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    if (currentMonth < 1)  { currentMonth = 12; currentYear--; }
    currentDay = dateStr(currentYear, currentMonth, 1);
    loadDay(currentDay);
  }
};

window.switchView = function(view) {
  currentView = view;
  document.querySelectorAll('.side-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.getElementById('view-daily').style.display = (view === 'daily') ? 'block' : 'none';
  document.getElementById('view-monthly').style.display = (view === 'monthly') ? 'block' : 'none';
  document.getElementById('view-history').style.display = (view === 'history') ? 'block' : 'none';

  renderCurrentView();
};

window.renderHistoryList = async function() {
  const listContainer = document.getElementById('history-list-container');
  if (!listContainer) return;
  listContainer.innerHTML = '<div style="padding:20px; color:#64748B;">Loading archive records...</div>';

  const cloud = await loadAllEmployeeRecordsFromCloud();
  Object.assign(allEmployeeRecords, cloud);

  // Read local storage keys
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('lv_emp_')) {
      const d = k.replace('lv_emp_', '');
      if (!allEmployeeRecords[d]) {
        try { allEmployeeRecords[d] = JSON.parse(localStorage.getItem(k)); } catch(e) {}
      }
    }
  }

  const mSel = document.getElementById('hist-month-sel');
  const ySel = document.getElementById('hist-year-sel');
  const prefix = `${ySel ? ySel.value : '2026'}-${mSel ? mSel.value.padStart(2,'0') : '10'}`;

  const dates = Object.keys(allEmployeeRecords).filter(k => k.startsWith(prefix)).sort().reverse();

  if (dates.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:#64748B;">
        <h3>No records found for ${prefix}</h3>
        <p>Switch to October 2026 to see full compliant records.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = dates.map(ds => {
    const rows = allEmployeeRecords[ds] || [];
    const issues = rows.filter(r => r.uniform === 'X' || r.hygiene === 'X' || r.nails === 'X' || r.health === 'X').length;
    return `
      <div class="history-item-row" onclick="selectDate('${ds}')">
        <div>
          <strong>${formatDateDisplay(ds)}</strong>
          <div style="font-size:12px; color:#64748B; margin-top:3px;">Supervisor: Mukesh Vora • 11 Staff Verified</div>
        </div>
        <div>
          <span class="badge ${issues > 0 ? 'badge-amber' : 'badge-green'}">${issues > 0 ? `${issues} Deficiencies` : '100% OK'}</span>
        </div>
      </div>
    `;
  }).join('');
};

// ──────────────────────────────────────────────────────────────────────────────
// EXCEL EXPORT (SHEETJS MATCHING CLIENT PDF EXACTLY)
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
      datesToExport.push(wStr);
    }
    fileName = `LV_Spices_Employee_Hygiene_Weekly_${currentDay}.xlsx`;
  } else if (type === 'october' || type === 'monthly') {
    for (let d = 1; d <= 31; d++) {
      datesToExport.push(`2026-10-${String(d).padStart(2,'0')}`);
    }
    fileName = `LV_Spices_Employee_Hygiene_October_2026.xlsx`;
  } else if (type === 'all') {
    datesToExport = Object.keys(allEmployeeRecords).sort();
    fileName = `LV_Spices_Employee_Hygiene_Complete_Archive.xlsx`;
  } else if (type === 'custom') {
    const from = document.getElementById('export-from-date').value;
    const to = document.getElementById('export-to-date').value;
    if (!from || !to) { alert("Please select both dates."); return; }
    datesToExport = Object.keys(allEmployeeRecords).filter(k => k >= from && k <= to).sort();
    fileName = `LV_Spices_Employee_Hygiene_${from}_to_${to}.xlsx`;
  }

  if (datesToExport.length === 0) {
    alert("No records to export.");
    return;
  }

  const wb = XLSX.utils.book_new();
  const sheetRows = [];

  // Sheet Header matching Image 1
  sheetRows.push(["L V SPICES"]);
  sheetRows.push(["EMPLOYEE PERSONAL HYGIENE RECORD"]);
  sheetRows.push([`Month: October`, `Year: 2026`, `Department / Area: Manufacturing & Packaging`]);
  sheetRows.push([]); // blank

  // Table Columns matching Client PDF:
  // Date | Employee Name | Clean Uniform | Hand Hygiene | Nails / Hair | Health Status | Corrective Action | Checked By
  sheetRows.push([
    "Date",
    "Employee Name",
    "Clean Uniform",
    "Hand Hygiene",
    "Nails / Hair",
    "Health Status",
    "Corrective Action",
    "Checked By"
  ]);

  datesToExport.forEach(ds => {
    const rows = allEmployeeRecords[ds] || createDefaultDay(ds);
    rows.forEach(r => {
      sheetRows.push([
        ds,
        r.name,
        r.uniform,
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
  sheetRows.push([`Supervisor Name / Signature: Mukesh Vora`, "", "", "", "", "", `Date: ${currentDay}`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetRows);

  ws['!cols'] = [
    { wch: 14 }, // Date
    { wch: 22 }, // Employee Name
    { wch: 16 }, // Clean Uniform
    { wch: 16 }, // Hand Hygiene
    { wch: 16 }, // Nails / Hair
    { wch: 16 }, // Health Status
    { wch: 45 }, // Corrective Action
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
  pregenerateOctober2026Data();
  await loadDay("2026-10-18");
});
