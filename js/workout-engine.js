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

document.addEventListener("DOMContentLoaded", () => {
    initWorkoutEngine();
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

function initWorkoutEngine() {
    const workoutHome = document.getElementById("workout-home");
    const activeWorkoutView = document.getElementById("active-workout");
    const btnDiscard = document.getElementById("btn-discard-workout");
    const btnFinish = document.getElementById("btn-finish-workout");
    const routineNameDisplay = document.getElementById("active-routine-name");

    // Initiate Session
    document.addEventListener("metricfitStartWorkout", async (e) => {
        const { routineId, routineName } = e.detail;
        const user = auth.currentUser;
        if (!user) return alert("System Error: Unauthenticated.");

        currentRoutineId = routineId;
        currentRoutineName = routineName;
        sessionStartTime = new Date();
        historicalStates = {};

        workoutHome.classList.add("app-shell-hidden");
        activeWorkoutView.classList.remove("app-shell-hidden");
        routineNameDisplay.innerText = routineName;
        startSessionTimer();

        document.getElementById("active-exercises-container").innerHTML =
            `<p class="text-muted text-center py-md"><i class="fas fa-spinner fa-spin"></i> Fetching mechanical history...</p>`;

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
        });
    }

    // Rest Timer Skip Logic
    document
        .getElementById("btn-skip-rest")
        ?.addEventListener("click", stopRestTimer);
}

function renderActiveExercises(exercises) {
    const container = document.getElementById("active-exercises-container");
    container.innerHTML = "";

    exercises.forEach((ex, index) => {
        const card = document.createElement("div");
        card.className = "mf-card mb-md p-sm border-primary";
        card.innerHTML = `
            <div class="flex justify-between align-center border-b pb-sm mb-sm">
                <div>
                    <h3 class="text-primary mb-0" style="font-size: 1.1rem;">${ex.name}</h3>
                    ${historicalStates[ex.id]?.best_volume > 0 ? `<span class="text-xs text-success">PR: ${historicalStates[ex.id].best_volume} kg</span>` : ""}
                </div>
                <button class="mf-btn-icon mf-btn-sm text-muted" title="Exercise Options"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            
            <div class="grid gap-xs mb-xs text-center text-sm text-muted font-bold" style="grid-template-columns: 0.5fr 3fr 3fr 1fr;">
                <span>Set</span>
                <span>kg</span>
                <span>Reps</span>
                <span><i class="fas fa-check"></i></span>
            </div>
            
            <div class="sets-container grid gap-xs" id="sets-container-${index}"></div>
            
            <button class="mf-btn-text w-100 mt-sm" onclick="addSetRow(${index}, '${ex.id}', ${ex.restTimer || 90})">+ Add Set</button>
        `;
        container.appendChild(card);
        addSetRow(index, ex.id, ex.restTimer || 90);
    });
}

window.addSetRow = (exerciseIndex, exerciseId, restTimeSeconds) => {
    const container = document.getElementById(
        `sets-container-${exerciseIndex}`,
    );
    const setNumber = container.children.length + 1;
    const row = document.createElement("div");
    row.className = "set-row tabular-nums align-center";
    row.style.gridTemplateColumns = "0.5fr 3fr 3fr 1fr";

    // Inject Real Ghost Data
    const ghostWeight = historicalStates[exerciseId]?.last_used_weight || "";
    const ghostReps = historicalStates[exerciseId]?.last_reps || "";

    row.innerHTML = `
        <span class="text-muted font-bold text-center">${setNumber}</span>
        <div class="mf-num-central mx-auto w-100" style="max-width: 120px;">
            <button class="mf-num-btn-hz" data-action="decrement"><i class="fas fa-minus"></i></button>
            <input type="number" class="mf-input tabular-nums font-bold px-0 text-center weight-input ${ghostWeight ? "ghost-fill" : ""}" placeholder="${ghostWeight || "0"}" step="2.5" min="0">
            <button class="mf-num-btn-hz" data-action="increment"><i class="fas fa-plus"></i></button>
        </div>
        <div class="mf-num-central mx-auto w-100" style="max-width: 120px;">
            <button class="mf-num-btn-hz" data-action="decrement"><i class="fas fa-minus"></i></button>
            <input type="number" class="mf-input tabular-nums font-bold px-0 text-center reps-input ${ghostReps ? "ghost-fill" : ""}" placeholder="${ghostReps || "0"}" step="1" min="0">
            <button class="mf-num-btn-hz" data-action="increment"><i class="fas fa-plus"></i></button>
        </div>
        <div class="flex justify-center">
            <input type="checkbox" class="mf-checkbox set-checkbox">
        </div>
    `;

    const checkbox = row.querySelector(".set-checkbox");
    const weightInput = row.querySelector(".weight-input");
    const repsInput = row.querySelector(".reps-input");

    checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
            // Auto-Fill Execution
            if (!weightInput.value && weightInput.placeholder !== "0")
                weightInput.value = weightInput.placeholder;
            if (!repsInput.value && repsInput.placeholder !== "0")
                repsInput.value = repsInput.placeholder;

            row.style.opacity = "0.6";
            weightInput.disabled = true;
            repsInput.disabled = true;
            weightInput.classList.remove("ghost-fill");
            repsInput.classList.remove("ghost-fill");

            // Trigger Rest Timer automatically
            startRestTimer(restTimeSeconds);
        } else {
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
    });

    container.appendChild(row);
    if (window.initCustomNumberInputs) window.initCustomNumberInputs();
};

