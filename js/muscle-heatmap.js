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

// MODIFIED: High-quality anatomically precise SVG — clean paths, defined muscle boundaries
const SVG_FRONT = `
<defs>
  <style>
    .hm-muscle { transition: fill 0.35s ease; }
    .hm-muscle:hover { stroke: rgba(255,255,255,0.4) !important; stroke-width: 1 !important; }
  </style>
</defs>

<!-- ─── HEAD & NECK ─── -->
<ellipse cx="100" cy="20" rx="15" ry="18"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
<path d="M94,36 L106,36 L107,50 L93,50 Z"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>

<!-- ─── TORSO SILHOUETTE (non-interactive background) ─── -->
<path d="M70,52 L130,52 L134,160 L115,165 L100,168 L85,165 L66,160 Z"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── CHEST ─── -->
<path data-muscle="chest"
  d="M73,54 C73,54 84,51 100,51 C116,51 127,54 127,54
     L124,80 C120,87 112,91 100,91 C88,91 80,87 76,80 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- sternum line -->
<line x1="100" y1="53" x2="100" y2="91"
  stroke="var(--hm-stroke)" stroke-width="0.8" pointer-events="none"/>

<!-- ─── SHOULDERS ─── -->
<!-- Left -->
<path data-muscle="shoulders"
  d="M70,52 C64,52 56,56 52,64 L50,80 C52,88 58,92 64,90 L72,86 L73,54 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="shoulders"
  d="M130,52 C136,52 144,56 148,64 L150,80 C148,88 142,92 136,90 L128,86 L127,54 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── BICEPS ─── -->
<!-- Left -->
<path data-muscle="biceps"
  d="M51,82 C48,82 44,86 43,94 L44,114 C45,120 49,124 54,123
     L60,120 C64,118 65,112 63,104 L60,84 C58,82 54,82 51,82 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="biceps"
  d="M149,82 C152,82 156,86 157,94 L156,114 C155,120 151,124 146,123
     L140,120 C136,118 135,112 137,104 L140,84 C142,82 146,82 149,82 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── FOREARMS ─── -->
<!-- Left -->
<path data-muscle="forearms"
  d="M43,117 C40,117 37,121 37,129 L39,152 C40,158 44,162 49,161
     L55,158 C59,156 60,150 58,142 L53,119 C51,117 46,117 43,117 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="forearms"
  d="M157,117 C160,117 163,121 163,129 L161,152 C160,158 156,162 151,161
     L145,158 C141,156 140,150 142,142 L147,119 C149,117 154,117 157,117 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── OBLIQUES ─── -->
<!-- Left -->
<path data-muscle="obliques"
  d="M66,94 C62,94 59,100 60,112 L63,140 C64,147 68,152 73,150
     L80,147 L79,92 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="obliques"
  d="M134,94 C138,94 141,100 140,112 L137,140 C136,147 132,152 127,150
     L120,147 L121,92 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── ABS ─── -->
<path data-muscle="abs"
  d="M80,92 L120,92 L121,150 C121,156 112,160 100,160
     C88,160 79,156 79,150 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- abs grid lines -->
<line x1="80" y1="109" x2="120" y2="109" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>
<line x1="80" y1="128" x2="120" y2="128" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>
<line x1="100" y1="92"  x2="100" y2="160" stroke="var(--hm-stroke)" stroke-width="0.7" pointer-events="none"/>

<!-- ─── HIP / PELVIS (decorative) ─── -->
<path d="M67,161 C67,161 82,170 100,170 C118,170 133,161 133,161 L132,175 C128,180 116,184 100,184 C84,184 72,180 68,175 Z"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6" pointer-events="none"/>

<!-- ─── QUADS ─── -->
<!-- Left -->
<path data-muscle="quads"
  d="M68,172 C63,172 59,178 60,188 L65,232 C67,241 73,246 81,245
     L89,242 C95,240 97,232 95,222 L87,178 C85,173 78,172 68,172 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="quads"
  d="M132,172 C137,172 141,178 140,188 L135,232 C133,241 127,246 119,245
     L111,242 C105,240 103,232 105,222 L113,178 C115,173 122,172 132,172 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── ADDUCTORS ─── -->
<!-- Left inner thigh -->
<path data-muscle="adductors"
  d="M89,174 C89,174 96,177 100,178 L99,242 L87,242 L85,195 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right inner thigh -->
<path data-muscle="adductors"
  d="M111,174 C111,174 104,177 100,178 L101,242 L113,242 L115,195 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── CALVES (tibialis anterior) ─── -->
<!-- Left -->
<path data-muscle="calves"
  d="M64,250 C60,250 57,256 58,267 L61,302 C62,310 67,314 73,313
     L79,310 C84,308 85,300 83,290 L76,256 C74,251 69,250 64,250 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="calves"
  d="M136,250 C140,250 143,256 142,267 L139,302 C138,310 133,314 127,313
     L121,310 C116,308 115,300 117,290 L124,256 C126,251 131,250 136,250 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
`;

