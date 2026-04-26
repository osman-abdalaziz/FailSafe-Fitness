/**
 * muscle-heatmap.js
 * Professional Muscle Heatmap System — Session-aware, anatomically accurate.
 * Integrates with workout-engine.js via CustomEvents. Zero interference.
 */

// ── Unified Muscle Name Mapping ───────────────────────────────────────────────
// Maps every possible exercise DB muscle string → internal heatmap key
const MUSCLE_ALIAS_MAP = {
    // Chest
    pectorals: "chest",
    chest: "chest",
    "pectoralis major": "chest",
    "pectoralis minor": "chest",
    pecs: "chest",

    // Back
    lats: "lats",
    "latissimus dorsi": "lats",
    traps: "traps",
    trapezius: "traps",
    "upper back": "traps",
    rhomboids: "traps",
    "lower back": "lower_back",
    "erector spinae": "lower_back",
    spine: "lower_back",

    // Shoulders
    delts: "shoulders",
    deltoids: "shoulders",
    shoulders: "shoulders",
    "anterior deltoid": "shoulders",
    "posterior deltoid": "shoulders",
    "lateral deltoid": "shoulders",
    "front deltoid": "shoulders",
    "rear deltoid": "shoulders",

    // Arms
    biceps: "biceps",
    "biceps brachii": "biceps",
    triceps: "triceps",
    "triceps brachii": "triceps",
    forearms: "forearms",
    brachioradialis: "forearms",
    brachialis: "biceps",

    // Core
    abs: "abs",
    abdominals: "abs",
    core: "abs",
    "rectus abdominis": "abs",
    obliques: "obliques",
    "serratus anterior": "abs",
    "transverse abdominis": "abs",

    // Legs
    quads: "quads",
    quadriceps: "quads",
    "quadriceps femoris": "quads",
    hamstrings: "hamstrings",
    "biceps femoris": "hamstrings",
    glutes: "glutes",
    "gluteus maximus": "glutes",
    "gluteus medius": "glutes",
    calves: "calves",
    gastrocnemius: "calves",
    soleus: "calves",
    "hip flexors": "quads",
    adductors: "adductors",
    abductors: "glutes",

    // Neck / Other
    neck: "traps",
    "levator scapulae": "traps",
};

// Normalize any muscle string → internal key
function normalizeMuscle(raw) {
    if (!raw) return null;
    const key = raw.toLowerCase().trim();
    return MUSCLE_ALIAS_MAP[key] || null;
}

// ── Session State ─────────────────────────────────────────────────────────────
// { muscleKey: [ { exerciseName, sets: [{weight, reps, volume}] } ] }
let sessionMuscleData = {};

// ── Public API ────────────────────────────────────────────────────────────────
export function resetHeatmap() {
    sessionMuscleData = {};
    renderHeatmapColors();
}

export function updateHeatmapSet(exerciseName, rawMuscle, setData) {
    const key = normalizeMuscle(rawMuscle);
    if (!key) return;

    if (!sessionMuscleData[key]) sessionMuscleData[key] = [];

    // Find or create exercise entry
    let exEntry = sessionMuscleData[key].find(
        (e) => e.exerciseName === exerciseName,
    );
    if (!exEntry) {
        exEntry = { exerciseName, sets: [] };
        sessionMuscleData[key].push(exEntry);
    }
    exEntry.sets.push(setData);
    renderHeatmapColors();
}

// Called once when the heatmap DOM is ready
export function initHeatmap() {
    buildHeatmapSVG();
    buildMuscleModal();
    renderHeatmapColors();
}

// ── SVG Builder ───────────────────────────────────────────────────────────────
function buildHeatmapSVG() {
    const container = document.getElementById("heatmap-svg-container");
    if (!container) return;
    container.innerHTML = `
    <div class="hm-body-wrap">
        <div class="hm-side-label">FRONT</div>
        <svg class="hm-svg" viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
            ${SVG_FRONT}
        </svg>
        <div class="hm-side-label">BACK</div>
        <svg class="hm-svg" viewBox="0 0 200 420" xmlns="http://www.w3.org/2000/svg">
            ${SVG_BACK}
        </svg>
    </div>`;

    // Attach click handlers to every muscle path
    container.querySelectorAll("[data-muscle]").forEach((el) => {
        el.addEventListener("click", () => {
            const key = el.getAttribute("data-muscle");
            openMuscleModal(key);
        });
    });
}

