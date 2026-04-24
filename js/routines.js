/**
 * routines.js
 * Handles Routine Builder UI, Real Exercise Catalog, and Firestore Integration.
 */

import { auth, db } from "./firebase-config.js";
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
    initRoutineUI();
});

let selectedExercises = [];
let globalExerciseDB = [];

// Listen for Auth State to fetch routines automatically
onAuthStateChanged(auth, (user) => {
    if (user) {
        fetchMyRoutines(user.uid);
    }
});

function initRoutineUI() {
    const workoutHome = document.getElementById("workout-home");
    const routineBuilder = document.getElementById("routine-builder");
    const catalogModal = document.getElementById("exercise-catalog-modal");
    const searchInput = document.getElementById("search-exercise");

    document
        .getElementById("btn-create-routine")
        .addEventListener("click", () => {
            workoutHome.classList.add("app-shell-hidden");
            routineBuilder.classList.remove("app-shell-hidden");
            selectedExercises = [];
            renderBuilderList();
        });

    document
        .getElementById("btn-back-routines")
        .addEventListener("click", () => {
            routineBuilder.classList.add("app-shell-hidden");
            workoutHome.classList.remove("app-shell-hidden");
        });

    document
        .getElementById("btn-open-catalog")
        .addEventListener("click", async () => {
            catalogModal.classList.remove("app-shell-hidden");
            searchInput.value = "";
            await loadRealCatalog();
        });

    document
        .getElementById("btn-close-catalog")
        .addEventListener("click", () => {
            catalogModal.classList.add("app-shell-hidden");
        });

    searchInput.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = globalExerciseDB.filter(
            (ex) =>
                ex.name.toLowerCase().includes(term) ||
                ex.target.toLowerCase().includes(term),
        );
        renderCatalogDOM(filtered);
    });

    document
        .getElementById("btn-save-routine")
        .addEventListener("click", async () => {
            const name = document
                .getElementById("routine-name-input")
                .value.trim();
            if (!name || selectedExercises.length === 0)
                return alert(
                    "Clinical Warning: Routine name and at least one exercise required.",
                );

            const user = auth.currentUser;
            if (!user) return alert("Auth Error: No active session.");

            try {
                await addDoc(collection(db, "routines"), {
                    uid: user.uid,
                    name: name,
                    exercises: selectedExercises,
                    createdAt: serverTimestamp(),
                });

                alert("System: Routine Saved Successfully.");

                document.getElementById("routine-name-input").value = "";
                document.getElementById("btn-back-routines").click();

                // Re-fetch routines to update the list instantly
                fetchMyRoutines(user.uid);
            } catch (error) {
                console.error("Error saving routine:", error);
                alert("Database Error: " + error.message);
            }
        });
}

// Fetch routines from Firestore
async function fetchMyRoutines(uid) {
    const list = document.getElementById("routines-list");
    list.innerHTML = `<p class="text-muted text-center py-md"><i class="fas fa-spinner fa-spin"></i> Loading templates...</p>`;

    try {
        const q = query(collection(db, "routines"), where("uid", "==", uid));
        const querySnapshot = await getDocs(q);

        let routines = [];
        querySnapshot.forEach((doc) =>
            routines.push({ id: doc.id, ...doc.data() }),
        );

        // Sort client-side by creation date (newest first)
        routines.sort(
            (a, b) =>
                (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0),
        );

        list.innerHTML = "";

        if (routines.length === 0) {
            list.innerHTML = `<p class="text-muted text-center py-md" id="empty-routines-msg">No routines found. Build your first template.</p>`;
            return;
        }

        routines.forEach((routine) => {
            const card = document.createElement("div");
            card.className =
                "mf-card border-success p-sm flex justify-between align-center mb-sm";
            card.innerHTML = `
                <div>
                    <h3 style="font-size: 1.1rem;">${routine.name}</h3>
                    <p class="text-xs text-muted">${routine.exercises.length} Exercises Template</p>
                </div>
                <button class="mf-btn mf-btn-primary mf-btn-sm" onclick="dispatchStartWorkout('${routine.id}', '${routine.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-play"></i> Start
                </button>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching routines:", error);
        list.innerHTML = `<p class="text-error text-center py-md">Failed to load routines.</p>`;
    }
}

// Global dispatcher to send routine data to the Workout Engine
window.dispatchStartWorkout = (routineId, routineName) => {
    document.dispatchEvent(
        new CustomEvent("metricfitStartWorkout", {
            detail: { routineId, routineName },
        }),
    );
};

async function loadRealCatalog() {
    const catalogList = document.getElementById("catalog-list");
    const cachedDB = localStorage.getItem("metricfit_exercise_db");

    if (cachedDB) {
        globalExerciseDB = JSON.parse(cachedDB);
        renderCatalogDOM(globalExerciseDB);
        return;
    }

    catalogList.innerHTML = `<p class="text-muted text-center text-sm mt-md"><i class="fas fa-spinner fa-spin"></i> Downloading mechanical database...</p>`;

    try {
        const response = await fetch(
            "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
        );
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        globalExerciseDB = data.map((ex) => ({
            id: ex.id,
            name: ex.name.charAt(0).toUpperCase() + ex.name.slice(1),
            muscle: ex.target,
            target: ex.target,
            equipment: ex.equipment,
            restTimer: 90,
        }));

        localStorage.setItem(
            "metricfit_exercise_db",
            JSON.stringify(globalExerciseDB),
        );
        renderCatalogDOM(globalExerciseDB);
    } catch (error) {
        console.error("API Error:", error);
        catalogList.innerHTML = `<p class="text-error text-center mt-md">Failed to load database. Check connection.</p>`;
    }
}

function renderCatalogDOM(exercises) {
    const catalogList = document.getElementById("catalog-list");
    catalogList.innerHTML = "";
    const displayList = exercises.slice(0, 50);

    displayList.forEach((ex) => {
        const div = document.createElement("div");
        div.className = "exercise-item interactive";
        div.innerHTML = `
            <div>
                <h3 style="font-size: 1rem;">${ex.name}</h3>
                <p class="text-xs text-muted">Target: ${ex.muscle.toUpperCase()} | Eq: ${ex.equipment}</p>
            </div>
            <i class="fas fa-plus text-primary"></i>
        `;
        div.onclick = () => {
            selectedExercises.push(ex);
            renderBuilderList();
            document.getElementById("btn-close-catalog").click();
        };
        catalogList.appendChild(div);
    });

    if (exercises.length === 0) {
        catalogList.innerHTML = `<p class="text-muted text-center mt-md">No exercises found matching criteria.</p>`;
    }
}

function renderBuilderList() {
    const list = document.getElementById("builder-exercise-list");
    list.innerHTML = "";
    selectedExercises.forEach((ex, index) => {
        const card = document.createElement("div");
        card.className = "mf-card border-primary p-sm";
        card.innerHTML = `
            <div class="flex justify-between align-center">
                <h3 style="font-size: 1rem;">${ex.name}</h3>
                <button class="mf-btn-icon text-error" style="width:30px; height:30px;" onclick="removeExercise(${index})"><i class="fas fa-trash text-sm"></i></button>
            </div>
            <p class="text-xs text-muted mt-xs">Muscle: ${ex.muscle} | Equipment: ${ex.equipment}</p>
        `;
        list.appendChild(card);
    });
}

window.removeExercise = (index) => {
    selectedExercises.splice(index, 1);
    renderBuilderList();
};
