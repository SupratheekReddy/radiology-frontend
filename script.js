// ======================= CONFIG =======================

// CHANGE THIS LATER TO YOUR REAL IP
const API_BASE = "https://radiology-backend-vvor.onrender.com";



// SOCKET.IO CLIENT — REALTIME SYNC
let socket = null;

// GLOBALS
let currentUser = null;
let currentRole = "admin";

// ======================= HELPERS =======================
async function apiRequest(path, options = {}) {
  const finalOptions = {
    method: options.method || "GET",
    headers: options.headers || {},
    credentials: "include",
  };

  if (options.body && !(options.body instanceof FormData)) {
    finalOptions.headers["Content-Type"] = "application/json";
    finalOptions.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData) {
    finalOptions.body = options.body;
  }

  const res = await fetch(`${API_BASE}${path}`, finalOptions);
  let data;

  try { data = await res.json(); }
  catch { data = null; }

  if (!res.ok) {
    throw new Error((data && data.message) || `Request failed: ${res.status}`);
  }

  return data;
}

function priorityBadge(p) {
  if (p === "Critical") return `<span class="badge badge-critical">Critical</span>`;
  if (p === "Medium")   return `<span class="badge badge-medium">Medium</span>`;
  return `<span class="badge badge-safe">Safe</span>`;
}

// ======================= ROLE TOGGLE =======================
const roleToggle = document.getElementById("roleToggle");
const loginError = document.getElementById("loginError");
const loginIdInput = document.getElementById("loginId");
const loginPasswordInput = document.getElementById("loginPassword");

function updatePlaceholder(role) {
  switch(role) {
    case "admin":       loginIdInput.placeholder = "admin"; break;
    case "doctor":      loginIdInput.placeholder = "doctor@example.com"; break;
    case "technician":  loginIdInput.placeholder = "tech@example.com"; break;
    case "radiologist": loginIdInput.placeholder = "radiologist"; break;
    case "patient":     loginIdInput.placeholder = "patient@example.com"; break;
  }
}

if (roleToggle) {
  roleToggle.addEventListener("click", (e) => {
    const btn = e.target.closest(".role-btn");
    if (!btn) return;

    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentRole = btn.dataset.role;
    updatePlaceholder(currentRole);
    loginError.style.display = "none";
  });
}
// ======================= LOGIN =======================
document.getElementById("loginBtn")?.addEventListener("click", handleLogin);

async function handleLogin() {
  const id = loginIdInput.value.trim();
  const pw = loginPasswordInput.value.trim();

  loginError.style.display = "none";

  if (!id || !pw) {
    loginError.textContent = "Please fill both fields.";
    loginError.style.display = "block";
    return;
  }

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: { username: id, password: pw, role: currentRole }
    });

    if (!data.success) {
      loginError.textContent = data.message || "Invalid credentials.";
      loginError.style.display = "block";
      return;
    }

    currentUser = data.user;
    currentRole = data.user.role;

    openDashboardForRole();
    setupSocket();

  } catch (err) {
    loginError.textContent = err.message || "Login failed.";
    loginError.style.display = "block";
  }
}

function openDashboardForRole() {
  if (currentRole === "admin") {
    openDashboard("adminDashboard");
    initAdminUI();
  } else if (currentRole === "doctor") {
    openDashboard("doctorDashboard");
    renderDoctorCases();
  } else if (currentRole === "technician") {
    openDashboard("techDashboard");
    renderTechCases();
  } else if (currentRole === "radiologist") {
    openDashboard("radioDashboard");
    renderRadioCases();
  } else if (currentRole === "patient") {
    openDashboard("patientDashboard");
    renderPatientCases();
  }
}

function openDashboard(id) {
  document.getElementById("loginCard").style.display = "none";
  document.querySelectorAll(".dashboard").forEach(d => d.style.display = "none");
  document.getElementById(id).style.display = "block";
}

// ======================= LOGOUT =======================
async function logout() {
  try { await apiRequest("/auth/logout", { method: "POST" }); }
  catch {}

  currentUser = null;
  currentRole = "admin";

  document.getElementById("loginCard").style.display = "block";
  document.querySelectorAll(".dashboard").forEach(d => d.style.display = "none");

  loginIdInput.value = "";
  loginPasswordInput.value = "";

  document.querySelectorAll(".role-btn")
    .forEach(b => b.classList.remove("active"));

  document.querySelector('.role-btn[data-role="admin"]').classList.add("active");
  updatePlaceholder("admin");
}

