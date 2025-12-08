/* ============================================================
   FRONTEND SCRIPT.JS — THE TRUE "ULTIMATE" MERGE
   Features:
   1. Rich UI (Tags, Confidence, Colors, Badges) - RESTORED
   2. Robust Error Handling & Safety Checks - RESTORED
   3. Admin Fields (Email, Priority) - RESTORED
   4. Technician Dashboard Details - RESTORED
   5. New Features (Full Focus View, Delete, Rad Notes) - KEPT
============================================================ */

const API_BASE = "https://radiology-backend-vvor.onrender.com"; 

// GLOBAL STATE
let socket = null;
let currentUser = null;
let currentRole = "patient";
let activeCaseId = null;
let currentFocusCaseId = null; 

// ============================================================
// 1. INITIALIZATION & AUTH
// ============================================================
window.addEventListener('DOMContentLoaded', checkSession);

async function checkSession() {
    try {
        const data = await apiRequest("/auth/me");
        if (data.success && data.user) {
            currentUser = data.user;
            currentRole = data.user.role;
            
            document.getElementById("landingPage").style.display = "none";
            document.getElementById("loginPage").style.display = "none";
            document.getElementById("appLayout").style.display = "flex";

            updateSidebarProfile();
            buildSidebarForRole();
            loadRoleDashboard();
            setupSocket();
        }
    } catch (err) { console.log("No active session"); }
}

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

// API WRAPPER (Restored Robust Error Handling)
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
        
        // RESTORED: Throw error if not OK
        if (!res.ok) {
            throw new Error(data.message || `Request failed: ${res.status}`);
        }
        return data;
    } catch (err) {
        throw err;
    }
}

// LOGIN LOGIC
document.getElementById("loginBtn")?.addEventListener("click", handleLogin);

async function handleLogin() {
    const username = document.getElementById("loginId").value.trim();
    const password = document.getElementById("loginPassword").value.trim();
    const errorBox = document.getElementById("loginError");

    errorBox.style.display = "none";

    if (!username || !password) {
        errorBox.textContent = "Please fill both fields.";
        errorBox.style.display = "block";
        return;
    }

    try {
        const data = await apiRequest("/auth/login", {
            method: "POST",
            body: { username, password, role: currentRole }
        });

        if (!data.success) {
            errorBox.textContent = data.message;
            errorBox.style.display = "block";
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
        errorBox.textContent = err.message || "Login failed.";
        errorBox.style.display = "block";
    }
}

// ROLE TOGGLE
const roleToggle = document.getElementById("roleToggle");
const loginId = document.getElementById("loginId");

if (roleToggle) {
    roleToggle.addEventListener("click", (e) => {
        const btn = e.target.closest(".role-card");
        if (!btn) return;

        document.querySelectorAll(".role-card").forEach(x => x.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("loginError").style.display = "none";

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

// SIDEBAR & VIEWS
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

    if (currentRole === "admin") nav.appendChild(createNavItem("Dashboard", "adminSections"));
    else if (currentRole === "doctor") nav.appendChild(createNavItem("My Cases", "doctorCasesView"));
    else if (currentRole === "technician") nav.appendChild(createNavItem("Upload Scans", "techCasesView"));
    else if (currentRole === "radiologist") nav.appendChild(createNavItem("Analyze Cases", "radioCasesView"));
    else if (currentRole === "patient") nav.appendChild(createNavItem("My Reports", "patientCasesView"));
    
    if(nav.firstChild) nav.firstChild.click();
}

function loadRoleDashboard() {
    if (currentRole === "admin") { refreshAdminDropdowns(); renderAdminCases(); }
    else if (currentRole === "doctor") renderDoctorCases(); 
    else if (currentRole === "technician") renderTechCases(); 
    else if (currentRole === "radiologist") renderRadioCases();
    else if (currentRole === "patient") renderPatientCases();
}

// ============================================================
// 2. ADMIN & GENERIC FUNCTIONS (Restored Email/Priority Fields)
// ============================================================

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
                opt.textContent = `${item.name} (${item.username})`;
                el.appendChild(opt);
            });
        };
        fill("casePatient", data.patients || []);
        fill("caseDoctor", data.doctors || []);
    } catch(e) { console.error("Error loading dropdowns", e); }
}

