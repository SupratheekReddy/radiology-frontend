/* ============================================================
   FRONTEND SCRIPT.JS — FINAL VERSION (Matches Latest Server.js)
   ============================================================ */

const API_BASE = "https://radiology-backend-vvor.onrender.com";

// GLOBAL STATE
let socket = null;
let currentUser = null;
let currentRole = "admin";

/* ============================================================
   GENERIC API REQUEST WRAPPER
   ============================================================ */
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

/* ============================================================
   BADGE HELPERS
   ============================================================ */
function priorityBadge(p) {
    if (p === "Critical") return `<span class="badge badge-critical">Critical</span>`;
    if (p === "Medium") return `<span class="badge badge-medium">Medium</span>`;
    return `<span class="badge badge-safe">Safe</span>`;
}

/* ============================================================
   ROLE TOGGLE
   ============================================================ */
const roleToggle = document.getElementById("roleToggle");
const loginError = document.getElementById("loginError");
const loginIdInput = document.getElementById("loginId");
const loginPasswordInput = document.getElementById("loginPassword");

function updatePlaceholder(role) {
    switch (role) {
        case "admin": loginIdInput.placeholder = "admin"; break;
        case "doctor": loginIdInput.placeholder = "doctor@example.com"; break;
        case "technician": loginIdInput.placeholder = "tech@example.com"; break;
        case "radiologist": loginIdInput.placeholder = "radiologist"; break;
        case "patient": loginIdInput.placeholder = "patient@example.com"; break;
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

/* ============================================================
   LOGIN FLOW
   ============================================================ */
document.getElementById("loginBtn")?.addEventListener("click", handleLogin);

async function handleLogin() {
    const username = loginIdInput.value.trim();
    const password = loginPasswordInput.value.trim();

    loginError.style.display = "none";

    if (!username || !password) {
        loginError.textContent = "Please fill both fields.";
        loginError.style.display = "block";
        return;
    }

    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: { username, password, role: currentRole }
        });

        if (!data.success) {
            loginError.textContent = data.message;
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

function openDashboard(id) {
    document.getElementById("loginCard").style.display = "none";
    document.querySelectorAll(".dashboard").forEach(d => d.style.display = "none");
    document.getElementById(id).style.display = "block";
}

function openDashboardForRole() {
    if (currentRole === "admin") {
        openDashboard("adminDashboard");
        initAdminUI();
    }
    if (currentRole === "doctor") {
        openDashboard("doctorDashboard");
        renderDoctorCases();
    }
    if (currentRole === "technician") {
        openDashboard("techDashboard");
        renderTechCases();
    }
    if (currentRole === "radiologist") {
        openDashboard("radioDashboard");
        renderRadioCases();
    }
    if (currentRole === "patient") {
        openDashboard("patientDashboard");
        renderPatientCases();
    }
}

/* ============================================================
   LOGOUT
   ============================================================ */
async function logout() {
    try { await apiRequest("/auth/logout", { method: "POST" }); } catch {}

    location.reload();
}

/* ============================================================
   ADMIN PANEL
   ============================================================ */
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
    document.getElementById(id).style.display = "block";
}

/* ---- ADD DOCTOR ---- */
async function addDoctor() {
    const name = docName.value.trim();
    const email = docEmail.value.trim();
    const username = docUser.value.trim();

    if (!name || !email || !username) return;

    try {
        await apiRequest("/admin/doctor", {
            method: "POST",
            body: { name, email, username }
        });

        docSuccess.style.display = "block";
        setTimeout(() => docSuccess.style.display = "none", 1500);

        docName.value = "";
        docEmail.value = "";
        docUser.value = "";

        refreshAdminDropdowns();
        socket?.emit("admin-updated");
    } catch (err) {
        alert(err.message);
    }
}

/* ---- ADD TECH ---- */
async function addTechnician() {
    const name = techName.value.trim();
    const email = techEmail.value.trim();
    const username = techUser.value.trim();
    const password = techPass.value.trim();

    if (!name || !email || !username || !password) return;

    try {
        await apiRequest("/admin/technician", {
            method: "POST",
            body: { name, email, username, password }
        });

        techSuccess.style.display = "block";
        setTimeout(() => techSuccess.style.display = "none", 1500);

        techName.value = techEmail.value = techUser.value = techPass.value = "";
        socket?.emit("admin-updated");
    } catch (err) {
        alert(err.message);
    }
}
/* ---- ADD RADIOLOGIST ---- */
async function addRadiologist() {
    const name = radioName.value.trim();
    const email = radioEmail.value.trim();
    const username = radioUser.value.trim();
    const password = radioPass.value.trim();

    if (!name || !email || !username || !password) return;

    try {
        await apiRequest("/admin/radiologist", {
            method: "POST",
            body: { name, email, username, password }
        });

        radioSuccess.style.display = "block";
        setTimeout(() => radioSuccess.style.display = "none", 1500);

        radioName.value = radioEmail.value = radioUser.value = radioPass.value = "";
        socket?.emit("admin-updated");
    } catch (err) {
        alert(err.message);
    }
}


/* ---- ADD PATIENT ---- */
async function addPatient() {
    const name = patName.value.trim();
    const email = patEmail.value.trim();
    const username = patUser.value.trim();
    const password = patPass.value.trim();
    const basePriority = patPriority.value;

    if (!name || !email || !username || !password) return;

    try {
        await apiRequest("/admin/patient", {
            method: "POST",
            body: { name, email, username, password, basePriority }
        });

        patSuccess.style.display = "block";
        setTimeout(() => patSuccess.style.display = "none", 1500);

        patName.value = patEmail.value = patUser.value = patPass.value = "";
        patPriority.value = "Critical";

        refreshAdminDropdowns();
        socket?.emit("admin-updated");
    } catch (err) {
        alert(err.message);
    }
}

/* ---- REFRESH DROPDOWNS ---- */
async function refreshAdminDropdowns() {
    const patSelect = casePatient;
    const docSelect = caseDoctor;

    patSelect.innerHTML = "";
    docSelect.innerHTML = "";

    try {
        const data = await apiRequest("/admin/lists");

        data.patients.forEach(p => {
            const o = document.createElement("option");
            o.value = p._id;
            o.textContent = `${p.name} (${p.username})`;
            patSelect.appendChild(o);
        });

        data.doctors.forEach(d => {
            const o = document.createElement("option");
            o.value = d._id;
            o.textContent = `${d.name} (${d.username})`;
            docSelect.appendChild(o);
        });

    } catch (err) {
        console.error(err);
    }
}

/* ---- SCHEDULE CASE ---- */
async function scheduleCase() {
    const body = {
        patient: casePatient.value,
        doctor: caseDoctor.value,
        date: caseDate.value,
        timeSlot: caseSlot.value,
        scanType: caseScanType.value,
        priority: casePriority.value,
        refDoctor: caseRefDoc.value,
        symptoms: caseSymptoms.value,
    };

    try {
        await apiRequest("/admin/case", { method: "POST", body });

        caseSuccess.style.display = "block";
        setTimeout(() => caseSuccess.style.display = "none", 1500);

        caseSymptoms.value = caseRefDoc.value = "";
        renderAdminCases();
        socket?.emit("case-created");
    } catch (err) {
        alert(err.message);
    }
}

/* ---- RENDER ADMIN CASES ---- */
async function renderAdminCases() {
    const list = adminCasesList;
    list.innerHTML = "<li class='case-card'>Loading...</li>";

    try {
        const data = await apiRequest("/admin/cases");

        if (!data.cases.length) {
            list.innerHTML = "<li class='case-card'>No cases found.</li>";
            return;
        }

        list.innerHTML = "";

        data.cases.forEach(c => {
            const li = document.createElement("li");
            li.className = "case-card";
            li.innerHTML = `
                <div class="case-top">
                    <b>${c._id}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${priorityBadge(c.priority)}
                </div>
                <div class="case-meta-line">Patient: ${c.patient?.name || "-"}</div>
                <div class="case-meta-line">Doctor: ${c.doctor?.name || "-"}</div>
                <div class="case-meta-line">When: ${c.date} • ${c.timeSlot}</div>
            `;
            list.appendChild(li);
        });

    } catch (err) {
        list.innerHTML = "<li class='case-card'>Error loading cases</li>";
    }
}

/* ============================================================
   DOCTOR PANEL
   ============================================================ */
async function renderDoctorCases() {
    const list = doctorCasesList;
    list.innerHTML = "<li class='case-card'>Loading...</li>";

    try {
        const data = await apiRequest(`/doctor/cases/${currentUser.id}`);
        const cases = data.cases;

        if (!cases.length) {
            list.innerHTML = "<li class='case-card'>No cases assigned.</li>";
            return;
        }

        list.innerHTML = "";

        cases.forEach(c => {
            const li = document.createElement("li");
            li.className = "case-card";
            li.innerHTML = `
                <div class="case-top">
                    <b>${c.patient?.name || "-"}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${priorityBadge(c.priority)}
                </div>
                <div class="case-meta-line">Case: ${c._id}</div>
                <div class="case-meta-line">When: ${c.date} • ${c.timeSlot}</div>
                <div class="case-meta-line">Symptoms: ${c.symptoms}</div>

                <textarea class="input-inline" id="docNote_${c._id}" placeholder="Doctor notes...">${c.diagnosis || ""}</textarea>
                <input class="input-inline" id="docSeverity_${c._id}" placeholder="Severity" value="${c.severity || ""}">
                <button class="small-btn" onclick="saveDoctorDiagnosis('${c._id}')">Save</button>
            `;
            list.appendChild(li);
        });

    } catch (err) {
        list.innerHTML = "<li class='case-card'>Error loading cases</li>";
    }
}

async function saveDoctorDiagnosis(id) {
    const diagnosis = document.getElementById(`docNote_${id}`).value;
    const severity = document.getElementById(`docSeverity_${id}`).value;

    try {
        await apiRequest(`/doctor/diagnosis/${id}`, {
            method: "POST",
            body: { diagnosis, severity }
        });

        alert("Saved!");
        socket?.emit("doctor-updated");
    } catch (err) {
        alert("Failed to save.");
    }
}

/* ============================================================
   PATIENT VIEW
   ============================================================ */
async function renderPatientCases() {
    const list = patientCasesList;
    list.innerHTML = "<li class='case-card'>Loading...</li>";

    try {
        const data = await apiRequest(`/patient/cases/${currentUser.id}`);

        if (!data.cases.length) {
            list.innerHTML = "<li class='case-card'>No scheduled cases.</li>";
            return;
        }

        list.innerHTML = "";

        data.cases.forEach(c => {
            const li = document.createElement("li");
            li.className = "case-card";

            li.innerHTML = `
                <div class="case-top">
                    <b>${c.scanType}</b>
                    ${priorityBadge(c.priority)}
                </div>
                <div class="case-meta-line">Case: ${c._id}</div>
                <div class="case-meta-line">Doctor: ${c.doctor?.name}</div>
                <div class="case-meta-line">When: ${c.date} • ${c.timeSlot}</div>
                <div class="case-meta-line">Diagnosis: ${c.diagnosis || "Not yet"}</div>
            `;

            list.appendChild(li);
        });

    } catch (err) {
        list.innerHTML = "<li class='case-card'>Error loading cases</li>";
    }
}

/* ============================================================
   TECHNICIAN PANEL
   ============================================================ */
async function renderTechCases() {
    const list = techCasesList;
    list.innerHTML = "<li class='case-card'>Loading...</li>";

    try {
        const data = await apiRequest("/admin/cases"); // tech gets all cases

        list.innerHTML = "";
        data.cases.forEach(c => {
            const li = document.createElement("li");
            li.className = "case-card";

            li.innerHTML = `
                <div class="case-top">
                    <b>${c._id}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                </div>

                <div class="case-meta-line">Patient: ${c.patient?.name}</div>
                <div class="case-meta-line">When: ${c.date} • ${c.timeSlot}</div>

                <input type="file" multiple accept="image/*" id="upload_${c._id}">
                <button class="small-btn" onclick="uploadImages('${c._id}')">Upload</button>
            `;

            list.appendChild(li);
        });

    } catch (err) {
        list.innerHTML = "<li class='case-card'>Error loading technician cases</li>";
    }
}

async function uploadImages(caseId) {
    const input = document.getElementById(`upload_${caseId}`);
    if (!input.files.length) return alert("Select images");

    const fd = new FormData();
    for (let f of input.files) fd.append("images", f);

    try {
        await apiRequest(`/tech/upload-cloud/${caseId}`, {
            method: "POST",
            body: fd
        });

        alert("Uploaded!");
        socket?.emit("images-updated");
    } catch (err) {
        alert("Upload failed");
    }
}

/* ============================================================
   RADIOLOGIST PANEL
   ============================================================ */
async function renderRadioCases() {
    const list = radioCasesList;
    list.innerHTML = "<li class='case-card'>Loading...</li>";

    try {
        const data = await apiRequest("/admin/cases"); // radiologist sees all cases with images

        list.innerHTML = "";

        data.cases.forEach(c => {
            const hasImages = c.images && c.images.length > 0;

            const li = document.createElement("li");
            li.className = "case-card";

            li.innerHTML = `
                <div class="case-top">
                    <b>${c._id}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${priorityBadge(c.priority)}
                </div>

                <div class="case-meta-line">Patient: ${c.patient?.name}</div>
                <div class="case-meta-line">Doctor: ${c.doctor?.name}</div>

                <div class="image-strip">
                    ${
                        hasImages
                        ? c.images.map(url => `<img src="${url}" onclick="window.open('${url}')">`).join("")
                        : "<span class='muted'>No images</span>"
                    }
                </div>

                <textarea id="radioNote_${c._id}" class="input-inline">${c.radiologistNotes || ""}</textarea>

                <button class="small-btn" onclick="saveRadioNotes('${c._id}')">Save Notes</button>
                <button class="small-btn" onclick="runAI('${c._id}')">Run AI</button>
            `;

            list.appendChild(li);
        });

    } catch (err) {
        list.innerHTML = "<li>Error loading cases</li>";
    }
}

async function saveRadioNotes(caseId) {
    const notes = document.getElementById(`radioNote_${caseId}`).value;

    try {
        await apiRequest(`/radio/notes/${caseId}`, {
            method: "POST",
            body: { radiologistNotes: notes }
        });

        alert("Saved!");
        socket?.emit("radiologist-updated");
    } catch (err) {
        alert("Save failed");
    }
}

async function runAI(caseId) {
    try {
        const data = await apiRequest(`/radio/ai-analyze/${caseId}`, {
            method: "POST"
        });

        alert("AI Report Added!");
        renderRadioCases();
        socket?.emit("ai-report-generated");

    } catch (err) {
        alert("AI failed");
    }
}

/* ============================================================
   LIVE SOCKET UPDATES
   ============================================================ */
function setupSocket() {
    socket = io(API_BASE, {
        transports: ["websocket"],
        withCredentials: true
    });

    socket.on("connect", () => {
        console.log("Socket connected");
    });

    socket.on("case-created", () => {
        if (currentRole === "doctor") renderDoctorCases();
        if (currentRole === "patient") renderPatientCases();
        if (currentRole === "technician") renderTechCases();
    });

    socket.on("doctor-updated", () => {
        if (currentRole === "radiologist") renderRadioCases();
    });

    socket.on("images-updated", () => {
        if (currentRole === "radiologist") renderRadioCases();
    });

    socket.on("radiologist-updated", () => {
        if (currentRole === "doctor") renderDoctorCases();
    });

    socket.on("ai-report-generated", () => {
        if (currentRole === "radiologist") renderRadioCases();
    });
}