// ======================= ADMIN UI =======================
function initAdminUI() {
  document.querySelectorAll("#adminDashboard .tab-link").forEach(btn => {
    btn.addEventListener("click", () => {
      showAdminSection(btn.dataset.target);

      document.querySelectorAll("#adminDashboard .tab-link")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
    });
  });

  showAdminSection("adminAddDoctor");
  refreshAdminDropdowns();
  renderAdminCases();
}

function showAdminSection(id) {
  document.querySelectorAll("#adminDashboard .section")
    .forEach(s => s.style.display = "none");

  const target = document.getElementById(id);
  if (target) target.style.display = "block";
}

// ---- Admin: Add Doctor ----
async function addDoctor() {
  const name = document.getElementById("docName").value.trim();
  const email = document.getElementById("docEmail").value.trim();
  const username = document.getElementById("docUser").value.trim();

  if (!name || !email || !username) return;

  try {
    const res = await apiRequest("/admin/doctor", {
      method: "POST",
      body: { name, email, username }
    });

    if (!res.success) return alert(res.message);

    document.getElementById("docSuccess").style.display = "block";
    setTimeout(() => document.getElementById("docSuccess").style.display = "none", 1600);

    document.getElementById("docName").value = "";
    document.getElementById("docEmail").value = "";
    document.getElementById("docUser").value = "";

    refreshAdminDropdowns();

    if (socket) socket.emit("admin-updated");

  } catch (err) {
    alert(err.message);
  }
}

// ---- Admin: Add Technician ----
async function addTechnician() {
  const name = document.getElementById("techName").value.trim();
  const email = document.getElementById("techEmail").value.trim();
  const username = document.getElementById("techUser").value.trim();
  const password = document.getElementById("techPass").value.trim();

  if (!name || !email || !username || !password) return;

  try {
    const res = await apiRequest("/admin/technician", {
      method: "POST",
      body: { name, email, username, password }
    });

    if (!res.success) return alert(res.message);

    document.getElementById("techSuccess").style.display = "block";
    setTimeout(() => document.getElementById("techSuccess").style.display = "none", 1600);

    document.getElementById("techName").value = "";
    document.getElementById("techEmail").value = "";
    document.getElementById("techUser").value = "";
    document.getElementById("techPass").value = "";

    if (socket) socket.emit("admin-updated");

  } catch (err) {
    alert(err.message);
  }
}

// ---- Admin: Add Patient ----
async function addPatient() {
  const name = document.getElementById("patName").value.trim();
  const email = document.getElementById("patEmail").value.trim();
  const username = document.getElementById("patUser").value.trim();
  const password = document.getElementById("patPass").value.trim();
  const basePriority = document.getElementById("patPriority").value;

  if (!name || !email || !username || !password) return;

  try {
    const res = await apiRequest("/admin/patient", {
      method: "POST",
      body: { name, email, username, password, basePriority }
    });

    if (!res.success) return alert(res.message);

    document.getElementById("patSuccess").style.display = "block";
    setTimeout(() => document.getElementById("patSuccess").style.display = "none", 1600);

    document.getElementById("patName").value = "";
    document.getElementById("patEmail").value = "";
    document.getElementById("patUser").value = "";
    document.getElementById("patPass").value = "";
    document.getElementById("patPriority").value = "Critical";

    refreshAdminDropdowns();

    if (socket) socket.emit("admin-updated");

  } catch (err) {
    alert(err.message);
  }
}

// ---- Admin: Refresh Dropdowns ----
async function refreshAdminDropdowns() {
  const patSelect = document.getElementById("casePatient");
  const docSelect = document.getElementById("caseDoctor");

  if (!patSelect || !docSelect) return;

  patSelect.innerHTML = "";
  docSelect.innerHTML = "";

  try {
    const data = await apiRequest("/admin/lists");

    data.patients?.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.username;
      opt.textContent = `${p.name} (${p.username})`;
      patSelect.appendChild(opt);
    });

    data.doctors?.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.username;
      opt.textContent = `${d.name} (${d.username})`;
      docSelect.appendChild(opt);
    });

  } catch (err) {
    console.error("Dropdown refresh failed:", err);
  }
}