async function scheduleCase() {
    await apiRequest("/admin/case", {
        method: "POST",
        body: {
            patient: document.getElementById("casePatient").value,
            doctor: document.getElementById("caseDoctor").value,
            scanType: document.getElementById("caseScanType").value,
            symptoms: document.getElementById("caseSymptoms").value
        }
    });
    alert("Scheduled!");
    renderAdminCases();
}

async function renderAdminCases() {
    const list = document.getElementById("adminCasesList");
    if(!list) return;
    list.innerHTML = "Loading...";
    try {
        const data = await apiRequest("/admin/cases");
        if (!data.cases.length) { list.innerHTML = "<div class='case-card'>No cases found.</div>"; return; }
        
        list.innerHTML = "";
        data.cases.forEach(c => {
            const displayId = c.caseId || c._id.substring(0,8);
            list.innerHTML += `
            <div class="case-card">
                <div class="case-top">
                    <b>${displayId}</b>
                    <span class="badge badge-scan">${c.scanType || 'Scan'}</span>
                    ${priorityBadge(c.priority)}
                    <button class="btn-text" style="color:red" onclick="deleteCase('${c._id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="case-meta-line">Patient: ${c.patient?.name || c.patientUsername || "-"}</div>
                <div class="case-meta-line">Doctor: ${c.doctor?.name || c.doctorUsername || "-"}</div>
                <div class="case-meta-line">Date: ${c.date || "?"}</div>
            </div>`;
        });
    } catch(e) { list.innerHTML = "Error loading cases."; }
}

function priorityBadge(p) {
    let color = "gray";
    if(p === "Critical") color = "red";
    if(p === "Medium") color = "orange";
    if(p === "Safe") color = "green";
    return `<span style="color:${color}; font-weight:bold">${p || '-'}</span>`;
}

// GENERIC DELETE (Admin + Rad)
async function deleteCase(id) {
    if(!confirm("Are you sure you want to delete this case? This cannot be undone.")) return;
    try {
        const res = await apiRequest(`/admin/case/${id}`, { method: "DELETE" });
        if(res.success) {
            if(currentRole === 'admin') renderAdminCases();
            if(currentRole === 'radiologist') renderRadioCases();
        } else {
            alert("Failed to delete case.");
        }
    } catch(e) { alert("Error deleting case."); }
}

// ============================================================
// 3. TECHNICIAN DASHBOARD (Restored Rich Layout)
// ============================================================

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

// ============================================================
// 4. RADIOLOGIST DASHBOARD (Restored Inline Features + New Full View)
// ============================================================

