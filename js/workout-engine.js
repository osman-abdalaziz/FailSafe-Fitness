/**
 * workout-engine.js
 * Advanced Active Session Protocol: Ghost Fill, PR Engine, and Rest Timers.
 */

import { auth, db } from "./firebase-config.js";
import {
    doc,
    getDoc,
    collection,
    addDoc,
    setDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
// NEW CONTENT HERE: Heatmap integration
// MODIFIED: Updated imports — refreshHeatmap replaces updateHeatmapSet, add setHeatmapExercises
import {
    resetHeatmap,
    refreshHeatmap,
    setHeatmapExercises,
    initHeatmap,
} from "./muscle-heatmap.js";
document.addEventListener("DOMContentLoaded", () => {
    initWorkoutEngine();

    initHeatmap(); // NEW CONTENT HERE: boot heatmap
});

// Global Session State
let sessionTimerInterval = null;
let sessionSeconds = 0;
let currentRoutineId = null;
let currentRoutineName = null;
let sessionStartTime = null;
let currentExercises = [];
let historicalStates = {}; // Holds the user_exercise_state for active exercises

// Rest Timer State
let restInterval = null;

// ==========================================
// NEW CONTENT HERE: Session Persistence Logic
// ==========================================

window.saveActiveSessionLocal = () => {
    if (!currentRoutineId) return; // Prevent saving empty states
    const setsState = [];

    currentExercises.forEach((ex, index) => {
        const container = document.getElementById(`sets-container-${index}`);
        if (!container) return;
        const rows = container.querySelectorAll("tr");
        const exerciseSets = [];

        rows.forEach((row) => {
            const weight = row.querySelector(".weight-input").value;
            const reps = row.querySelector(".reps-input").value;
            const checked = row.querySelector(".set-checkbox").checked;
            exerciseSets.push({ weight, reps, checked });
        });
        setsState.push(exerciseSets);
    });

    const sessionData = {
        currentRoutineId,
        currentRoutineName,
        sessionStartTime: sessionStartTime.toISOString(),
        currentExercises,
        historicalStates,
        setsState,
    };
    localStorage.setItem(
        "metricfit_active_session",
        JSON.stringify(sessionData),
    );
};

// MODIFIED: Registers exercises with heatmap BEFORE rendering so DOM-scan works correctly
function restoreActiveSession(data) {
    currentRoutineId = data.currentRoutineId;
    currentRoutineName = data.currentRoutineName;
    sessionStartTime = new Date(data.sessionStartTime);
    currentExercises = data.currentExercises;
    historicalStates = data.historicalStates;

    // NEW: Register exercises so heatmap can map DOM rows → muscles
    setHeatmapExercises(currentExercises);

    const workoutHome = document.getElementById("workout-home");
    const activeWorkoutView = document.getElementById("active-workout");

    workoutHome.classList.add("app-shell-hidden");
    activeWorkoutView.classList.remove("app-shell-hidden");
    document
        .getElementById("session-sub-nav")
        ?.classList.remove("app-shell-hidden");
    document
        .getElementById("hm-subnav-wrap")
        ?.classList.remove("app-shell-hidden");
    startSessionTimer();

    // ISSUE 1: Render DOM first, then immediately recalculate heatmap from restored checked rows
    renderActiveExercises(currentExercises, data.setsState);

    // Small delay ensures DOM is fully painted before scanning
    setTimeout(() => {
        updateSessionHeaderStats();
        refreshHeatmap();
    }, 50);
}

function initWorkoutEngine() {
    const workoutHome = document.getElementById("workout-home");
    const activeWorkoutView = document.getElementById("active-workout");
    const btnDiscard = document.getElementById("btn-discard-workout");
    const btnFinish = document.getElementById("btn-finish-workout");
    const sessionSubNav = document.getElementById("session-sub-nav");
    // const routineNameDisplay = document.getElementById("active-routine-name");

    // MODIFIED: Auto-save on any input change in the workout view
    const activeContainer = document.getElementById(
        "active-exercises-container",
    );
    if (activeContainer) {
        activeContainer.addEventListener(
            "input",
            window.saveActiveSessionLocal,
        );
    }

    // MODIFIED: Check for existing session on page load
    const savedSession = localStorage.getItem("metricfit_active_session");
    if (savedSession) {
        try {
            restoreActiveSession(JSON.parse(savedSession));
        } catch (e) {
            console.error("Corrupted session data", e);
            localStorage.removeItem("metricfit_active_session");
        }
    }

    // Initiate Session
    document.addEventListener("metricfitStartWorkout", async (e) => {
        const { routineId, routineName } = e.detail;
        const user = auth.currentUser;
        if (!user) return alert("System Error: Unauthenticated.");
        currentRoutineId = routineId;
        currentRoutineName = routineName;
        sessionStartTime = new Date();
        historicalStates = {};
        // MODIFIED: Register exercises for heatmap before render
        setHeatmapExercises([]); // clear first
        resetHeatmap();
        // MODIFIED: Clear any old junk before starting a new session
        localStorage.removeItem("metricfit_active_session");

        workoutHome.classList.add("app-shell-hidden");
        activeWorkoutView.classList.remove("app-shell-hidden");
        // NEW: Show sub-nav on new workout
        document
            .getElementById("session-sub-nav")
            ?.classList.remove("app-shell-hidden");
        document
            .getElementById("hm-subnav-wrap")
            ?.classList.remove("app-shell-hidden");
        // routineNameDisplay.innerText = routineName;
        startSessionTimer();

        document.getElementById("active-exercises-container").innerHTML =
            `<p class="text-muted text-center py-md">Fetching mechanical history... <i class="fas fa-spinner fa-spin"></i></p>`;

        try {
            // 1. Get Routine Data
            const routineRef = doc(db, "routines", routineId);
            const routineSnap = await getDoc(routineRef);

            if (!routineSnap.exists())
                return alert("Clinical Error: Routine missing.");
            currentExercises = routineSnap.data().exercises;

            // 2. Fetch Performance Layer (Ghost Fill Data)
            for (const ex of currentExercises) {
                const stateRef = doc(
                    db,
                    "user_exercise_state",
                    `${user.uid}_${ex.id}`,
                );
                const stateSnap = await getDoc(stateRef);
                historicalStates[ex.id] = stateSnap.exists()
                    ? stateSnap.data()
                    : { last_used_weight: "", last_reps: "", best_volume: 0 };
            }

            // 3. Render UI with actual data
            renderActiveExercises(currentExercises);
            // NEW: Register exercises after they are loaded from Firestore
            setHeatmapExercises(currentExercises);
            window.saveActiveSessionLocal(); // Initial Save
        } catch (error) {
            console.error("Engine Error:", error);
            alert("Database Error: Failed to load mechanics.");
        }
    });

    if (btnDiscard) {
        btnDiscard.addEventListener("click", () => {
            if (
                confirm(
                    "Clinical Warning: Discard session? No data will be logged.",
                )
            ) {
                stopSessionTimer();
                stopRestTimer();
                activeWorkoutView.classList.add("app-shell-hidden");
                workoutHome.classList.remove("app-shell-hidden");
                // NEW: Hide sub-nav on discard
                document
                    .getElementById("session-sub-nav")
                    ?.classList.add("app-shell-hidden");
                document
                    .getElementById("hm-subnav-wrap")
                    ?.classList.add("app-shell-hidden");
                // MODIFIED: Clear memory
                localStorage.removeItem("metricfit_active_session");
            }
        });
    }

    if (btnFinish) {
        btnFinish.addEventListener("click", async () => {
            await compileAndSaveSession(
                btnFinish,
                activeWorkoutView,
                workoutHome,
            );
            // MODIFIED: Clear memory
            localStorage.removeItem("metricfit_active_session");
        });
    }

    // Rest Timer Skip Logic
    document
        .getElementById("btn-skip-rest")
        ?.addEventListener("click", stopRestTimer);
}

// MODIFIED: Accept restored sets array
function renderActiveExercises(exercises, restoredSetsState = null) {
    const container = document.getElementById("active-exercises-container");
    container.innerHTML = "";

    exercises.forEach((ex, index) => {
        // ... (Keep the exact same Card HTML structure you currently have) ...
        const card = document.createElement("div");
        card.className = "mf-card mb-md p-sm border-primary";
        card.innerHTML = `
            <div class="flex justify-between align-center border-b pb-sm mb-sm">
                <div>
                    <h3 onclick="openExerciseDetailsFromWorkout('${ex.id}')" class="text-primary mb-0" style="cursor: pointer; font-size: 1.1rem;">${ex.name} <i class="fas fa-circle-info fa-fw"></i></h3>
                    ${historicalStates[ex.id]?.best_volume > 0 ? `<span class="text-xs success mf-badge">PR: ${historicalStates[ex.id].best_volume} kg</span>` : ""}
                </div>
                    <button class="mf-btn-icon mf-btn-sm text-muted" title="Exercise Options"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            <table class="w-100 text-center text-sm" style="border-collapse: collapse;">
                <thead>
                    <tr class="text-muted font-bold" style="border-color: rgba(255,255,255,0.05);">
                        <th style="padding-bottom: 8px; width: 15%;">Set</th>
                        <th style="padding-bottom: 8px; width: 35%;">kg</th>
                        <th style="padding-bottom: 8px; width: 35%;">Reps</th>
                        <th style="padding-bottom: 8px; width: 15%;"><i class="fas fa-check"></i></th>
                    </tr>
                </thead>
                <tbody class="sets-container" id="sets-container-${index}"></tbody>
            </table>
            <button class="mf-btn-text w-100 mt-sm" onclick="addSetRow(${index}, '${ex.id}', ${ex.restTimer || 90})">+ Add Set</button>
        `;
        container.appendChild(card);

        // MODIFIED: Render restored sets OR just 1 default set
        if (
            restoredSetsState &&
            restoredSetsState[index] &&
            restoredSetsState[index].length > 0
        ) {
            restoredSetsState[index].forEach((savedSet) => {
                addSetRow(index, ex.id, ex.restTimer || 90, savedSet);
            });
        } else {
            addSetRow(index, ex.id, ex.restTimer || 90);
        }
    });
}

// MODIFIED: Accept restoredSet object and inject its values
window.addSetRow = (
    exerciseIndex,
    exerciseId,
    restTimeSeconds,
    restoredSet = null,
) => {
    const container = document.getElementById(
        `sets-container-${exerciseIndex}`,
    );
    const setNumber = container.children.length + 1;

    const row = document.createElement("tr");
    row.className = "tabular-nums";
    row.style.borderColor = "rgba(255,255,255,0.03)";

    const ghostWeight = historicalStates[exerciseId]?.last_used_weight || "";
    const ghostReps = historicalStates[exerciseId]?.last_reps || "";

    // Extract saved values if any
    let valW = restoredSet ? restoredSet.weight : "";
    let valR = restoredSet ? restoredSet.reps : "";
    let isChecked = restoredSet ? restoredSet.checked : false;

    // Determine if Ghost Class should exist
    const hasGhostW = !valW && ghostWeight ? "ghost-fill" : "";
    const hasGhostR = !valR && ghostReps ? "ghost-fill" : "";

    row.innerHTML = `
        <td class="text-muted font-bold text-center" style="vertical-align: middle;">${setNumber}</td>
        <td style="padding: 6px 4px;">
            <div class="mf-num-central mx-auto w-100">
                <button class="mf-num-btn-hz" data-action="decrement"><i class="fas fa-minus"></i></button>
                <input type="number" class="mf-input tabular-nums font-bold px-0 text-center weight-input ${hasGhostW}" placeholder="${ghostWeight || "0"}" step="2.5" min="0" value="${valW}">
                <button class="mf-num-btn-hz" data-action="increment"><i class="fas fa-plus"></i></button>
            </div>
        </td>
        <td style="padding: 6px 4px;">
            <div class="mf-num-central mx-auto w-100">
                <button class="mf-num-btn-hz" data-action="decrement"><i class="fas fa-minus"></i></button>
                <input type="number" class="mf-input tabular-nums font-bold px-0 text-center reps-input ${hasGhostR}" placeholder="${ghostReps || "0"}" step="1" min="0" value="${valR}">
                <button class="mf-num-btn-hz" data-action="increment"><i class="fas fa-plus"></i></button>
            </div>
        </td>
        <td style="vertical-align: middle;">
            <div class="flex justify-center">
                <input type="checkbox" class="mf-checkbox set-checkbox" ${isChecked ? "checked" : ""}>
            </div>
        </td>
    `;

    const checkbox = row.querySelector(".set-checkbox");
    const weightInput = row.querySelector(".weight-input");
    const repsInput = row.querySelector(".reps-input");

    // Re-lock UI if it was previously checked
    if (isChecked) {
        row.style.opacity = "0.6";
        weightInput.disabled = true;
        repsInput.disabled = true;
        weightInput.classList.remove("ghost-fill");
        repsInput.classList.remove("ghost-fill");
    }

    // MODIFIED: Both check and uncheck call refreshHeatmap — DOM-derived state handles both correctly
    checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            if (!weightInput.value && weightInput.placeholder !== "0")
                weightInput.value = weightInput.placeholder;
            if (!repsInput.value && repsInput.placeholder !== "0")
                repsInput.value = repsInput.placeholder;

            row.style.opacity = "0.6";
            weightInput.disabled = true;
            repsInput.disabled = true;
            weightInput.classList.remove("ghost-fill");
            repsInput.classList.remove("ghost-fill");
            startRestTimer(restTimeSeconds);
        } else {
            // ISSUE 2: Uncheck — re-enable inputs
            row.style.opacity = "1";
            weightInput.disabled = false;
            repsInput.disabled = false;
            if (
                weightInput.value === weightInput.placeholder &&
                weightInput.placeholder !== "0"
            )
                weightInput.classList.add("ghost-fill");
            if (
                repsInput.value === repsInput.placeholder &&
                repsInput.placeholder !== "0"
            )
                repsInput.classList.add("ghost-fill");
        }

        // ISSUE 1 + 2: Single call handles both check and uncheck — derives fresh state from DOM
        refreshHeatmap();
        updateSessionHeaderStats();
        window.saveActiveSessionLocal();
    });

    container.appendChild(row);
    if (window.initCustomNumberInputs) window.initCustomNumberInputs();

    // Save only if it's a manual add, not during a bulk restore loop
    if (!restoredSet) window.saveActiveSessionLocal();
};