// ── Color Renderer ────────────────────────────────────────────────────────────
function renderHeatmapColors() {
    const allPaths = document.querySelectorAll("[data-muscle]");
    if (!allPaths.length) return;

    // Compute max sets across all muscles for relative intensity
    let maxSets = 0;
    Object.values(sessionMuscleData).forEach((exercises) => {
        const total = exercises.reduce((a, e) => a + e.sets.length, 0);
        if (total > maxSets) maxSets = total;
    });

    allPaths.forEach((path) => {
        const key = path.getAttribute("data-muscle");
        const exercises = sessionMuscleData[key];

        if (!exercises || exercises.length === 0) {
            path.style.fill = "var(--hm-inactive)";
            path.style.opacity = "1";
            path.classList.remove("hm-active");
            return;
        }

        const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
        const intensity = maxSets > 0 ? totalSets / maxSets : 0;

        // Graduated color: low = amber, high = rose red
        if (intensity > 0.66) {
            path.style.fill = "var(--hm-hot)";
        } else if (intensity > 0.33) {
            path.style.fill = "var(--hm-warm)";
        } else {
            path.style.fill = "var(--hm-cool)";
        }
        path.classList.add("hm-active");
    });

    // Update sub-nav mini heatmap if present
    renderMiniHeatmap();
}

// ── Mini Heatmap (sub-nav) ────────────────────────────────────────────────────
function renderMiniHeatmap() {
    const mini = document.getElementById("hm-mini-wrap");
    if (!mini) return;

    const activeMuscles = Object.keys(sessionMuscleData);
    const total = activeMuscles.length;

    if (total === 0) {
        mini.innerHTML = `<span class="hm-mini-empty">No muscles yet</span>`;
        return;
    }

    mini.innerHTML = activeMuscles
        .map((key) => {
            const sets = sessionMuscleData[key].reduce(
                (a, e) => a + e.sets.length,
                0,
            );
            return `<div class="hm-mini-dot hm-mini-dot--active" title="${key}: ${sets} sets"></div>`;
        })
        .join("");
}

// ── Muscle Modal ──────────────────────────────────────────────────────────────
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

    // Backdrop close
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeMuscleModal();
    });

    // Close button (delegated)
    modal.addEventListener("click", (e) => {
        if (e.target.closest("#hm-modal-close")) closeMuscleModal();
    });

    // Drag to dismiss
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

function openMuscleModal(muscleKey) {
    const modal = document.getElementById("hm-modal");
    const body = document.getElementById("hm-modal-body");
    if (!modal || !body) return;

    const label = MUSCLE_LABELS[muscleKey] || muscleKey;
    const exercises = sessionMuscleData[muscleKey] || [];
    const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
    const totalVol = exercises.reduce(
        (a, e) => a + e.sets.reduce((b, s) => b + (s.volume || 0), 0),
        0,
    );

    body.innerHTML = `
        <div class="hm-modal-header">
            <div>
                <div class="hm-modal-muscle-badge">${getMuscleEmoji(muscleKey)}</div>
                <h2 class="hm-modal-title">${label}</h2>
                <p class="hm-modal-subtitle">Current session breakdown</p>
            </div>
            <button id="hm-modal-close" class="mf-btn-icon"><i class="fas fa-xmark"></i></button>
        </div>

        ${
            exercises.length === 0
                ? `
        <div class="hm-modal-empty">
            <i class="fas fa-dumbbell"></i>
            <p>No sets logged for ${label} this session.</p>
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
                <span class="hm-modal-stat-lbl">Volume kg</span>
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
                    ${s.is_pr ? '<span class="mf-badge success" style="font-size:0.55rem;padding:2px 6px;">PR</span>' : "<span></span>"}
                </div>`,
                    )
                    .join("")}
            </div>`,
                )
                .join("")}
        </div>`
        }
    `;

    modal.classList.add("hm-modal--open");
    document.body.classList.add("exd-body-lock");
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

function getMuscleEmoji(key) {
    const map = {
        chest: "💪",
        lats: "🦅",
        traps: "🏔️",
        lower_back: "🔩",
        shoulders: "🔝",
        biceps: "💪",
        triceps: "💪",
        forearms: "🤜",
        abs: "⬡",
        obliques: "↔️",
        quads: "🦵",
        hamstrings: "🦵",
        glutes: "🍑",
        calves: "🦶",
        adductors: "🦵",
    };
    return map[key] || "💪";
}

