import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase config (yours)
const firebaseConfig = {
  apiKey: "AIzaSyBaj1Z_q9OCu4qpiZAqT9wLipJ_H5yPXPg",
  authDomain: "embeddedsystemstheromostat.firebaseapp.com",
  databaseURL: "https://embeddedsystemstheromostat-default-rtdb.firebaseio.com",
  projectId: "embeddedsystemstheromostat",
  storageBucket: "embeddedsystemstheromostat.firebasestorage.app",
  messagingSenderId: "213456525601",
  appId: "1:213456525601:web:fb328f659c4ce079e68660"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase(app);

// Paths match your ESP32 sketch
const PATH_CUR = "/CurTemp";
const PATH_INT = "/IntTemp";

// UI elements (existing)
const authBox = document.getElementById("authBox");
const controlBox = document.getElementById("controlBox");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authMsg = document.getElementById("authMsg");
const badge = document.getElementById("statusBadge");

// UI elements (new)
const curTempText = document.getElementById("curTempText");
const intTempText = document.getElementById("intTempText");
const intTempInput = document.getElementById("intTempInput");
const intUpBtn = document.getElementById("intUpBtn");
const intDownBtn = document.getElementById("intDownBtn");
const applyBtn = document.getElementById("applyBtn");
const writeMsg = document.getElementById("writeMsg");

// Local state
let curTemp = null;
let intTemp = null;

// Clamp range (match ESP32)
const SETPOINT_MIN = 0;
const SETPOINT_MAX = 30;

function clampTemp(v) {
  if (Number.isNaN(v)) return null;
  if (v < SETPOINT_MIN) return SETPOINT_MIN;
  if (v > SETPOINT_MAX) return SETPOINT_MAX;
  return v;
}

function renderTemps() {
  curTempText.textContent = (curTemp === null || curTemp === undefined) ? "--" : String(curTemp);
  intTempText.textContent = (intTemp === null || intTemp === undefined) ? "--" : String(intTemp);

  // If user isn't actively typing (focus), keep input synced to cloud value
  if (document.activeElement !== intTempInput) {
    intTempInput.value = (intTemp === null || intTemp === undefined) ? "" : String(intTemp);
  }
}

// Login
loginBtn.onclick = async () => {
  authMsg.textContent = "";
  try {
    await signInWithEmailAndPassword(
      auth,
      document.getElementById("emailField").value,
      document.getElementById("passwordField").value
    );
  } catch (e) {
    authMsg.textContent = e.message;
  }
};

logoutBtn.onclick = () => signOut(auth);

// Auth state monitor
onAuthStateChanged(auth, (user) => {
  if (user) {
    authBox.style.display = "none";
    controlBox.style.display = "block";
    badge.className = "status-badge online";
    badge.textContent = "Online";
    startListeners();
  } else {
    authBox.style.display = "block";
    controlBox.style.display = "none";
    badge.className = "status-badge offline";
    badge.textContent = "Offline";
  }
});

let listenersStarted = false;

function startListeners() {
  if (listenersStarted) return;
  listenersStarted = true;

  // Live read current
  onValue(ref(db, PATH_CUR), (snapshot) => {
    const v = snapshot.val();
    curTemp = (typeof v === "number") ? v : parseInt(v, 10);
    if (Number.isNaN(curTemp)) curTemp = null;
    renderTemps();
  });

  // Live read intended
  onValue(ref(db, PATH_INT), (snapshot) => {
    const v = snapshot.val();
    intTemp = (typeof v === "number") ? v : parseInt(v, 10);
    if (Number.isNaN(intTemp)) intTemp = null;
    renderTemps();
  });

  // Controls
  intUpBtn.onclick = () => {
    const base = (document.activeElement === intTempInput)
      ? parseInt(intTempInput.value, 10)
      : intTemp;

    let next = (Number.isNaN(base) || base === null || base === undefined) ? 0 : base + 1;
    next = clampTemp(next);
    intTempInput.value = String(next);
    intTempText.textContent = String(next);
  };

  intDownBtn.onclick = () => {
    const base = (document.activeElement === intTempInput)
      ? parseInt(intTempInput.value, 10)
      : intTemp;

    let next = (Number.isNaN(base) || base === null || base === undefined) ? 0 : base - 1;
    next = clampTemp(next);
    intTempInput.value = String(next);
    intTempText.textContent = String(next);
  };

  // Allow enter-to-apply
  intTempInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyBtn.click();
  });

  // Apply button writes to Firebase
  applyBtn.onclick = async () => {
    writeMsg.textContent = "";
    const raw = parseInt(intTempInput.value, 10);
    if (Number.isNaN(raw)) {
      writeMsg.textContent = "Enter a valid number.";
      return;
    }

    const v = clampTemp(raw);
    try {
      await set(ref(db, PATH_INT), v);
      writeMsg.textContent = "Saved.";
      // intTemp will update via listener
    } catch (e) {
      writeMsg.textContent = "Write failed: " + e.message;
    }
  };
}