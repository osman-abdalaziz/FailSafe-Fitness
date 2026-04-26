/**
 * exercise-details.js
 * Exercise Details — True overlay panel, works from catalog AND active workout.
 */

import { auth, db } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    getDocs,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const IMG_BASE =
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

// ── Create the overlay DOM once on load ──────────────────────────────────────
let overlayEl = null;

// function ensureOverlay() {
//     if (overlayEl) return;

//     overlayEl = document.createElement("div");
//     overlayEl.id = "exd-overlay";
//     overlayEl.innerHTML = `<div id="exd-panel"><div id="exd-panel-body"></div></div>`;
//     document.body.appendChild(overlayEl);

//     // Close on backdrop click
//     overlayEl.addEventListener("click", (e) => {
//         if (e.target === overlayEl) closeExerciseDetails();
//     });

//     // Close button (delegated)
//     overlayEl.addEventListener("click", (e) => {
//         if (e.target.closest("#btn-back-exercise-details"))
//             closeExerciseDetails();
//     });

//     // Swipe down to close (touch)
//     let touchStartY = 0;
//     overlayEl.addEventListener(
//         "touchstart",
//         (e) => {
//             touchStartY = e.touches[0].clientY;
//         },
//         { passive: true },
//     );
//     overlayEl.addEventListener(
//         "touchend",
//         (e) => {
//             if (e.changedTouches[0].clientY - touchStartY > 80)
//                 closeExerciseDetails();
//         },
//         { passive: true },
//     );
// }
// MODIFIED: Fixed overlay creation order + guard + clean references
// function ensureOverlay() {
//     if (overlayEl) return; // Guard: only create once

//     // Create DOM first, THEN query into it
//     overlayEl = document.createElement("div");
//     overlayEl.id = "exd-overlay";
//     overlayEl.innerHTML = `<div id="exd-panel"><div id="exd-panel-body"></div></div>`;
//     document.body.appendChild(overlayEl);

//     const panel = overlayEl.querySelector("#exd-panel");

//     // ── Backdrop tap → close ─────────────────────────────────────────────
//     overlayEl.addEventListener("click", (e) => {
//         if (e.target === overlayEl) closeExerciseDetails();
//     });

//     // ── Back button (delegated) ──────────────────────────────────────────
//     overlayEl.addEventListener("click", (e) => {
//         if (e.target.closest("#btn-back-exercise-details"))
//             closeExerciseDetails();
//     });

//     // MODIFIED: Drag-to-dismiss with scroll conflict fix + rAF for smoothness
//     let touchStartY = 0;
//     let touchStartX = 0;
//     let isDragging = false;
//     let dragIntent = null; // 'drag' | 'scroll' | null
//     let rafId = null;
//     let latestDelta = 0;

//     // Tell the compositor to prepare this layer
//     panel.style.willChange = "transform";

//     overlayEl.addEventListener(
//         "touchstart",
//         (e) => {
//             if (!e.target.closest("#exd-panel")) return;
//             touchStartY = e.touches[0].clientY;
//             touchStartX = e.touches[0].clientX;
//             isDragging = true;
//             dragIntent = null; // reset intent each gesture
//             panel.style.transition = "none";
//         },
//         { passive: true },
//     );

//     overlayEl.addEventListener(
//         "touchmove",
//         (e) => {
//             if (!isDragging) return;

//             const deltaY = e.touches[0].clientY - touchStartY;
//             const deltaX = e.touches[0].clientX - touchStartX;

//             // ── Determine intent on first meaningful move ──
//             if (
//                 dragIntent === null &&
//                 (Math.abs(deltaY) > 4 || Math.abs(deltaX) > 4)
//             ) {
//                 const isMoreVertical = Math.abs(deltaY) > Math.abs(deltaX);
//                 const panelBody = panel.querySelector("#exd-panel-body");
//                 const scrolledFromTop = panelBody
//                     ? panelBody.scrollTop <= 0
//                     : true;

//                 // Only take control if: moving more vertically AND panel is scrolled to top AND pulling down
//                 if (isMoreVertical && scrolledFromTop && deltaY > 0) {
//                     dragIntent = "drag";
//                 } else {
//                     dragIntent = "scroll";
//                 }
//             }

//             if (dragIntent !== "drag") return; // Let native scroll handle it

//             e.preventDefault(); // Block scroll only when we own the gesture

//             if (deltaY < 0) {
//                 latestDelta = deltaY * 0.1; // rubber-band up
//             } else {
//                 latestDelta = deltaY * 0.55; // weighted drag down
//             }

