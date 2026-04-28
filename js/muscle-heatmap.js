/**
 * muscle-heatmap.js
 * Single-Source-of-Truth Heatmap — derives all state from live DOM + localStorage session.
 * No separate state object. No double-counting. No stale data.
 */

// ── Muscle Name Alias Map ─────────────────────────────────────────────────────
const MUSCLE_ALIAS_MAP = {
    pectorals: "chest",
    chest: "chest",
    "pectoralis major": "chest",
    "pectoralis minor": "chest",
    pecs: "chest",
    lats: "lats",
    "latissimus dorsi": "lats",
    traps: "traps",
    trapezius: "traps",
    "upper back": "traps",
    rhomboids: "traps",
    "lower back": "lower_back",
    "erector spinae": "lower_back",
    spine: "lower_back",
    delts: "shoulders",
    deltoids: "shoulders",
    shoulders: "shoulders",
    "anterior deltoid": "shoulders",
    "posterior deltoid": "shoulders",
    "lateral deltoid": "shoulders",
    "front deltoid": "shoulders",
    "rear deltoid": "shoulders",
    biceps: "biceps",
    "biceps brachii": "biceps",
    brachialis: "biceps",
    triceps: "triceps",
    "triceps brachii": "triceps",
    forearms: "forearms",
    brachioradialis: "forearms",
    abs: "abs",
    abdominals: "abs",
    core: "abs",
    "rectus abdominis": "abs",
    "serratus anterior": "abs",
    "transverse abdominis": "abs",
    obliques: "obliques",
    quads: "quads",
    quadriceps: "quads",
    "quadriceps femoris": "quads",
    "hip flexors": "quads",
    hamstrings: "hamstrings",
    "biceps femoris": "hamstrings",
    glutes: "glutes",
    "gluteus maximus": "glutes",
    "gluteus medius": "glutes",
    abductors: "glutes",
    calves: "calves",
    gastrocnemius: "calves",
    soleus: "calves",
    adductors: "adductors",
    neck: "traps",
    "levator scapulae": "traps",
};

function normalizeMuscle(raw) {
    if (!raw) return null;
    return MUSCLE_ALIAS_MAP[raw.toLowerCase().trim()] || null;
}

// ── Labels & Emoji ────────────────────────────────────────────────────────────
const MUSCLE_LABELS = {
    chest: "Chest",
    lats: "Lats",
    traps: "Traps",
    lower_back: "Lower Back",
    shoulders: "Shoulders",
    biceps: "Biceps",
    triceps: "Triceps",
    forearms: "Forearms",
    abs: "Abs",
    obliques: "Obliques",
    quads: "Quads",
    hamstrings: "Hamstrings",
    glutes: "Glutes",
    calves: "Calves",
    adductors: "Adductors",
};

const MUSCLE_ICONS = {
    chest: "fas fa-heart-pulse",
    lats: "fas fa-person",
    traps: "fas fa-mountain",
    lower_back: "fas fa-spine",
    shoulders: "fas fa-angles-up",
    biceps: "fas fa-dumbbell",
    triceps: "fas fa-dumbbell",
    forearms: "fas fa-hand-fist",
    abs: "fas fa-table-cells",
    obliques: "fas fa-arrows-left-right",
    quads: "fas fa-person-walking",
    hamstrings: "fas fa-person-walking",
    glutes: "fas fa-circle",
    calves: "fas fa-shoe-prints",
    adductors: "fas fa-arrows-left-right",
};

// ── SINGLE SOURCE OF TRUTH: derive state from DOM ─────────────────────────────
/**
 * Scans ALL checked set rows in the active workout DOM.
 * Returns: { muscleKey: [ { exerciseName, sets: [{weight,reps,volume,is_pr}] } ] }
 * This is called on every render — no separate state to sync.
 */
function deriveHeatmapStateFromDOM() {
    const state = {};
    const container = document.getElementById("active-exercises-container");
    if (!container) return state;

    // currentExercises is defined in workout-engine scope — access via window bridge
    const exercises = window.__currentExercisesForHeatmap || [];

    container
        .querySelectorAll("tbody.sets-container, .sets-container")
        .forEach((tbody, exIndex) => {
            const ex = exercises[exIndex];
            if (!ex) return;
            const muscleKey = normalizeMuscle(ex.muscle);
            if (!muscleKey) return;

            tbody.querySelectorAll("tr").forEach((row) => {
                const checkbox = row.querySelector(".set-checkbox");
                if (!checkbox || !checkbox.checked) return;

                const weightInput = row.querySelector(".weight-input");
                const repsInput = row.querySelector(".reps-input");
                const w =
                    parseFloat(weightInput?.value) ||
                    parseFloat(weightInput?.placeholder) ||
                    0;
                const r =
                    parseInt(repsInput?.value) ||
                    parseInt(repsInput?.placeholder) ||
                    0;

                if (!state[muscleKey]) state[muscleKey] = [];
                let entry = state[muscleKey].find(
                    (e) => e.exerciseName === ex.name,
                );
                if (!entry) {
                    entry = { exerciseName: ex.name, sets: [] };
                    state[muscleKey].push(entry);
                }
                entry.sets.push({
                    weight: w,
                    reps: r,
                    volume: w * r,
                    is_pr: false,
                });
            });
        });

    return state;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Called when starting a new session — resets colors immediately */
export function resetHeatmap() {
    window.__currentExercisesForHeatmap = [];
    renderHeatmapColors();
}

/**
 * Called by workout-engine to register the current exercise list.
 * This is the bridge that makes DOM-derived state work correctly.
 */
export function setHeatmapExercises(exercises) {
    window.__currentExercisesForHeatmap = exercises || [];
}

/**
 * Main render trigger — call this on every checkbox change.
 * Derives fresh state from DOM, no parameters needed.
 */
export function refreshHeatmap() {
    renderHeatmapColors();
}

// Keep old export for backward compat — just triggers a refresh
export function updateHeatmapSet(_exerciseName, _rawMuscle, _setData) {
    renderHeatmapColors();
}

export function initHeatmap() {
    buildHeatmapSVG();
    buildMiniHeatmap();
    buildMuscleModal();
    renderHeatmapColors();
}

// ── SVG Builder ───────────────────────────────────────────────────────────────
function buildHeatmapSVG() {
    const container = document.getElementById("heatmap-svg-container");
    if (!container) return;

    container.innerHTML = `
    <div class="hm-body-wrap">
        <div class="hm-view-col">
            <span class="hm-side-label">FRONT</span>
            <svg class="hm-svg" viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
                ${SVG_FRONT}
            </svg>
        </div>
        <div class="hm-view-col">
            <span class="hm-side-label">BACK</span>
            <svg class="hm-svg" viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
                ${SVG_BACK}
            </svg>
        </div>
    </div>`;

    container.querySelectorAll("[data-muscle]").forEach((el) => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
            openMuscleModal(el.getAttribute("data-muscle"));
        });
    });
}

// ── ISSUE 4: Mini Heatmap — same SVG scaled down, clickable ──────────────────
function buildMiniHeatmap() {
    const wrap = document.getElementById("hm-mini-wrap");
    if (!wrap) return;

    wrap.innerHTML = `
        <button class="hm-mini-btn" id="hm-mini-open-btn" title="View muscle heatmap">
            <div class="hm-mini-svgs">
                <svg class="hm-mini-svg" viewBox="0 0 739.18561 1359.8492" xmlns="http://www.w3.org/2000/svg">
                    ${SVG_FRONT}
                </svg>
                <svg class="hm-mini-svg" viewBox="0 0 722.36041 1359.5321" xmlns="http://www.w3.org/2000/svg">
                    ${SVG_BACK}
                </svg>
            </div>
            <span class="hm-mini-label">Muscles</span>
        </button>`;

    document
        .getElementById("hm-mini-open-btn")
        ?.addEventListener("click", () => {
            openFullHeatmapModal();
        });
}

// ── ISSUE 3: Color Renderer — derives state fresh from DOM every call ─────────
function renderHeatmapColors() {
    const state = deriveHeatmapStateFromDOM();

    // Compute max sets for relative intensity scaling
    let maxSets = 0;
    Object.values(state).forEach((exList) => {
        const total = exList.reduce((a, e) => a + e.sets.length, 0);
        if (total > maxSets) maxSets = total;
    });

    // Apply to ALL [data-muscle] elements across both full and mini SVGs
    document.querySelectorAll("[data-muscle]").forEach((path) => {
        const key = path.getAttribute("data-muscle");
        const exList = state[key];

        if (!exList || exList.length === 0) {
            // ISSUE 3: Inactive = dark muted base
            path.style.fill = "var(--hm-inactive)";
            path.setAttribute("data-intensity", "0");
            path.classList.remove("hm-active");
            return;
        }

        const totalSets = exList.reduce((a, e) => a + e.sets.length, 0);
        // ISSUE 3: Smooth 0–1 intensity, then map to HSL gradient
        const intensity = maxSets > 0 ? Math.min(totalSets / maxSets, 1) : 0;

        // Smooth gradient: cyan (low) → amber (mid) → rose (high)
        // Uses HSL interpolation for smooth transitions
        const color = intensityToColor(intensity);
        path.style.fill = color;
        path.setAttribute("data-intensity", intensity.toFixed(2));
        path.classList.add("hm-active");
    });
}

/**
 * ISSUE 3: Smooth intensity → color mapping
 * 0.0 → hsl(199, 80%, 55%)  — Cyan (cool, low effort)
 * 0.5 → hsl(38,  90%, 58%)  — Amber (medium)
 * 1.0 → hsl(347, 90%, 58%)  — Rose red (high intensity)
 */
function intensityToColor(t) {
    // Clamp
    t = Math.max(0, Math.min(1, t));

    if (t < 0.5) {
        // Cyan → Amber: hue 199 → 38, sat/light stable
        const hue = 199 - (199 - 38) * (t / 0.5);
        const sat = 80 + 10 * (t / 0.5);
        const alpha = 0.35 + 0.35 * (t / 0.5);
        return `hsla(${Math.round(hue)}, ${Math.round(sat)}%, 55%, ${alpha.toFixed(2)})`;
    } else {
        // Amber → Rose: hue 38 → 347
        const t2 = (t - 0.5) / 0.5;
        const hue = 38 - (38 - 347 + 360) * t2; // wrap around via offset
        const adjustedHue = hue < 0 ? hue + 360 : hue;
        const sat = 90;
        const alpha = 0.7 + 0.3 * t2;
        return `hsla(${Math.round(adjustedHue)}, ${sat}%, 58%, ${alpha.toFixed(2)})`;
    }
}

