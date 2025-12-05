/* ============================================================
   FRONTEND SCRIPT.JS — ORIGINAL STRUCTURE + NEW FEATURES
   (Auto-Triage, Chat, Timeline, Prescriptions, PDF)
============================================================ */

// Matches the port defined in your server.js
const API_BASE = "http://localhost:5000"; 

// GLOBAL STATE
let socket = null;
let currentUser = null;
let currentRole = "patient";
let activeCaseId = null; // Added for Prescription Modal tracking

/* ============================================================
   INITIALIZATION (Check if already logged in)
============================================================ */
window.addEventListener('DOMContentLoaded', checkSession);

async function checkSession() {
    try {
        const data = await apiRequest("/auth/me");
        if (data.success && data.user) {
            // Restore session
            currentUser = data.user;
            currentRole = data.user.role;
            
            // Show Dashboard immediately
            document.getElementById("landingPage").style.display = "none";
            document.getElementById("loginPage").style.display = "none";
            document.getElementById("appLayout").style.display = "flex";

            updateSidebarProfile();
            buildSidebarForRole();
            loadRoleDashboard();
            setupSocket();
        }
    } catch (err) {
        // Not logged in, stay on landing page
        console.log("No active session");
    }
}

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

async function logout() {
    try {
        await apiRequest("/auth/logout", { method: "POST" });
    } catch(e) {}
    currentUser = null;
    currentRole = "patient";
    window.location.reload(); 
}

function updateSidebarProfile() {
    if(currentUser) {
        document.getElementById("displayUsername").textContent = currentUser.username;
        document.getElementById("displayRole").textContent = currentRole;
    }
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

        document.querySelectorAll(".role-card").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        loginError.style.display = "none";

        currentRole = btn.dataset.role;
        
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

        currentUser = data.user;
        currentRole = data.user.role;

        document.getElementById("loginPage").style.display = "none";
        document.getElementById("appLayout").style.display = "flex";

        updateSidebarProfile();
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
    
    if(nav.firstChild) nav.firstChild.click();
}

function loadRoleDashboard() {
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
   ADMIN FUNCTIONS (Keep Original Logic)
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
            if(!el) return;
            el.innerHTML = "";
            list.forEach(item => {
                const opt = document.createElement("option");
                opt.value = item._id;
                opt.dataset.username = item.username; 
                opt.textContent = `${item.name} (${item.username})`;
                el.appendChild(opt);
            });
        };
        fill("casePatient", data.patients || []);
        fill("caseDoctor", data.doctors || []);
    } catch(e) { console.error("Error loading dropdowns", e); }
}