async function compileAndSaveSession(btnFinish, activeView, homeView) {
    const user = auth.currentUser;
    if (!user) return alert("System Error: No session.");
    // Hide Sub-Nav when workout ends.
    const sessionSubNav = document.getElementById("session-sub-nav");

    if (sessionSubNav) sessionSubNav.classList.add("app-shell-hidden");
    document
        .getElementById("hm-subnav-wrap")
        ?.classList.add("app-shell-hidden");
    const workoutLog = {
        uid: user.uid,
        metadata: {
            routine_id: currentRoutineId,
            routine_name: currentRoutineName,
            start_time: sessionStartTime,
            end_time: new Date(),
            duration_seconds: sessionSeconds,
            status: "completed",
        },
        exercises_data: [],
        createdAt: serverTimestamp(),
    };

    let totalSessionVolume = 0;

    // MODIFIED CONTENT: Bulletproof compilation logic targeting <tr> directly
    currentExercises.forEach((ex, index) => {
        const container = document.getElementById(`sets-container-${index}`);
        if (!container) return; // Safety check

        // Select 'tr' directly to completely avoid class name bugs
        const rows = container.querySelectorAll("tr");
        const validSets = [];
        let exerciseVolume = 0;
        let currentBestVolume = historicalStates[ex.id]?.best_volume || 0;

        rows.forEach((row, setIdx) => {
            const checkbox = row.querySelector(".set-checkbox");
            const weightInput = row.querySelector(".weight-input");
            const repsInput = row.querySelector(".reps-input");

            if (!checkbox || !weightInput || !repsInput) return; // Ignore malformed rows

            const isChecked = checkbox.checked;
            let weightVal = weightInput.value;
            let repsVal = repsInput.value;

            // Strict Ghost Auto-Fill at compile time
            if (isChecked) {
                if (!weightVal || weightVal === "")
                    weightVal = weightInput.placeholder;
                if (!repsVal || repsVal === "") repsVal = repsInput.placeholder;
            }

            const weight = parseFloat(weightVal) || 0;
            const reps = parseInt(repsVal) || 0;

            // A set is valid if explicitly checked OR if user typed numbers but forgot to check
            const isValid = isChecked || (weight > 0 && reps > 0);

            if (isValid) {
                const volume = weight * reps;
                const isPR = volume > currentBestVolume;
                if (isPR) currentBestVolume = volume;

                exerciseVolume += volume;
                totalSessionVolume += volume;

                validSets.push({
                    set_index: setIdx + 1,
                    set_type: "Normal",
                    weight: weight,
                    reps: reps,
                    volume: volume,
                    is_pr: isPR,
                });
            }
        });

        if (validSets.length > 0) {
            workoutLog.exercises_data.push({
                exercise_id: ex.id,
                exercise_name: ex.name,
                muscle: ex.muscle,
                total_volume: exerciseVolume,
                sets: validSets,
                new_best_volume: currentBestVolume,
            });
        }
    });

    if (workoutLog.exercises_data.length === 0) {
        document
            .getElementById("session-sub-nav")
            ?.classList.remove("app-shell-hidden");
        document
            .getElementById("hm-subnav-wrap")
            ?.classList.remove("app-shell-hidden");
        return alert("Clinical Warning: Log at least one set.");
    }

    btnFinish.disabled = true;
    btnFinish.innerHTML = `Saving... <i class="fas fa-spinner fa-spin fa-fw"></i>`;

    try {
        await addDoc(collection(db, "workouts_log"), workoutLog);

        // Update user_exercise_state (The Performance Layer)
        for (const exData of workoutLog.exercises_data) {
            const lastSet = exData.sets[exData.sets.length - 1];
            const stateRef = doc(
                db,
                "user_exercise_state",
                `${user.uid}_${exData.exercise_id}`,
            );

            await setDoc(
                stateRef,
                {
                    last_used_weight: lastSet.weight,
                    last_reps: lastSet.reps,
                    best_volume: exData.new_best_volume,
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            );
        }

        stopSessionTimer();
        stopRestTimer();
        activeView.classList.add("app-shell-hidden");
        homeView.classList.remove("app-shell-hidden");

        // NEW: Hide sub-nav when finished
        document
            .getElementById("session-sub-nav")
            ?.classList.add("app-shell-hidden");
        document
            .getElementById("hm-subnav-wrap")
            ?.classList.add("app-shell-hidden");

        btnFinish.disabled = false;
        btnFinish.innerHTML = `Finish <i class="fas fa-check fa-fw"></i>`;

        alert(
            `System: Session Logged. Total Volume: ${totalSessionVolume} kg.`,
        );
    } catch (error) {
        console.error("Save Error:", error);
        alert("Database Error: Could not log session.");
        btnFinish.disabled = false;
        btnFinish.innerHTML = `Finish <i class="fas fa-check fa-fw"></i>`;
    }
}

// --- Timers Logic ---

// MODIFIED: Accurate global timer that handles background/closed states seamlessly
function startSessionTimer() {
    // const timerDisplay = document.getElementById("global-timer");
    if (!sessionStartTime) sessionStartTime = new Date(); // Fallback

    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
        const now = new Date();
        sessionSeconds = Math.floor((now - sessionStartTime) / 1000); // Exact delta

        const hrs = Math.floor(sessionSeconds / 3600);
        const mins = Math.floor((sessionSeconds % 3600) / 60);
        const secs = sessionSeconds % 60;
        // timerDisplay.innerText = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        const timeStr = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

        // if (timerDisplay) timerDisplay.innerText = timeStr;
        // MODIFIED: Sync duration with the new header
        const headerTimer = document.getElementById("header-duration");
        if (headerTimer) headerTimer.innerText = timeStr;
        // Backup save every 5 seconds
        if (sessionSeconds % 5 === 0 && currentRoutineId) {
            window.saveActiveSessionLocal();
        }
    }, 1000);
}

function stopSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    // document.getElementById("global-timer").innerText = "00:00:00";
}

function startRestTimer(seconds) {
    const overlay = document.getElementById("rest-timer-overlay");
    const display = document.getElementById("rest-timer-display");
    const progressFill = document.getElementById("rest-progress-fill"); // NEW
    if (!overlay || !display) return;

    stopRestTimer(); // Clear existing
    overlay.classList.remove("app-shell-hidden");

    let timeLeft = seconds;
    const totalSeconds = seconds;

    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.innerText = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

        // Animate the Progress Bar
        if (progressFill) {
            const pct = (timeLeft / totalSeconds) * 100;
            progressFill.style.width = `${pct}%`;
        }
    };
    updateDisplay();

    restInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            stopRestTimer();
            // Vibrate device if supported to alert user
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    }, 1000);
}

function stopRestTimer() {
    if (restInterval) clearInterval(restInterval);
    document
        .getElementById("rest-timer-overlay")
        ?.classList.add("app-shell-hidden");
}

// MODIFIED: Real-time Volumetric Calculation Engine
function updateSessionHeaderStats() {
    let totalVolume = 0;
    let completedSets = 0;

    // مسح كافة الصفوف النشطة في الـ DOM الحالي
    const rows = document.querySelectorAll(
        "#active-exercises-container tr, #active-exercises-container .set-row",
    );

    rows.forEach((row) => {
        const checkbox = row.querySelector(".set-checkbox");
        if (checkbox && checkbox.checked) {
            const weightInput = row.querySelector(".weight-input");
            const repsInput = row.querySelector(".reps-input");

            // الأولوية للقيمة المدخلة، ثم الـ Ghost Placeholder، ثم الصفر
            const w =
                parseFloat(weightInput.value) ||
                parseFloat(weightInput.placeholder) ||
                0;
            const r =
                parseInt(repsInput.value) ||
                parseInt(repsInput.placeholder) ||
                0;

            totalVolume += w * r;
            completedSets++;
        }
    });

    // تحديث واجهة المستخدم
    const volEl = document.getElementById("header-volume");
    const setsEl = document.getElementById("header-sets");
    if (volEl) volEl.innerText = `${totalVolume.toLocaleString()} kg`;
    if (setsEl) setsEl.innerText = completedSets;
}

// NEW CONTENT HERE: Bridge — opens details overlay from active workout without touching session state
window.openExerciseDetailsFromWorkout = (exerciseId) => {
    // Find exercise from current session
    const ex = currentExercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    document.dispatchEvent(
        new CustomEvent("metricfitOpenExercise", { detail: ex }),
    );
};

document.getElementById("btn-go-to-profile")?.addEventListener("click", () => {
    // محاكاة الضغط على أيتم البروفايل في الناف بار السفلي
    document.querySelector('[data-target="view-profile"]').click();
});