//             // rAF: batch transform updates to display refresh cycle
//             if (rafId) cancelAnimationFrame(rafId);
//             rafId = requestAnimationFrame(() => {
//                 panel.style.transform = `translateY(${latestDelta}px)`;
//             });
//         },
//         { passive: false },
//     ); // Must be false so e.preventDefault() works

//     overlayEl.addEventListener(
//         "touchend",
//         (e) => {
//             if (!isDragging) return;
//             isDragging = false;
//             dragIntent = null;
//             if (rafId) cancelAnimationFrame(rafId);

//             const dragDistance = e.changedTouches[0].clientY - touchStartY;
//             panel.style.transition =
//                 "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";

//             if (dragDistance > 140) {
//                 closeExerciseDetails();
//             } else {
//                 panel.style.transform = "translateY(0)";
//             }
//         },
//         { passive: true },
//     );
// }

// MODIFIED: Instagram-style sheet — drag only from handle OR when content is at top
function ensureOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement("div");
    overlayEl.id = "exd-overlay";
    overlayEl.innerHTML = `
        <div id="exd-panel">
            <div id="exd-drag-handle-zone">
                <div id="exd-drag-handle-pill"></div>
            </div>
            <div id="exd-panel-body"></div>
        </div>`;
    document.body.appendChild(overlayEl);

    const panel = overlayEl.querySelector("#exd-panel");
    const handleZone = overlayEl.querySelector("#exd-drag-handle-zone");
    const panelBody = overlayEl.querySelector("#exd-panel-body");

    // GPU layer
    panel.style.willChange = "transform";

    // ── Backdrop tap ─────────────────────────────────────────────────────
    overlayEl.addEventListener("click", (e) => {
        if (e.target === overlayEl) closeExerciseDetails();
    });

    // ── Back button ──────────────────────────────────────────────────────
    overlayEl.addEventListener("click", (e) => {
        if (e.target.closest("#btn-back-exercise-details"))
            closeExerciseDetails();
    });

    // ── Drag state ───────────────────────────────────────────────────────
    let touchStartY = 0;
    let isDragging = false; // we own this gesture
    let dragSource = null; // 'handle' | 'body'
    let rafId = null;
    let latestDelta = 0;

    // Helper — is the scrollable body at the very top?
    const bodyAtTop = () => panelBody.scrollTop <= 0;

    // ── TOUCHSTART ───────────────────────────────────────────────────────
    // Capture on both handle zone and panel body separately

    // Handle zone: ALWAYS take control
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

    // Panel body: only commit after we know direction
    panelBody.addEventListener(
        "touchstart",
        (e) => {
            touchStartY = e.touches[0].clientY;
            dragSource = "body";
            isDragging = false; // not decided yet
        },
        { passive: true },
    );

    // ── TOUCHMOVE ────────────────────────────────────────────────────────
    // Must be non-passive so we can preventDefault when we own the gesture
    overlayEl.addEventListener(
        "touchmove",
        (e) => {
            const deltaY = e.touches[0].clientY - touchStartY;

            if (dragSource === "handle") {
                // Handle zone: own the gesture unconditionally
                isDragging = true;
            } else if (dragSource === "body" && !isDragging) {
                // Body: only take control if pulling DOWN and already at top
                if (deltaY > 6 && bodyAtTop()) {
                    isDragging = true;
                    panel.style.transition = "none";
                } else {
                    return; // let native scroll work
                }
            }

            if (!isDragging) return;
            e.preventDefault(); // block scroll while we own the gesture

            if (deltaY < 0) {
                latestDelta = deltaY * 0.08; // barely moves upward — hard ceiling
            } else {
                latestDelta = deltaY * 0.55; // natural downward drag with weight
            }

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                panel.style.transform = `translateY(${latestDelta}px)`;
            });
        },
        { passive: false },
    );

    // ── TOUCHEND ─────────────────────────────────────────────────────────
    overlayEl.addEventListener(
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

            const totalDrag = e.changedTouches[0].clientY - touchStartY;
            panel.style.transition =
                "transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)";

            if (totalDrag > 130) {
                closeExerciseDetails();
            } else {
                panel.style.transform = "translateY(0)"; // snap back
            }
        },
        { passive: true },
    );
}

// MODIFIED: Smooth slide-out before backdrop fade
function closeExerciseDetails() {
    const panel = overlayEl?.querySelector("#exd-panel");
    if (panel) {
        panel.style.transition =
            "transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
        panel.style.transform = "translateY(100%)";
    }
    setTimeout(() => {
        overlayEl?.classList.remove("exd-overlay--open");
        document.body.classList.remove("exd-body-lock");
        if (panel) panel.style.transform = ""; // reset for next open
    }, 320);
}