// ... (Your original scheduleCase logic) ...

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
        const displayId = c.caseId || c._id.substring(0,8);
        
        card.innerHTML = `
            <div class="case-top">
                <b>${displayId}</b>
                <span class="badge badge-scan">${c.scanType || 'Scan'}</span>
                ${priorityBadge(c.priority)}
            </div>
            <div class="case-meta-line">Patient: ${c.patient?.name || c.patientUsername || "-"}</div>
            <div class="case-meta-line">Doctor: ${c.doctor?.name || c.doctorUsername || "-"}</div>
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
   TECHNICIAN FUNCTIONS (With Badge Fix)
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

        list.innerHTML = ""; 

        cases.forEach(c => {
            const card = document.createElement("div");
            card.className = "case-card";
            
            const isCompleted = c.images && c.images.length > 0;
            const displayId = c.caseId || c._id.substring(0,8);

            card.innerHTML = `
                <div class="case-top">
                    <b>ID: ${displayId}</b>
                    <span class="badge badge-scan">${c.scanType || 'General'}</span>
                    ${isCompleted 
                        ? `<span class="badge" style="background:#d1fae5; color:#065f46">Scanned</span>` 
                        : `<span class="badge" style="background:#fee2e2; color:#991b1b">Pending</span>`
                    }
                </div>

                <div class="case-details" style="margin: 10px 0; font-size: 0.9rem; color: #555;">
                    <p><strong>Patient:</strong> ${c.patient?.name || c.patientUsername || "Unknown"}</p>
                    <p><strong>Doctor:</strong> ${c.doctor?.name || c.doctorUsername || "Unknown"}</p>
                    <p><strong>Symptoms:</strong> ${c.symptoms || "N/A"}</p>
                </div>

                <div class="upload-section" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    ${isCompleted 
                        ? `<p style="color:green; font-size:0.9rem;"><i class="fa-solid fa-check"></i> Images Uploaded</p>` 
                        : `
                        <label style="display:block; margin-bottom:5px; font-size:0.85rem;">Upload Scan Image:</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="file" id="file-${c._id}" class="inp" style="padding: 5px; flex-grow:1;">
                            <button class="btn-primary" onclick="uploadScan(event, '${c._id}')">
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
        list.innerHTML = `<div class='case-card' style='color:red'>Error: ${err.message}</div>`;
    }
}

async function uploadScan(e, caseId) {
    const fileInput = document.getElementById(`file-${caseId}`);
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const formData = new FormData();
    formData.append("images", file); 

    // Visual feedback on button
    e.target.innerText = "Uploading...";
    e.target.disabled = true;

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
        e.target.innerText = "Upload";
        e.target.disabled = false;
    }
}


/* ============================================================
   RADIOLOGIST FUNCTIONS (UPDATED: Auto-Triage + Chat)
============================================================ */

async function renderRadioCases() {
    const list = document.getElementById("radioCasesList");
    if (!list) return;

    list.innerHTML = "<div class='loading-spinner'>Loading cases for analysis...</div>";

    try {
        const data = await apiRequest("/admin/cases");
        const cases = data.cases || [];

        list.innerHTML = "";
        const readyCases = cases.filter(c => c.images && c.images.length > 0);

        // --- NEW: Sort by Priority (Critical First) ---
        const priorityOrder = { Critical: 0, Medium: 1, Safe: 2 };
        readyCases.sort((a,b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

        if (readyCases.length === 0) {
            list.innerHTML = "<div class='case-card'>No scanned cases waiting for analysis.</div>";
            return;
        }

        readyCases.forEach(c => {
            const card = document.createElement("div");
            
            // --- NEW: Red Flash for Critical Cases ---
            card.className = `case-card ${c.priority === 'Critical' ? 'critical-card' : ''}`;

            const hasReport = c.radiologistNotes && c.radiologistNotes.includes("AI ANALYSIS REPORT");
            const imageUrl = c.images[0]; 
            const displayId = c.caseId || c._id.substring(0,8);

            // --- NEW: Enhanced HTML with Chat & AI Tags ---
            card.innerHTML = `
                <div class="case-top">
                    <b>ID: ${displayId}</b>
                    <span class="badge badge-scan">${c.scanType}</span>
                    ${c.priority ? `<span class="badge ${c.priority}">${c.priority}</span>` : ''}
                </div>

                <div class="split-view" style="display:flex; flex-wrap: wrap; gap:15px; margin-top:15px;">
                    <!-- LEFT SIDE: IMAGE & AI REPORT -->
                    <div style="flex:1; min-width: 200px;">
                        <small style="color:#666; display:block; margin-bottom:5px;">Uploaded Scan:</small>
                        <a href="${imageUrl}" target="_blank">
                            <img src="${imageUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">
                        </a>
                        
                        <div style="margin-top:10px;">
                        ${c.aiData?.diagnosis 
                            ? `<div class="ai-result-box" style="background:#f8f9fa; padding:10px; border-radius:6px; font-size:0.85rem; border-left: 3px solid #6366f1;">
                                <div style="margin-bottom:5px;">
                                    <span class="tag">Conf: ${c.aiData.confidence}</span>
                                    <span class="tag blue">${c.aiData.bodyPart}</span>
                                </div>
                                <strong>Diagnosis:</strong> ${c.aiData.diagnosis}<br>
                                <small>${c.aiData.findings}</small>
                               </div>`
                            : `<button class="btn-primary full-width" onclick="generateAIReport(event, '${c._id}')">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> Run AI Analysis
                               </button>`
                        }
                        </div>
                    </div>

                    <!-- RIGHT SIDE: INTERACTIVE CHAT (NEW) -->
                    <div style="flex:1; min-width: 200px;">
                        <div class="chat-container" style="border:1px solid #eee; border-radius:8px; height:300px; display:flex; flex-direction:column;">
                            <div class="chat-history" id="chat-${c._id}" style="flex:1; overflow-y:auto; padding:10px; font-size:0.85rem;">
                                ${(c.chatHistory || []).map(msg => `
                                    <div class="msg ${msg.role}" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:${msg.role==='user'?'#6366f1':'#f1f5f9'}; color:${msg.role==='user'?'white':'black'}; align-self:${msg.role==='user'?'flex-end':'flex-start'}; max-width:80%;">
                                        ${msg.message}
                                    </div>
                                `).join('')}
                            </div>
                            <div class="chat-input" style="display:flex; padding:5px; border-top:1px solid #eee;">
                                <input type="text" id="inp-${c._id}" placeholder="Ask question..." style="flex:1; border:none; outline:none;">
                                <button class="btn-text" onclick="sendChat('${c._id}')">Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = `<div class='case-card'>Error: ${err.message}</div>`;
    }
}