async function compileAndSaveSession(btnFinish, activeView, homeView) {
    const user = auth.currentUser;
    if (!user) return alert("System Error: No session.");

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

    currentExercises.forEach((ex, index) => {
        const container = document.getElementById(`sets-container-${index}`);
        const rows = container.querySelectorAll(".set-row");
        const validSets = [];
        let exerciseVolume = 0;
        let currentBestVolume = historicalStates[ex.id]?.best_volume || 0;

        rows.forEach((row, setIdx) => {
            if (row.querySelector(".set-checkbox").checked) {
                const weight =
                    parseFloat(row.querySelector(".weight-input").value) || 0;
                const reps =
                    parseInt(row.querySelector(".reps-input").value) || 0;
                const volume = weight * reps;

                // PR Logic Engine
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
                new_best_volume: currentBestVolume, // to update state later
            });
        }
    });

    if (workoutLog.exercises_data.length === 0)
        return alert("Clinical Warning: Log at least one set.");

    btnFinish.disabled = true;
    btnFinish.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

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
        btnFinish.disabled = false;
        btnFinish.innerHTML = `<i class="fas fa-check"></i> Finish`;

        alert(
            `System: Session Logged. Total Volume: ${totalSessionVolume} kg.`,
        );
    } catch (error) {
        console.error("Save Error:", error);
        alert("Database Error: Could not log session.");
        btnFinish.disabled = false;
        btnFinish.innerHTML = `<i class="fas fa-check"></i> Finish`;
    }
}

// --- Timers Logic ---

function startSessionTimer() {
    const timerDisplay = document.getElementById("global-timer");
    sessionSeconds = 0;
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    sessionTimerInterval = setInterval(() => {
        sessionSeconds++;
        const hrs = Math.floor(sessionSeconds / 3600);
        const mins = Math.floor((sessionSeconds % 3600) / 60);
        const secs = sessionSeconds % 60;
        timerDisplay.innerText = `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }, 1000);
}

function stopSessionTimer() {
    if (sessionTimerInterval) clearInterval(sessionTimerInterval);
    document.getElementById("global-timer").innerText = "00:00:00";
}

function startRestTimer(seconds) {
    const overlay = document.getElementById("rest-timer-overlay");
    const display = document.getElementById("rest-timer-display");
    if (!overlay || !display) return;

    stopRestTimer(); // Clear existing
    overlay.classList.remove("app-shell-hidden");

    let timeLeft = seconds;

    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.innerText = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };
    updateDisplay();

    restInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            stopRestTimer();
            // Optional: Play a sound here
        }
    }, 1000);
}

function stopRestTimer() {
    if (restInterval) clearInterval(restInterval);
    document
        .getElementById("rest-timer-overlay")
        ?.classList.add("app-shell-hidden");
}