function openExerciseDetails(ex) {
    ensureOverlay();
    const body = document.getElementById("exd-panel-body");
    body.innerHTML = buildShell(ex);

    // Activate overlay
    overlayEl.classList.add("exd-overlay--open");
    document.body.classList.add("exd-body-lock");

    loadAnalytics(ex);
}

// MODIFIED: Animate panel out before removing overlay visibility
// function closeExerciseDetails() {
//     const panel = overlayEl?.querySelector("#exd-panel");
//     if (panel) {
//         panel.style.transition =
//             "transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)";
//         panel.style.transform = "translateY(100%)";
//     }
//     // Wait for animation to finish before fading backdrop
//     setTimeout(() => {
//         overlayEl?.classList.remove("exd-overlay--open");
//         document.body.classList.remove("exd-body-lock");
//         if (panel) panel.style.transform = ""; // Reset for next open
//     }, 300);
// }

// ── Entry points ─────────────────────────────────────────────────────────────
document.addEventListener("metricfitOpenExercise", (e) =>
    openExerciseDetails(e.detail),
);

// ── Shell HTML ────────────────────────────────────────────────────────────────
function buildShell(ex) {
    const img0 = ex.images?.[0] ? `${IMG_BASE}${ex.images[0]}` : null;
    const img1 = ex.images?.[1] ? `${IMG_BASE}${ex.images[1]}` : img0;

    const animBlock = img0
        ? `
        <div class="exd-anim-container">
            <img class="exd-frame exd-frame-0" src="${img0}" alt="${ex.name} frame 1"
                onerror="this.style.opacity='0'">
            <img class="exd-frame exd-frame-1" src="${img1}" alt="${ex.name} frame 2"
                onerror="this.style.opacity='0'">
            <div class="exd-anim-shimmer"></div>
        </div>
    `
        : `
        <div class="exd-anim-container exd-no-image">
            <i class="fas fa-dumbbell"></i>
        </div>
    `;

    return `
    <div class="exd-page">

        <!-- Header -->
        <div class="exd-header">
            <button class="mf-btn-icon" id="btn-back-exercise-details">
                <i class="fas fa-arrow-left"></i>
            </button>
            <span class="mf-badge primary text-xs">${(ex.category || "strength").toUpperCase()}</span>
        </div>

        <!-- Name -->
        <h1 class="exd-title">${ex.name}</h1>

        <!-- Animated Image -->
        ${animBlock}

        <!-- Metadata chips -->
        <div class="exd-chips">
            <div class="exd-chip">
                <i class="fas fa-bullseye"></i>
                <span>${(ex.muscle || "general").toUpperCase()}</span>
            </div>
            <div class="exd-chip">
                <i class="fas fa-toolbox"></i>
                <span>${ex.equipment || "none"}</span>
            </div>
            <div class="exd-chip">
                <i class="fas fa-signal"></i>
                <span>${ex.level || "beginner"}</span>
            </div>
        </div>

        <!-- Analytics -->
        <div class="exd-section">
            <h4 class="exd-section-title">
                <i class="fas fa-chart-line"></i> Performance History
            </h4>
            <div id="exd-analytics" class="exd-analytics-wrap">
                <div class="exd-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading history...
                </div>
            </div>
        </div>

    </div>`;
}

// ── Analytics fetch & render ──────────────────────────────────────────────────
async function loadAnalytics(ex) {
    const wrap = document.getElementById("exd-analytics");
    if (!wrap) return;

    const user = auth.currentUser;
    if (!user) {
        wrap.innerHTML = emptyState("Sign in to view history.");
        return;
    }

    try {
        const q = query(
            collection(db, "workouts_log"),
            where("uid", "==", user.uid),
        );
        const snap = await getDocs(q);

        // NEW CONTENT HERE: Sort descending by createdAt client-side
        const docs = [];
        snap.forEach((d) => docs.push(d));
        docs.sort(
            (a, b) =>
                (b.data().createdAt?.toMillis() || 0) -
                (a.data().createdAt?.toMillis() || 0),
        );
        // Extract sessions that contain this exercise
        const sessions = [];
        docs.forEach((docSnap) => {
            const data = docSnap.data();
            const exData = data.exercises_data?.find(
                (e) => e.exercise_id === ex.id,
            );
            if (!exData) return;

            const date = data.metadata?.start_time?.toDate?.() || new Date();
            const completedSets =
                exData.sets?.filter((s) => s.weight !== undefined) || [];
            if (completedSets.length === 0) return;

            const maxVolume = Math.max(
                ...completedSets.map((s) => s.volume || 0),
            );
            const maxWeight = Math.max(
                ...completedSets.map((s) => s.weight || 0),
            );
            const totalReps = completedSets.reduce(
                (a, s) => a + (s.reps || 0),
                0,
            );

            sessions.push({
                date,
                sets: completedSets,
                maxVolume,
                maxWeight,
                totalReps,
            });
        });

        if (sessions.length === 0) {
            wrap.innerHTML = emptyState();
            return;
        }

        wrap.innerHTML = buildAnalytics(sessions);
    } catch (err) {
        console.error("ExerciseDetails: analytics fetch failed", err);
        wrap.innerHTML = emptyState("Could not load history.");
    }
}