// ---- Admin: Schedule New Case ----
async function scheduleCase() {
  const patientUsername = document.getElementById("casePatient").value;
  const doctorUsername  = document.getElementById("caseDoctor").value;
  const date = document.getElementById("caseDate").value;
  const timeSlot = document.getElementById("caseSlot").value;
  const scanType = document.getElementById("caseScanType").value;
  const priority = document.getElementById("casePriority").value;
  const refDoctor = document.getElementById("caseRefDoc").value.trim();
  const symptoms = document.getElementById("caseSymptoms").value.trim();

  if (!patientUsername || !doctorUsername || !date || !timeSlot) return;

  try {
    const res = await apiRequest("/admin/case", {
      method: "POST",
      body: {
        patientUsername,
        doctorUsername,
        date,
        timeSlot,
        scanType,
        priority,
        refDoctor,
        symptoms
      }
    });

    if (!res.success) return alert(res.message);

    document.getElementById("caseSuccess").style.display = "block";
    setTimeout(() => document.getElementById("caseSuccess").style.display = "none", 1600);

    document.getElementById("caseSymptoms").value = "";
    document.getElementById("caseRefDoc").value = "";

    renderAdminCases();

    if (socket) socket.emit("case-created");

  } catch (err) {
    alert(err.message);
  }
}

