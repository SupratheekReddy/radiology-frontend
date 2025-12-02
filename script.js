/* ============================================================
   FRONTEND SCRIPT.JS — UPDATED FOR NEW UI LAYOUT (A1)
   Matches new index.html + server.js
============================================================ */

const API_BASE = "https://radiology-backend-vvor.onrender.com";

// GLOBAL STATE
let socket = null;
let currentUser = null;
let currentRole = "patient";

/* ============================================================
   PAGE NAVIGATION
============================================================ */
function navigateToLogin() {
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
    document.getElementById("appLayout").style.display = "none";
}

function navigateToHome() {
    document.getElementById("landingPage").style.display = "block";
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appLayout").style.display = "none";
}

/* After login → Open dashboard */
function openAppLayout() {
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appLayout").style.display = "flex";
}

/* ============================================================
   API WRAPPER
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
   ROLE SELECTOR (New UI)
============================================================ */
const roleToggle = document.getElementById("roleToggle");
const loginId = document.getElementById("loginId");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

function updatePlaceholder(role) {
    switch (role) {
        case "admin": loginId.placeholder = "admin"; break;
        case "doctor": loginId.placeholder = "doctor@example.com"; break;
        case "technician": loginId.placeholder = "tech@example.com"; break;
        case "radiologist": loginId.placeholder = "radiologist"; break;
        case "patient": loginId.placeholder = "patient@example.com"; break;
    }
}

if (roleToggle) {
    roleToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".role-card");
        if (!btn) return;

        // Remove active from all
        document.querySelectorAll(".role-card").forEach(x => x.classList.remove("active"));

        // Set clicked active
        btn.classList.add("active");

        // Set new role
        currentRole = btn.dataset.role;
        updatePlaceholder(currentRole);

        loginError.style.display = "none";
    });
}

/* ============================================================
   LOGIN HANDLER
============================================================ */
document.getElementById("loginBtn")?.addEventListener("click", handleLogin);

async function handleLogin() {
    const username = loginId.value.trim();
    const password = loginPassword.value.trim();

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

        loadDashboard();
        setupSocket();
    } catch (err) {
        loginError.textContent = err.message || "Login failed.";
        loginError.style.display = "block";
    }
}

/* ============================================================
   DASHBOARD LOADING
============================================================ */
function loadDashboard() {
    openAppLayout();

    // Set user info in sidebar
    document.getElementById("displayUsername").textContent = currentUser.username;
    document.getElementById("displayRole").textContent = currentUser.role;

    loadSidebarForRole();
    loadInitialRoleView();
}

/* ============================================================
   SIDEBAR NAV (Dynamic for each role)
============================================================ */

function loadSidebarForRole() {
    const nav = document.getElementById("dynamicNav");
    nav.innerHTML = "";

    const tabs = {
        admin: [
            ["Add Doctor", "adminAddDoctor"],
            ["Add Technician", "adminAddTech"],
            ["Add Radiologist", "adminAddRadio"],
            ["Add Patient", "adminAddPatient"],
            ["Schedule Case", "adminSchedule"],
            ["All Cases", "adminCases"]
        ],
        doctor: [["Cases", "doctorCasesView"]],
        technician: [["Upload Images", "techCasesView"]],
        radiologist: [["Analyze Scans", "radioCasesView"]],
        patient: [["My Cases", "patientCasesView"]]
    };

    tabs[currentRole].forEach(([label, target]) => {
        const btn = document.createElement("button");
        btn.className = "nav-item";
        btn.textContent = label;
        btn.dataset.target = target;
        nav.appendChild(btn);

        btn.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");
            showMainSection(target);
        });
    });
}

/* Show one dashboard section */
function showMainSection(id) {
    document.querySelectorAll(".view-group").forEach(v => v.style.display = "none");
    const sec = document.getElementById(id);
    if (sec) sec.style.display = "block";
}

/* Initial load after login */
function loadInitialRoleView() {
    if (currentRole === "admin") showMainSection("adminAddDoctor");
    if (currentRole === "doctor") renderDoctorCases();
    if (currentRole === "technician") renderTechCases();
    if (currentRole === "radiologist") renderRadioCases();
    if (currentRole === "patient") renderPatientCases();
}
/* ============================================================
   LOGIN FLOW (Matches NEW UI Layout)
   ============================================================= */

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

        // SWITCH FROM LOGIN PAGE → APP LAYOUT
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("appLayout").style.display = "flex";

        // Update profile panel
        document.getElementById("displayUsername").textContent = currentUser.name;
        document.getElementById("displayRole").textContent = currentRole;
        document.getElementById("userAvatar").src =
            "https://cdn-icons-png.flaticon.com/512/149/149071.png";

        buildSidebarForRole();
        loadRoleDashboard();

        setupSocket();

    } catch (err) {
        loginError.textContent = err.message || "Login failed.";
        loginError.style.display = "block";
    }
}

/* ============================================================
   SWITCH DASHBOARD VIEW BASED ON ROLE
   ============================================================= */