async function renderRadioCases() {
    const list = document.getElementById("radioCasesList");
    if (!list) return;

    list.innerHTML = "<div class='loading-spinner'>Loading cases for analysis...</div>";

    try {
        const data = await apiRequest("/admin/cases");
        const cases = data.cases || [];

        list.innerHTML = "";
        const readyCases = cases.filter(c => c.images && c.images.length > 0);

        // Sort by Priority
        const priorityOrder = { Critical: 0, Medium: 1, Safe: 2 };
        readyCases.sort((a,b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

        if (readyCases.length === 0) {
            list.innerHTML = "<div class='case-card'>No scanned cases waiting.</div>";
            return;
        }

        readyCases.forEach(c => {
            const card = document.createElement("div");
            card.className = `case-card ${c.priority === 'Critical' ? 'critical-card' : ''}`;
            const displayId = c.caseId || c._id.substring(0,8);

            // 🔥 RESTORED: Split View + Chat + AI Tags + Inline Notes
            card.innerHTML = `
                <div class="case-top" style="display:flex; justify-content:space-between;">
                    <div>
                        <b>ID: ${displayId}</b>
                        <span class="badge badge-scan">${c.scanType}</span>
                        ${c.priority ? `<span class="badge ${c.priority}">${c.priority}</span>` : ''}
                    </div>
                    <div>
                        <button class="btn-primary-outline" onclick="openCaseView('${c._id}')" style="margin-right:5px; font-size:0.8rem;">
                            <i class="fa-solid fa-expand"></i> Full Focus View
                        </button>
                        <button class="btn-text" style="color:red;" onclick="deleteCase('${c._id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>

                <div class="split-view" style="display:flex; flex-wrap: wrap; gap:15px; margin-top:15px;">
                    <!-- LEFT: IMAGE & AI REPORT -->
                    <div style="flex:1; min-width: 200px;">
                        <a href="${c.images[0]}" target="_blank">
                            <img src="${c.images[0]}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; border:1px solid #ddd;">
                        </a>
                        <div style="margin-top:10px;">
                        ${c.aiData?.findings 
                            ? `<div class="ai-result-box" style="background:#f8f9fa; padding:10px; border-radius:6px; font-size:0.85rem; border-left: 3px solid #6366f1;">
                                <div style="margin-bottom:5px;">
                                    <span class="tag">Conf: ${c.aiData.confidence || 'N/A'}</span>
                                    <span class="tag blue">${c.aiData.bodyPart || 'Scan'}</span>
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

                    <!-- RIGHT: INLINE CHAT (RESTORED) -->
                    <div style="flex:1; min-width: 200px;">
                        <div class="chat-container" style="border:1px solid #eee; border-radius:8px; height:250px; display:flex; flex-direction:column;">
                            <div class="chat-history" id="chat-${c._id}" style="flex:1; overflow-y:auto; padding:10px; font-size:0.85rem;">
                                ${(c.chatHistory || []).map(msg => `
                                    <div class="msg ${msg.role}" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:${msg.role==='user'?'#6366f1':'#f1f5f9'}; color:${msg.role==='user'?'white':'black'}; align-self:${msg.role==='user'?'flex-end':'flex-start'}; max-width:80%;">
                                        ${msg.message}
                                    </div>
                                `).join('')}
                            </div>
                            <div class="chat-input" style="display:flex; padding:5px; border-top:1px solid #eee;">
                                <input type="text" id="inp-${c._id}" placeholder="Ask about this scan..." style="flex:1; border:none; outline:none; font-size:0.85rem;">
                                <button class="btn-text" onclick="sendDashboardChat('${c._id}')">Send</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- BOTTOM: QUICK NOTE (RESTORED) -->
                <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <textarea id="note-${c._id}" class="inp" rows="2" placeholder="Quick note for doctor...">${c.radiologistNotes || ''}</textarea>
                    <button class="btn-primary-outline" style="font-size:0.8rem; margin-top:5px;" onclick="saveRadioNote('${c._id}')">Save Note</button>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (err) {
        list.innerHTML = `<div class='case-card'>Error: ${err.message}</div>`;
    }
}

// INLINE AI FUNCTION
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

// INLINE CHAT FUNCTION
async function sendDashboardChat(caseId) {
    const input = document.getElementById(`inp-${caseId}`);
    const message = input.value;
    if (!message) return;

    // Optimistic UI
    const chatBox = document.getElementById(`chat-${caseId}`);
    chatBox.innerHTML += `<div class="msg user" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:#6366f1; color:white; align-self:flex-end; max-width:80%;">${message}</div>`;
    input.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        const res = await apiRequest(`/ai/chat/${caseId}`, { method: "POST", body: { question: message } });
        chatBox.innerHTML += `<div class="msg ai" style="margin-bottom:5px; padding:5px 10px; border-radius:10px; background:#f1f5f9; color:black; align-self:flex-start; max-width:80%;">${res.answer}</div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { alert("Chat failed"); }
}

async function saveRadioNote(id) {
    const note = document.getElementById(`note-${id}`).value;
    if(!note) return alert("Note is empty");
    await apiRequest(`/radio/notes/${id}`, { method: "POST", body: { radiologistNotes: note } });
    alert("Note Saved!");
}

// ============================================================
// 5. FULL FOCUS VIEW (THE NEW FEATURE)
// ============================================================

async function openCaseView(caseId) {
    currentFocusCaseId = caseId;
    
    // Hide App, Show View
    document.getElementById("appLayout").style.display = "none";
    document.getElementById("fullCaseView").style.display = "block";
    
    // Reset Fields
    document.getElementById("aiResults").style.display = "none";
    document.getElementById("focusChatHistory").innerHTML = "";
    document.getElementById("btnRunAI").disabled = false;
    document.getElementById("btnRunAI").innerText = "Run Advanced Analysis";

    // Load Data
    const res = await apiRequest(`/case/${caseId}`);
    if(!res.success) return alert("Failed to load case data.");
    const c = res.case;

    // Populate Header
    document.getElementById("focusPatientName").textContent = c.patient?.name || "Unknown Patient";
    document.getElementById("focusCaseId").textContent = c.caseId || "ID";
    
    // Populate Image
    document.getElementById("focusImage").src = c.images.length > 0 ? c.images[0] : "https://placehold.co/600x400?text=No+Image";

    // Populate Notes
    document.getElementById("focusNotes").value = c.radiologistNotes || "";

    // Populate AI (If exists)
    if(c.aiData && c.aiData.findings) {
        showAIResults(c.aiData);
    }
    
    // Load Chat History for Focus View
    const chatBox = document.getElementById("focusChatHistory");
    chatBox.innerHTML = (c.chatHistory || []).map(msg => `
        <div style="text-align:${msg.role==='user'?'right':'left'}; margin:5px;">
            <span style="background:${msg.role==='user'?'#6366f1':'#f1f5f9'}; color:${msg.role==='user'?'white':'black'}; padding:8px 12px; border-radius:10px; display:inline-block;">${msg.message}</span>
        </div>
    `).join('');
}

function closeCaseView() {
    document.getElementById("fullCaseView").style.display = "none";
    document.getElementById("appLayout").style.display = "flex";
    loadRoleDashboard(); // Refresh list to show status changes
}

async function runFocusAI() {
    const btn = document.getElementById("btnRunAI");
    btn.innerText = "Running Advanced AI... (Please Wait)";
    btn.disabled = true;

    try {
        const res = await apiRequest(`/radio/ai-analyze/${currentFocusCaseId}`, { method: "POST" });
        if(res.success) {
            showAIResults(res.aiData);
            // Auto-fill the Radiologist Report box with AI findings for convenience
            const existingNotes = document.getElementById("focusNotes").value;
            if(!existingNotes) {
                document.getElementById("focusNotes").value = 
`AI FINDINGS:
${res.aiData.findings}

SUGGESTED TREATMENT:
${res.aiData.treatment || "N/A"}

RADIOLOGIST OBSERVATION:
`;
            }
        } else {
            alert(res.message);
        }
    } catch(e) { alert("AI Analysis Failed. Check logs."); }
    
    btn.innerText = "Run Advanced AI Analysis";
    btn.disabled = false;
}

function showAIResults(ai) {
    document.getElementById("aiResults").style.display = "block";
    document.getElementById("aiDiagnosis").textContent = ai.diagnosis;
    document.getElementById("aiConfidence").textContent = ai.confidence || "N/A";
    document.getElementById("aiFindings").textContent = ai.findings;
    document.getElementById("aiTreatment").textContent = ai.treatment || "Consult Doctor";
}

async function saveFocusNotes() {
    const notes = document.getElementById("focusNotes").value;
    await apiRequest(`/radio/notes/${currentFocusCaseId}`, { 
        method: "POST", body: { radiologistNotes: notes } 
    });
    alert("Report Saved Successfully!");
}

async function sendFocusChat() {
    const input = document.getElementById("focusChatInput");
    const msg = input.value;
    if(!msg) return;

    const chatBox = document.getElementById("focusChatHistory");
    chatBox.innerHTML += `<div style="text-align:right; margin:5px;"><span style="background:#6366f1; color:white; padding:8px 12px; border-radius:12px; display:inline-block;">${msg}</span></div>`;
    input.value = "";

    try {
        const res = await apiRequest(`/ai/chat/${currentFocusCaseId}`, { method: "POST", body: { question: msg } });
        chatBox.innerHTML += `<div style="text-align:left; margin:5px;"><span style="background:#f1f5f9; color:black; padding:8px 12px; border-radius:12px; display:inline-block;">${res.answer}</span></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { alert("Chat Error"); }
}

// ============================================================
// 6. DOCTOR FUNCTIONS (RESTORED ENHANCED UI)
// ============================================================

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
                        <div style="background:#f0fdf4; padding:8px; border-radius:6px; margin-bottom:5px; border:1px solid #bbf7d0;">
                            <strong style="color:#166534">Radiologist:</strong> ${c.radiologistNotes || "Pending"}
                        </div>
                        <div style="background:#f8fafc; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
                            <strong>AI:</strong> ${c.aiData?.findings || "Pending"}
                        </div>
                        
                        ${c.images.length > 0 && !c.prescription ? `
                            <button class="btn-primary-outline full-width" style="margin-top:10px;" onclick="openRx('${c._id}')">Write Prescription</button>
                        ` : `<p style="margin-top:5px; color:green;"><strong>Rx:</strong> ${c.prescription}</p>`}
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
/* ============================================================
   FIXED PATIENT RENDER FUNCTION (Replace existing one)
============================================================ */
async function renderPatientCases() {
    const list = document.getElementById("patientCasesList");
    if(!list) return;

    // 1. Safety Check: Ensure user is logged in before fetching
    if (!currentUser || !currentUser._id) {
        // console.log("Waiting for user session...");
        return;
    }

    list.innerHTML = "<div class='case-card'>Loading your reports...</div>";

    try {
        const data = await apiRequest(`/patient/cases/${currentUser._id}`);
        
        // 2. Data Validation
        if (!data || !data.cases || data.cases.length === 0) {
            list.innerHTML = "<div class='case-card'>No medical reports found.</div>";
            return;
        }

        list.innerHTML = "";
        
        data.cases.forEach(c => {
            // Check specific fields exist
            const doctorRx = c.prescription ? c.prescription : "Pending review...";
            const radNotes = c.radiologistNotes ? c.radiologistNotes : "Pending analysis...";
            const aiDiag = c.aiData && c.aiData.diagnosis ? c.aiData.diagnosis : "Pending";

            list.innerHTML += `
                <div class="case-card">
                    <div class="case-top" style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span class="badge badge-scan">${c.scanType || "Scan"}</span>
                        <small>${new Date(c.date).toLocaleDateString()}</small>
                    </div>

                    <!-- Doctor's Prescription Section (Highlighted) -->
                    <div style="background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:10px;">
                        <strong style="color:#166534;"><i class="fa-solid fa-user-doctor"></i> Doctor's Prescription:</strong>
                        <p style="margin-top:5px; font-weight:500; color:#14532d;">${doctorRx}</p>
                    </div>

                    <!-- Radiologist & AI Section -->
                    <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; font-size:0.9rem;">
                        <p><strong><i class="fa-solid fa-eye"></i> Radiologist Notes:</strong> ${radNotes}</p>
                        <hr style="border-color:#e2e8f0; margin:5px 0;">
                        <p><strong><i class="fa-solid fa-robot"></i> AI Diagnosis:</strong> ${aiDiag}</p>
                    </div>

                    <!-- PDF Download -->
                    ${c.aiData ? `
                        <a href="${API_BASE}/patient/pdf/${c._id}" target="_blank" class="btn-primary full-width" style="display:block; text-align:center; margin-top:15px; text-decoration:none;">
                            <i class="fa-solid fa-file-pdf"></i> Download Official Report
                        </a>` : ''
                    }
                </div>`;
        });

    } catch(e) { 
        console.error("Patient Dashboard Error:", e); // Use this to see real error in F12 Console
        list.innerHTML = `<div class="case-card" style="color:red;">Error loading reports: ${e.message}</div>`; 
    }
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