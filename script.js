/* ============================================================
   FRONTEND SCRIPT.JS — CLEANED & FIXED
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

function logout() {
    currentUser = null;
    currentRole = "patient";
    location.reload(); // Simple reload to clear state
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
    }

    try {
        const res = await fetch(`${API_BASE}${path}`, finalOptions);
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.message || `Request failed: ${res.status}`);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

/* ============================================================
   ROLE SELECTOR UI
============================================================ */
const roleToggle = document.getElementById("roleToggle");
const loginId = document.getElementById("loginId");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");

if (roleToggle) {
    roleToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".role-card");
        if (!btn) return;

        // UI Updates
        document.querySelectorAll(".role-card").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        loginError.style.display = "none";

        // Logic Updates
        currentRole = btn.dataset.role;
        
        // Placeholder Updates
        switch (currentRole) {
            case "admin": loginId.placeholder = "admin"; break;
            case "doctor": loginId.placeholder = "doctor@example.com"; break;
            case "technician": loginId.placeholder = "tech@example.com"; break;
            case "radiologist": loginId.placeholder = "radiologist"; break;
            case "patient": loginId.placeholder = "patient@example.com"; break;
        }
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
        showError("Please fill both fields.");
        return;
    }

    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: { username, password, role: currentRole }
        });

        if (!data.success) {
            showError(data.message);
            return;
        }

        // Success
        currentUser = data.user;
        currentRole = data.user.role;

        // Switch View
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("appLayout").style.display = "flex";

        // Update Sidebar User Info
        document.getElementById("displayUsername").textContent = currentUser.username;
        document.getElementById("displayRole").textContent = currentRole;

        // Setup Dashboard
        buildSidebarForRole();
        loadRoleDashboard();
        setupSocket();

    } catch (err) {
        showError(err.message || "Login failed. Check server.");
    }
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = "block";
}

/* ============================================================
   DASHBOARD & SIDEBAR LOGIC
============================================================ */
function hideAllRoleViews() {
    document.querySelectorAll(".view-group").forEach(v => v.style.display = "none");
}

function buildSidebarForRole() {
    const nav = document.getElementById("dynamicNav");
    nav.innerHTML = "";

    const createNavItem = (label, targetId) => {
        const btn = document.createElement("button");
        btn.className = "nav-item";
        btn.textContent = label;
        btn.onclick = () => {
            document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById("pageTitle").textContent = label;
            hideAllRoleViews();
            const el = document.getElementById(targetId);
            if(el) el.style.display = "block";
        };
        return btn;
    };

    // Define items per role
    if (currentRole === "admin") {
        nav.appendChild(createNavItem("Dashboard", "adminSections"));
    } else if (currentRole === "doctor") {
        nav.appendChild(createNavItem("My Cases", "doctorCasesView"));
    } else if (currentRole === "technician") {
        nav.appendChild(createNavItem("Upload Scans", "techCasesView"));
    } else if (currentRole === "radiologist") {
        nav.appendChild(createNavItem("Analyze Cases", "radioCasesView"));
    } else if (currentRole === "patient") {
        nav.appendChild(createNavItem("My Reports", "patientCasesView"));
    }
    
    // Auto-click first item
    if(nav.firstChild) nav.firstChild.click();
}

function loadRoleDashboard() {
    // Initial data fetch based on role
    if (currentRole === "admin") {
        refreshAdminDropdowns();
        renderAdminCases();
    } else if (currentRole === "doctor") {
        renderDoctorCases();
    } else if (currentRole === "technician") {
        renderTechCases();
    } else if (currentRole === "radiologist") {
        renderRadioCases();
    } else if (currentRole === "patient") {
        renderPatientCases();
    }
}

/* ============================================================
   ADMIN FUNCTIONS
============================================================ */
function getVal(id) { return document.getElementById(id).value.trim(); }
function setVal(id, val) { document.getElementById(id).value = val; }

async function addDoctor() {
    try {
        await apiRequest("/admin/doctor", {
            method: "POST",
            body: { name: getVal('docName'), email: getVal('docEmail'), username: getVal('docUser'), password: getVal('docPass') }
        });
        alertAndReset("docSuccess", ['docName','docEmail','docUser','docPass']);
        refreshAdminDropdowns();
    } catch(e) { alert(e.message); }
}

async function addTechnician() {
    try {
        await apiRequest("/admin/technician", {
            method: "POST",
            body: { name: getVal('techName'), email: getVal('techEmail'), username: getVal('techUser'), password: getVal('techPass') }
        });
        alertAndReset("techSuccess", ['techName','techEmail','techUser','techPass']);
    } catch(e) { alert(e.message); }
}

async function addRadiologist() {
    try {
        await apiRequest("/admin/radiologist", {
            method: "POST",
            body: { name: getVal('radioName'), email: getVal('radioEmail'), username: getVal('radioUser'), password: getVal('radioPass') }
        });
        alertAndReset("radioSuccess", ['radioName','radioEmail','radioUser','radioPass']);
    } catch(e) { alert(e.message); }
}

