/* ============================================================
   FRONTEND SCRIPT.JS — COMPLETE (TECH UPLOAD + RADIO AI)
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
        credentials: "include", // Essential for session cookies
    };

    // If body is NOT FormData (i.e., JSON), set headers and stringify
    if (options.body && !(options.body instanceof FormData)) {
        finalOptions.headers["Content-Type"] = "application/json";
        finalOptions.body = JSON.stringify(options.body);
    } 
    // If body IS FormData, let browser set Content-Type automatically (multipart/form-data)
    else if (options.body instanceof FormData) {
        finalOptions.body = options.body;
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
        renderRadioCases(); // <--- This now works with AI
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
   TECHNICIAN FUNCTIONS (UPLOAD LOGIC)
   Fully implemented to work with server routes
============================================================ */

async function renderTechCases() {
    const list = document.getElementById("techCasesList");
    if (!list) return;

    list.innerHTML = "<div class='loading-spinner'>Loading pending scans...</div>";

    try {
        const data = await apiRequest("/technician/cases"); 
        const cases = data.cases || [];

        if (cases.length === 0) {
            list.innerHTML = "<div class='case-card'>No cases found assigned or pending.</div>";
            return;
        }

        list.innerHTML = ""; // Clear loading message

        cases.forEach(c => {
            const card = document.createElement("div");
            card.className = "case-card";
            
            // Check if images array has items
            const isCompleted = c.images && c.images.length > 0;

            card.innerHTML = `
                <div class="case-top">
                    <b>ID: ${c._id.substring(0, 8)}...</b>
                    <span class="badge badge-scan">${c.scanType || 'General'}</span>
                    ${isCompleted 
                        ? `<span class="badge" style="background:#d1fae5; color:#065f46">Scanned</span>` 
                        : `<span class="badge" style="background:#fee2e2; color:#991b1b">Pending</span>`
                    }
                </div>

                <div class="case-details" style="margin: 10px 0; font-size: 0.9rem; color: #555;">
                    <p><strong>Patient:</strong> ${c.patient?.name || "Unknown"}</p>
                    <p><strong>Doctor:</strong> ${c.doctor?.name || "Unknown"}</p>
                    <p><strong>Symptoms:</strong> ${c.symptoms || "N/A"}</p>
                </div>

                <div class="upload-section" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    ${isCompleted 
                        ? `<p style="color:green; font-size:0.9rem;"><i class="fa-solid fa-check"></i> Images Uploaded</p>` 
                        : `
                        <label style="display:block; margin-bottom:5px; font-size:0.85rem;">Upload Scan Image:</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="file" id="file-${c._id}" class="inp" style="padding: 5px; flex-grow:1;">
                            <button class="btn-primary" onclick="uploadScan('${c._id}')">
                                <i class="fa-solid fa-cloud-arrow-up"></i> Upload
                            </button>
                        </div>
                        `
                    }
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class='case-card' style='color:red'>Error: ${err.message}</div>`;
    }
}

async function uploadScan(caseId) {
    const fileInput = document.getElementById(`file-${caseId}`);
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("images", file); 

    const btn = fileInput.nextElementSibling;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    btn.disabled = true;

    try {
        await apiRequest(`/tech/upload-cloud/${caseId}`, {
            method: "POST",
            body: formData
        });

        alert("Scan uploaded successfully!");
        renderTechCases(); 
        
        if(socket) socket.emit("images-updated", { caseId });

    } catch (err) {
        alert("Upload Failed: " + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


/* ============================================================
   RADIOLOGIST FUNCTIONS (AI LOGIC)
   Displays image + "Generate AI Report" button
============================================================ */

async function renderRadioCases() {
    const list = document.getElementById("radioCasesList");
    if (!list) return;

    list.innerHTML = "<div class='loading-spinner'>Loading cases for analysis...</div>";

    try {
        // Fetch all cases (Using admin endpoint to see everything)
        // In a real app, you might have /radio/cases
        const data = await apiRequest("/admin/cases");
        const cases = data.cases || [];

        list.innerHTML = "";

        // Filter only cases that have images uploaded by tech
        const readyCases = cases.filter(c => c.images && c.images.length > 0);

        if (readyCases.length === 0) {
            list.innerHTML = "<div class='case-card'>No scanned cases waiting for analysis.</div>";
            return;
        }

        readyCases.forEach(c => {
            const card = document.createElement("div");
            card.className = "case-card";

            // Check if AI report already exists in notes
            const hasReport = c.radiologistNotes && c.radiologistNotes.includes("AI ANALYSIS REPORT");
            const imageUrl = c.images[0]; // Display first image

            card.innerHTML = `
                <div class="case-top">
                    <b>ID: ${c._id.substring(0, 8)}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${hasReport 
                        ? `<span class="badge" style="background:#d1fae5; color:#065f46">Report Ready</span>`
                        : `<span class="badge" style="background:#fff7ed; color:#c2410c">Needs Analysis</span>`
                    }
                </div>

                <div class="split-view" style="display:flex; flex-wrap: wrap; gap:15px; margin-top:15px;">
                    <!-- LEFT: THE SCAN IMAGE -->
                    <div style="flex:1; min-width: 200px;">
                        <small style="color:#666; display:block; margin-bottom:5px;">Uploaded Scan:</small>
                        <a href="${imageUrl}" target="_blank">
                            <img src="${imageUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">
                        </a>
                    </div>

                    <!-- RIGHT: AI ACTIONS / REPORT -->
                    <div style="flex:2; min-width: 200px;">
                        ${hasReport 
                            ? `<div class="ai-result-box" style="background:#f8f9fa; padding:10px; border-radius:6px; font-size:0.85rem; max-height:150px; overflow-y:auto; border-left: 3px solid #6366f1;">
                                <strong><i class="fa-solid fa-robot"></i> AI Findings:</strong><br>
                                ${c.radiologistNotes.replace(/\n/g, '<br>')}
                               </div>`
                            : `<div style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:start;">
                                <p style="font-size:0.9rem; color:#555; margin-bottom:10px;">
                                    Scan is ready. Run AI analysis to detect anomalies.
                                </p>
                                <button class="btn-primary" id="btn-ai-${c._id}" onclick="generateAIReport('${c._id}')">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI Report
                                </button>
                               </div>`
                        }
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = `<div class='case-card'>Error: ${err.message}</div>`;
    }
}

async function generateAIReport(caseId) {
    const btn = document.getElementById(`btn-ai-${caseId}`);
    const originalText = btn.innerHTML;
    
    // 1. UI Loading State
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...`;
    btn.disabled = true;

    try {
        // 2. Call Server Endpoint
        const data = await apiRequest(`/radio/ai-analyze/${caseId}`, { method: "POST" });

        if (data.success) {
            // 3. Refresh View to show the new report
            await renderRadioCases();
            
            // Notify other users
            if(socket) socket.emit("ai-report-generated", { caseId });
        } else {
            throw new Error(data.message);
        }

    } catch (err) {
        alert("AI Analysis Failed: " + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/* ============================================================
   OTHER ROLES
============================================================ */
async function renderDoctorCases() {
    const list = document.getElementById("doctorCasesList");
    if(!list) return;
    list.innerHTML = "Fetching doctor cases...";
    // Placeholder - connect to specific doctor endpoint if needed
    // const data = await apiRequest("/doctor/cases/ME");
    list.innerHTML = "<div class='case-card'>Doctor Dashboard Loaded (Connect endpoint to see specific cases)</div>";
}

async function renderPatientCases() {
    document.getElementById("patientCasesList").innerHTML = "<div class='case-card'>Patient records loaded.</div>";
}

/* ============================================================
   SOCKET.IO LIVE UPDATES
============================================================ */
function setupSocket() {
    try {
        socket = io(API_BASE, { transports: ["websocket"], withCredentials: true });
        
        socket.on("connect", () => console.log("Socket Connected"));
        
        // Listen for events
        socket.on("case-created", () => {
            if(currentRole === "admin") renderAdminCases();
            if(currentRole === "technician") renderTechCases(); 
        });
        
        socket.on("images-updated", () => {
             if(currentRole === "technician") renderTechCases(); 
             if(currentRole === "radiologist") renderRadioCases(); // Radiologist sees new scan instantly
        });

        socket.on("ai-report-generated", () => {
             if(currentRole === "radiologist") renderRadioCases(); // Update view to show report
             if(currentRole === "doctor") renderDoctorCases();
        });

    } catch(e) {
        console.warn("Socket failed to connect", e);
    }
}