async function generateAIReport(e, caseId) {
    e.target.innerText = "Analyzing...";
    try {
        const data = await apiRequest(`/radio/ai-analyze/${caseId}`, { method: "POST" });
        if (data.success) {
            await renderRadioCases();
            if(socket) socket.emit("ai-report-generated", { caseId });
        }
    } catch (err) {
        alert("AI Analysis Failed: " + err.message);
    }
}

// --- NEW: Chat Functionality ---
async function sendChat(caseId) {
    const input = document.getElementById(`inp-${caseId}`);
    const message = input.value;
    if (!message) return;

    // Optimistic UI Update
    const chatBox = document.getElementById(`chat-${caseId}`);
    chatBox.innerHTML += `<div class="msg user" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:#6366f1; color:white; align-self:flex-end; max-width:80%;">${message}</div>`;
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await apiRequest(`/ai/chat/${caseId}`, { 
            method: "POST", 
            body: { question: message } 
        });
        chatBox.innerHTML += `<div class="msg ai" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:#f1f5f9; color:black; align-self:flex-start; max-width:80%;">${res.answer}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) {
        alert("Chat failed");
    }
}

/* ============================================================
   DOCTOR FUNCTIONS (UPDATED: Prescriptions + Timeline + Create Case)
============================================================ */
async function renderDoctorCases() {
    const list = document.getElementById("doctorCasesList");
    if(!list) return;
    
    const docId = currentUser?.id || currentUser?._id;
    list.innerHTML = "<div class='loading-spinner'>Fetching your cases...</div>";

    try {
        const data = await apiRequest(`/doctor/cases/${docId}`);
        const cases = data.cases || [];

        if (cases.length === 0) {
            list.innerHTML = "<div class='case-card'>No cases assigned to you yet.</div>";
            return;
        }

        list.innerHTML = "";

        cases.forEach(c => {
            const card = document.createElement("div");
            card.className = "case-card";
            const imageUrl = c.images[0];

            card.innerHTML = `
                <div class="case-top">
                    <h3>${c.patient?.name || "Unknown Patient"}</h3>
                    <button class="btn-text" onclick="viewHistory('${c.patient._id}')">
                        <i class="fa-solid fa-clock-rotate-left"></i> History
                    </button>
                </div>

                <div class="split-view" style="display:flex; gap:15px; margin-top:10px;">
                    <img src="${imageUrl || 'https://via.placeholder.com/150?text=Waiting'}" style="width:100px; height:100px; object-fit:cover; border-radius:6px;">
                    
                    <div style="flex:1;">
                        <p><strong>Diagnosis:</strong> ${c.aiData?.diagnosis || 'Pending'}</p>
                        <p><strong>Rx:</strong> ${c.prescription || 'None'}</p>
                        ${c.images.length > 0 && !c.prescription ? `
                            <button class="btn-primary-outline full-width" onclick="openRx('${c._id}')">Write Prescription</button>
                        ` : ''}
                    </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch(e) {
        list.innerHTML = `<div class='case-card'>Error loading cases: ${e.message}</div>`;
    }
}