// ---- Admin: Render All Cases ----
async function renderAdminCases() {
  const list = document.getElementById("adminCasesList");
  if (!list) return;

  list.innerHTML = `<li class="case-card">Loading...</li>`;

  try {
    const data = await apiRequest("/admin/cases");
    const cases = data.cases || [];

    if (!cases.length) {
      list.innerHTML = `<li class="case-card">No cases found.</li>`;
      return;
    }

    list.innerHTML = "";

    cases.forEach(c => {
      const li = document.createElement("li");
      li.className = "case-card";

      const patientName = c.patientName || c.patientUsername;
      const doctorName  = c.doctorName  || c.doctorUsername;

      li.innerHTML = `
        <div class="case-top">
          <div><b>${c.id}</b></div>
          <div>
            <span class="badge badge-scan">${c.scanType}</span>
            ${priorityBadge(c.priority)}
          </div>
        </div>
        <div class="case-meta-line"><span class="label-inline">Patient:</span> ${patientName}</div>
        <div class="case-meta-line"><span class="label-inline">Doctor:</span> ${doctorName}</div>
        <div class="case-meta-line"><span class="label-inline">When:</span> ${c.date} • ${c.timeSlot}</div>
        <div class="case-meta-line"><span class="label-inline">Ref:</span> ${c.refDoctor || "-"}</div>
      `;

      list.appendChild(li);
    });

  } catch (err) {
    list.innerHTML = `<li class="case-card">Error loading cases.</li>`;
  }
}
// ======================= DOCTOR VIEW =======================
async function renderDoctorCases() {
  const list = document.getElementById("doctorCasesList");
  if (!list || !currentUser) return;

  list.innerHTML = `<li class="case-card">Loading...</li>`;

  try {
    const data = await apiRequest(`/doctor/cases/${encodeURIComponent(currentUser.username)}`);
    const cases = data.cases || [];

    if (!cases.length) {
      list.innerHTML = `<li class="case-card">No assigned cases yet.</li>`;
      return;
    }

    list.innerHTML = "";

    cases.forEach(c => {
      const patName = c.patientName || c.patientUsername || "?";

      const li = document.createElement("li");
      li.className = "case-card";

      li.innerHTML = `
        <div class="case-top">
          <div><b>${patName}</b></div>
          <div>
            ${priorityBadge(c.priority)}
            <span class="badge badge-scan">${c.scanType}</span>
          </div>
        </div>

        <div class="case-meta-line"><span class="label-inline">Case:</span> ${c.id}</div>
        <div class="case-meta-line"><span class="label-inline">When:</span> ${c.date} • ${c.timeSlot}</div>
        <div class="case-meta-line"><span class="label-inline">Symptoms:</span> ${c.symptoms || "-"}</div>
        <div class="case-meta-line"><span class="label-inline">Ref:</span> ${c.refDoctor || "-"}</div>

        <div class="notes-block">
          <span class="label-inline">Doctor Notes:</span>
          <textarea class="input-inline" data-case="${c.id}" data-field="notes">${c.doctorNotes || ""}</textarea>

          <span class="label-inline">Prescription:</span>
          <textarea class="input-inline" data-case="${c.id}" data-field="presc">${c.prescription || ""}</textarea>

          <button class="small-btn" onclick="saveDoctorNotes('${c.id}', this)">Save</button>
        </div>
      `;

      list.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = `<li class="case-card">Error loading doctor cases.</li>`;
  }
}

async function saveDoctorNotes(caseId, btnEl) {
  const card = btnEl.closest(".case-card");

  const notesEl = card.querySelector(`textarea[data-case="${caseId}"][data-field="notes"]`);
  const prescEl = card.querySelector(`textarea[data-case="${caseId}"][data-field="presc"]`);

  const doctorNotes = notesEl.value.trim();
  const prescription = prescEl.value.trim();

  try {
    await apiRequest(`/doctor/notes/${encodeURIComponent(caseId)}`, {
      method: "POST",
      body: { doctorNotes }
    });

    await apiRequest(`/doctor/prescription/${encodeURIComponent(caseId)}`, {
      method: "POST",
      body: { prescription }
    });

    btnEl.textContent = "Saved";
    setTimeout(() => btnEl.textContent = "Save", 1100);

    if (socket) socket.emit("doctor-updated", { caseId });

  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to save notes.");
  }
}



// ======================= PATIENT VIEW =======================
async function renderPatientCases() {
  const list = document.getElementById("patientCasesList");
  if (!list || !currentUser) return;

  list.innerHTML = `<li class="case-card">Loading...</li>`;

  try {
    const data = await apiRequest(`/patient/cases/${encodeURIComponent(currentUser.username)}`);
    const cases = data.cases || [];

    if (!cases.length) {
      list.innerHTML = `<li class="case-card">No scheduled cases.</li>`;
      return;
    }

    list.innerHTML = "";

    cases.forEach(c => {
      const docName = c.doctorName || c.doctorUsername || "?";

      const li = document.createElement("li");
      li.className = "case-card";

      li.innerHTML = `
        <div class="case-top">
          <div><b>${c.scanType}</b></div>
          <div>${priorityBadge(c.priority)}</div>
        </div>

        <div class="case-meta-line"><span class="label-inline">Case:</span> ${c.id}</div>
        <div class="case-meta-line"><span class="label-inline">Doctor:</span> ${docName} (${c.doctorUsername})</div>
        <div class="case-meta-line"><span class="label-inline">When:</span> ${c.date} • ${c.timeSlot}</div>

        <div class="notes-block">
          <span class="label-inline">Prescription:</span>
          ${c.prescription ? c.prescription : "<span class='muted'>Not yet provided</span>"}
        </div>
      `;

      list.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = `<li class="case-card">Error loading patient cases.</li>`;
  }
}
// ======================= TECHNICIAN VIEW =======================
async function renderTechCases() {
  const list = document.getElementById("techCasesList");
  if (!list) return;

  list.innerHTML = `<li class="case-card">Loading...</li>`;

  try {
    const data = await apiRequest("/tech/cases");
    const cases = data.cases || [];

    if (!cases.length) {
      list.innerHTML = `<li class="case-card">No scheduled cases.</li>`;
      return;
    }

    list.innerHTML = "";

    cases.forEach(c => {
      const patName = c.patientName || c.patientUsername || "?";
      const imagesCount = c.images?.length || 0;

      const li = document.createElement("li");
      li.className = "case-card";

      li.innerHTML = `
        <div class="case-top">
          <div><b>${c.id}</b></div>
          <div class="badge badge-scan">${c.scanType}</div>
        </div>

        <div class="case-meta-line"><span class="label-inline">Patient:</span> ${patName} (${c.patientUsername})</div>
        <div class="case-meta-line"><span class="label-inline">Date:</span> ${c.date} • ${c.timeSlot}</div>
        <div class="case-meta-line"><span class="label-inline">Images:</span> ${imagesCount}</div>

        <div class="notes-block" style="margin-top:6px;">
          <span class="label-inline">Upload Images:</span><br>
          <input type="file" multiple accept="image/*" class="input-inline" data-case="${c.id}">
          <button class="small-btn" onclick="uploadImagesForCase('${c.id}', this)">Upload</button>
        </div>
      `;

      list.appendChild(li);
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = `<li class="case-card">Error loading technician cases.</li>`;
  }
}

async function uploadImagesForCase(caseId, btnEl) {
  const card = btnEl.closest(".case-card");
  const input = card.querySelector(`input[data-case="${caseId}"]`);

  if (!input.files.length) {
    alert("Choose at least one image.");
    return;
  }

  const formData = new FormData();
  Array.from(input.files).forEach(f => formData.append("images", f));

  try {
    await apiRequest(`/tech/upload/${encodeURIComponent(caseId)}`, {
      method: "POST",
      body: formData
    });

    input.value = "";
    renderTechCases();

    if (socket) socket.emit("images-updated", { caseId });

  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to upload images.");
  }
}



// ======================= RADIOLOGIST VIEW =======================
async function renderRadioCases() {
  const list = document.getElementById("radioCasesList");
  if (!list) return;

  list.innerHTML = `<li class="case-card">Loading...</li>`;

  try {
    const data = await apiRequest("/radio/cases");
    const cases = data.cases || [];

    if (!cases.length) {
      list.innerHTML = `<li class="case-card">No cases with images yet.</li>`;
      return;
    }

    list.innerHTML = "";

    cases.forEach(c => {
      const patName = c.patientName || c.patientUsername || "?";
      const docName = c.doctorName || c.doctorUsername || "?";

      const li = document.createElement("li");
      li.className = "case-card";

      li.innerHTML = `
        <div class="case-top">
          <div><b>${c.id}</b></div>
          <div>
            ${priorityBadge(c.priority)}
            <span class="badge badge-scan">${c.scanType}</span>
          </div>
        </div>

        <div class="case-meta-line"><span class="label-inline">Patient:</span> ${patName} (${c.patientUsername})</div>
        <div class="case-meta-line"><span class="label-inline">Doctor:</span> ${docName} (${c.doctorUsername})</div>
        <div class="case-meta-line"><span class="label-inline">When:</span> ${c.date} • ${c.timeSlot}</div>
        <div class="case-meta-line"><span class="label-inline">Symptoms:</span> ${c.symptoms || "-"}</div>

        <div class="notes-block">
          <span class="label-inline">Images:</span>
          <div class="image-strip" data-case="${c.id}"></div>
        </div>

        <div class="notes-block" style="margin-top:6px;">
          <span class="label-inline">Radiologist Notes:</span>
          <textarea class="input-inline" data-case="${c.id}" data-field="rnotes">${c.radiologistNotes || ""}</textarea>
          <button class="small-btn" onclick="saveRadiologistNotes('${c.id}', this)">Save</button>
        </div>

        <div class="notes-block" style="margin-top:4px;">
          <span class="label-inline">Doctor Notes:</span>
          ${c.doctorNotes || "<span class='muted'>Not added</span>"}
        </div>
      `;

      list.appendChild(li);

      // Load thumbnails
      const holder = li.querySelector(`.image-strip[data-case="${c.id}"]`);
      if (!c.images?.length) {
        holder.innerHTML = "<span class='muted'>No images uploaded</span>";
      } else {
        c.images.forEach(img => {
          const url = `${API_BASE}/uploads/${encodeURIComponent(img)}`;
          const tag = document.createElement("img");
          tag.src = url;
          tag.onclick = () => window.open(url, "_blank");
          holder.appendChild(tag);
        });
      }
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = `<li class="case-card">Error loading radiology queue.</li>`;
  }
}



// ======================= RADIOLOGIST: SAVE NOTES =======================
async function saveRadiologistNotes(caseId, btnEl) {
  const card = btnEl.closest(".case-card");
  const notesEl = card.querySelector(`textarea[data-case="${caseId}"][data-field="rnotes"]`);

  const radiologistNotes = notesEl.value.trim();

  try {
    await apiRequest(`/radio/notes/${encodeURIComponent(caseId)}`, {
      method: "POST",
      body: { radiologistNotes }
    });

    btnEl.textContent = "Saved";
    setTimeout(() => (btnEl.textContent = "Save"), 1000);

    if (socket) socket.emit("radiologist-updated", { caseId });

  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to save radiologist notes.");
  }
}
// ======================= SOCKET.IO LIVE UPDATES =======================

// ======================= SOCKET.IO LIVE UPDATES =======================
function setupSocket() {
  if (!currentUser) return;

  socket = io(API_BASE, {
  transports: ["websocket"],
  withCredentials: true,
  extraHeaders: {
    "Access-Control-Allow-Credentials": "true"
  }
});


  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);

    socket.emit("register", {
      username: currentUser.username,
      role: currentUser.role
    });
  });

  socket.on("case-created", () => {
    if (currentRole === "doctor") renderDoctorCases();
    if (currentRole === "patient") renderPatientCases();
    if (currentRole === "technician") renderTechCases();
  });

  socket.on("doctor-updated", () => {
    if (currentRole === "technician") renderTechCases();
    if (currentRole === "radiologist") renderRadioCases();
  });

  socket.on("images-updated", () => {
    if (currentRole === "radiologist") renderRadioCases();
    if (currentRole === "doctor") renderDoctorCases();
  });

  socket.on("radiologist-updated", () => {
    if (currentRole === "doctor") renderDoctorCases();
    if (currentRole === "patient") renderPatientCases();
  });

  socket.on("disconnect", () => {
    console.warn("Socket disconnected.");
  });
}