const SVG_BACK = `
<defs>
  <style>
    .hm-muscle { transition: fill 0.35s ease; }
    .hm-muscle:hover { stroke: rgba(255,255,255,0.4) !important; stroke-width: 1 !important; }
  </style>
</defs>

<!-- ─── HEAD & NECK ─── -->
<ellipse cx="100" cy="20" rx="15" ry="18"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>
<path d="M94,36 L106,36 L107,50 L93,50 Z"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.7"/>

<!-- ─── TORSO SILHOUETTE ─── -->
<path d="M70,52 L130,52 L134,185 L115,190 L100,192 L85,190 L66,185 Z"
  fill="var(--hm-body-base)" stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── TRAPEZIUS ─── -->
<path data-muscle="traps"
  d="M100,38 C86,40 70,48 66,60 L72,76 C80,70 90,64 100,63
     C110,64 120,70 128,76 L134,60 C130,48 114,40 100,38 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── REAR SHOULDERS ─── -->
<!-- Left -->
<path data-muscle="shoulders"
  d="M66,58 C60,58 52,64 49,72 L48,88 C50,96 57,100 63,98
     L71,94 L72,56 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="shoulders"
  d="M134,58 C140,58 148,64 151,72 L152,88 C150,96 143,100 137,98
     L129,94 L128,56 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── LATS ─── -->
<!-- Left -->
<path data-muscle="lats"
  d="M67,75 C61,82 59,96 61,114 L65,138 C67,148 74,154 83,150
     L93,146 L91,95 C89,82 80,72 67,75 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="lats"
  d="M133,75 C139,82 141,96 139,114 L135,138 C133,148 126,154 117,150
     L107,146 L109,95 C111,82 120,72 133,75 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── LOWER BACK (erector spinae) ─── -->
<path data-muscle="lower_back"
  d="M87,148 C83,148 80,155 81,164 L84,183 C85,190 90,194 96,193
     L104,193 C110,194 115,190 116,183 L119,164
     C120,155 117,148 113,148 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- spine -->
<line x1="100" y1="63" x2="100" y2="193"
  stroke="var(--hm-stroke)" stroke-width="0.8" stroke-dasharray="4,3"
  pointer-events="none"/>

<!-- ─── TRICEPS ─── -->
<!-- Left -->
<path data-muscle="triceps"
  d="M48,90 C44,90 40,95 41,104 L44,124 C45,131 50,135 56,134
     L62,131 C66,129 67,122 65,114 L60,92 C58,90 52,90 48,90 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="triceps"
  d="M152,90 C156,90 160,95 159,104 L156,124 C155,131 150,135 144,134
     L138,131 C134,129 133,122 135,114 L140,92 C142,90 148,90 152,90 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── FOREARMS (back) ─── -->
<!-- Left -->
<path data-muscle="forearms"
  d="M40,127 C37,127 34,132 35,141 L38,164 C39,170 44,174 49,172
     L55,169 C59,167 60,161 58,153 L53,129 C51,127 45,127 40,127 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="forearms"
  d="M160,127 C163,127 166,132 165,141 L162,164 C161,170 156,174 151,172
     L145,169 C141,167 140,161 142,153 L147,129 C149,127 155,127 160,127 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── GLUTES ─── -->
<!-- Left -->
<path data-muscle="glutes"
  d="M67,188 C62,188 59,195 60,205 L64,228 C66,237 73,243 81,240
     L95,236 L93,205 C91,194 82,187 67,188 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="glutes"
  d="M133,188 C138,188 141,195 140,205 L136,228 C134,237 127,243 119,240
     L105,236 L107,205 C109,194 118,187 133,188 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── HAMSTRINGS ─── -->
<!-- Left -->
<path data-muscle="hamstrings"
  d="M64,242 C59,242 56,249 57,260 L62,298 C64,307 70,312 78,311
     L85,308 C91,305 92,297 90,286 L82,249 C80,244 74,242 64,242 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="hamstrings"
  d="M136,242 C141,242 144,249 143,260 L138,298 C136,307 130,312 122,311
     L115,308 C109,305 108,297 110,286 L118,249 C120,244 126,242 136,242 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>

<!-- ─── CALVES (gastrocnemius) ─── -->
<!-- Left -->
<path data-muscle="calves"
  d="M62,314 C58,314 55,321 56,333 L59,366 C60,374 66,379 73,377
     L79,374 C84,371 85,363 83,352 L75,320 C73,315 67,314 62,314 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
<!-- Right -->
<path data-muscle="calves"
  d="M138,314 C142,314 145,321 144,333 L141,366 C140,374 134,379 127,377
     L121,374 C116,371 115,363 117,352 L125,320 C127,315 133,314 138,314 Z"
  class="hm-muscle" fill="var(--hm-inactive)"
  stroke="var(--hm-stroke)" stroke-width="0.6"/>
`;