function loadRoleDashboard() {
    hideAllRoleViews();

    if (currentRole === "admin") {
        document.getElementById("adminSections").style.display = "block";
        refreshAdminDropdowns();
        renderAdminCases();
    }
    if (currentRole === "doctor") {
        document.getElementById("doctorCasesView").style.display = "block";
        renderDoctorCases();
    }
    if (currentRole === "technician") {
        document.getElementById("techCasesView").style.display = "block";
        renderTechCases();
    }
    if (currentRole === "radiologist") {
        document.getElementById("radioCasesView").style.display = "block";
        renderRadioCases();
    }
    if (currentRole === "patient") {
        document.getElementById("patientCasesView").style.display = "block";
        renderPatientCases();
    }
}

function hideAllRoleViews() {
    document.querySelectorAll(".view-group").forEach(v => v.style.display = "none");
}

/* ============================================================
   ROLE‑BASED SIDEBAR BUILDER
   Matches NEW UI (dynamicNav)
   ============================================================= */

function buildSidebarForRole() {
    const nav = document.getElementById("dynamicNav");
    nav.innerHTML = "";

    const makeItem = (label, target) => {
        const btn = document.createElement("button");
        btn.className = "nav-item";
        btn.textContent = label;
        btn.onclick = () => {
            document.getElementById("pageTitle").textContent = label;
            hideAllRoleViews();
            document.getElementById(target).style.display = "block";
        };
        return btn;
    };

    if (currentRole === "admin") {
        nav.appendChild(makeItem("Dashboard", "adminSections"));
    }

    if (currentRole === "doctor") {
        nav.appendChild(makeItem("My Cases", "doctorCasesView"));
    }

    if (currentRole === "technician") {
        nav.appendChild(makeItem("Upload Scans", "techCasesView"));
    }

    if (currentRole === "radiologist") {
        nav.appendChild(makeItem("Analyze Cases", "radioCasesView"));
    }

    if (currentRole === "patient") {
        nav.appendChild(makeItem("My Reports", "patientCasesView"));
    }
}
/* ============================================================
   ADMIN PANEL — ADD DOCTOR / TECH / PATIENT / RADIOLOGIST
   ============================================================= */

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

/* ============================================================
   SCHEDULING CASE FROM ADMIN PANEL
   ============================================================= */

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

async function renderAdminCases() {
    const list = adminCasesList;
    list.innerHTML = "<div class='case-card'>Loading...</div>";

    try {
        const data = await apiRequest("/admin/cases");

        if (!data.cases.length) {
            list.innerHTML = "<div class='case-card'>No cases found.</div>";
            return;
        }

        list.innerHTML = "";

        data.cases.forEach(c => {
            const card = document.createElement("div");
            card.className = "case-card";

            card.innerHTML = `
                <div class="case-top">
                    <b>${c._id}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${priorityBadge(c.priority)}
                </div>

                <div class="case-meta-line">Patient: ${c.patient?.name || "-"}</div>
                <div class="case-meta-line">Doctor: ${c.doctor?.name || "-"}</div>
                <div class="case-meta-line">Date: ${c.date}</div>
                <div class="case-meta-line">Slot: ${c.timeSlot}</div>
            `;

            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = "<div class='case-card'>Error loading cases</div>";
    }
}
/* ============================================================
   📡 SOCKET.IO LIVE UPDATES
============================================================ */
function setupSocket() {
    socket = io(API_BASE, {
        transports: ["websocket"],
        withCredentials: true
    });

    socket.on("connect", () => {
        console.log("Socket connected");
    });

    // When a case is created → doctor, patient, tech auto-refresh
    socket.on("case-created", () => {
        if (currentRole === "doctor") renderDoctorCases();
        if (currentRole === "patient") renderPatientCases();
        if (currentRole === "technician") renderTechCases();
        if (currentRole === "radiologist") renderRadioCases();
    });

    // Doctor updated diagnosis → radiologist refreshes
    socket.on("doctor-updated", () => {
        if (currentRole === "radiologist") renderRadioCases();
    });

    // New images uploaded → radiologist refresh
    socket.on("images-updated", () => {
        if (currentRole === "technician") renderTechCases();
        if (currentRole === "radiologist") renderRadioCases();
    });

    // Radiologist updates notes → doctor refresh
    socket.on("radiologist-updated", () => {
        if (currentRole === "doctor") renderDoctorCases();
        if (currentRole === "patient") renderPatientCases();
    });

    // AI report created → radiologist sees new report immediately
    socket.on("ai-report-generated", () => {
        if (currentRole === "radiologist") renderRadioCases();
        if (currentRole === "doctor") renderDoctorCases();
        if (currentRole === "patient") renderPatientCases();
    });
}

/* ============================================================
   🚀 PAGE NAVIGATION (Landing → Login → Dashboard)
============================================================ */
function navigateToLogin() {
    document.getElementById("landingPage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
}

function navigateToHome() {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("landingPage").style.display = "block";
}
