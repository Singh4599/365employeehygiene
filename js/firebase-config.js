// firebase-config.js — LV Spices Employee Personal Hygiene Register
// Project: employees-84985 | Collection: employee_hygiene_records

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA2rrUEpxplENuBTZfo70MGK7oc31wHaew",
  authDomain: "employees-84985.firebaseapp.com",
  projectId: "employees-84985",
  storageBucket: "employees-84985.firebasestorage.app",
  messagingSenderId: "1064706743708",
  appId: "1:1064706743708:web:b2a58b31272d3c5521bc59"
};

export const COLLECTION_NAME = "employee_hygiene_records";

let db = null;

export function updateCloudBadge(connected) {
  const badge = document.getElementById('cloud-status-badge');
  const text = document.getElementById('cloud-status-text');
  if (badge && text) {
    if (connected) {
      badge.className = 'top-cloud-pill connected';
      text.textContent = 'Cloud Synced (Firestore)';
    } else {
      badge.className = 'top-cloud-pill offline';
      text.textContent = 'Offline / Local Mode';
    }
  }
}

export function initFirebase() {
  if (db) return db;
  try {
    const app = getApps().find(a => a.name === 'employees') || initializeApp(firebaseConfig, 'employees');
    db = getFirestore(app);
    console.log('[Firebase] Employees DB connected: employees-84985');
    updateCloudBadge(true);
    return db;
  } catch (err) {
    console.warn('[Firebase] Init notice:', err);
    updateCloudBadge(false);
    return null;
  }
}

export async function saveEmployeeDayToCloud(dateStr, rows, meta = {}) {
  const database = initFirebase();
  if (!database) return false;
  try {
    const docRef = doc(database, COLLECTION_NAME, dateStr);
    await setDoc(docRef, {
      date: dateStr,
      rows: rows,
      supervisor: meta.supervisor || "Mukesh Vora",
      department: meta.department || "Manufacturing & Packaging",
      updatedAt: Date.now()
    }, { merge: true });
    updateCloudBadge(true);
    return true;
  } catch (err) {
    console.error('[Firebase] Save error:', err);
    updateCloudBadge(false);
    return false;
  }
}

export async function loadEmployeeDayFromCloud(dateStr) {
  const database = initFirebase();
  if (!database) return null;
  try {
    const docRef = doc(database, COLLECTION_NAME, dateStr);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      updateCloudBadge(true);
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] Load error for', dateStr, err);
    return null;
  }
}

export async function loadAllEmployeeRecordsFromCloud() {
  const database = initFirebase();
  if (!database) return {};
  try {
    const q = query(collection(database, COLLECTION_NAME), orderBy("date", "desc"), limit(250));
    const snap = await getDocs(q);
    const map = {};
    snap.forEach(d => {
      map[d.id] = d.data();
    });
    updateCloudBadge(true);
    return map;
  } catch (err) {
    console.warn('[Firebase] Bulk load error:', err);
    return {};
  }
}

// Auto-initialize
try {
  initFirebase();
} catch (e) {}