// ── SVG Definitions ───────────────────────────────────────────────────────────
// Anatomically simplified but recognizable front/back muscle maps

const SVG_FRONT = `
<!-- Head -->
<ellipse cx="100" cy="22" rx="18" ry="22" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.8"/>
<!-- Neck -->
<rect x="91" y="40" width="18" height="14" rx="4" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.8"/>

<!-- Chest (pectorals) — two lobes -->
<path data-muscle="chest" d="M68,60 C68,54 78,52 100,53 C122,52 132,54 132,60 L130,82 C130,88 120,92 100,92 C80,92 70,88 68,82 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Shoulder -->
<ellipse data-muscle="shoulders" cx="57" cy="68" rx="13" ry="18" class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Shoulder -->
<ellipse data-muscle="shoulders" cx="143" cy="68" rx="13" ry="18" class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Bicep -->
<path data-muscle="biceps" d="M44,84 C40,84 36,88 36,96 L38,116 C38,122 42,126 48,126 L56,124 C60,122 62,116 60,108 L56,86 C54,84 48,84 44,84Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Bicep -->
<path data-muscle="biceps" d="M156,84 C160,84 164,88 164,96 L162,116 C162,122 158,126 152,126 L144,124 C140,122 138,116 140,108 L144,86 C146,84 152,84 156,84Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Forearm -->
<path data-muscle="forearms" d="M37,118 C34,118 32,122 33,130 L36,152 C37,157 41,160 46,159 L52,156 C56,154 57,149 55,142 L50,120 C48,118 42,118 37,118Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Forearm -->
<path data-muscle="forearms" d="M163,118 C166,118 168,122 167,130 L164,152 C163,157 159,160 154,159 L148,156 C144,154 143,149 145,142 L150,120 C152,118 158,118 163,118Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Abs (6-pack grid) -->
<path data-muscle="abs" d="M83,93 C83,93 100,91 117,93 L118,145 C118,151 110,156 100,156 C90,156 82,151 82,145 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Abs internal lines (decorative, non-interactive) -->
<line x1="83" y1="110" x2="118" y2="110" stroke="var(--hm-stroke)" stroke-width="0.5" pointer-events="none"/>
<line x1="83" y1="128" x2="118" y2="128" stroke="var(--hm-stroke)" stroke-width="0.5" pointer-events="none"/>
<line x1="100" y1="93" x2="100" y2="156" stroke="var(--hm-stroke)" stroke-width="0.5" pointer-events="none"/>

<!-- Left Oblique -->
<path data-muscle="obliques" d="M69,96 C65,96 62,102 63,112 L66,140 C67,146 71,150 76,148 L83,145 L82,93 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Oblique -->
<path data-muscle="obliques" d="M131,96 C135,96 138,102 137,112 L134,140 C133,146 129,150 124,148 L117,145 L118,93 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Quad -->
<path data-muscle="quads" d="M72,160 C68,160 64,165 65,174 L70,220 C71,228 76,234 83,233 L91,231 C97,229 99,222 97,213 L90,166 C88,162 82,160 72,160Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Quad -->
<path data-muscle="quads" d="M128,160 C132,160 136,165 135,174 L130,220 C129,228 124,234 117,233 L109,231 C103,229 101,222 103,213 L110,166 C112,162 118,160 128,160Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Adductor -->
<path data-muscle="adductors" d="M91,163 C91,163 97,165 100,166 C100,166 100,220 99,228 L88,228 L85,180 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Adductor -->
<path data-muscle="adductors" d="M109,163 C109,163 103,165 100,166 C100,166 100,220 101,228 L112,228 L115,180 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Calves (front — tibialis) -->
<path data-muscle="calves" d="M69,238 C65,238 62,244 63,254 L66,288 C67,295 71,298 76,297 L82,294 C87,292 88,285 86,275 L80,244 C78,240 74,238 69,238Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Calves (front) -->
<path data-muscle="calves" d="M131,238 C135,238 138,244 137,254 L134,288 C133,295 129,298 124,297 L118,294 C113,292 112,285 114,275 L120,244 C122,240 126,238 131,238Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Torso outline / pelvis -->
<path d="M68,60 L62,155 C62,158 80,165 100,165 C120,165 138,158 138,155 L132,60" fill="none" stroke="var(--hm-stroke)" stroke-width="0.6" pointer-events="none"/>
<!-- Hip band -->
<path d="M65,156 C65,156 80,165 100,166 C120,165 135,156 135,156 L134,170 C134,170 120,178 100,178 C80,178 66,170 66,170Z" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6" pointer-events="none"/>
`;

