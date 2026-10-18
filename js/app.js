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
let currentDay = "2026-10-10"; // Default to Sat, 10 Oct 2026 to match client sheet
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
// RENDER DAILY TABLE (MATCHING CLIENT REFERENCE MOCKUP EXACTLY)
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
    else if (field === "hygiene") rows[empIdx].corrective = "Hands scrubbed with antibacterial soap at wash station";
    else if (field === "nails") rows[empIdx].corrective = "Nails trimmed and sanitized before entry";
    else if (field === "health") rows[empIdx].corrective = "Minor cold symptoms noted, assigned to non-contact area";
  } else if (next === "OK") {
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
// RENDER MONTHLY MATRIX
// ──────────────────────────────────────────────────────────────────────────────
function renderMonthlyGrid() {
  const totalDays = daysInMonth(currentYear, currentMonth);
  const rhMonth = document.getElementById('rh-month');
  if (rhMonth) rhMonth.textContent = formatMonthYear(currentYear, currentMonth);

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
    headerHtml += `<th class="day-th ${isCurrent ? 'today-col' : ''}" onclick="selectDate('${ds}')">${d}</th>`;
  }
  headerHtml += `</tr></thead>`;

  // Build Rows
  let bodyHtml = '<tbody>';
  const monthIssues = [];

  EMPLOYEES.forEach((empName) => {
    bodyHtml += `<tr><td class="name-col"><strong>${empName}</strong></td>`;
    for (let d = 1; d <= totalDays; d++) {
      const ds = dateStr(currentYear, currentMonth, d);
      const rows = allEmployeeRecords[ds] || [];
      const empRow = rows.find(r => r.name === empName);

      if (!empRow) {
        bodyHtml += `<td class="day-cell cell-na">—</td>`;
        continue;
      }

      const hasFail = (empRow.uniform === 'X' || empRow.hygiene === 'X' || empRow.nails === 'X' || empRow.health === 'X');
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

  // Monthly stat pills
  const statPills = document.getElementById('stat-pills');
  if (statPills) {
    const totalChecks = EMPLOYEES.length * totalDays;
    const okChecks = totalChecks - monthIssues.length;
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
      if (!allEmployeeRecords[d]) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          allEmployeeRecords[d] = Array.isArray(parsed) ? parsed : (parsed?.rows || []);
        } catch(e) {}
      }
    }
  }

  // Ensure current October days 1-18 are in memory
  if (Object.keys(allEmployeeRecords).length === 0) {
    pregenerateOctober2026Data();
  }

  function displayList() {
    const mSel = document.getElementById('hist-month-sel');
    const ySel = document.getElementById('hist-year-sel');
    const prefix = `${ySel ? ySel.value : '2026'}-${mSel ? String(mSel.value).padStart(2,'0') : '10'}`;

    const dates = Object.keys(allEmployeeRecords).filter(k => k.startsWith(prefix)).sort().reverse();

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
        allEmployeeRecords[ds] = rows;
      }
      if (!Array.isArray(rows)) rows = [];

      const issues = rows.filter(r => r.uniform === 'X' || r.hygiene === 'X' || r.nails === 'X' || r.health === 'X').length;
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
        const item = cloud[d];
        const docRows = Array.isArray(item) ? item : (item?.rows || null);
        if (docRows && (!allEmployeeRecords[d] || allEmployeeRecords[d].length === 0)) {
          allEmployeeRecords[d] = docRows;
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

  // Sheet Header matching Client Mockup
  sheetRows.push(["L V SPICES"]);
  sheetRows.push(["EMPLOYEE PERSONAL HYGIENE RECORD"]);
  sheetRows.push([`Month: October`, `Year: 2026`, `Department / Area: Manufacturing & Packaging`]);
  sheetRows.push([]); // blank

  // Table Columns:
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
  await loadDay("2026-10-10");
});