// --- NEW: Create Case Functions (Doctor) ---
async function openCreateCase() {
    document.getElementById('createCaseModal').style.display = 'flex';
    // Fetch patients list
    const res = await apiRequest("/admin/users/patient");
    const sel = document.getElementById('casePatientSelect');
    sel.innerHTML = res.users.map(u => `<option value="${u._id}">${u.name}</option>`).join('');
}

async function submitCreateCase() {
    const patientId = document.getElementById('casePatientSelect').value;
    const scanType = document.getElementById('caseScanType').value;
    const symptoms = document.getElementById('caseSymptoms').value;

    await apiRequest("/doctor/create-case", { 
        method: "POST", 
        body: { patientId, scanType, symptoms } 
    });
    
    document.getElementById('createCaseModal').style.display = 'none';
    renderDoctorCases();
}

// --- NEW: Prescription Modal Functions ---
function openRx(id) {
    activeCaseId = id;
    document.getElementById('prescribeModal').style.display = 'flex';
}

async function submitPrescription() {
    const text = document.getElementById('prescribeText').value;
    await apiRequest(`/doctor/prescribe/${activeCaseId}`, {
        method: "POST",
        body: { prescription: text }
    });
    document.getElementById('prescribeModal').style.display = 'none';
    renderDoctorCases();
}

// --- NEW: Timeline Function ---
async function viewHistory(pid) {
    const sidebar = document.getElementById('timelineSidebar');
    if(!sidebar) return;
    
    sidebar.style.display = 'block';
    document.getElementById('timelineContent').innerHTML = "Loading history...";
    
    const data = await apiRequest(`/patient/history/${pid}`);
    document.getElementById('timelineContent').innerHTML = data.history.map(h => `
        <div class="timeline-item" style="margin-bottom:15px; border-left:2px solid #ddd; padding-left:10px;">
            <small>${new Date(h.date).toLocaleDateString()}</small><br>
            <strong>${h.scanType}</strong> <span class="badge ${h.priority}">${h.priority}</span>
        </div>
    `).join('');
}

// Close Modal Helpers
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function closeTimeline() { document.getElementById('timelineSidebar').style.display = 'none'; }

/* ============================================================
   PATIENT FUNCTIONS (UPDATED: PDF Download)
============================================================ */
async function renderPatientCases() {
    const list = document.getElementById("patientCasesList");
    if(!list) return;
    try {
        const data = await apiRequest(`/patient/cases/${currentUser._id}`);
        list.innerHTML = "";
        data.cases.forEach(c => {
            list.innerHTML += `
                <div class="case-card">
                    <h3>${c.scanType} Scan</h3>
                    <p>Date: ${new Date(c.date).toLocaleDateString()}</p>
                    <div class="ai-box" style="background:#f8f9fa; padding:10px; margin:10px 0;">
                        <b>Diagnosis:</b> ${c.aiData?.diagnosis || 'Pending'}<br>
                        <b>Rx:</b> ${c.prescription || 'Pending'}
                    </div>
                    ${c.aiData ? `<a href="${API_BASE}/patient/pdf/${c._id}" target="_blank" class="btn-primary full-width" style="display:block; text-align:center; text-decoration:none;">Download Report (PDF)</a>` : ''}
                </div>`;
        });
    } catch(e) { list.innerHTML = "Error"; }
}

/* ============================================================
   SOCKET.IO LIVE UPDATES
============================================================ */
function setupSocket() {
    try {
        socket = io(API_BASE, { transports: ["websocket"], withCredentials: true });
        
        socket.on("connect", () => console.log("Socket Connected"));
        
        socket.on("update-dashboard", () => {
            loadRoleDashboard(); // Refresh current view
        });

    } catch(e) {
        console.warn("Socket failed to connect", e);
    }
}