const SVG_BACK = `
<!-- Head -->
<ellipse cx="100" cy="22" rx="18" ry="22" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.8"/>
<!-- Neck back -->
<rect x="91" y="40" width="18" height="14" rx="4" fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.8"/>

<!-- Traps (upper trapezius — diamond shape) -->
<path data-muscle="traps" d="M100,44 C86,46 70,52 66,62 L72,74 C80,68 90,63 100,62 C110,63 120,68 128,74 L134,62 C130,52 114,46 100,44Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Rear Shoulder -->
<ellipse data-muscle="shoulders" cx="57" cy="72" rx="14" ry="19" class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Rear Shoulder -->
<ellipse data-muscle="shoulders" cx="143" cy="72" rx="14" ry="19" class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Lats -->
<path data-muscle="lats" d="M68,72 C62,78 60,90 62,106 L66,130 C68,138 74,143 82,140 L92,136 L90,90 C88,80 80,70 68,72Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Lats -->
<path data-muscle="lats" d="M132,72 C138,78 140,90 138,106 L134,130 C132,138 126,143 118,140 L108,136 L110,90 C112,80 120,70 132,72Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Lower Back (erector spinae) -->
<path data-muscle="lower_back" d="M88,138 C84,138 82,144 83,152 L86,170 C87,176 91,180 96,179 L104,179 C109,180 113,176 114,170 L117,152 C118,144 116,138 112,138 Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Spine line decorative -->
<line x1="100" y1="62" x2="100" y2="179" stroke="var(--hm-stroke)" stroke-width="0.6" stroke-dasharray="3,3" pointer-events="none"/>

<!-- Left Tricep -->
<path data-muscle="triceps" d="M43,86 C39,86 35,91 36,100 L39,120 C40,127 44,131 50,130 L57,127 C61,125 62,118 60,110 L55,88 C53,86 47,86 43,86Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Tricep -->
<path data-muscle="triceps" d="M157,86 C161,86 165,91 164,100 L161,120 C160,127 156,131 150,130 L143,127 C139,125 138,118 140,110 L145,88 C147,86 153,86 157,86Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Forearm (back) -->
<path data-muscle="forearms" d="M38,122 C35,122 33,127 34,135 L37,158 C38,163 42,166 47,165 L53,162 C57,160 58,155 56,148 L51,124 C49,122 43,122 38,122Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Forearm (back) -->
<path data-muscle="forearms" d="M162,122 C165,122 167,127 166,135 L163,158 C162,163 158,166 153,165 L147,162 C143,160 142,155 144,148 L149,124 C151,122 157,122 162,122Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Glute -->
<path data-muscle="glutes" d="M66,178 C62,178 60,184 61,193 L65,215 C67,223 73,228 80,226 L93,222 L92,188 C90,180 80,177 66,178Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Glute -->
<path data-muscle="glutes" d="M134,178 C138,178 140,184 139,193 L135,215 C133,223 127,228 120,226 L107,222 L108,188 C110,180 120,177 134,178Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Hamstring -->
<path data-muscle="hamstrings" d="M69,228 C65,228 62,234 63,244 L68,278 C69,286 74,291 81,290 L88,287 C93,285 95,278 93,268 L86,234 C84,230 78,228 69,228Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Hamstring -->
<path data-muscle="hamstrings" d="M131,228 C135,228 138,234 137,244 L132,278 C131,286 126,291 119,290 L112,287 C107,285 105,278 107,268 L114,234 C116,230 122,228 131,228Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Left Calf (gastrocnemius) -->
<path data-muscle="calves" d="M68,292 C64,292 61,299 62,310 L66,346 C67,354 72,358 78,356 L84,353 C89,350 90,342 88,332 L81,298 C79,294 74,292 68,292Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>
<!-- Right Calf -->
<path data-muscle="calves" d="M132,292 C136,292 139,299 138,310 L134,346 C133,354 128,358 122,356 L116,353 C111,350 110,342 112,332 L119,298 C121,294 126,292 132,292Z"
    class="hm-muscle" style="fill:var(--hm-inactive)"/>

<!-- Torso back outline -->
<path d="M70,72 L64,178 C64,178 80,186 100,186 C120,186 136,178 136,178 L130,72" fill="none" stroke="var(--hm-stroke)" stroke-width="0.6" pointer-events="none"/>
`;