function emptyState(msg = "No data yet — start your first set.") {
    return `
    <div class="exd-empty">
        <i class="fas fa-chart-simple"></i>
        <p>${msg}</p>
    </div>`;
}

function buildAnalytics(sessions) {
    // Most recent first → chart left-to-right = oldest first
    const chronological = [...sessions].reverse().slice(-8);

    const maxW = Math.max(...chronological.map((s) => s.maxWeight));
    const maxV = Math.max(...chronological.map((s) => s.maxVolume));

    const weightBars = chronological
        .map((s, i) => {
            const pct = maxW > 0 ? (s.maxWeight / maxW) * 100 : 0;
            const label = formatDate(s.date);
            return `
        <div class="exd-bar-col">
            <span class="exd-bar-val">${s.maxWeight}kg</span>
            <div class="exd-bar-track">
                <div class="exd-bar-fill" style="height:${pct}%;animation-delay:${i * 60}ms"></div>
            </div>
            <span class="exd-bar-label">${label}</span>
        </div>`;
        })
        .join("");

    const repBars = chronological
        .map((s, i) => {
            const pct =
                maxV > 0
                    ? (s.totalReps /
                          Math.max(...chronological.map((x) => x.totalReps))) *
                      100
                    : 0;
            return `
        <div class="exd-bar-col">
            <span class="exd-bar-val">${s.totalReps}</span>
            <div class="exd-bar-track">
                <div class="exd-bar-fill exd-bar-fill--reps" style="height:${pct}%;animation-delay:${i * 60}ms"></div>
            </div>
            <span class="exd-bar-label">${formatDate(s.date)}</span>
        </div>`;
        })
        .join("");

    // Last session sets table
    const last = sessions[0];
    const setRows = last.sets
        .map(
            (s, i) => `
        <div class="exd-set-row">
            <span class="exd-set-num">${i + 1}</span>
            <span>${s.weight} <small>kg</small></span>
            <span>${s.reps} <small>reps</small></span>
            <span class="exd-vol">${s.volume || s.weight * s.reps} <small>vol</small></span>
            ${s.is_pr ? '<span class="mf-badge success" style="font-size:0.6rem;">PR</span>' : "<span></span>"}
        </div>
    `,
        )
        .join("");

    return `
    <!-- Stat Pills -->
    <div class="exd-stat-pills">
        <div class="exd-stat-pill">
            <span class="exd-stat-val">${sessions.length}</span>
            <span class="exd-stat-lbl">Sessions</span>
        </div>
        <div class="exd-stat-pill exd-stat-pill--primary">
            <span class="exd-stat-val">${Math.max(...sessions.map((s) => s.maxWeight))}kg</span>
            <span class="exd-stat-lbl">Best Weight</span>
        </div>
        <div class="exd-stat-pill">
            <span class="exd-stat-val">${Math.max(...sessions.map((s) => s.maxVolume))}</span>
            <span class="exd-stat-lbl">Best Volume</span>
        </div>
    </div>

    <!-- Weight Chart -->
    <p class="exd-chart-label">Max Weight per Session</p>
    <div class="exd-bar-chart">${weightBars}</div>

    <!-- Reps Chart -->
    <p class="exd-chart-label" style="margin-top:var(--space-md)">Total Reps per Session</p>
    <div class="exd-bar-chart">${repBars}</div>

    <!-- Last Session Breakdown -->
    <p class="exd-chart-label" style="margin-top:var(--space-md)">
        Last Session — ${formatDate(last.date, true)}
    </p>
    <div class="exd-set-header">
        <span>#</span><span>Weight</span><span>Reps</span><span>Volume</span><span></span>
    </div>
    ${setRows}
    `;
}

function formatDate(date, long = false) {
    if (!date) return "—";
    if (long)
        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