// ── ISSUE 5: Full Heatmap Modal ───────────────────────────────────────────────
function buildMuscleModal() {
    if (document.getElementById("hm-modal")) return;
    const modal = document.createElement("div");
    modal.id = "hm-modal";
    modal.innerHTML = `
        <div id="hm-modal-panel">
            <div id="hm-modal-handle-zone"><div id="hm-modal-handle-pill"></div></div>
            <div id="hm-modal-body"></div>
        </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeMuscleModal();
    });
    modal.addEventListener("click", (e) => {
        if (e.target.closest("#hm-modal-close")) closeMuscleModal();
        if (e.target.closest("#hm-modal-back")) renderFullHeatmapView();
    });

    // Drag-to-dismiss (same physics as exercise details)
    const panel = modal.querySelector("#hm-modal-panel");
    const handleZone = modal.querySelector("#hm-modal-handle-zone");
    const body = modal.querySelector("#hm-modal-body");
    panel.style.willChange = "transform";

    let touchStartY = 0,
        isDragging = false,
        dragSource = null,
        rafId = null;
    const bodyAtTop = () => body.scrollTop <= 0;

    handleZone.addEventListener(
        "touchstart",
        (e) => {
            touchStartY = e.touches[0].clientY;
            isDragging = true;
            dragSource = "handle";
            panel.style.transition = "none";
        },
        { passive: true },
    );

    body.addEventListener(
        "touchstart",
        (e) => {
            touchStartY = e.touches[0].clientY;
            dragSource = "body";
            isDragging = false;
        },
        { passive: true },
    );

    modal.addEventListener(
        "touchmove",
        (e) => {
            const deltaY = e.touches[0].clientY - touchStartY;
            if (dragSource === "handle") {
                isDragging = true;
            } else if (dragSource === "body" && !isDragging) {
                if (deltaY > 6 && bodyAtTop()) {
                    isDragging = true;
                    panel.style.transition = "none";
                } else return;
            }
            if (!isDragging) return;
            e.preventDefault();
            const move = deltaY < 0 ? deltaY * 0.08 : deltaY * 0.55;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                panel.style.transform = `translateY(${move}px)`;
            });
        },
        { passive: false },
    );

    modal.addEventListener(
        "touchend",
        (e) => {
            if (!isDragging) {
                isDragging = false;
                dragSource = null;
                return;
            }
            isDragging = false;
            dragSource = null;
            if (rafId) cancelAnimationFrame(rafId);
            const dist = e.changedTouches[0].clientY - touchStartY;
            panel.style.transition =
                "transform 0.38s cubic-bezier(0.22,1,0.36,1)";
            if (dist > 130) closeMuscleModal();
            else panel.style.transform = "translateY(0)";
        },
        { passive: true },
    );
}

/** Opens the full heatmap overview inside the modal */
function openFullHeatmapModal() {
    const modal = document.getElementById("hm-modal");
    if (!modal) return;
    renderFullHeatmapView();
    modal.classList.add("hm-modal--open");
    document.body.classList.add("exd-body-lock");
}

function renderFullHeatmapView() {
    const body = document.getElementById("hm-modal-body");
    if (!body) return;

    const state = deriveHeatmapStateFromDOM();
    const activeMuscles = Object.keys(state);

    body.innerHTML = `
        <div class="hm-modal-header">
            <div>
                <h2 class="hm-modal-title">Session Heatmap</h2>
                <p class="hm-modal-subtitle">${activeMuscles.length} muscle group${activeMuscles.length !== 1 ? "s" : ""} activated</p>
            </div>
            <button id="hm-modal-close" class="mf-btn-icon"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="hm-full-svg-wrap">
            <div class="hm-full-view-col">
                <span class="hm-side-label">FRONT</span>
                <svg fill: var(--hm-inactive); class="hm-full-svg" width="200pt" height="300pt" viewBox="0 0 739.18561 1359.8492" xmlns="http://www.w3.org/2000/svg">
                    ${SVG_FRONT}
                </svg>
            </div>
            <div class="hm-full-view-col">
                <span class="hm-side-label">BACK</span>
                <svg fill: var(--hm-inactive); class="hm-full-svg"  width="200pt" height="300pt" viewBox="0 0 722.36041 1359.5321" xmlns="http://www.w3.org/2000/svg">
                    ${SVG_BACK}
                </svg>
            </div>
        </div>

        <div class="hm-legend-row">
            <span class="hm-legend-item"><span class="hm-legend-swatch" style="background:${intensityToColor(0.15)}"></span>Low</span>
            <span class="hm-legend-item"><span class="hm-legend-swatch" style="background:${intensityToColor(0.5)}"></span>Medium</span>
            <span class="hm-legend-item"><span class="hm-legend-swatch" style="background:${intensityToColor(1)}"></span>High</span>
        </div>

        ${
            activeMuscles.length === 0
                ? `
        <div class="hm-modal-empty">
            <i class="fas fa-person"></i>
            <p>Complete your first set to see the heatmap update.</p>
        </div>`
                : `
        <div class="hm-chip-grid">
            ${activeMuscles
                .map((key) => {
                    const exList = state[key];
                    const sets = exList.reduce((a, e) => a + e.sets.length, 0);
                    return `
                <button class="hm-muscle-chip" onclick="window.__openHeatmapMuscle('${key}')">
                    <i class="${MUSCLE_ICONS[key] || "fas fa-circle"}" style="color:${intensityToColor(sets / 6)}"></i>
                    <span class="hm-chip-name">${MUSCLE_LABELS[key] || key}</span>
                    <span class="hm-chip-sets">${sets} sets</span>
                </button>`;
                })
                .join("")}
        </div>`
        }
    `;

    // Apply colors to the freshly injected SVG elements
    setTimeout(() => renderHeatmapColors(), 0);

    // Attach click handlers to new SVG paths
    body.querySelectorAll("[data-muscle]").forEach((el) => {
        el.style.cursor = "pointer";
        el.addEventListener("click", () =>
            openMuscleModal(el.getAttribute("data-muscle")),
        );
    });
}

// Global bridge so inline onclick in chip can call this
window.__openHeatmapMuscle = (key) => openMuscleModal(key);

function openMuscleModal(muscleKey) {
    const modal = document.getElementById("hm-modal");
    const body = document.getElementById("hm-modal-body");
    if (!modal || !body) return;

    const state = deriveHeatmapStateFromDOM();
    const label = MUSCLE_LABELS[muscleKey] || muscleKey;
    const exercises = state[muscleKey] || [];
    const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const totalVol = exercises.reduce(
        (a, e) => a + e.sets.reduce((b, s) => b + (s.volume || 0), 0),
        0,
    );

    body.innerHTML = `
        <div class="hm-modal-header">
            <button id="hm-modal-back" class="mf-btn-icon" title="Back to heatmap">
                <i class="fas fa-arrow-left"></i>
            </button>
            <div style="flex:1;margin-left:var(--space-xs)">
                <h2 class="hm-modal-title">${label}</h2>
                <p class="hm-modal-subtitle">Current session</p>
            </div>
            <button id="hm-modal-close" class="mf-btn-icon"><i class="fas fa-xmark"></i></button>
        </div>

        ${
            exercises.length === 0
                ? `
        <div class="hm-modal-empty">
            <i class="${MUSCLE_ICONS[muscleKey] || "fas fa-dumbbell"}" style="font-size:2.5rem;opacity:0.2;"></i>
            <p>No sets logged for <strong>${label}</strong> yet.</p>
        </div>`
                : `
        <div class="hm-modal-stats">
            <div class="hm-modal-stat">
                <span class="hm-modal-stat-val">${exercises.length}</span>
                <span class="hm-modal-stat-lbl">Exercises</span>
            </div>
            <div class="hm-modal-stat hm-modal-stat--accent">
                <span class="hm-modal-stat-val">${totalSets}</span>
                <span class="hm-modal-stat-lbl">Sets</span>
            </div>
            <div class="hm-modal-stat">
                <span class="hm-modal-stat-val">${totalVol.toLocaleString()}</span>
                <span class="hm-modal-stat-lbl">Vol (kg)</span>
            </div>
        </div>

        <div class="hm-modal-exercises">
            ${exercises
                .map(
                    (ex) => `
            <div class="hm-ex-card">
                <div class="hm-ex-card-header">
                    <h4 class="hm-ex-name">${ex.exerciseName}</h4>
                    <span class="mf-badge primary">${ex.sets.length} sets</span>
                </div>
                <div class="hm-ex-sets-header">
                    <span>SET</span><span>WEIGHT</span><span>REPS</span><span>VOL</span>
                </div>
                ${ex.sets
                    .map(
                        (s, i) => `
                <div class="hm-ex-set-row ${s.is_pr ? "hm-ex-set-row--pr" : ""}">
                    <span class="hm-ex-set-num">${i + 1}</span>
                    <span>${s.weight}<small>kg</small></span>
                    <span>${s.reps}<small>reps</small></span>
                    <span class="hm-ex-vol">${s.volume || s.weight * s.reps}</span>
                    ${s.is_pr ? '<span class="mf-badge success" style="font-size:0.55rem;">PR</span>' : "<span></span>"}
                </div>`,
                    )
                    .join("")}
            </div>`,
                )
                .join("")}
        </div>`
        }
    `;

    if (!modal.classList.contains("hm-modal--open")) {
        modal.classList.add("hm-modal--open");
        document.body.classList.add("exd-body-lock");
    }
}

function closeMuscleModal() {
    const modal = document.getElementById("hm-modal");
    const panel = modal?.querySelector("#hm-modal-panel");
    if (panel) {
        panel.style.transition = "transform 0.34s cubic-bezier(0.22,1,0.36,1)";
        panel.style.transform = "translateY(100%)";
    }
    setTimeout(() => {
        modal?.classList.remove("hm-modal--open");
        document.body.classList.remove("exd-body-lock");
        if (panel) panel.style.transform = "";
    }, 320);
}

// ── SVG Definitions ───────────────────────────────────────────────────────────
// const SVG_FRONT = `
// <!-- HEAD -->
// <ellipse cx="100" cy="20" rx="15" ry="18" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
// <path d="M94,36 L106,36 L107,50 L93,50 Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
// <!-- TORSO BG -->
// <path d="M70,52 L130,52 L134,160 L115,165 L100,168 L85,165 L66,160 Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- CHEST -->
// <path data-muscle="chest" d="M73,54 C73,54 84,51 100,51 C116,51 127,54 127,54 L124,80 C120,87 112,91 100,91 C88,91 80,87 76,80 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <line x1="100" y1="53" x2="100" y2="91" stroke="var(--hm-stroke)" stroke-width="0.8" pointer-events="none"/>
// <!-- SHOULDERS -->
// <path data-muscle="shoulders" d="M70,52 C64,52 56,56 52,64 L50,80 C52,88 58,92 64,90 L72,86 L73,54 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="shoulders" d="M130,52 C136,52 144,56 148,64 L150,80 C148,88 142,92 136,90 L128,86 L127,54 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- BICEPS -->
// <path data-muscle="biceps" d="M51,82 C48,82 44,86 43,94 L44,114 C45,120 49,124 54,123 L60,120 C64,118 65,112 63,104 L60,84 C58,82 54,82 51,82 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="biceps" d="M149,82 C152,82 156,86 157,94 L156,114 C155,120 151,124 146,123 L140,120 C136,118 135,112 137,104 L140,84 C142,82 146,82 149,82 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- FOREARMS -->
// <path data-muscle="forearms" d="M43,117 C40,117 37,121 37,129 L39,152 C40,158 44,162 49,161 L55,158 C59,156 60,150 58,142 L53,119 C51,117 46,117 43,117 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="forearms" d="M157,117 C160,117 163,121 163,129 L161,152 C160,158 156,162 151,161 L145,158 C141,156 140,150 142,142 L147,119 C149,117 154,117 157,117 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- OBLIQUES -->
// <path data-muscle="obliques" d="M66,94 C62,94 59,100 60,112 L63,140 C64,147 68,152 73,150 L80,147 L79,92 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="obliques" d="M134,94 C138,94 141,100 140,112 L137,140 C136,147 132,152 127,150 L120,147 L121,92 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- ABS -->
// <path data-muscle="abs" d="M80,92 L120,92 L121,150 C121,156 112,160 100,160 C88,160 79,156 79,150 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <line x1="80" y1="109" x2="120" y2="109" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>
// <line x1="80" y1="128" x2="120" y2="128" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>
// <line x1="100" y1="92" x2="100" y2="160" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>
// <!-- HIP -->
// <path d="M67,161 C67,161 82,170 100,170 C118,170 133,161 133,161 L132,175 C128,180 116,184 100,184 C84,184 72,180 68,175 Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6" pointer-events="none"/>
// <!-- QUADS -->
// <path data-muscle="quads" d="M68,172 C63,172 59,178 60,188 L65,232 C67,241 73,246 81,245 L89,242 C95,240 97,232 95,222 L87,178 C85,173 78,172 68,172 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="quads" d="M132,172 C137,172 141,178 140,188 L135,232 C133,241 127,246 119,245 L111,242 C105,240 103,232 105,222 L113,178 C115,173 122,172 132,172 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- ADDUCTORS -->
// <path data-muscle="adductors" d="M89,174 C89,174 96,177 100,178 L99,242 L87,242 L85,195 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="adductors" d="M111,174 C111,174 104,177 100,178 L101,242 L113,242 L115,195 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- CALVES -->
// <path data-muscle="calves" d="M64,250 C60,250 57,256 58,267 L61,302 C62,310 67,314 73,313 L79,310 C84,308 85,300 83,290 L76,256 C74,251 69,250 64,250 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="calves" d="M136,250 C140,250 143,256 142,267 L139,302 C138,310 133,314 127,313 L121,310 C116,308 115,300 117,290 L124,256 C126,251 131,250 136,250 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// `;

const SVG_FRONT = `
<path class="hm-muscle" style="fill: var(--hm-inactive); cursor:default;" id="head" d="m 355.99999,0.31001434 c -21.7,3.79999996 -37.9,14.59999966 -46.1,30.89999966 -5.7,11 -6.4,15 -6.4,34.1 v 17.1 l -2.2,-1 c -3.1,-1.4 -6.8,1.2 -8.3,5.8 -2.5,7.7 4.4,31.999996 10.8,37.799996 1.1,1 3.3,2.2 4.8,2.6 2.8,0.7 2.9,1 4.2,10.5 0.7,5.4 1.9,11.1 2.7,12.5 4,7.7 20.9,23 31.2,28.1 6.7,3.4 7,3.4 20.3,3.4 12.6,0.1 13.9,-0.1 19.3,-2.6 3.1,-1.5 8.3,-4.7 11.5,-7.1 7.1,-5.5 18.9,-17.3 20.7,-20.8 1,-1.9 5.5,-21 5.5,-23.5 0,-0.2 1.2,-0.4 2.6,-0.4 5.9,0 11.8,-11.3 14.9,-28.299996 1.9,-10 1,-14.6 -3.1,-17.4 -2.2,-1.4 -2.6,-1.4 -4.8,0 l -2.4,1.6 0.5,-14.7 c 0.6,-16.5 -0.7,-25.3 -5.2,-35 -7,-15.2 -21.5,-27.0999997 -39,-31.7999997 -5.8,-1.49999996 -26.3,-2.69999996 -31.5,-1.79999996 z" />
    
    <g id="neck-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="traps" d="m 736.3,258.5 c 0.4,13.1 0.6,14.7 4.4,26 4.6,13.4 11,29 16.9,40.9 2.9,5.9 4.9,8.5 8.1,10.7 2.3,1.6 5.7,4.3 7.5,5.9 3.2,3 4.8,3.7 4.8,2.3 0,-0.5 -3,-9.6 -6.6,-20.3 -3.7,-10.7 -9.7,-29.2 -13.3,-41.1 l -6.6,-21.6 -7.9,-8.4 -7.8,-8.4 z" />
        <path class="hm-muscle" data-muscle="traps" d="m 830,254.2 c -8.1,8.8 -9,10.3 -11,18.8 -1.3,5.6 -5.3,17.6 -13,39.5 -7.2,20.4 -10,28.8 -10,30.2 0,2 1.7,1.6 4.8,-1.1 1.5,-1.3 4.7,-3.9 7.2,-5.8 2.5,-1.9 5.5,-5.2 6.7,-7.3 3.7,-6.5 18.5,-44.4 20.5,-52.5 1.6,-6.6 3.7,-30 2.7,-30 -0.2,0 -3.8,3.7 -7.9,8.2 z" />
        <path class="hm-muscle" data-muscle="traps" d="m 760.8,276.2 c 2.1,9.2 10,35.4 16.9,55.8 4.9,14.3 7.1,17 11.5,13.6 2.5,-1.8 26.8,-73.1 26.8,-78.3 0,-1 -1,-0.8 -3.8,0.6 -7.6,3.9 -15.9,5.3 -27.7,4.9 -10.7,-0.4 -13.4,-1.1 -25.1,-6.4 -0.5,-0.3 0,4 1.4,9.8 z" />
    </g>

    <g id="traps-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="traps" d="m 723,283.2 c -8.4,5.3 -21.3,12.4 -38,21.1 -18.9,9.7 -22.3,11.8 -21.3,12.7 2.1,2 39.7,12 45.2,12 7,0 17.8,-16.4 20.5,-31 2.3,-12.8 2.8,-19 1.4,-18.9 -0.7,0 -4.2,1.9 -7.8,4.1 z" />
        <path class="hm-muscle" data-muscle="traps" d="m 841.4,282.2 c 0.3,1.8 0.8,5.7 1.1,8.7 1.5,13.5 6.6,26 13.7,33.7 4.8,5.2 7,5.5 19.3,2.3 4.4,-1.2 9.8,-2.5 12,-3 3.5,-0.9 17.6,-5.1 21.4,-6.5 2,-0.7 0.3,-1.8 -17.4,-10.9 C 874,297.4 851,284.7 846,281.3 c -4.6,-3 -5.2,-2.9 -4.6,0.9 z" />
        <path class="hm-muscle" data-muscle="traps" d="m 735.6,281 c -0.3,0.8 -1,5.3 -1.6,10 -1.9,14.3 -6.6,25.9 -13.9,34.2 -3.5,3.9 -3.9,4.7 -2.4,5.2 1,0.2 9.6,0.8 19.1,1.1 13.2,0.6 17.2,0.4 17.2,-0.5 0,-1.4 -4.4,-14.7 -9.6,-28.5 -2,-5.5 -4.7,-12.9 -6,-16.5 -1.3,-3.6 -2.5,-5.8 -2.8,-5 z" />
        <path class="hm-muscle" data-muscle="traps" d="m 833,291.2 c -1.8,5.1 -4.5,13.1 -6,17.8 -1.6,4.7 -4,11.6 -5.4,15.4 -1.4,3.7 -2.6,7.1 -2.6,7.3 0,0.7 31.3,-0.6 35.3,-1.3 l 2.7,-0.6 -4.4,-4.9 c -7.5,-8.3 -11,-17.2 -13.7,-34.7 -0.7,-4.5 -1.6,-8.2 -2,-8.2 -0.3,0 -2.1,4.2 -3.9,9.2 z" />
    </g>

    <g id="shoulders-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="shoulders" d="m 630.5,323.7 c -11,1.5 -29.3,12.1 -39.3,22.8 -17.9,19.1 -27.3,46.7 -24.2,71 1.1,8.7 6,25.8 8.4,29 1.4,2 1.5,2 4,-0.4 2.6,-2.4 2.6,-2.7 2.6,-16.5 0,-24 3.7,-40.2 13.3,-59 9.3,-18.2 23.8,-33 42.7,-43.4 l 7.5,-4.2 -6,0.2 c -3.3,0 -7.3,0.3 -9,0.5 z" />
        <path class="hm-muscle" data-muscle="shoulders" d="m 650.5,325 c -12.7,3.1 -32.4,18 -44.1,33.2 -9.1,11.8 -16.8,30.3 -19.8,47.8 -1.4,8.3 -2.3,34 -1.2,34 0.3,0 2,-1.4 3.8,-3.1 5.4,-5 13.7,-11.2 22.3,-16.4 14.6,-9 20.2,-15.6 30.6,-35.8 10.7,-20.9 20.8,-33.6 34.2,-42.9 5.1,-3.6 6.2,-4.9 6.2,-7.2 0,-4 -3.3,-6.2 -12.9,-8.6 -8.1,-2.1 -13.8,-2.4 -19.1,-1 z" />
        <path class="hm-muscle" data-muscle="shoulders" d="m 929,323 c 0,0.5 0.4,1 0.8,1 0.4,0 5.5,3.1 11.3,6.9 21.5,14.1 34.6,30.6 43.2,54.7 4,11.1 5.7,21.5 6.7,39.8 0.9,15.3 1.2,17.2 3.2,19.3 1.2,1.3 2.4,2.3 2.8,2.3 1.3,0 4.3,-6.4 5.5,-11.8 5.8,-25.5 3.9,-45.2 -6.2,-66.2 -9.6,-19.8 -21.6,-31.7 -41,-40.7 -9.5,-4.4 -26.3,-7.8 -26.3,-5.3 z" />
        <path class="hm-muscle" data-muscle="shoulders" d="m 904.5,325.9 c -7.1,2 -13,4.7 -14.5,6.7 -1.7,2 1.7,6.3 9.4,11.8 12.6,9 22.9,22.8 35.1,47 6.3,12.6 12.8,19.7 24.7,27.1 9.1,5.7 18.2,12 20.9,14.7 2.8,2.7 8,6 8.6,5.4 0.3,-0.3 0.1,-7.4 -0.5,-15.8 -2.9,-39 -16.6,-66 -43.5,-86.1 -16.8,-12.5 -26,-14.9 -40.2,-10.8 z" />
    </g>

    <g id="chest-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="chest" d="m 693,338.5 c -16.1,4.5 -33.1,21.2 -45.2,44.4 -2.2,4.2 -5.6,10.5 -7.6,14.1 -3.1,5.5 -3.6,7.4 -3.6,12.5 0.1,15.1 14.4,41.6 29.1,54 12.9,11 23,14.5 41.4,14.5 25.2,0 53.3,-7.4 64.2,-17 10.1,-8.8 11.6,-17.1 9.9,-53.7 -1.6,-33.1 -2.8,-39.1 -10.3,-50.3 -10.1,-15.2 -19.6,-18.6 -54.4,-19.5 -14.3,-0.4 -19.1,-0.2 -23.5,1 z" />
        <path class="hm-muscle" data-muscle="chest" d="m 840,338.1 c -17.4,1.7 -26.4,5.3 -33.9,13.4 -10.9,11.8 -14.1,27.2 -14.1,68.1 0,26.4 0.7,30.3 6.9,38.2 6.4,8 20.3,13.8 44,18.2 13.4,2.5 34.3,2.7 42.2,0.4 19.7,-5.8 38.5,-25.3 47.4,-49.4 2.2,-5.9 2.8,-9.3 2.9,-16 0.1,-8.5 0.1,-8.6 -5.7,-20 -15.1,-29.9 -31.3,-46.7 -50.4,-52.5 -5.3,-1.6 -24.8,-1.8 -39.3,-0.4 z" />
    </g>

    <g id="sartorius-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="quads" d="m 642.1,461.3 c -0.9,38.4 -1,37.1 3.3,48.2 4.5,11.9 14.1,32.1 15.5,33 0.7,0.4 1.1,-0.4 1.1,-1.8 0,-1.3 1.1,-4.1 2.5,-6.1 1.4,-2 2.5,-3.9 2.5,-4.2 0,-0.3 -2,-4.7 -4.6,-9.6 -2.5,-5 -4.4,-9.2 -4.2,-9.4 0.2,-0.1 2.2,0.2 4.4,0.7 4.6,1.2 8.7,0 10.3,-3 0.9,-1.6 0.4,-2.9 -2.5,-7.2 -1.9,-2.9 -4.4,-5.9 -5.5,-6.7 -1,-0.7 -2.3,-2.1 -2.9,-3.2 -0.9,-1.7 -0.7,-1.8 2.2,-0.9 1.8,0.5 4.6,0.9 6.2,0.9 3.2,0 13.2,-5.5 14,-7.7 0.3,-0.8 -2,-3 -5.7,-5.5 -14.2,-9.5 -26,-20.7 -32.7,-31 -1.4,-2.1 -2.7,-3.8 -3,-3.8 -0.3,0 -0.7,7.8 -0.9,17.3 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 926.2,450.3 c -6.3,8.4 -18.6,20 -28.2,26.6 -4.7,3.2 -8.5,6.4 -8.5,7.1 0,0.7 2.9,2.8 6.3,4.6 4.8,2.6 7.6,3.4 11.4,3.4 h 5 l -5,5.4 c -2.7,3 -5.2,6.3 -5.4,7.3 -1.3,4.9 3.7,9 9.4,7.8 1.6,-0.4 2.8,-0.2 2.8,0.3 0,0.6 -1.6,4.4 -3.5,8.5 -3.9,8.2 -4.3,10.8 -2,12.7 0.8,0.7 2.1,3.3 2.9,5.9 1.3,4.4 1.4,4.5 2.4,2.1 0.5,-1.4 2.6,-5.3 4.5,-8.7 4.4,-7.7 10.7,-23.4 13.2,-32.6 1.7,-6.3 1.7,-8.3 0.6,-25.5 -0.6,-10.3 -1.3,-21.4 -1.4,-24.7 l -0.2,-6 z" />
    </g>

    <g id="biceps-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="biceps" d="m 623.3,418.5 c -8.6,3.4 -19.5,10.1 -26.4,16.3 -14.2,12.9 -24.6,36.8 -31,71.1 -2.7,14.7 -2.7,38.4 0,47.1 3.6,11.4 6.1,12.2 18.9,5.7 10.4,-5.2 23.3,-16.9 32.5,-29.5 12.9,-17.7 17.8,-28.8 20.1,-45.6 3.9,-28.3 0.3,-67.8 -6.1,-67.5 -1,0 -4.6,1.1 -8,2.4 z" />
        <path class="hm-muscle" data-muscle="biceps" d="m 565.2,452.2 c -7.9,14.1 -12.2,25.3 -15.4,40.3 -2.7,12.7 -2.8,28.2 -0.4,38 2.3,9.1 8.5,27.7 9.7,29 0.5,0.5 0.9,-4.5 0.9,-13 0,-28.3 4.3,-57 11.4,-75.8 1.5,-3.8 2.6,-8.8 2.6,-11.5 0,-4.9 -2.6,-14.2 -3.9,-14.2 -0.4,0 -2.6,3.3 -4.9,7.2 z" />
        <path class="hm-muscle" data-muscle="biceps" d="m 626.9,522.7 c -6.3,10.1 -23.9,30.1 -30.9,35 -1.1,0.8 -2.5,2.4 -3.1,3.5 -1.7,3.1 1.2,4.8 8.3,4.8 10,0 12,-1.5 17.2,-12.2 5.6,-11.6 13.1,-34.8 11.3,-34.8 -0.3,0 -1.6,1.7 -2.8,3.7 z" />
        <path class="hm-muscle" data-muscle="biceps" d="m 940.1,416.9 c -0.7,0.4 -2.2,5.1 -3.4,10.2 -3.6,16.6 -2.6,51.7 2,67.9 6.8,24.5 29.6,53.6 50.2,64 8.1,4.2 12.6,4.4 15.2,1 5.2,-6.8 7,-26.6 4.4,-47 -4.1,-33 -14.7,-61.3 -27.8,-74.3 -12.4,-12.4 -35.7,-25 -40.6,-21.8 z" />
        <path class="hm-muscle" data-muscle="biceps" d="m 1001.2,449.5 c -2.9,7.5 -2.8,9.4 1.3,21.8 7.4,22.7 9.4,34.8 10.4,64.5 0.5,13.4 1.1,24.5 1.4,24.8 0.2,0.3 1.7,-3.5 3.1,-8.3 1.5,-4.8 3.1,-9.8 3.6,-11.1 5,-12.2 6.6,-32.6 3.5,-45.7 -3.1,-13.7 -8.6,-29.5 -13.6,-39.2 -6.9,-13.5 -7.1,-13.6 -9.7,-6.8 z" />
        <path class="hm-muscle" data-muscle="biceps" d="m 944.5,522.2 c 2.3,11.8 12.8,36.2 17.8,41.5 1.6,1.8 3.1,2.3 7.4,2.3 5.6,0 12.3,-2.1 12.3,-3.9 0,-0.6 -1.5,-2.3 -3.2,-3.8 -7.7,-6.5 -16.9,-16.6 -25.1,-27.6 -4.8,-6.4 -9,-11.7 -9.3,-11.7 -0.3,0 -0.3,1.5 0.1,3.2 z" />
    </g>

    <g id="obliques-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="obliques" d="m 690.5,487.5 c -9.6,2.6 -15.5,6.7 -15.5,10.7 0,6.8 15.7,17.6 27,18.6 7.5,0.6 9.5,-1.5 9.5,-10.2 0,-4.9 -0.6,-7.1 -2.8,-10.8 -4.8,-8.2 -10,-10.6 -18.2,-8.3 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 872.5,488.9 c -7,3.6 -11,12.1 -9.8,20.8 0.8,5.9 3.1,7.7 9.1,7.1 6.8,-0.7 14.8,-4.6 21.3,-10.6 6.8,-6.2 7.7,-8.6 4.4,-11.6 -7.1,-6.5 -18.3,-9.1 -25,-5.7 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 893.5,514.7 c -4.6,1.1 -17.3,5.8 -21.7,8 -6.1,3 -8.8,7.9 -8.8,16 0,3.8 0.6,6.7 1.6,8.2 1.5,2.1 2.2,2.3 6.9,1.8 12.2,-1.2 35.5,-20.6 35.5,-29.5 0,-2.9 -8.4,-5.8 -13.5,-4.5 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 671,516.8 c -4.6,2.3 -4.9,5.1 -1.2,10.3 3.5,4.8 15.7,14.7 22.6,18.4 5.1,2.8 14.1,4.3 16.4,2.7 3.5,-2.4 3.2,-15.2 -0.4,-20.8 -2,-3 -8.1,-6.2 -18.8,-9.8 -9.2,-3 -13.8,-3.3 -18.6,-0.8 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 893.4,541.9 c -3.8,2.6 -10,6.5 -13.9,8.5 -9.2,4.9 -10.7,5.8 -12.6,7.9 -2.6,2.8 -4.2,10.2 -3.6,16.8 1.3,14.9 8.2,14.7 24.6,-0.7 16.1,-15.2 22.7,-26.6 19.6,-34.1 -2,-4.8 -5.5,-4.5 -14.1,1.6 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 665.8,540.4 c -1.8,4.2 0.6,11.2 6.9,19.5 9.2,12.3 22.7,24.1 29.1,25.8 3.2,0.8 7,-1.2 8.2,-4.3 0.6,-1.4 1,-6 1,-10.3 0,-10.8 -1.6,-12.9 -15,-20.1 -5.8,-3.1 -13.1,-7.3 -16.2,-9.3 -7,-4.6 -12.2,-5 -14,-1.3 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 667,560.7 c 0,2.7 4.2,35.5 4.9,38.5 0.5,2 1.8,5.2 3,7.1 4.3,7 24.2,22.7 28.7,22.7 4.8,0 8.3,-12 6.4,-21.8 -2,-9.8 -5.1,-14.2 -14.8,-21 -9.4,-6.5 -16.3,-12.7 -23.6,-21 -2.5,-2.9 -4.6,-4.9 -4.6,-4.5 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 903.6,563.5 c -2.7,4.2 -14.8,15.8 -21.6,20.8 -11.8,8.6 -13,9.8 -15,13.6 -5.7,11.3 -3.5,31.1 3.5,31.1 3.5,0 16.7,-9.4 23.9,-17 7.9,-8.4 9.1,-11.9 10.6,-30.5 0.6,-7.7 1.3,-15.5 1.6,-17.3 0.7,-3.8 -0.7,-4.2 -3,-0.7 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 669.2,609.1 c -0.6,1.9 -2.1,9.9 -3.3,17.9 -2.3,15.9 -2.2,31 0.4,37.2 0.8,1.8 4.5,6 8.3,9.3 3.8,3.2 8,7 9.4,8.4 4.9,4.7 17.5,13.5 21.3,14.8 3.4,1.2 4.2,1.2 6.4,-0.2 6.1,-4 6.7,-13.8 2.4,-35.3 -4,-19.6 -5.4,-21.7 -21.7,-34 -8.9,-6.7 -16.8,-14.1 -20.1,-18.6 l -2,-2.9 z" />
        <path class="hm-muscle" data-muscle="obliques" d="m 902,607.8 c 0,2.1 -10.3,12 -20.3,19.5 -12.9,9.7 -13.9,10.7 -16.6,16.8 -2.2,5 -8.1,32.9 -8.1,38.4 0,4 2.2,10 4.7,12.7 2,2.2 6.4,2.3 10.6,0.2 7.7,-4 32.7,-25.7 35.2,-30.7 2.7,-5.2 2.9,-17.4 0.6,-34.7 -2.2,-16.7 -3.6,-23 -5.1,-23 -0.6,0 -1,0.3 -1,0.8 z" />
    </g>

    <path class="hm-muscle" data-muscle="abs" d="m 362.39999,552.81001 c -1.9,2.1 -1.8,2.1 0.5,4 3,2.4 6.3,2.4 9.2,-0.1 l 2.4,-2 -2.4,-2 c -3,-2.6 -7.3,-2.6 -9.7,0.1 z" />
    <g id="abs-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="abs" d="m 757,478 c -13.1,2.7 -23.2,7.3 -29.5,13.4 -6.3,6.2 -7.5,9.6 -8.2,22.8 -0.6,10.6 -0.1,13.8 2.3,16.2 2.4,2.5 5.4,1.9 16.5,-3 12.1,-5.4 18.6,-7.8 28.9,-10.5 15.4,-4.1 16.4,-5.2 16.4,-20.9 0,-9.2 -0.3,-11.2 -2.2,-14.2 -3.9,-6.2 -8.9,-7 -24.2,-3.8 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 796.9,477.5 c -4.3,2.3 -6,7.3 -6,17.9 -0.1,9.3 1.3,14.9 4.2,17.3 0.8,0.6 4.1,1.9 7.4,2.8 12.5,3.5 19.4,5.9 31.7,11.2 7,3 13.7,5.3 15,5.1 8.1,-1.1 8.7,-24.1 1,-36.5 -4.9,-7.8 -18.2,-14.3 -36.7,-17.8 -9.8,-1.8 -13.2,-1.8 -16.6,0 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 798.3,524.2 c -5.9,1.5 -6.8,4.9 -6.8,24 0,18.9 0.7,20.9 7.9,23.4 9.2,3.2 44.9,6.5 49.8,4.5 4,-1.5 5.8,-5 6.5,-12.4 0.8,-9.1 -1.2,-14.1 -8.3,-20.6 -6.5,-6 -14.1,-10.2 -25.4,-14.2 -11.6,-4.1 -19.7,-5.7 -23.7,-4.7 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 765.5,524.7 c -20.8,4.8 -38.1,14.6 -44.2,25.1 -4.7,8 -2.7,23.9 3.4,26.3 3.4,1.3 19.9,0.6 36.3,-1.7 20.9,-2.8 22.4,-4.6 22.3,-26.9 -0.1,-16.1 -1.1,-20.2 -5.2,-22.5 -2,-1 -8.8,-1.2 -12.6,-0.3 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 750,582 c -27.8,2 -30.5,4.2 -30.5,24.5 0,13.6 1.3,19.5 5.3,23.5 4.1,4 16.3,6.3 34.2,6.4 13,0.1 14.8,-0.1 17.2,-1.9 5.6,-4.2 6.3,-6.6 6.6,-24 0.4,-16.8 -0.4,-22.5 -3.7,-26.6 -1.6,-2 -2.8,-2.3 -10.2,-2.5 -4.6,-0.1 -13.1,0.1 -18.9,0.6 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 798,581.7 c -5.4,2.3 -7.4,10.8 -6.8,29.2 0.4,15.1 1.8,19.6 7.1,23.5 2.6,1.9 4.2,2.1 17.5,2 17.3,0 28.5,-2.1 33.2,-6.1 4.6,-3.9 6.2,-10.9 5.8,-25.8 -0.4,-17.4 -2.1,-19.1 -19.6,-21.4 -9.9,-1.3 -35.3,-2.3 -37.2,-1.4 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 725.1,643.8 c -1.6,2.9 -1.4,18.3 0.3,27.2 3,15.4 8.2,32.5 17.7,57.6 12.4,33 21.9,52.7 27.9,57.7 3.2,2.7 9.6,4.3 13.1,3.2 l 2.2,-0.7 -0.6,-31.7 c -0.4,-17.4 -1.1,-46.2 -1.7,-64 -1,-29.5 -1.2,-32.7 -3.2,-36.5 -2.5,-5.1 -4.5,-7.4 -8,-9.2 -4.8,-2.5 -15.9,-4.2 -31.4,-4.9 -14.7,-0.7 -15.2,-0.7 -16.3,1.3 z" />
        <path class="hm-muscle" data-muscle="abs" d="m 828.5,642.7 c -8.3,0.6 -23.7,3.4 -26.6,4.8 -1.5,0.8 -3.9,2.8 -5.3,4.6 -6,7.1 -5.8,4.8 -6.4,73.5 l -0.5,63.2 2.2,0.7 c 4.7,1.4 10.2,-0.5 15,-5.4 6.4,-6.4 12,-18.8 24.7,-54.8 16.2,-46.2 18.1,-53.1 19.1,-71 0.5,-9.5 0.3,-11.6 -1.1,-13.7 -1.5,-2.4 -2.1,-2.6 -8.9,-2.4 -3.9,0.1 -9.4,0.3 -12.2,0.5 z" />
    </g>

    <g id="forearms-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="forearms" d="m 542.1,539.3 c -1.3,2.3 -6.1,9.8 -10.5,16.7 -8.9,13.6 -10.3,16.8 -11.7,26.8 -1.5,9.8 -5.8,42.3 -7,52.2 -1.2,10.2 -4.4,26.6 -6.5,33.5 -1.6,5 -2.9,7.7 -15.4,32.5 -3.8,7.4 -7,14.4 -7.2,15.5 -0.2,1.6 0.7,2.3 4.9,3.7 2.9,1 5.9,1.5 6.6,1.2 0.8,-0.3 3.9,-5.8 6.8,-12.2 5.9,-12.6 13.6,-26.5 24.4,-43.7 9.9,-15.7 20.8,-38.8 25.4,-53.6 5.7,-18.2 5.4,-44.3 -0.7,-61.9 -1.9,-5.4 -6,-15 -6.5,-15 -0.1,0 -1.3,1.9 -2.6,4.3 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 582,573.4 c -14.3,3.9 -22.9,12.7 -23,23.3 0,2.4 0.2,4.3 0.5,4.3 0.3,0 4.5,-2.6 9.3,-5.9 4.8,-3.2 11.4,-7.3 14.7,-9.1 8.4,-4.6 18.5,-11.1 18.5,-12 0,-2.3 -12.6,-2.7 -20,-0.6 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 596.6,582.5 c -3.3,1.3 -8.2,3.8 -10.8,5.5 -2.7,1.6 -5.2,3 -5.4,3 -1.3,0 -16.4,11.8 -20,15.6 -2.3,2.5 -5.3,7.3 -6.9,11.2 -9.4,23.1 -15.7,36.2 -23.6,48.6 -12.4,19.5 -18.8,31.2 -27.4,50 -2.6,5.8 -2.7,6 -0.9,7.3 1.1,0.8 3,1.7 4.3,2 3.1,0.8 4.1,-0.4 18,-21.7 10.3,-15.7 18.1,-26 29.6,-39.5 7.1,-8.2 16.7,-21.4 32,-44 7.1,-10.5 14.3,-21 16,-23.5 3.5,-5 6.5,-12 6.5,-15 0,-2.8 -3.9,-2.6 -11.4,0.5 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 512.3,591.6 c -4.7,12.3 -7.6,24.2 -11.3,46.9 -2,12.3 -7.7,41.3 -9.6,49.3 -0.9,3.5 -1.4,6.6 -1.1,6.9 0.6,0.6 9.9,-18.5 12.3,-25.1 1.9,-5.4 5,-18.7 6.3,-27.1 4.2,-28.2 7.4,-54.7 6.9,-57.2 -0.2,-1 -1.7,1.6 -3.5,6.3 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 601.4,602.8 c -1.1,1.5 -8.7,12.6 -16.9,24.7 -15,22.3 -23.5,33.7 -32,42.9 -10.8,11.7 -38.5,51.9 -38.5,56 0,1.8 6.8,5.9 8.6,5.2 0.7,-0.3 2.9,-3.7 4.8,-7.5 8.3,-16.7 23.3,-34.9 41.5,-50.1 15.2,-12.7 28.8,-36.5 34,-59.6 2.2,-9.5 2.6,-14.4 1.4,-14.3 -0.5,0 -1.7,1.2 -2.9,2.7 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 560.9,684.6 c -9.2,8.9 -17.3,18.8 -24.8,30.5 -7.5,11.6 -9.9,17.2 -8.1,19.4 2.5,3.1 4.6,1.7 8.4,-5.8 5.3,-10.1 13.5,-23.1 23.9,-37.5 4.9,-6.8 8.7,-12.6 8.4,-12.9 -0.4,-0.3 -3.8,2.5 -7.8,6.3 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 1026.9,538.7 c -0.6,2.1 -1.5,4.2 -1.9,4.8 -0.4,0.5 -2.2,5.5 -4,11 -5.7,18 -5.2,36.1 1.6,56.4 4.8,14.5 18.6,42.2 27.9,56 11.9,17.6 18,28.7 26.6,47.9 1.6,3.4 3.5,6.5 4.3,6.8 2.5,1 11.6,-2.5 11.6,-4.5 0,-2.2 -5.5,-13.6 -11.3,-23.3 -4.8,-8.1 -10.8,-22.2 -13.3,-31.1 -1.9,-7 -5.1,-24.5 -6.9,-38.4 -1.8,-13.4 -5.9,-37.1 -8,-46.1 -1.9,-8 -3.9,-11.8 -14.2,-27.4 -4.6,-7 -8.6,-13.4 -8.9,-14.3 -1,-2.5 -2.2,-1.7 -3.5,2.2 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 974.3,572.7 c -2.5,0.9 -1.2,2.2 7.5,7.4 4.8,2.8 13.8,8.5 20.1,12.6 6.2,4.1 12,7.7 12.7,8 1.9,0.7 0.7,-7.9 -1.7,-12.8 -4.6,-9.2 -17.8,-16 -30.7,-15.8 -3.7,0 -7.3,0.3 -7.9,0.6 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 967.3,582.9 c 0.7,5.7 4,11.7 17.3,31.2 15.9,23.7 26.1,37.1 40.5,53.9 13.9,16.1 31.7,40.1 35.9,48.5 2.3,4.5 6.6,9.5 8.2,9.5 1.8,0 7.8,-2.6 7.8,-3.4 0,-0.2 -1.2,-3 -2.6,-6.2 -6.6,-15 -14.5,-29.1 -26.9,-47.9 -6.8,-10.4 -18.1,-31.9 -23.1,-44 -4.6,-11.4 -7.3,-15.7 -12.7,-20.7 -2.9,-2.6 -5.5,-4.8 -5.9,-4.8 -0.4,0 -4.5,-2.6 -9,-5.9 -10.4,-7.3 -16.5,-10.7 -22,-12.1 -2.4,-0.6 -5.2,-1.4 -6.2,-1.7 -1.7,-0.5 -1.8,-0.1 -1.3,3.6 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 1058,583.9 c 0,0.7 0.7,5 1.5,9.5 0.8,4.4 2.2,13.3 3.1,19.6 2.7,19.9 5.5,36.2 7.5,44 3.5,13.5 13,36.7 15.9,38.5 1.4,0.8 1.6,2 -3.9,-20.7 -2.7,-11.2 -6.1,-28 -7.6,-37.3 -1.5,-9.4 -3.5,-20.2 -4.5,-24 -3.2,-12.3 -12,-34.1 -12,-29.6 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 970.5,606.5 c 1.4,12.7 7.6,28.9 18.1,47.5 4.4,7.7 12.6,16.5 20.9,22.5 12.6,9 33.9,34.4 40.6,48.3 1.7,3.5 3.7,6.6 4.4,6.8 1.4,0.6 5,-0.9 7.7,-3.3 1.6,-1.4 1.5,-1.8 -0.9,-5.7 -8.1,-12.9 -21.3,-32.1 -26.7,-38.6 -6.7,-8.2 -7,-8.6 -17.9,-21.2 -9.6,-11 -19.1,-23.8 -30.2,-40.6 -4.8,-7.3 -10.5,-15.1 -12.7,-17.5 l -3.9,-4.2 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 1007,679.9 c 0,0.6 0.4,1.2 0.9,1.5 2.9,1.8 26.2,34.9 34,48.3 4.3,7.5 6.2,8.8 8.1,5.3 2.6,-4.9 -12.3,-26.9 -31.9,-47.3 -7.7,-7.9 -11.1,-10.3 -11.1,-7.8 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 478.6,730.9 c -0.4,0.5 -6.8,4.7 -14.4,9.4 -13.9,8.7 -18,12.2 -24.5,21.2 -1.9,2.7 -7.2,8.6 -11.6,13 -4.5,4.4 -8.1,8.8 -8.1,9.8 0,2.5 6.4,5.1 10.8,4.3 5,-0.8 11.8,-4.4 18,-9.4 4.9,-4 5.4,-4.2 5,-2.1 -1.5,7.1 -5.4,19.5 -9.7,31.2 -11.9,32.5 -12.7,41.2 -4.1,40.9 5.7,-0.1 7.9,-3.1 13,-18.2 3.6,-10.3 7.7,-19.7 9.1,-20.6 0.5,-0.3 0.4,0.7 -0.1,2.2 -1.1,2.9 -3.2,10.5 -8.1,28.9 -3.4,13 -3.7,20.4 -1.1,22.8 4.2,3.8 11.4,0.4 12.7,-6 1.5,-6.9 13.2,-41.3 14.1,-41.3 0.5,0 0.6,-0.3 -4.2,19.4 -4.4,18.4 -4.8,24.7 -1.8,27.7 1.7,1.6 2.9,2 5.1,1.5 3.7,-0.8 5.4,-3.8 8.7,-14.6 1.4,-4.7 3.4,-11.2 4.5,-14.5 1.1,-3.3 3,-9.4 4.2,-13.5 2.9,-9.6 3.5,-7.6 1.4,4.2 -3.3,18.2 -3.2,23.8 0.5,25.8 2.7,1.5 7.4,-1 8.8,-4.7 0.9,-2.3 3.5,-11.8 5.6,-20.8 3.4,-14.5 5.1,-20.4 7.1,-24.9 3.4,-7.6 6.3,-20.3 7.6,-32.6 1.3,-12.1 0.8,-17.3 -1.8,-20.2 -2.5,-2.8 -14.3,-8.1 -29.5,-13.3 -7,-2.4 -13.6,-4.9 -14.7,-5.4 -1.2,-0.7 -2.2,-0.7 -2.5,-0.2 z" />
        <path class="hm-muscle" data-muscle="forearms" d="m 1096,730.9 c -0.8,0.5 -7.3,3 -14.5,5.5 -15,5.4 -22.7,8.8 -27.2,12.3 l -3.3,2.4 v 11.1 c 0,13.1 2.4,24.6 8,38.8 2.1,5.2 5.3,14.9 7,21.5 7.7,28.9 8.4,30.5 13.8,30.5 3.4,0 4.7,-2.8 4.5,-9.4 -0.1,-5.3 -1.9,-17.4 -3.9,-26.6 -1.3,-5.8 1.6,0.1 4.1,8.5 5.9,19.9 11.7,36.4 13.5,38 2.6,2.3 8,2.3 9.7,-0.1 2,-2.6 1.2,-8.2 -3.7,-28.3 -2.2,-9 -3.8,-16.6 -3.6,-16.9 0.3,-0.3 0.9,0.6 1.4,1.9 2.4,6.4 8.6,24.4 11.3,32.6 2.1,6.5 3.7,9.8 5.6,11.3 4.6,3.6 9.8,2.1 10.8,-3.3 0.5,-3 -3.1,-18.5 -9.4,-40.6 -3.5,-11.9 -1.8,-10.5 3.4,2.9 5.4,14 9.7,23.1 11.7,24.7 0.7,0.6 2.5,1.4 3.9,1.8 2.1,0.5 3.1,0.1 4.8,-2.1 1.1,-1.5 2.1,-3.7 2.1,-5 0,-1.4 -3.2,-11.8 -7.1,-23.2 -8.5,-25.2 -12.9,-39.1 -12.9,-41.5 0,-1.5 0.8,-1.2 4.3,1.7 6,4.9 15.3,9.6 19.2,9.6 1.7,0 4.6,-0.5 6.4,-1.1 5.6,-2 4.3,-5 -5.9,-14.7 -5,-4.7 -10.7,-10.8 -12.7,-13.6 -4,-5.5 -11.3,-13.6 -12.4,-13.6 -1.3,0 -22.6,-13 -23.9,-14.5 -1.4,-1.7 -2.8,-1.8 -5,-0.6 z" />
    </g>

    <g id="adductors-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="adductors" d="m 662.7,677.2 c -1.8,2.6 -5.9,16.8 -8.2,27.8 -2,9.5 -4.6,29.2 -4,29.9 1,0.9 3.3,-3.5 8.5,-16.3 3,-7.2 7.3,-17 9.7,-21.9 2.4,-4.8 4.3,-9.1 4.3,-9.5 0,-0.6 -6.9,-10.3 -8.5,-12 -0.2,-0.2 -1,0.7 -1.8,2 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 906.1,680.2 c -2.3,3 -4.1,5.8 -4.1,6.1 0,0.3 2.1,5 4.6,10.4 2.5,5.4 5.4,11.8 6.4,14.3 3.7,9.2 10.2,22 11.2,22 1.2,0 1,-2.1 -2.1,-19 -3.4,-18.7 -8.2,-35.5 -11,-38.3 -0.5,-0.5 -2.5,1.3 -5,4.5 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 894.5,692.4 c -3.1,3.3 -3.2,3.7 -3.8,15.3 -0.8,14.6 0.5,26.6 3.9,36.9 4.7,14 20.2,47.5 27.2,58.8 2.7,4.4 14.2,27.1 16.7,33.1 4.3,10.4 9.4,24.8 10.6,29.9 2.6,11.7 3.9,5.2 1.9,-9.6 -0.5,-4 -1.4,-11.1 -2,-15.8 -3.4,-27 -12.5,-65.1 -20.9,-87.6 -2.9,-7.8 -12.2,-29.1 -19.8,-45.4 -2.2,-4.7 -5.1,-10.9 -6.3,-13.8 -1.2,-2.8 -2.7,-5.2 -3.3,-5.2 -0.5,0 -2.4,1.5 -4.2,3.4 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 672.3,696.2 c -1.7,3.5 -5.6,12.1 -8.8,19.3 -3.1,7.1 -6.6,14.9 -7.7,17.3 -3.6,8.1 -13.7,39.7 -16.2,51 -4.1,17.9 -7.6,41.7 -9.5,63.2 -1.2,14 -1.8,27.1 -1.2,26.4 0.3,-0.2 2,-5.7 3.8,-12.2 5,-17.5 11.4,-33.1 24.4,-59.2 24.2,-48.7 28.9,-64.9 27,-94.1 -0.8,-11.6 -0.8,-11.7 -4.2,-14.7 -1.9,-1.8 -3.7,-3.2 -4,-3.2 -0.3,0 -2,2.8 -3.6,6.2 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 688.3,702.5 c -0.7,2 1.3,20.7 3.2,29.5 16.3,74.5 17.2,78 26.1,103.5 6.9,20 12.9,38 18.4,55.5 2.3,7.4 4.8,15.5 5.6,17.9 2.6,7.7 7.2,27.3 8.8,37.1 3.6,22.7 4.1,27.2 4,40.5 -0.1,21.5 -2.8,34.3 -11.9,57.1 -3,7.2 -5.6,15.4 -6,18 -1.7,13 -2.8,19.8 -5,29.9 -4.2,20 -5.5,26.5 -5.5,28.7 0,2.1 0,2.1 2.1,0.2 3.2,-2.9 14.2,-26.4 18.8,-40.1 8,-24 12.2,-49.7 15.2,-93.3 2.4,-35 2.1,-50.6 -1.1,-76.5 -4.1,-32 -9.6,-52.6 -25,-92.5 -2.9,-7.4 -6.5,-16.9 -8,-21 -1.5,-4.1 -5.8,-14.7 -9.5,-23.5 -3.7,-8.8 -9.8,-25.7 -13.7,-37.5 -3.8,-11.8 -8.2,-24.1 -9.6,-27.3 -2.9,-6.3 -5.8,-9 -6.9,-6.2 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 879.5,709.5 c -1.9,4.1 -3.5,8 -3.5,8.7 0,2.1 -8.5,29.4 -13.5,43.3 -2.5,7.1 -5.2,14.8 -6,17 -0.7,2.2 -2.8,7.8 -4.5,12.5 -1.7,4.7 -5.8,16.1 -9.1,25.5 -3.3,9.3 -6.6,18.8 -7.4,21 -6.4,18.1 -12.5,49.9 -14.5,76.7 -1.3,16.3 -0.9,46.2 0.9,61.8 0.5,4.7 1.4,13.7 2.1,20 2.6,27.1 8.7,59.2 14.7,76.9 3.7,11 11.8,29.5 16.1,37.1 5.5,9.5 9.8,13.8 8.8,8.7 -2.1,-10 -6.6,-30.1 -9,-39.7 -0.8,-3 -1.7,-8.2 -2.1,-11.5 -0.7,-6.3 -3.2,-13.4 -8.5,-25 -12.5,-27.2 -16.3,-52.4 -12.5,-84 3.4,-28.4 6.5,-42.3 19.4,-86 1,-3.3 2.5,-8.7 3.5,-12 0.9,-3.3 4.3,-15 7.5,-26 7.5,-25.5 10.2,-36.8 15.2,-65.5 1.1,-6.3 3.1,-17.1 4.4,-24 2.7,-14 4.1,-23.9 5,-35.3 0.5,-7.2 0.5,-7.7 -1.4,-7.7 -1.5,0 -2.9,1.9 -5.6,7.5 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 703,719.1 c 0,1.5 4.7,15.8 9,27.4 5.4,14.6 13.3,35.1 14,36.4 0.6,1.1 1.5,0.3 3.5,-3 1.6,-2.4 3.9,-6.1 5.2,-8.1 1.2,-2.1 2.3,-4.6 2.3,-5.7 0,-1.9 -9.6,-16.1 -24.4,-36 -9.6,-12.9 -9.6,-12.9 -9.6,-11 z" />
        <path class="hm-muscle" data-muscle="adductors" d="M 867.4,723.3 C 858,735.4 839,764.5 839,767 c 0,1.6 10,16 11.1,16 0.5,0 0.9,-0.1 0.9,-0.3 0,-0.1 0.9,-2.7 2.1,-5.7 1.1,-3 2.6,-7.3 3.4,-9.5 0.7,-2.2 4.3,-12.7 7.9,-23.2 5.9,-17.5 8.4,-26.4 7.5,-26.2 -0.2,0 -2.2,2.3 -4.5,5.2 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 736.7,774.7 c -1.3,2.1 -3.7,6.1 -5.2,9 l -2.9,5.2 1.8,5.3 c 3.6,10.2 3.2,10.3 9.7,-3.2 3.3,-6.7 5.9,-12.6 5.9,-13.1 0,-1.1 -5,-6.9 -6.1,-6.9 -0.5,0 -1.9,1.7 -3.2,3.7 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 833.8,772.7 c -2.6,3 -3.8,6.1 -3.2,8 1.2,3.2 11.9,22.3 12.6,22.3 0.4,0 1.7,-3.1 2.9,-6.9 l 2.2,-6.9 -3.3,-5.8 c -3.8,-6.9 -7.8,-12.4 -8.9,-12.4 -0.4,0 -1.5,0.8 -2.3,1.7 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 745.9,786.6 c -3.6,5.9 -8.9,18.7 -8.9,21.6 0,1.5 1.7,7.2 3.9,12.5 15.6,39.4 21,61.9 26.8,112.8 l 0.8,7 2.3,-8.3 c 6.4,-22.9 8.1,-36.9 9.3,-75.8 0.7,-18.8 0.9,-35.7 0.5,-37.5 -0.5,-2.6 -1.7,-4.1 -5.2,-6.3 -4.5,-2.9 -8.3,-7 -19.8,-22 -3.2,-4.2 -6.2,-7.6 -6.7,-7.6 -0.4,0 -1.7,1.6 -3,3.6 z" />
        <path class="hm-muscle" data-muscle="adductors" d="m 819.7,792.3 c -6.5,9.2 -13,16.5 -19.5,21.9 -3.8,3.1 -3.8,1.8 -1.7,36.8 1.3,23.5 2.2,30.2 6.5,52.5 3.2,16 8.9,35.7 11.1,38 0.5,0.5 0.9,-4.6 0.9,-13 0.1,-23.7 3.8,-53.3 9.5,-74.5 1.4,-5.2 5.1,-17.2 8.1,-26.5 l 5.6,-17 -2.1,-6.5 c -2.4,-7.2 -9.1,-20.2 -10.7,-20.7 -0.6,-0.2 -4,3.9 -7.7,9 z" />
    </g>

    <g id="quads-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle" data-muscle="quads" d="m 886.6,740.1 c -0.8,2.6 -1.6,6.9 -3.6,18.7 -1.1,6.4 -3.1,16.6 -4.5,22.7 -1.3,6 -3.6,17.1 -5,24.5 -2.7,14.2 -3.3,16.4 -8.6,32.5 -3.9,12 -4.7,23.4 -3,41.2 1.7,17.1 2.2,19.8 8.1,46.3 2.3,10.1 7.4,26.2 11,34.5 4.4,10.1 9,24.8 11.1,35.5 2.3,11.5 3.3,13 7.8,11.5 2.1,-0.6 4,-5.2 10.4,-24.5 8.3,-24.8 10.7,-34.7 13.3,-55 3,-24 0.6,-68.5 -5.5,-101 -3.3,-17.7 -7.1,-33.3 -9.1,-37.5 -4.2,-9.1 -13.5,-30.7 -17.2,-40 -4.4,-11.1 -4.6,-11.4 -5.2,-9.4 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 685.8,746.4 c -1.7,6.3 -8.8,24 -15.3,38.3 -6.1,13.1 -10.5,41.9 -12.6,82.4 -2.2,43.2 2,76.9 13.8,108.9 10,27.5 10.6,28.7 14.5,31 3.7,2 5.5,0.2 6.3,-6.3 1.2,-9.3 4.3,-21 10.4,-39.3 3.3,-9.8 6.9,-21.5 8,-26 4,-15.6 8.2,-51.1 8.5,-70.4 l 0.1,-11.5 -5.7,-16.5 c -6.7,-19.6 -10,-30.9 -12.7,-44.7 -4,-19.9 -11.5,-50.1 -12.8,-51.4 -0.5,-0.5 -1.6,2 -2.5,5.5 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 918.4,808.5 c 0.9,4 3.6,18.2 5,27 8,46.8 7.4,88.9 -1.4,121 -1.2,4.4 -2.6,9.3 -3,11 -0.4,1.6 -2.4,8.2 -4.3,14.6 -4.3,13.9 -6.7,26.2 -6.7,33.8 0.1,10.7 5,34.8 6.9,33.6 0.5,-0.2 1.2,-2.6 1.6,-5.2 1.2,-8.3 4.3,-14.6 13.2,-27.4 12.6,-18 16.8,-27.3 20.9,-46.3 7.5,-34.8 5.7,-66.9 -5.8,-105.1 -5.2,-17.1 -19,-48.4 -25.1,-56.6 -1.5,-2.1 -1.7,-2.1 -1.3,-0.4 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 656.2,813.2 c -4.8,8 -13.1,28.1 -17.2,41.8 -11.3,37.8 -13.1,83.6 -4.6,117 4.7,18.4 9.3,27.9 21.6,44.5 10,13.4 12.2,17.5 14.6,26.9 0.9,3.6 2,6.6 2.4,6.6 1.8,0 5.3,-19.7 5.3,-30 0,-11.2 -1.4,-17.8 -7.4,-35.4 -13.8,-40.3 -17.9,-62.9 -17.9,-97 0,-15.1 3.7,-63.8 5.6,-74.4 0.4,-1.7 0.4,-3.2 0.1,-3.2 -0.3,0 -1.4,1.5 -2.5,3.2 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 722.1,893 c -3.3,30.8 -5.8,43 -13.6,66 -2.5,7.4 -6,18.6 -7.7,24.9 -2.8,10.6 -3,12.9 -3.2,29.1 -0.1,19.8 0.9,25.1 6.6,33.6 3.9,5.8 8.5,8.4 14.9,8.4 17.6,0 31.9,-31.7 31.9,-70.7 0,-23.8 -6.3,-52.9 -20.6,-96.3 -6.3,-18.9 -5.7,-19.2 -8.3,5 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 854.1,878.2 c -0.7,2.9 -2.3,8.7 -3.6,12.8 -1.3,4.1 -3.3,11.1 -4.3,15.5 -1.1,4.4 -2.8,10.7 -3.6,14 -7.7,28.5 -10.4,58.7 -7.2,80.5 4.9,33.5 17.5,53.9 33.4,54 11.5,0 18,-9.9 20.2,-30.7 1.8,-16.9 -2.3,-37.5 -13,-65.3 -8.9,-23 -13.6,-42.3 -17.6,-72.3 -1,-7.5 -2.1,-13.7 -2.5,-13.7 -0.3,0 -1.1,2.4 -1.8,5.2 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 938.1,1015.7 c -5.2,11.3 -7.3,21.4 -7.4,34.8 0,13.8 3.4,32.5 7.2,39.4 0.5,0.7 1,-16.2 1.3,-37.5 0.3,-21.4 0.5,-39 0.4,-39.2 -0.2,-0.1 -0.8,1 -1.5,2.5 z" />
        <path class="hm-muscle" data-muscle="quads" d="m 647.5,1020.5 c 0.5,6.8 2.5,49.7 2.8,62.5 l 0.2,8.5 1.8,-4 c 3.1,-6.7 4.7,-18.2 4.7,-32.8 0,-15.8 -1.3,-22.5 -6.6,-33.2 l -3.4,-7 z" />
    </g>

    <g id="calves-group" transform="translate(-420.00001,-88.289986)">
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 920.1,1100.6 c -2.4,3.1 -6.2,14.5 -9.6,28.9 -6.5,27.5 -8.5,51.8 -8.5,105.5 0,41.6 -0.2,45.1 -4.5,79 -0.7,5.8 -1.2,10.6 -1.1,10.7 0.1,0.1 1.4,0.3 3.1,0.5 l 2.9,0.3 2.7,-15 c 2.6,-15.3 6.3,-29.8 14.4,-57.5 8.5,-29.2 12.2,-45.9 14.4,-64.5 2.4,-19.8 0.6,-62.8 -3.2,-79.1 -2.6,-10.9 -6.4,-14.1 -10.6,-8.8 z" />
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 662.1,1100.5 c -6,7.7 -9.1,55.1 -5.6,86 2.5,22.1 5,32.9 14.5,62 7.8,23.9 12.5,41.3 17.5,64 2.6,11.9 3,13 4.9,13.3 2.9,0.6 4.8,-1.8 4.2,-5.2 -4.7,-23 -6.6,-43.2 -6.6,-69.9 -0.1,-43.9 -2.5,-74.9 -8.1,-103.6 -5.2,-27.2 -10.9,-44.6 -15.5,-47.5 -3,-2 -2.9,-2.1 -5.3,0.9 z" />
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 649.5,1102.2 c -15.6,44.4 -17.8,72.1 -9,112.2 2,8.9 4.7,21.3 6.1,27.6 1.4,6.3 3.2,14.6 4,18.5 0.7,3.8 2.5,12.2 3.9,18.5 1.3,6.3 2.9,14.2 3.5,17.5 0.7,3.3 1.6,8 2.2,10.5 0.5,2.5 1.8,9.2 2.9,14.9 1,5.7 2.1,10.7 2.5,11 0.3,0.3 5.1,-1 10.7,-3 l 10.2,-3.5 -0.2,-4.9 c -0.2,-2.8 -1,-8.2 -2,-12 -4.4,-18.3 -10,-38.9 -15.9,-58 -10.3,-33.7 -11.3,-37.8 -14.5,-57 -2.7,-16.3 -3.3,-56.7 -1,-70.4 1.1,-6.9 1.2,-9.5 0.1,-15.3 -1.3,-6.8 -2.6,-9.2 -3.5,-6.6 z" />
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 936.6,1107.1 c -1.7,5.8 -1.7,6.4 0.1,16.2 2.2,12.6 2.5,56.2 0.4,69.2 -3.9,24.6 -5.5,30.9 -21.1,85.5 -3.6,12.9 -9,39.9 -9,45.5 0,3.1 0,3.1 11.1,6.4 6.1,1.7 11.3,3.1 11.4,2.9 0.2,-0.2 1.5,-7.5 2.9,-16.3 3.3,-19.9 2.9,-18 7.7,-42.5 2.2,-11.3 4.4,-22.8 4.9,-25.5 0.5,-2.8 2.3,-12.9 3.9,-22.5 1.7,-9.6 3.9,-21.3 4.8,-26 2.1,-10.6 2.3,-33.4 0.4,-45 -2.7,-17.1 -12.9,-54 -15,-54 -0.3,0 -1.5,2.7 -2.5,6.1 z" />
        <path class="hm-muscle" data-muscle="calves" d="m 855.7,1121.7 c -1,1.7 -5.7,34.5 -6.6,46.9 -1.6,20.3 0.2,31.8 8.5,54.9 2,5.5 4.3,11.9 5.1,14.2 0.8,2.4 1.8,4.3 2.2,4.3 1.4,0 18.1,-34.7 19.2,-40 2,-9.2 0.6,-24.9 -3.1,-35 -3.6,-10.1 -11.1,-25 -18.6,-37.2 -5.6,-9 -5.9,-9.4 -6.7,-8.1 z" />
        <path class="hm-muscle" data-muscle="calves" d="m 885.7,1209.5 c -0.9,3.1 -3.5,8.7 -5.6,12.5 -2.2,3.8 -5.7,10.4 -7.8,14.6 -3.6,7.4 -3.8,8.3 -3.8,17.3 0,7.2 0.9,14 3.7,27.1 2,9.6 4.4,23.1 5.3,30 0.9,6.9 1.9,13.6 2.2,15 l 0.5,2.5 1.3,-2.6 c 3.1,-5.8 5.8,-23.1 7.6,-48.6 1.3,-18.8 0.8,-70.8 -0.7,-72.3 -0.7,-0.7 -1.6,0.8 -2.7,4.5 z" />
        <path class="hm-muscle" data-muscle="calves" d="m 728.6,1128.3 c -7,11.8 -16,30.9 -19.3,40.7 -2.5,7.5 -2.8,10 -2.8,21.1 v 12.6 l 6.2,11.9 c 12,23.3 14.8,28.4 15.4,28.4 0.4,0 0.9,-1 1.2,-2.3 0.3,-1.2 2.1,-6.7 4,-12.2 8.3,-23.7 9.2,-28.4 9.2,-47 0,-15.8 -1.3,-27.3 -4.5,-42 -0.5,-2.2 -1.4,-6.9 -2.1,-10.5 -0.6,-3.6 -1.5,-7 -1.8,-7.7 -0.3,-0.6 -2.8,2.6 -5.5,7 z" />
        <path class="hm-muscle" data-muscle="calves" d="m 702.8,1217.2 c -0.8,44.2 3.5,95 8.9,106.6 3.1,6.5 3.2,6.1 5.4,-12.3 0.6,-5.5 1.5,-11.9 2,-14.2 0.5,-2.4 1.3,-7.1 1.9,-10.5 0.5,-3.5 1.8,-11.3 3,-17.3 1.8,-9.5 1.9,-12 0.9,-18.5 -1.3,-9 -2.6,-11.9 -11.7,-27.3 -3.9,-6.5 -7.4,-13.2 -7.7,-14.8 -1.5,-6.6 -2.5,-3.5 -2.7,8.3 z" />
        
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 891.5,1332.8 c -1.6,0.1 -4.6,0.7 -6.6,1.2 -3.3,0.9 -4,1.7 -6.4,7.8 -3.6,9 -4.2,16.1 -2.1,26.9 1.6,8.2 1.6,9.5 0.1,18.1 -0.8,5.1 -2,10.4 -2.5,11.8 -0.6,1.4 -1,5 -1,8.1 0,7.2 2.6,11.4 9.6,15.9 5,3.2 5.4,3.8 5.4,7.2 0,5.5 4.1,10.7 10.5,13.3 1.7,0.7 4.1,2.1 5.4,3.1 3.3,2.5 18.1,2.6 20.6,0.2 1.4,-1.5 2.3,-1.5 7,-0.4 2.9,0.7 6.6,1 8.1,0.6 1.6,-0.4 5.4,-1.1 8.4,-1.5 5.5,-0.7 7,-1.1 18.5,-4.8 7.7,-2.5 9.5,-5.1 7.6,-11.3 -1,-3.4 -3.9,-6.8 -14.7,-17.3 -16.9,-16.4 -26.4,-30.1 -26.4,-38.1 0,-1.9 0.5,-5.6 1.1,-8.3 1,-4.2 0.8,-6 -1,-12.8 -1.2,-4.4 -2.7,-8.5 -3.3,-9.2 -4,-4.8 -27.9,-11.4 -38.3,-10.5 z" />
        <path class="hm-muscle"  style="fill: var(--hm-inactive); cursor:default;" d="m 686.1,1335 c -4.1,1 -10.4,3.4 -14,5.2 -5.7,2.8 -6.8,3.9 -8,7.3 -1.4,3.8 -1.8,14.3 -1.1,25.2 0.7,9.4 -7.4,21.9 -25.5,39.9 -8.3,8.2 -11.7,12.3 -13,15.7 -2.3,6.1 -1.4,9.3 3,11.1 5,2.1 15.2,4.8 21.5,5.6 3,0.4 7.2,1.1 9.2,1.5 2.3,0.5 5.6,0.3 8.2,-0.5 3.8,-1 4.8,-1 6.7,0.4 1.7,1.1 4.6,1.6 10.1,1.6 6.7,0 8.5,-0.4 13.5,-3.1 8.1,-4.2 12.3,-8.9 12.3,-13.6 0.1,-4.5 1.1,-5.9 6.7,-9.6 7.6,-4.8 9.9,-12.7 6.9,-23.3 -4,-14.2 -4.3,-21.2 -1.6,-36.5 0.9,-5.6 0.9,-7.2 -0.5,-11 -0.9,-2.4 -2.3,-6.4 -3.2,-8.9 -2.6,-7.7 -4,-8.5 -14.6,-8.7 -6.4,-0.2 -11.4,0.3 -16.6,1.7 z" />
    </g>
`;

// const SVG_BACK = `
// <!-- HEAD -->
// <ellipse cx="100" cy="20" rx="15" ry="18" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
// <path d="M94,36 L106,36 L107,50 L93,50 Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
// <!-- TORSO BG -->
// <path d="M70,52 L130,52 L134,185 L115,190 L100,192 L85,190 L66,185 Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- TRAPS -->
// <path data-muscle="traps" d="M100,38 C86,40 70,48 66,60 L72,76 C80,70 90,64 100,63 C110,64 120,70 128,76 L134,60 C130,48 114,40 100,38 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- REAR SHOULDERS -->
// <path data-muscle="shoulders" d="M66,58 C60,58 52,64 49,72 L48,88 C50,96 57,100 63,98 L71,94 L72,56 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="shoulders" d="M134,58 C140,58 148,64 151,72 L152,88 C150,96 143,100 137,98 L129,94 L128,56 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- LATS -->
// <path data-muscle="lats" d="M67,75 C61,82 59,96 61,114 L65,138 C67,148 74,154 83,150 L93,146 L91,95 C89,82 80,72 67,75 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="lats" d="M133,75 C139,82 141,96 139,114 L135,138 C133,148 126,154 117,150 L107,146 L109,95 C111,82 120,72 133,75 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- LOWER BACK -->
// <path data-muscle="lower_back" d="M87,148 C83,148 80,155 81,164 L84,183 C85,190 90,194 96,193 L104,193 C110,194 115,190 116,183 L119,164 C120,155 117,148 113,148 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <line x1="100" y1="63" x2="100" y2="193" stroke="var(--hm-stroke)" stroke-width="0.8" stroke-dasharray="4,3" pointer-events="none"/>
// <!-- TRICEPS -->
// <path data-muscle="triceps" d="M48,90 C44,90 40,95 41,104 L44,124 C45,131 50,135 56,134 L62,131 C66,129 67,122 65,114 L60,92 C58,90 52,90 48,90 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="triceps" d="M152,90 C156,90 160,95 159,104 L156,124 C155,131 150,135 144,134 L138,131 C134,129 133,122 135,114 L140,92 C142,90 148,90 152,90 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- FOREARMS BACK -->
// <path data-muscle="forearms" d="M40,127 C37,127 34,132 35,141 L38,164 C39,170 44,174 49,172 L55,169 C59,167 60,161 58,153 L53,129 C51,127 45,127 40,127 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="forearms" d="M160,127 C163,127 166,132 165,141 L162,164 C161,170 156,174 151,172 L145,169 C141,167 140,161 142,153 L147,129 C149,127 155,127 160,127 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- GLUTES -->
// <path data-muscle="glutes" d="M67,188 C62,188 59,195 60,205 L64,228 C66,237 73,243 81,240 L95,236 L93,205 C91,194 82,187 67,188 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="glutes" d="M133,188 C138,188 141,195 140,205 L136,228 C134,237 127,243 119,240 L105,236 L107,205 C109,194 118,187 133,188 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- HAMSTRINGS -->
// <path data-muscle="hamstrings" d="M64,242 C59,242 56,249 57,260 L62,298 C64,307 70,312 78,311 L85,308 C91,305 92,297 90,286 L82,249 C80,244 74,242 64,242 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="hamstrings" d="M136,242 C141,242 144,249 143,260 L138,298 C136,307 130,312 122,311 L115,308 C109,305 108,297 110,286 L118,249 C120,244 126,242 136,242 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <!-- CALVES BACK -->
// <path data-muscle="calves" d="M62,314 C58,314 55,321 56,333 L59,366 C60,374 66,379 73,377 L79,374 C84,371 85,363 83,352 L75,320 C73,315 67,314 62,314 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// <path data-muscle="calves" d="M138,314 C142,314 145,321 144,333 L141,366 C140,374 134,379 127,377 L121,374 C116,371 115,363 117,352 L125,320 C127,315 133,314 138,314 Z" class="hm-muscle" fill="var(--hm-inactive)" stroke="var(--hm-stroke)" stroke-width="0.6"/>
// `;

const SVG_BACK = `
    <path id="head" style="fill: var(--hm-inactive); cursor:default;" class="hm-muscle" d="m 351.69996,0.64611053 c -24.2,4.39999997 -41.7,18.60000047 -49.4,40.20000047 -2.4,6.8 -2.6,8.5 -2.7,24.5 0,13.9 -0.2,17 -1.3,16.1 -2.2,-1.8 -6,0 -7.7,3.6 -2,4.2 -2,8 -0.1,17.099999 3.2,15.2 9.1,25.5 14.7,25.5 2.1,0 2.6,0.7 3.6,4.7 0.6,2.7 1.5,7.2 1.8,10 0.4,2.9 0.9,5.3 1.3,5.3 0.3,0 1.9,-3.2 3.4,-7 3.4,-8.3 9,-15.8 14.4,-19.1 3.7,-2.4 4.2,-2.4 31.8,-2.5 15.4,-0.1 29.6,0.2 31.5,0.7 8.1,2 16,10.6 20.2,22.1 1.1,3.2 2.4,5.8 2.8,5.8 0.5,0 1.3,-2.8 1.9,-6.3 2,-11.3 3,-13.7 5.5,-13.7 6.7,0 15.5,-19.9 15.8,-35.899999 0.1,-5.9 -0.1,-6.7 -2.7,-8.8 -1.5,-1.3 -3.4,-2.2 -4.1,-1.9 -0.8,0.3 -2,0.8 -2.6,1.1 -1,0.4 -1.2,-3.2 -1,-16.5 0.4,-20.8 -0.9,-26.6 -9.1,-38.7 -8.1,-12.1 -19.3,-20.0000005 -34.6,-24.5000005 -7.5,-2.19999997 -25.9,-3.19999997 -33.4,-1.79999997 z" />

    <g id="neck-traps-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="traps" class="hm-muscle" d="m 1972.2,216 c -2.1,2 -2.5,3.1 -5.7,17 -3.3,14.6 -13,32.1 -22.4,40.8 -7.8,7.2 -15.5,12 -39.6,24.7 -6,3.2 -12.3,6.6 -14,7.5 -1.6,1 -5,2.9 -7.5,4.2 -8.7,4.8 -12,7 -12,7.9 0,1.7 10.8,8.9 21,14 23.4,11.6 32.6,20.3 35.1,33.3 0.5,2.8 1.4,15.2 1.9,27.6 0.9,23.2 1.8,29.3 6.6,43.6 8.4,25.2 27,60.2 47.6,89.4 l 5.3,7.5 0.8,-11.5 c 0.4,-6.3 0.6,-40.8 0.4,-76.5 l -0.5,-65 -2.6,-12.5 c -2.3,-11.2 -3.5,-14.2 -10.9,-28.9 l -8.2,-16.4 0.1,-8.1 c 0.1,-7.4 0.5,-8.9 4.7,-18.1 5.7,-12.4 7.4,-16.9 9.7,-26.5 3.1,-12.8 4.3,-23.7 3.8,-34.9 -0.6,-11.5 -2.2,-16.9 -5.9,-19.5 -3.1,-2.1 -5.1,-2 -7.7,0.4 z" />
        <path data-muscle="traps" class="hm-muscle" d="m 2013,215.3 c -3.3,1.6 -4.9,5.3 -6.2,13.5 -1.1,7.9 -0.3,26.8 1.7,36.1 1.7,8.2 6.9,23.5 9,26.8 4,6 6.8,15.7 6.8,23.3 0,8.1 -1.1,11 -10.3,28 -10.9,20.3 -11.9,31 -12,121.5 0,36.8 0.4,67.6 0.8,68.2 1.4,2.2 23.3,-32.5 35.5,-56 17.9,-34.5 24.6,-57.5 24.7,-85.2 0,-14.9 2.5,-30.8 5.6,-35.8 5.3,-8.3 12.5,-14 27.4,-21.6 15.6,-7.9 25,-14 25,-16.2 0,-0.6 -3.2,-2.7 -11.2,-7.4 -1,-0.5 -5.5,-3 -10,-5.4 -4.6,-2.4 -13,-6.9 -18.8,-9.9 -22.4,-11.9 -34.7,-21.2 -42,-31.7 -6.3,-9.2 -13.3,-26.4 -16,-39.3 -0.9,-4.5 -2,-6.8 -3.8,-8.2 -2.9,-2.3 -3,-2.3 -6.2,-0.7 z" />
    </g>
    
    <path data-muscle="traps" class="hm-muscle" d="m 329.19996,129.44611 c -3.7,0.6 -8.7,6.3 -11.2,12.7 -2.1,5.8 -3.9,19.3 -4,31.4 v 5.4 l 3.5,-4.4 c 8.1,-10.1 15.5,-29.7 15.5,-40.8 0,-4.4 -0.4,-4.9 -3.8,-4.3 z" />
    <path data-muscle="traps" class="hm-muscle" d="m 394.99996,134.24611 c 0,11.5 8,31.8 16.1,40.7 l 3.8,4.2 -0.4,-3 c -0.2,-1.7 -0.7,-7.7 -1,-13.5 -1.1,-20.1 -6.3,-31.3 -15.7,-33.6 l -2.8,-0.6 z" />

    <g id="shoulders-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="shoulders" class="hm-muscle" d="m 1844,323.1 c -25.2,5.8 -46.4,23.6 -57.3,48.4 -8.8,19.8 -11.5,43.1 -7.5,63.8 l 1.1,5.7 5.1,-4.7 c 10.3,-9.6 12.5,-11 29,-19.7 12.6,-6.6 19.9,-11.2 27.6,-17.2 5.8,-4.6 7.8,-6.3 20.6,-18.1 4.5,-4.1 9.9,-9 12,-10.9 2.2,-2 7.6,-6.3 12.2,-9.6 4.5,-3.3 8.2,-6.4 8.2,-6.8 0,-0.7 -1.4,-1.8 -14.7,-11.5 -7,-5.2 -9.6,-7.6 -16.9,-15.8 -5.9,-6.6 -6.2,-6.6 -19.4,-3.6 z" />
        <path data-muscle="shoulders" class="hm-muscle" d="m 2126.4,329.1 c -4.8,5.7 -10.5,10.7 -18.6,16.6 -6.5,4.6 -11.8,8.6 -11.8,8.8 0,0.2 2.1,1.7 4.8,3.3 6.3,3.9 11.7,8.5 23.7,20.1 5.6,5.3 11.9,11 14,12.6 2.2,1.7 5.8,4.7 8,6.7 l 4,3.8 h -5.7 c -4.8,0 -6,0.4 -7.3,2.2 -0.8,1.3 -5.5,8.3 -10.4,15.7 -9.9,14.9 -21.9,29 -31,36.6 -3.3,2.7 -6,5.3 -6,5.7 -0.1,1.2 10.8,2.1 17.2,1.4 8.7,-1 21.4,-4.4 26.6,-7.3 6.9,-3.8 8.9,-5.5 10.5,-9.3 1.2,-3 3.1,-20.9 3.9,-37 0.2,-4.3 0.3,-4.5 3.5,-4.8 2.5,-0.3 4.9,0.6 9.5,3.6 3.4,2.2 11.6,6.7 18.2,10.2 11.8,6.1 17.7,10.3 26.6,18.8 3.3,3.1 4.9,4 5.4,3.2 0.4,-0.7 1.3,-6.6 1.8,-13.1 3.5,-39.1 -11.2,-74.3 -38.8,-92.8 -8.8,-5.9 -30.1,-13.1 -38.8,-13.1 -1.7,0 -4.3,2.2 -9.3,8.1 z" />
    </g>

    <path data-muscle="traps" class="hm-muscle" d="m 259.39996,274.24611 c -6,3.6 -13.2,9.4 -22.3,17.9 -11.2,10.4 -13.1,12.5 -13.1,13.9 0,3.1 9.8,20.5 17.9,31.9 8.5,12 17.4,21.5 27.2,28.9 9,6.8 10.3,7.1 20.1,4.4 9.8,-2.7 13.8,-5 13.8,-7.9 0,-1.2 -1.8,-7.3 -3.9,-13.7 -2.2,-6.3 -5.5,-16.5 -7.4,-22.6 -6.7,-21.1 -21.7,-54.4 -25.3,-55.8 -0.7,-0.3 -3.8,1.1 -7,3 z" />
    <path data-muscle="traps" class="hm-muscle" d="m 457.39996,276.34611 c -5.7,8.9 -15.2,32.5 -24.3,60.4 -2.7,8.5 -6,18.1 -7.2,21.3 l -2.2,6 3.3,2.7 c 3.6,3.1 17.9,7.4 21.4,6.5 6.4,-1.6 21.3,-14.6 31.4,-27.4 13,-16.5 23.2,-33.6 23.2,-39 0,-1.2 -1.3,-3.5 -2.8,-5 -10.7,-10.3 -19.4,-18.2 -23.1,-21.2 -5.3,-4.4 -13.1,-9 -15.1,-9 -0.8,0 -2.9,2.1 -4.6,4.7 z" />
    <path data-muscle="traps" class="hm-muscle" d="m 213.99996,313.54611 c -3.3,0.9 -3.6,4.1 -2,23.6 1.4,17.2 2.3,21.8 5.1,24.3 3.4,3.2 16.1,9.1 23.4,10.8 7,1.6 26.8,2.4 28.2,1 0.4,-0.3 -4.3,-5.7 -10.4,-11.9 -13.7,-13.8 -14.7,-15 -26.1,-31.4 -8.3,-11.8 -13.3,-17.5 -15.1,-17.2 -0.3,0.1 -1.7,0.4 -3.1,0.8 z" />

    <g id="lats-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="lats" class="hm-muscle" d="m 1848,459.4 c 0,14.5 4.9,36.3 12.5,56.1 1.5,3.8 3.6,9.2 4.7,12 2.9,7.6 7.3,20.8 10.8,32.5 3,9.9 7.7,20.8 12,27.5 1.1,1.6 3,4.7 4.2,6.9 1.3,2.1 2.8,4.6 3.3,5.5 11,18 18.8,34.4 20.6,43.1 1.7,8.8 2.9,13 3.7,13 0.9,0 10,-14.5 13.5,-21.5 1.4,-2.8 4.2,-9.1 6.2,-14 5.8,-14.3 11.8,-24.5 22.3,-37.7 5.4,-6.8 11.7,-15.2 14,-18.6 9.8,-15 8.6,-20.8 -11.8,-57.2 -4.8,-8.5 -11.8,-21.6 -15.6,-29 -3.7,-7.4 -7.6,-14.7 -8.6,-16.2 -1.8,-2.7 -1.9,-2.7 -6.6,-1.2 -14.9,4.6 -22.6,5.7 -39.2,5.8 -18.9,0.1 -27.3,-1.7 -38.7,-7.9 -3.5,-1.9 -6.6,-3.5 -6.8,-3.5 -0.3,0 -0.5,2 -0.5,4.4 z" />
        <path data-muscle="lats" class="hm-muscle" d="m 2136.2,458.5 c -2.9,1.8 -9.2,4.3 -14,5.6 -7.6,2.1 -10.8,2.4 -25.2,2.3 -16.6,0 -28,-1.7 -39.5,-5.8 -2.2,-0.8 -4.3,-1.1 -4.7,-0.8 -0.3,0.4 -4,7.2 -8,15.2 -7.1,13.9 -12.2,23.4 -13.8,25.5 -0.8,1 -3.1,5.3 -11.9,21.7 -5.6,10.5 -10.1,22.5 -10.1,26.9 0,5.5 7,17.2 20,33.4 9.2,11.6 15.4,22.1 21.4,36.6 4.9,12.1 14.1,29.3 18.2,34.2 l 2.4,2.8 1,-2.3 c 0.5,-1.3 1.6,-5.5 2.4,-9.3 2.3,-11.3 5.2,-17.6 16.9,-36.8 16.6,-27.3 19.5,-32.6 21.2,-38.3 2.1,-7.3 12.9,-38.8 15.5,-45.4 6.6,-16.6 11.1,-31.1 13,-41.9 2,-11.7 2.7,-27.2 1.3,-27 -0.5,0 -3.2,1.5 -6.1,3.4 z" />
    </g>

    <g id="triceps-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="triceps" class="hm-muscle" d="m 1823,416.2 c -19.2,9.6 -22.7,13.9 -28.3,35.3 -1.5,5.8 -2.1,11.2 -2.1,19.5 -0.1,13.2 0.6,17 3.3,17 2.4,0 8.4,-4.1 12.8,-8.7 11.2,-11.9 26,-42 28.8,-58.6 0.6,-3.8 -0.2,-10.7 -1.4,-10.7 -0.3,0 -6.2,2.8 -13.1,6.2 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 2154.6,412.6 c -1.5,3.9 -0.1,14.1 3.4,24.5 6.7,20.1 28.6,50.9 36.1,50.9 2.4,0 3,-0.5 3.8,-3.8 2.5,-8.8 0.3,-26.9 -5.4,-43.7 -2.5,-7.5 -5.9,-13.3 -9.5,-16.3 -2.1,-1.8 -25,-13.2 -26.5,-13.2 -0.7,0 -1.6,0.7 -1.9,1.6 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 1839.7,428 c -8.6,24.2 -17.2,39.8 -31.5,56.9 -4.2,4.9 -5.2,6.8 -4.7,8.5 0.4,1.1 0.9,6.1 1.2,11.1 0.5,9.9 -0.2,13.4 -6.1,32.8 -2,6.5 -3.6,12.7 -3.6,13.7 0,1.9 0.1,1.9 3.8,0.3 8.6,-4 21.2,-12.6 29,-19.8 7.2,-6.7 8.9,-8.9 12.6,-16.9 2.4,-5 5.1,-12.1 6.1,-15.9 1.6,-5.9 1.7,-7.7 0.6,-15 -3.4,-22.8 -5.1,-37 -5.1,-44.7 -0.1,-8.6 -1.3,-14 -2.3,-11 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 2150,429.9 c 0,7.3 -2.3,30.2 -4.5,45.5 -2.4,16.2 -2.5,17.2 -0.9,23.5 0.8,3.6 3.5,10.7 6,15.6 4.7,9.8 10.2,16.2 20.4,23.9 7.5,5.6 23.9,15 24.7,14.2 0.4,-0.4 -1.1,-6.8 -3.2,-14.4 -6,-21.5 -6.7,-25.8 -6.2,-35.2 0.3,-4.7 0.8,-9.2 1.2,-10.1 0.4,-1 -1.8,-4.4 -6.3,-10 -11.5,-14.1 -21.9,-32.3 -28.2,-49.7 -1.2,-3.4 -2.4,-6.2 -2.6,-6.2 -0.2,0 -0.4,1.3 -0.4,2.9 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 2194,434.5 c 0,0.9 0.7,3.1 1.4,5 0.8,1.9 2.7,8.3 4.1,14.2 2.3,9.4 2.6,12.5 2.4,24.3 -0.3,13.3 -0.3,13.5 2.5,17.5 10.9,15.6 15.5,36.1 15.6,68.5 v 7.5 l 2.5,-3 c 3.4,-4.2 8,-13.9 9.6,-20.5 1.9,-7.5 1.6,-34 -0.4,-44.5 -3.7,-18.8 -10.6,-38.5 -17.3,-49.2 -7.6,-12.3 -20.4,-24.6 -20.4,-19.8 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 1788.8,439.2 c -10.9,10.6 -17.8,22.4 -23.2,39.8 -9.1,29.6 -11.4,56.6 -6.2,73.1 1.7,5.6 5.7,13.5 8.4,16.9 l 2,2.5 0.6,-4.5 c 0.3,-2.5 0.7,-11.7 1,-20.5 0.6,-21.9 4,-33.3 14.8,-50.2 l 4,-6.3 -1.1,-6.3 c -0.6,-3.5 -1.1,-8.4 -1.1,-11 0,-6.2 3.2,-22.5 6.3,-31.5 3,-8.8 2,-9.2 -5.5,-2 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 2149,520.8 c 0,2 7.7,22.5 11,29.1 5.2,10.5 12.8,21.8 17.9,26.3 5.4,4.9 13.2,9.1 15.8,8.6 2.1,-0.4 3.2,-5.4 3.2,-15.6 0.1,-9.9 -1.2,-11.9 -11.8,-17.7 -15.2,-8.4 -20.7,-12.8 -28.9,-23 -7.5,-9.4 -7.2,-9.1 -7.2,-7.7 z" />
        <path data-muscle="triceps" class="hm-muscle" d="m 1831.8,531.4 c -9.7,10 -15.6,14.5 -27.3,20.6 -8,4.2 -9.2,5.4 -10.3,10.4 -1,5 0.8,21.8 2.5,22.3 1.9,0.7 8.1,-2.4 14.4,-7.3 8.6,-6.6 19.1,-23.5 25.3,-40.4 1.5,-4.1 3.5,-9.2 4.3,-11.3 0.9,-2 1.4,-3.9 1.2,-4.1 -0.2,-0.1 -4.8,4.2 -10.1,9.8 z" />
    </g>

    <path data-muscle="lower_back" class="hm-muscle" d="m 248.99996,496.24611 c 0,11.3 -1.3,27.6 -3.1,37.4 -1.9,10.2 -2.3,15.9 -2.2,30.8 0,10.1 0.4,18.6 0.7,19 0.4,0.3 1.7,0 2.9,-0.8 8.8,-5.5 14.1,-7.2 30.2,-9.7 l 5,-0.8 -0.3,-4.5 c -1.2,-15.9 -6.1,-27.8 -22.8,-55.5 -10.2,-17.1 -10.4,-17.3 -10.4,-15.9 z" />
    <path data-muscle="lower_back" class="hm-muscle" d="m 467.49996,512.34611 c -13.6,22.8 -17,29.1 -19.4,36.5 -2.2,6.6 -4.5,21.4 -3.6,22.8 0.3,0.5 2.7,1.2 5.3,1.5 12.4,1.6 18.7,3.6 27.6,8.8 2.7,1.5 5,2.6 5.2,2.4 0.2,-0.2 0.6,-7.3 1,-15.8 0.6,-15.3 0.4,-17.9 -3.2,-39.9 -1,-5.8 -1.8,-15.6 -1.8,-21.8 -0.1,-6.1 -0.3,-11.2 -0.6,-11.2 -0.3,0 -5,7.5 -10.5,16.7 z" />

    <g id="forearms-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="forearms" class="hm-muscle" d="m 1749.8,545.7 c -3.9,4.3 -12.3,17.3 -17.8,27.5 -8.1,15.3 -15.2,41 -17.5,63.3 -0.7,6.7 0.4,6.6 2.8,-0.5 1.8,-5.3 11,-27.7 13.6,-33.5 1.1,-2.2 5.5,-11.4 9.9,-20.5 5.5,-11.3 8.5,-18.9 9.5,-24 1.7,-7.9 2.7,-15 2.3,-15 -0.1,0 -1.4,1.2 -2.8,2.7 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2238.5,549.7 c 1.2,11.3 3,16.4 13.3,37.5 5.4,11.2 12.8,27.8 16.3,37 6.3,16.5 6.4,16.6 6.7,11.8 0.6,-10 -8.9,-48.7 -14.6,-59.5 -6.3,-11.8 -20.4,-33.5 -21.8,-33.5 -0.4,0 -0.3,3 0.1,6.7 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 1753,571.9 c 0,3.3 0.7,15.6 1.6,27.3 1,12.8 1.4,27.8 1.2,37.5 -0.3,9 -0.2,16.3 0.1,16.3 1,0 15.6,-29 17.5,-34.4 2.1,-6.4 2.1,-17.3 -0.1,-22.8 -1.8,-4.9 -6.8,-12.5 -14.8,-22.9 l -5.5,-7.1 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2230.5,575.2 c -13.6,18 -14.9,21.1 -14.9,34.8 v 8.5 l 8.9,17.2 c 4.9,9.5 9.2,17.3 9.6,17.3 0.3,0 0.9,-12.7 1.2,-28.3 0.4,-15.5 1.1,-33.4 1.6,-39.7 0.6,-6.3 0.7,-12.9 0.3,-14.6 l -0.7,-3.1 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 1744.8,581 c -7.8,12.2 -16.3,36.2 -18.8,53 -1,6.3 -4.2,29.3 -6.6,46 -2,14.5 -4.8,29.7 -7,37.5 -2.9,10.2 -2.7,10.7 3.6,12.8 3,0.9 6.3,1.6 7.4,1.5 1.4,-0.2 3.7,-5 9.7,-20.3 17.3,-43.9 19.1,-51.9 19.1,-85.5 0,-18.8 -1.7,-44.3 -3.2,-48.5 -0.6,-1.7 -1.2,-1.2 -4.2,3.5 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2239.9,591.7 c -1.8,19.4 -1.8,57.1 0,68.3 0.7,4.7 3.7,15.7 6.6,24.5 5.1,15.3 16.6,44 18.5,45.9 0.8,0.8 12.7,-0.7 13.7,-1.8 0.2,-0.2 -0.3,-3 -1.1,-6.2 -3.2,-12.4 -5.6,-26.7 -8.1,-47.4 -6.3,-52.6 -8.1,-61.1 -16.7,-79.7 -3.9,-8.4 -9.7,-18.3 -10.7,-18.3 -0.5,0 -1.5,6.6 -2.2,14.7 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2172,584.8 c 0.1,7 5.8,33.8 9.6,45 4.8,14.3 13.5,26.2 32.2,44 11.3,10.7 17.5,17.6 21.5,23.4 5.6,8.5 14,24.6 17.2,33.1 1.3,3.4 2.2,4.6 3.2,4.2 0.8,-0.3 2.6,-0.8 3.9,-1.1 3,-0.8 3,-1.3 -0.1,-7.5 -1.4,-2.7 -5.5,-12.5 -9.1,-21.7 -3.5,-9.2 -8.2,-21.3 -10.4,-26.8 -2.2,-5.6 -4,-10.5 -4,-10.8 0,-1.2 -19.1,-39 -22.8,-45.1 -8.7,-14.4 -10.8,-16.5 -32.9,-32.5 -6.3,-4.5 -8.3,-5.6 -8.3,-4.2 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 1806.1,592 c -6.3,4.4 -13,9.4 -14.9,11.2 -11.4,10.9 -26.6,38.1 -39.3,70.3 -3.3,8.2 -6.5,16.3 -7.3,18 -0.7,1.6 -3.4,8.4 -6,15 -2.6,6.6 -5.9,14.8 -7.3,18.2 -2.9,7 -2.6,8.8 1.2,9.5 2.5,0.5 4.5,-1.3 4.5,-4.2 0,-2.4 10.4,-21.9 16.5,-31 6,-8.9 14.2,-17.7 25.9,-28.1 12.1,-10.7 22.2,-23.6 27.6,-35.4 5.3,-11.4 14.1,-51.6 11.4,-51.4 -0.5,0 -6,3.6 -12.3,7.9 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 1721.5,634.1 c -2.6,4.9 -6.1,16.3 -9.9,31.9 -1.9,8 -6,21.9 -8.9,31 -7.6,23.3 -7.4,21.2 -2.5,25.5 2.3,1.9 4.9,3.4 5.7,3.3 2.5,-0.5 8.8,-28 11.5,-50.8 1.2,-9.8 5.7,-40.6 6.2,-42.3 0.8,-2.7 -0.4,-2 -2.1,1.4 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2267.3,635.1 c 1.4,5.6 2.8,16.4 4.2,32.2 1.9,20.9 3.9,35 6.5,46.8 2.4,10.7 3.6,13.3 5.7,12.5 0.8,-0.3 1.8,-0.6 2.2,-0.6 0.5,0 2,-1.2 3.5,-2.6 2.8,-2.9 3.3,-6.8 1.7,-12 -5.2,-15.9 -9.7,-31.7 -13.1,-45.4 -4.7,-18.8 -8.7,-31.7 -10.2,-32.6 -0.7,-0.5 -0.9,0.1 -0.5,1.7 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 2204,670.5 c 1.3,2.2 6.5,9.6 11.5,16.5 12.8,17.3 20.3,29 26.4,40.9 3.9,7.6 5.7,10.1 7.1,10.1 3.9,0 2.3,-5.7 -6.2,-22.5 -6.9,-13.7 -14.1,-23.5 -25,-34 -5.7,-5.5 -11.6,-11.1 -13.2,-12.5 l -2.9,-2.5 z" />
        <path data-muscle="forearms" class="hm-muscle" d="m 1779.4,674.1 c -16,14.1 -25,25.9 -34.9,45.6 -6.5,13 -7.6,17 -5,18 1.3,0.4 2.5,-0.2 4.2,-2.3 1.2,-1.6 2.3,-3.2 2.3,-3.6 0,-1.1 8.2,-15 13.7,-23.2 2.9,-4.3 5.3,-8 5.3,-8.3 0,-0.2 2.5,-3.8 5.5,-7.9 9,-12.1 16.7,-23.5 16.3,-23.9 -0.2,-0.3 -3.5,2.3 -7.4,5.6 z" />
    </g>

    <g id="glutes-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="glutes" class="hm-muscle" d="m 1941.4,694.5 c -24.2,5.9 -54.8,34.2 -61.6,57 -5.3,18 -4.8,39.6 1.3,53.3 2.2,5.1 8.8,14.4 12.8,18 5.2,4.8 15.8,10.9 22.1,12.8 9.3,2.7 29.5,2.6 40.1,-0.3 21,-5.8 33.5,-18.8 36.1,-37.6 1.3,-9.2 0.5,-50.9 -1.1,-55.9 -0.7,-2.1 -1.9,-4.4 -2.7,-5.3 -2.3,-2.3 -9.9,-12.7 -16.8,-23 -3.3,-5 -8.4,-11.6 -11.4,-14.8 -5,-5.2 -5.9,-5.7 -9.6,-5.6 -2.3,0.1 -6.4,0.7 -9.2,1.4 z" />
        <path data-muscle="glutes" class="hm-muscle" d="m 2030.1,698.7 c -2.7,3.2 -9.8,12.5 -15.7,20.8 -5.9,8.2 -11.7,16.2 -12.9,17.7 -3.6,4.3 -4.8,13.9 -4.9,38.3 -0.1,29.9 1.5,35.8 13.3,47.3 9.7,9.5 25.1,14.5 44.6,14.5 13.3,0.1 19.6,-1.3 29.8,-6.4 9.7,-5 21.8,-19 25.5,-29.8 5.8,-16.7 4.4,-42.6 -3.1,-57.6 -6.8,-13.6 -26.6,-33.6 -41.9,-42.3 -7,-4 -19.9,-8.2 -25.4,-8.2 -4,0 -4.6,0.4 -9.3,5.7 z" />
    </g>

    <g id="hands-group" transform="translate(-1632,-88.353889)" style="fill: var(--hm-inactive); cursor:default;">
        <path class="hm-muscle" d="m 1687.7,732.2 c -1.4,1.9 -6.8,5.7 -12.3,8.8 -11.8,6.6 -15,9.2 -20.8,17.3 -2.4,3.4 -8.5,10.2 -13.5,15.1 -5,4.9 -9.1,9.5 -9.1,10.2 0,2 2.7,4.2 5.9,4.9 5.6,1.2 14,-2.1 22.8,-9.2 2.3,-1.8 4.3,-3.3 4.6,-3.3 0.9,0 -3.5,14.9 -11.2,37.7 -4.4,13.4 -8.1,25.9 -8.1,27.8 0,5.5 1.5,7.5 5.5,7.5 4.8,0 8.2,-4.6 12.9,-17.7 4.7,-12.9 8.6,-21.6 9.3,-20.9 0.3,0.3 0.1,1.8 -0.5,3.3 -3.1,7.7 -11.2,39.9 -11.2,44.4 0,5 3.2,8.2 7.3,7.3 1.8,-0.3 3.7,-1.1 4.4,-1.6 0.7,-0.5 4.1,-9.8 7.7,-20.6 6.5,-19.6 9.3,-27.2 10,-27.2 0.2,0 0,1.5 -0.5,3.2 -6.3,22.9 -9.1,41 -6.7,44 3.9,4.9 10.9,1.9 12.9,-5.5 0.6,-2.3 2.4,-8.3 3.9,-13.2 1.6,-5 4,-12.8 5.4,-17.5 5,-16.2 5.6,-13.2 1.5,7.2 -2.1,10 -1.8,15.8 0.6,17.8 2.2,1.8 6.6,0.7 8.6,-2 1.9,-2.5 6.8,-20.2 8.9,-32 0.6,-3.6 2.4,-9.4 4,-13 5.7,-13.3 9,-27.7 9,-39.6 0,-8.4 -1.1,-15.5 -2.4,-15.9 -0.6,-0.2 -5.6,-1.5 -11.1,-2.9 -16.4,-4.3 -27.4,-9.3 -31.4,-14.3 -1.4,-1.8 -2.9,-3.3 -3.2,-3.3 -0.4,0 -1.8,1.5 -3.2,3.2 z" />
        <path class="hm-muscle" d="m 2294.9,733.9 c -6.2,4.8 -21.3,10.6 -35.6,13.6 -5.4,1.2 -8.4,2.3 -8.9,3.4 -1.3,3.3 -1.6,21.3 -0.5,28.9 1.3,8.1 3.8,17 6.6,23.7 2.1,4.8 4.4,13.7 8,30.5 3.2,14.5 4.6,17.7 8.2,18.6 6.4,1.6 8.1,-3.3 6,-17 -2.3,-14.8 -3,-20.2 -2.5,-19.6 0.3,0.3 3.6,10.4 7.3,22.5 4.1,13.6 7.5,22.9 8.8,24.2 4.2,4.6 10.7,1.8 10.7,-4.7 0,-1.8 -1.8,-11.4 -4,-21.3 -2.2,-9.9 -3.9,-18.2 -3.6,-18.4 0.4,-0.5 8.8,24.3 12.2,36.2 2.8,9.8 8.8,14.1 13.4,9.5 3.4,-3.4 2.4,-11.4 -4.4,-38.5 -2,-7.7 -3.6,-14.4 -3.6,-15 0,-2.9 3.3,4.7 7.4,17 5.3,15.9 7.5,20.1 11.2,21.6 5.1,1.9 9.5,-3.5 8,-9.8 -1,-4.3 -2.9,-10.7 -10.6,-36.3 -8.9,-29.2 -8.3,-27 -7.3,-27 0.5,0 2.4,1.5 4.2,3.4 6.9,7.2 19.8,11.4 25.4,8.5 5.2,-2.8 4.4,-4.3 -7.3,-15.8 -4.8,-4.8 -9.9,-10.5 -11.3,-12.8 -4.7,-7.5 -8.9,-11.3 -18.1,-16.8 -5,-2.9 -10.6,-6.5 -12.5,-7.9 -4.2,-3.1 -4.2,-3.1 -7.2,-0.7 z" />
    </g>

    <g id="adductors-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="adductors" class="hm-muscle" d="m 1981.5,828.2 c -12.9,8.2 -25.7,12.5 -40,13.6 l -10,0.7 0.3,3 c 0.1,1.6 1.2,6.8 2.3,11.5 10.1,42 14.1,65.3 17.4,101.5 2.5,26.8 1.9,25.7 7.2,14.5 9.5,-20.4 18.4,-51.8 23.8,-84.5 1.6,-9.2 3.4,-56.3 2.4,-60.6 -0.4,-1.4 -0.7,-1.4 -3.4,0.3 z" />
        <path data-muscle="adductors" class="hm-muscle" d="m 2004.5,841.7 c -1.7,35.9 5,76.8 19.9,121.2 3.6,10.6 6.7,19.6 7,19.9 1.1,1.1 1.5,-0.4 2.6,-9.8 8.6,-74.5 8.7,-74.9 20.6,-119.5 1.3,-5 2.4,-9.5 2.4,-10.2 0,-0.7 -3.2,-1.4 -8.7,-1.8 -15.4,-1.2 -26,-4.6 -36.7,-11.6 -3.2,-2.2 -6,-3.9 -6.1,-3.9 -0.2,0 -0.6,7.1 -1,15.7 z" />
    </g>

    <g id="hamstrings-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="hamstrings" class="hm-muscle" d="m 2067.1,843.9 c -1.6,1 -1.7,0.3 3.1,19.6 5.6,22.5 6.3,26.6 12.4,82.5 3.6,33.4 7.9,56.8 13.5,73.5 3.5,10.3 11.5,26.1 21.8,42.9 5.4,8.8 10.9,18.1 12.2,20.6 l 2.4,4.5 0.3,-14.5 c 0.3,-15.8 -1,-38.2 -3.2,-55.5 -2.2,-16.1 -4.4,-37.9 -5.6,-55 -4.2,-57.2 -13.2,-90.6 -28.5,-106 -8.6,-8.7 -24,-15.5 -28.4,-12.6 z" />
        <path data-muscle="hamstrings" class="hm-muscle" d="m 1907.8,846.4 c -13.8,5.7 -23.7,17.9 -30.7,37.9 -7.1,20.2 -9.6,33.6 -13.1,70.2 -2,21.6 -3.1,30.9 -5.5,50 -3.4,26.8 -4.4,38.3 -5,57 -0.3,11 -0.8,21 -1.2,22.2 -0.9,3.8 1.2,2.6 3.6,-2 1.2,-2.3 3.4,-6.1 4.9,-8.4 9.1,-14.2 19.6,-32.2 24,-41.3 9.8,-20.4 12.6,-32.3 17.7,-75 6.9,-57.4 10.6,-79.2 17.1,-100.6 1.9,-6.3 3.4,-11.6 3.4,-11.9 0,-1.4 -10.2,-0.2 -15.2,1.9 z" />
        <path data-muscle="hamstrings" class="hm-muscle" d="m 1925.1,851.2 c -3.6,11.3 -8.4,33.3 -11.5,52.8 -1.6,9.8 -2.4,16.5 -5.6,45.5 -1.9,17.5 -3.6,29.2 -6.5,45 -3.5,19.6 -3.5,19.5 -1.9,27.4 3.3,16.1 23.1,70.5 26.4,72.6 1.2,0.8 1.3,1.3 -0.5,-13 -3,-24 -1,-57.9 5.5,-92 4.7,-24.4 4.8,-25.3 6.4,-36.5 5.8,-41 5.4,-46.9 -6.7,-93.8 -2.8,-11 -4,-12.8 -5.6,-8 z" />
        <path data-muscle="hamstrings" class="hm-muscle" d="m 2060.2,849.7 c -2.2,4.4 -8.7,29.1 -12.1,46.2 -2.3,11.2 -2.7,25.2 -1.2,37.3 0.5,4 1.5,12.2 2.1,18.3 0.6,6 2,15.3 3,20.5 2.2,11.5 5.3,28.9 7.6,42.5 3.1,18.8 3,57 -0.2,77 -0.9,5.8 0.8,3.6 5.1,-6.5 8.7,-20.1 18.9,-48.5 21.5,-59.8 2.4,-9.9 2.5,-14.4 0.5,-23.7 -2.3,-10.9 -5.2,-30.3 -7.5,-50 -1.1,-9.9 -2.7,-24.1 -3.6,-31.5 -3.2,-28.5 -5.9,-44.2 -11.1,-64.8 -1.8,-6.9 -2.7,-8.2 -4.1,-5.5 z" />
    </g>

    <g id="not-for-naming-group" transform="translate(-1632,-88.353889)" style="fill: var(--hm-inactive); cursor:default;">
        <path class="hm-muscle" d="m 1894.6,669.1 c -11.7,4 -20,11.9 -23.4,22.2 -1.9,6 -3.9,15.1 -8.2,37.7 -2.1,11.2 -3.4,16.8 -7.3,32 -5.1,20 -11.7,53.3 -14.1,71.9 -3.1,23 -3.9,41.1 -3.3,72.6 0.7,36.5 3,58.4 9.7,92.5 1,5.2 2.1,11.4 2.5,13.8 1,6 2.2,4.4 3,-4 0.3,-4 1.1,-10 1.6,-13.3 1.4,-9.7 3.7,-28 5.4,-43 2.5,-23.1 6,-43.1 10,-57.5 4.2,-15.5 5,-20.6 4.8,-33.5 -0.1,-15.8 -2.5,-33.9 -5.9,-45.8 -1,-3.2 -2.2,-1.7 -5.2,6 -8,20.7 -15.6,52.6 -19.7,82.8 -0.9,6.6 -1.9,12.2 -2.1,12.4 -0.2,0.2 -0.4,-10.2 -0.4,-23.1 0,-32.6 1.4,-45.5 10,-91.3 2.6,-14.3 5.1,-30.1 5.5,-35 0.8,-10.9 2.2,-17.7 3.8,-18.7 0.7,-0.4 3.7,-0.8 6.7,-0.8 l 5.5,-0.1 6.7,-9.2 c 17,-23.5 35.8,-38.8 55.6,-45.1 4.2,-1.4 9.4,-2.7 11.5,-3.1 2,-0.3 3.7,-1 3.7,-1.6 0,-1.9 -8.7,-9.6 -14.8,-13.2 -13.4,-7.9 -28.7,-9.9 -41.6,-5.6 z" />
        <path class="hm-muscle" d="m 2065.7,669.5 c -9.3,3.3 -16.3,7.5 -21.9,13.1 -2.7,2.6 -4.8,5 -4.8,5.4 0,0.3 3.5,1.5 7.7,2.5 9.6,2.4 20.1,7 27.7,12 9.3,6.1 23,19.9 32.2,32.2 8.9,11.9 9.1,12 18.7,13.2 l 5.2,0.6 1.2,12 c 0.6,6.6 1.7,15.6 2.3,20 1.1,8 1.6,10.8 6.4,37 1.4,7.7 3.3,20.1 4.1,27.5 1.8,15.8 3,63.5 1.8,70 -0.8,4.3 -0.9,3.9 -2.2,-7 -2.9,-25.3 -8.3,-53.9 -13.7,-72 -2.8,-9.5 -8.3,-23 -9.4,-23 -2.3,0 -6.7,22.8 -7.9,41 -0.9,14.6 -0.1,23 3.4,36 5.7,20.8 9,42.6 13,85 2,21.9 3.4,35.5 4.2,40 0.5,3.1 0.6,3.3 1.3,1.3 1.1,-2.7 6.8,-30 8,-37.8 0.5,-3.3 1.6,-10.7 2.5,-16.5 6.5,-42 7.2,-91.2 1.9,-132 -2.4,-18.7 -8.5,-50.6 -14.9,-77.5 -1.4,-5.5 -3.4,-15.4 -4.5,-22 -5.9,-34 -9,-45.2 -13.8,-50 -8.5,-8.6 -18.6,-12.7 -32.2,-13.1 -8,-0.3 -10.5,0 -16.3,2.1 z" />
        <path class="hm-muscle" d="m 1943.8,937.5 c -0.3,0.6 -0.9,3.7 -1.3,7 -0.7,6.1 -5.1,33 -8,48.5 -5.7,31 -7.6,59.8 -5.5,81.4 0.8,8.5 1.6,12.4 2.1,11.1 0.4,-1.1 3.8,-15.7 7.5,-32.5 3.7,-16.8 7.6,-34.3 8.6,-39 3.2,-14.2 3.5,-36.6 0.8,-55.9 -2.3,-17.4 -3.3,-22 -4.2,-20.6 z" />
        <path class="hm-muscle" d="m 2041.2,942.7 c -3,15.9 -3.6,23.3 -3.6,40.8 -0.1,16.8 0.3,20.6 2.7,33 2.9,14.3 7.8,39.4 12.1,61 l 2.3,12 1.4,-6 c 1,-4.4 1.4,-13.3 1.4,-33 0,-28.2 -0.5,-32.7 -7,-68 -0.8,-4.4 -2.8,-16.3 -4.5,-26.4 -1.7,-10.2 -3.2,-18.6 -3.4,-18.8 -0.2,-0.2 -0.8,2.2 -1.4,5.4 z" />
        <path class="hm-muscle" d="m 1961.6,976.1 c -0.3,0.8 -2,6.1 -4,11.9 -6.4,19.3 -22.5,95.9 -25.2,120.2 -0.7,6.3 0.8,11 2.1,6.7 0.4,-1.3 3.4,-8.6 6.6,-16.1 12.5,-29.5 17.4,-53.6 20.4,-100.8 1.3,-20.5 1.3,-25.7 0.1,-21.9 z" />
        <path class="hm-muscle" d="m 2024.6,984.2 c 2.2,41.2 4.2,57.9 9.8,81.8 3.6,15.1 16.2,51.7 17.5,50.5 0.8,-0.8 0.3,-12 -1,-22 -1.2,-9 -3.8,-23.9 -7.5,-42.5 -1.4,-6.9 -3.4,-17.7 -4.5,-24 -1.1,-6.3 -3.1,-16.2 -4.5,-22 -2.6,-11.2 -8.4,-29 -9.5,-29 -0.3,0 -0.5,3.3 -0.3,7.2 z" />
        <path class="hm-muscle" d="m 1891.3,1027.7 c -1.3,3.2 -5.4,11.6 -9.3,18.7 l -7,12.8 6.4,8.7 c 3.5,4.7 7.4,10.6 8.6,13.1 l 2.2,4.4 1.9,-2.4 c 5.7,-7.7 7.8,-9.9 11.6,-12.8 l 4.3,-3.2 -2.6,-6.8 c -3,-8 -10,-29.1 -11.5,-34.4 -0.5,-2.1 -1.3,-3.8 -1.7,-3.8 -0.4,0 -1.7,2.6 -2.9,5.7 z" />
        <path class="hm-muscle" d="m 2091.3,1024 c -2.9,7.3 -14.3,41.9 -14.3,43.1 0,0.8 2.3,3.2 5.1,5.3 2.8,2 6.3,5.7 7.9,8.2 l 2.8,4.5 2.1,-3.4 c 1.2,-1.9 2.1,-3.8 2.1,-4.3 0.1,-0.8 2.7,-4.3 11.5,-15 l 2.6,-3.2 -3.2,-5.3 c -2.7,-4.7 -11.8,-23.2 -14.6,-29.9 l -1.1,-2.5 z" />
    </g>

    <g id="calves-group" transform="translate(-1632,-88.353889)">
        <path data-muscle="calves" class="hm-muscle" d="m 1868.5,1068.2 c -12.7,17.7 -23.1,42.3 -30.7,72.7 -4.2,16.6 -4.2,16.6 -4.2,35.6 0,16.7 0.3,20.6 2.7,32.5 1.5,7.4 4.3,22.9 6.2,34.5 4.3,25.8 6.8,39.6 10.6,59 7.4,37.3 8.8,55.4 5.5,67.5 -0.9,3.2 -1.6,9.6 -1.6,15 v 9.5 l -4.2,4.4 c -5.7,5.9 -13.4,11.5 -18.3,13.3 -4.7,1.8 -8.5,6.8 -8.5,11 0,7.4 7.4,12.7 20.4,14.8 7.2,1.1 13.6,3.2 23.6,7.8 2.3,1 7.4,1.7 14.6,2 14.7,0.5 20.8,-1.1 25.8,-6.9 4.7,-5.5 5.3,-10.1 3.3,-25.9 -1.6,-12.9 -1.3,-20.5 1.4,-30.5 1.7,-6.3 1.4,-14.4 -1,-21.9 -3.5,-11.3 -2.9,-27.4 2.4,-60.6 4,-25.5 4.7,-30.1 5.5,-37.5 0.6,-4.4 1,-9.6 1,-11.5 l -0.1,-3.5 -1.5,2.9 c -5.7,10.5 -14.2,39.8 -18.4,63.6 -4.1,23.2 -6.9,53.8 -6.6,73 l 0.1,7.5 -3.8,0.9 c -5.2,1.3 -5.7,0.3 -5.7,-12.5 0,-16.7 -3.7,-47.8 -8.6,-71.9 -2,-10.2 -8.9,-34.5 -12.5,-44.4 -3.7,-10 -13.9,-30.4 -18.6,-37.4 -2,-2.8 -3.4,-5.4 -3.1,-5.7 0.2,-0.3 2,0.3 3.9,1.2 2.3,1.2 5.9,1.7 11,1.8 7.3,0 7.7,-0.1 12.2,-3.8 3,-2.5 5.6,-5.9 7.6,-10 l 3,-6.2 0.4,-34 c 0.4,-28.7 0.9,-37.6 3.2,-57 2.6,-22.4 2.6,-23 1,-29.5 -1,-3.6 -3.1,-8.9 -4.8,-11.9 -3,-5.4 -8.3,-12.1 -9.6,-12.1 -0.3,0 -1.9,1.9 -3.6,4.2 z" />
        <path data-muscle="calves" class="hm-muscle" d="m 2111.1,1066.2 c -3.6,3.2 -10.7,14.8 -12.5,20.1 -2,5.9 -2,13.8 -0.2,28.2 2.4,17.9 3.8,47.7 3.4,72.2 l -0.3,22.8 2.6,5 c 3,5.7 7,9.9 11.4,12.3 4.5,2.4 14,2.1 19.3,-0.6 2.3,-1.2 4.2,-1.9 4.2,-1.6 0,0.4 -2,3.9 -4.4,7.8 -11.2,18 -22.4,44.8 -27.4,65.6 -8.8,36.2 -12.6,61.7 -13.4,90 l -0.3,8.5 -4.2,0.3 c -2.4,0.2 -4.3,0 -4.4,-0.5 -0.1,-0.4 -0.2,-9.4 -0.4,-19.8 -0.3,-22.7 -3.9,-53.3 -9.1,-79 -2.8,-13.4 -11.1,-40.4 -14.1,-45.5 -1.3,-2.3 -1.4,-1.5 -0.9,8 0.3,5.8 1.5,16.6 2.6,24 1.2,7.4 2.5,17.1 3,21.4 0.5,4.4 1.5,11.6 2.1,16 1.5,11.1 1.6,34.3 0,38.1 -0.7,1.6 -1.9,6 -2.6,9.7 -1.3,6.2 -1.3,7.6 0.6,18 2.1,11.6 2.1,14.4 0,33.7 -1.6,14 1,20.9 9.4,24.8 3.1,1.4 6.4,1.8 16.5,1.8 12.3,0 12.7,-0.1 23,-4.2 5.9,-2.3 14,-4.6 18.5,-5.3 13.4,-2 20.5,-7.3 20.5,-15.3 0,-4.4 -5.2,-10.4 -9.8,-11.3 -3.3,-0.7 -16.8,-11.6 -19.6,-15.9 -1.4,-2.1 -1.6,-3.9 -1,-9.9 0.5,-5.2 0.1,-10.8 -1.2,-18.6 -2.3,-15 -1.2,-27.3 5.6,-58 2.6,-11.8 6.3,-30.7 8.4,-42.5 0.9,-5 3.7,-20 6.2,-33.5 8.6,-45.4 8.6,-45.1 8.1,-61 -1,-31.4 -14.6,-75 -31.4,-100.7 -4.7,-7.2 -5.5,-7.7 -8.2,-5.1 z" />
        <path data-muscle="calves" class="hm-muscle" d="m 1905,1076.2 c -7.9,5.3 -10.8,13.3 -14.4,39.8 -5.1,37.3 -6.4,71.3 -3.3,89.2 1.9,10.9 7.1,21.1 14.7,28.8 9.1,9.3 19.9,12.9 23.2,7.7 2.3,-3.6 6.6,-14.5 9.4,-24.2 2.4,-8.1 2.7,-10.7 2.8,-25.5 0.1,-9.1 -0.5,-20.3 -1.2,-25 -0.7,-4.7 -2,-13.2 -2.8,-19 -3.9,-27.1 -9.1,-46.9 -16.7,-64 -4.8,-10.7 -6.1,-11.6 -11.7,-7.8 z" />
        <path data-muscle="calves" class="hm-muscle" d="m 2069.1,1083.7 c -10,22.3 -13.9,38 -20.7,81.8 -4.6,30.1 -2.2,53.4 7.5,72.4 3.4,6.5 7.6,7.3 16.6,2.9 7.3,-3.6 17.4,-16.5 21.4,-27.1 5.4,-14.8 5,-66.7 -1,-108.7 -1.3,-9.6 -4.2,-18.9 -7.1,-23.4 -2.3,-3.5 -8.2,-7.6 -11,-7.6 -0.8,0 -3.2,4 -5.7,9.7 z" />
    </g>
`;