async function addPatient() {
    try {
        await apiRequest("/admin/patient", {
            method: "POST",
            body: { 
                name: getVal('patName'), 
                email: getVal('patEmail'), 
                username: getVal('patUser'), 
                password: getVal('patPass'),
                basePriority: document.getElementById('patPriority').value
            }
        });
        alertAndReset("patSuccess", ['patName','patEmail','patUser','patPass']);
        refreshAdminDropdowns();
    } catch(e) { alert(e.message); }
}

function alertAndReset(successId, inputIds) {
    document.getElementById(successId).style.display = "block";
    setTimeout(() => document.getElementById(successId).style.display = "none", 1500);
    inputIds.forEach(id => setVal(id, ""));
}

/* ============================================================
   ADMIN: SCHEDULING & LISTS
============================================================ */
async function refreshAdminDropdowns() {
    try {
        const data = await apiRequest("/admin/lists");
        const fill = (id, list) => {
            const el = document.getElementById(id);
            el.innerHTML = "";
            list.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item._id;
                opt.textContent = `${item.name} (${item.username})`;
                el.appendChild(opt);
            });
        };
        fill("casePatient", data.patients || []);
        fill("caseDoctor", data.doctors || []);
    } catch(e) { console.error("Error loading dropdowns", e); }
}

async function scheduleCase() {
    try {
        await apiRequest("/admin/case", {
            method: "POST",
            body: {
                patient: getVal('casePatient'),
                doctor: getVal('caseDoctor'),
                date: getVal('caseDate'),
                timeSlot: getVal('caseSlot'),
                scanType: getVal('caseScanType'),
                priority: getVal('casePriority'),
                refDoctor: getVal('caseRefDoc'),
                symptoms: getVal('caseSymptoms'),
            }
        });
        alertAndReset("caseSuccess", ['caseRefDoc', 'caseSymptoms']);
        renderAdminCases();
    } catch(e) { alert(e.message); }
}

async function renderAdminCases() {
    const list = document.getElementById("adminCasesList");
    if(!list) return;
    list.innerHTML = "Loading...";
    try {
        const data = await apiRequest("/admin/cases");
        renderListGeneric(list, data.cases || []);
    } catch(e) { list.innerHTML = "Error loading cases."; }
}

function renderListGeneric(container, cases) {
    if (!cases.length) {
        container.innerHTML = "<div class='case-card'>No cases found.</div>";
        return;
    }
    container.innerHTML = "";
    cases.forEach(c => {
        const card = document.createElement("div");
        card.className = "case-card";
        card.innerHTML = `
            <div class="case-top">
                <b>${c._id.substring(0,8)}...</b>
                <span class="badge badge-scan">${c.scanType || 'Scan'}</span>
                ${priorityBadge(c.priority)}
            </div>
            <div class="case-meta-line">Patient: ${c.patient?.name || "-"}</div>
            <div class="case-meta-line">Doctor: ${c.doctor?.name || "-"}</div>
            <div class="case-meta-line">Date: ${c.date || "?"} | ${c.timeSlot || "?"}</div>
        `;
        container.appendChild(card);
    });
}

function priorityBadge(p) {
    let color = "gray";
    if(p === "Critical") color = "red";
    if(p === "Medium") color = "orange";
    if(p === "Safe") color = "green";
    return `<span style="color:${color}; font-weight:bold">${p || '-'}</span>`;
}

/* ============================================================
   OTHER ROLES (PLACEHOLDERS)
   These functions were missing in your original code, causing crashes.
============================================================ */
async function renderDoctorCases() {
    const list = document.getElementById("doctorCasesList");
    list.innerHTML = "Fetching doctor cases...";
    try {
        // Example endpoint, ensure your backend has this or change to /admin/cases
        // const data = await apiRequest("/doctor/cases"); 
        // renderListGeneric(list, data.cases);
        list.innerHTML = "Doctor cases loaded (Connect backend endpoint)";
    } catch(e) { list.innerHTML = "No cases or error."; }
}

async function renderPatientCases() {
    document.getElementById("patientCasesList").innerHTML = "Patient records loaded.";
}

async function renderTechCases() {
    document.getElementById("techCasesList").innerHTML = "Ready for uploads.";
}

async function renderRadioCases() {
    document.getElementById("radioCasesList").innerHTML = "Waiting for scans to analyze.";
}

/* ============================================================
   SOCKET.IO LIVE UPDATES
============================================================ */
function setupSocket() {
    try {
        socket = io(API_BASE, { transports: ["websocket"], withCredentials: true });
        
        socket.on("connect", () => console.log("Socket Connected"));
        
        socket.on("case-created", () => {
            if(currentRole === "admin") renderAdminCases();
            // trigger other refreshes if needed
        });
        
        socket.on("admin-updated", () => {
            if(currentRole === "admin") refreshAdminDropdowns();
        });

    } catch(e) {
        console.warn("Socket failed to connect", e);
    }
}