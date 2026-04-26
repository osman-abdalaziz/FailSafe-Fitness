/**
 * muscle-map.js
 * Generates the SVG Heatmap and handles color intensity rendering.
 */

// A stylized, high-performance abstract SVG representation of the human body (Front & Back)
const generateBodySVG = (prefix = "") => `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:100%; drop-shadow: 0 0 5px rgba(0,0,0,0.5);">
    <style>
        .muscle-path { fill: var(--bg-deep); stroke: rgba(255,255,255,0.15); stroke-width: 1; transition: fill 0.4s ease, stroke 0.2s; cursor: pointer; }
        .muscle-path:hover { stroke: var(--accent-primary); stroke-width: 1.5; }
    </style>
    <g transform="translate(40, 20)">
        <circle cx="25" cy="15" r="12" class="muscle-path" id="${prefix}neck" />
        <path d="M 0 35 Q 5 25 12 30 L 12 45 L 0 45 Z" class="muscle-path" id="${prefix}shoulders" />
        <path d="M 50 35 Q 45 25 38 30 L 38 45 L 50 45 Z" class="muscle-path" id="${prefix}shoulders-r" />
        <path d="M 14 32 L 24 32 L 24 50 Q 18 52 14 48 Z" class="muscle-path" id="${prefix}chest" />
        <path d="M 36 32 L 26 32 L 26 50 Q 32 52 36 48 Z" class="muscle-path" id="${prefix}chest-r" />
        <rect x="16" y="52" width="18" height="25" rx="2" class="muscle-path" id="${prefix}core" />
        <rect x="2" y="48" width="8" height="20" rx="4" class="muscle-path" id="${prefix}biceps" />
        <rect x="40" y="48" width="8" height="20" rx="4" class="muscle-path" id="${prefix}biceps-r" />
        <rect x="2" y="70" width="6" height="18" rx="3" class="muscle-path" id="${prefix}forearms" />
        <rect x="42" y="70" width="6" height="18" rx="3" class="muscle-path" id="${prefix}forearms-r" />
        <path d="M 14 80 L 23 80 L 21 115 L 14 115 Z" class="muscle-path" id="${prefix}quads" />
        <path d="M 36 80 L 27 80 L 29 115 L 36 115 Z" class="muscle-path" id="${prefix}quads-r" />
        <rect x="14" y="118" width="6" height="20" rx="2" class="muscle-path" id="${prefix}calves" />
        <rect x="30" y="118" width="6" height="20" rx="2" class="muscle-path" id="${prefix}calves-r" />
    </g>

    <g transform="translate(110, 20)">
        <circle cx="25" cy="15" r="12" class="muscle-path" id="${prefix}traps" />
        <path d="M 12 30 L 38 30 L 32 75 L 18 75 Z" class="muscle-path" id="${prefix}lats" />
        <rect x="2" y="48" width="8" height="20" rx="4" class="muscle-path" id="${prefix}triceps" />
        <rect x="40" y="48" width="8" height="20" rx="4" class="muscle-path" id="${prefix}triceps-r" />
        <rect x="12" y="78" width="26" height="15" rx="5" class="muscle-path" id="${prefix}glutes" />
        <path d="M 14 95 L 23 95 L 21 115 L 14 115 Z" class="muscle-path" id="${prefix}hamstrings" />
        <path d="M 36 95 L 27 95 L 29 115 L 36 115 Z" class="muscle-path" id="${prefix}hamstrings-r" />
    </g>
</svg>
`;

export function initHeatmap() {
    const miniContainer = document.getElementById("mini-heatmap-container");
    const fullContainer = document.getElementById("full-heatmap-container");

    if (miniContainer) miniContainer.innerHTML = generateBodySVG("mini-");
    if (fullContainer) fullContainer.innerHTML = generateBodySVG("full-");

    // Modal Toggles
    const modal = document.getElementById("heatmap-modal");
    document
        .getElementById("btn-open-heatmap")
        ?.addEventListener("click", () => {
            modal.classList.remove("app-shell-hidden");
        });
    document
        .getElementById("btn-close-heatmap")
        ?.addEventListener("click", () => {
            modal.classList.add("app-shell-hidden");
        });

    // Add interactivity to full map
    if (fullContainer) {
        const paths = fullContainer.querySelectorAll(".muscle-path");
        paths.forEach((path) => {
            path.addEventListener("click", (e) => {
                const muscleId = e.target.id
                    .replace("full-", "")
                    .replace("-r", "");
                showMuscleStats(muscleId);
            });
        });
    }
}

// Global variable to hold current session muscle volumes
let currentMuscleVolumes = {};

export function updateHeatmap(muscleVolumes) {
    currentMuscleVolumes = muscleVolumes;
    const maxVol = Math.max(...Object.values(muscleVolumes), 1); // Avoid division by zero

    // List of supported muscle IDs in the SVG
    const supportedMuscles = [
        "chest",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "core",
        "quads",
        "hamstrings",
        "calves",
        "glutes",
        "lats",
        "traps",
        "neck",
    ];

    supportedMuscles.forEach((muscle) => {
        const volume = muscleVolumes[muscle] || 0;

        // Map intensity to Alpha channel of our Red/Rose accent color (rgb(244, 63, 94))
        let color = "var(--bg-deep)";
        if (volume > 0) {
            const intensity = volume / maxVol;
            const alpha = 0.2 + intensity * 0.8; // Min 0.2, Max 1.0
            color = `rgba(244, 63, 94, ${alpha})`;
        }

        // Apply to left and right paths for both Mini and Full SVGs
        ["mini", "full"].forEach((prefix) => {
            const pathL = document.getElementById(`${prefix}-${muscle}`);
            const pathR = document.getElementById(`${prefix}-${muscle}-r`);
            if (pathL) pathL.style.fill = color;
            if (pathR) pathR.style.fill = color;
        });
    });
}

function showMuscleStats(muscle) {
    const statsBox = document.getElementById("heatmap-selected-stats");
    const nameLabel = document.getElementById("heatmap-muscle-name");
    const volLabel = document.getElementById("heatmap-muscle-vol");

    const vol = currentMuscleVolumes[muscle] || 0;

    statsBox.style.display = "block";
    nameLabel.innerText = muscle.toUpperCase();
    volLabel.innerText = `${vol.toLocaleString()} kg`;
}
