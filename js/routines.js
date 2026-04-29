/**
 * routines.js
 * Advanced Routine Manager: Folders, Drag & Drop, Three-Dots Menu, and Builder.
 */
import { auth, db } from "./firebase-config.js";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

let selectedExercises = [];
let globalExerciseDB = [];
let targetFolderId = "default";
let editingRoutineId = null;

// Drag & Drop State
let draggedItem = null;

document.addEventListener("DOMContentLoaded", () => {
    initRoutineUI();

    // Global listener to close dropdowns when clicking outside
    document.addEventListener("click", () => {
        document
            .querySelectorAll(".routine-menu-dropdown.show")
            .forEach((m) => m.classList.remove("show"));
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) fetchMyRoutines(user.uid);
});

function initRoutineUI() {
    const workoutHome = document.getElementById("workout-home");
    const routineBuilder = document.getElementById("routine-builder");
    const catalogModal = document.getElementById("exercise-catalog-modal");
    const searchInput = document.getElementById("search-exercise");

    // Expose global manager for UI buttons
    window.routinesManager = {
        createNewFolder: createNewFolder,
        openBuilderForFolder: openBuilderForFolder,
        toggleFolder: toggleFolder,
        toggleMenu: toggleMenu,
        deleteRoutine: deleteRoutine,
        duplicateRoutine: duplicateRoutine,
        editRoutine: editRoutine,
    };

    document
        .getElementById("btn-back-routines")
        .addEventListener("click", () => {
            routineBuilder.classList.add("app-shell-hidden");
            workoutHome.classList.remove("app-shell-hidden");
            editingRoutineId = null;
            targetFolderId = "default";
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
                ex.muscle.toLowerCase().includes(term) ||
                ex.equipment.toLowerCase().includes(term),
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
                if (editingRoutineId) {
                    // Update existing
                    const ref = doc(db, "routines", editingRoutineId);
                    await updateDoc(ref, {
                        name: name,
                        exercises: selectedExercises,
                        updatedAt: serverTimestamp(),
                    });
                } else {
                    // Create new
                    await addDoc(collection(db, "routines"), {
                        uid: user.uid,
                        name: name,
                        exercises: selectedExercises,
                        folderId: targetFolderId,
                        order: Date.now(), // Default placing at bottom
                        createdAt: serverTimestamp(),
                    });
                }

                document.getElementById("routine-name-input").value = "";
                document.getElementById("btn-back-routines").click();
                fetchMyRoutines(user.uid);
            } catch (error) {
                console.error("Error saving routine:", error);
                alert("Database Error: " + error.message);
            }
        });
}

// ==========================================
// Folders & Routines Fetching Engine
// ==========================================
async function fetchMyRoutines(uid) {
    const container = document.getElementById("folders-container");
    container.innerHTML = `<p class="text-muted text-center py-md"><i class="fas fa-spinner fa-spin"></i> Loading infrastructure...</p>`;

    try {
        // Fetch Custom Folders
        const foldersQ = query(
            collection(db, "routine_folders"),
            where("uid", "==", uid),
        );
        const foldersSnap = await getDocs(foldersQ);
        let folders = [
            { id: "default", name: "My Routines", order: 0, isDefault: true },
        ];
        foldersSnap.forEach((doc) =>
            folders.push({ id: doc.id, ...doc.data() }),
        );
        folders.sort((a, b) => a.order - b.order);

        // Fetch Routines
        const routinesQ = query(
            collection(db, "routines"),
            where("uid", "==", uid),
        );
        const routinesSnap = await getDocs(routinesQ);
        let routines = [];
        routinesSnap.forEach((doc) =>
            routines.push({ id: doc.id, ...doc.data() }),
        );
        routines.sort((a, b) => a.order - b.order);

        renderFoldersAndRoutines(folders, routines);
    } catch (error) {
        console.error("Fetch error:", error);
        container.innerHTML = `<p class="text-error text-center py-md">Architectural failure: Could not load data.</p>`;
    }
}

// ==========================================
// UI Rendering & DOM Injection
// ==========================================
function renderFoldersAndRoutines(folders, routines) {
    const container = document.getElementById("folders-container");
    container.innerHTML = "";

    folders.forEach((folder) => {
        const folderRoutines = routines.filter(
            (r) => (r.folderId || "default") === folder.id,
        );

        const folderEl = document.createElement("div");
        folderEl.className = "routine-folder";
        folderEl.dataset.folderId = folder.id;

        // Restore collapsed state from local storage if exists
        const isCollapsed =
            localStorage.getItem(`mf_folder_${folder.id}`) === "true";
        if (isCollapsed) folderEl.classList.add("collapsed");

        folderEl.innerHTML = `
            <div class="folder-header flex justify-between align-center interactive" onclick="window.routinesManager.toggleFolder('${folder.id}')">
                <div class="flex align-center gap-sm">
                    <i class="fas fa-folder text-primary"></i>
                    <h3 class="mb-0" style="font-size: 1.05rem;">${folder.name}</h3>
                </div>
                <i class="fas fa-chevron-down folder-toggle-icon text-muted"></i>
            </div>
            <div class="folder-content" id="folder-content-${folder.id}">
                <div class="routines-dropzone flex flex-col gap-sm">
                    ${folderRoutines.length === 0 ? `<div class="routine-placeholder text-center p-sm text-xs text-muted">Drop routines here</div>` : ""}
                </div>
                <button class="mf-btn-text w-100 mt-sm" style="font-size: 0.85rem;" onclick="window.routinesManager.openBuilderForFolder('${folder.id}')">
                    <i class="fas fa-plus"></i> Add Routine
                </button>
            </div>
        `;

        const dropzone = folderEl.querySelector(".routines-dropzone");

        folderRoutines.forEach((routine) => {
            const card = document.createElement("div");
            // تمت إزالة class "interactive" لمنع تأثير الضغط/التكبير على كامل البلوك
            card.className = "routine-card glass";
            card.dataset.routineId = routine.id;
            card.draggable = false;

            card.innerHTML = `
                <div class="routine-card-header">
                    <div class="flex align-center gap-sm flex-1" style="min-width:0;">
                        <div class="drag-handle" title="Drag to reorder">
                            <i class="fas fa-grip-vertical"></i>
                        </div>
                        <div class="flex-1">
                            <h4 class="mb-0 text-main text-truncate" style="font-size: 1rem;">${routine.name}</h4>
                            <p class="text-xs text-muted mb-0">${routine.exercises.length} Exercises</p>
                        </div>
                    </div>
                    <div class="routine-actions">
                        <button class="mf-btn-icon mf-btn-sm" onclick="window.routinesManager.toggleMenu(event, '${routine.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="routine-menu-dropdown" id="menu-${routine.id}">
                            <button class="routine-menu-item" onclick="window.routinesManager.editRoutine('${routine.id}')">
                                <i class="fas fa-pen text-primary"></i> Edit
                            </button>
                            <button class="routine-menu-item" onclick="window.routinesManager.duplicateRoutine('${routine.id}')">
                                <i class="fas fa-copy text-success"></i> Duplicate
                            </button>
                            <button class="routine-menu-item danger" onclick="window.routinesManager.deleteRoutine('${routine.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="routine-card-action">
                    <!-- زر Start تم فصله مع ربطه بوظيفة بدء الجلسة فقط -->
                    <button class="mf-btn mf-btn-primary mf-btn-sm btn-start-routine" onclick="dispatchStartWorkout('${routine.id}', '${routine.name.replace(/'/g, "\\'")}')">
                        <i class="fas fa-play"></i> Start Session
                    </button>
                </div>
            `;
            dropzone.appendChild(card);
        });

        container.appendChild(folderEl);
    });

    initDragAndDrop();
}

// ==========================================
// Advanced Mechanical Drag & Drop Engine
// ==========================================
function initDragAndDrop() {
    const cards = document.querySelectorAll(".routine-card");
    const dropzones = document.querySelectorAll(".routines-dropzone");

    cards.forEach((card) => {
        const handle = card.querySelector(".drag-handle");

        // Mobile & Desktop Grip Mechanics
        const enableDrag = () => card.setAttribute("draggable", "true");
        const disableDrag = () => card.setAttribute("draggable", "false");

        handle.addEventListener("mousedown", enableDrag);
        handle.addEventListener("mouseup", disableDrag);
        handle.addEventListener("touchstart", enableDrag, { passive: true });
        handle.addEventListener("touchend", disableDrag, { passive: true });

        card.addEventListener("dragstart", function (e) {
            draggedItem = this;
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/html", this.innerHTML); // Required for Firefox
            setTimeout(() => this.classList.add("is-dragging"), 0);
        });

        card.addEventListener("dragend", function () {
            this.classList.remove("is-dragging");
            this.setAttribute("draggable", "false");
            draggedItem = null;

            // Clean up empty placeholders globally
            document
                .querySelectorAll(".routine-placeholder")
                .forEach((p) => p.remove());

            // Commit structural changes to Firestore
            commitOrderToDatabase();
        });
    });

    dropzones.forEach((zone) => {
        zone.addEventListener("dragover", (e) => {
            e.preventDefault(); // Crucial to allow drop
            e.dataTransfer.dropEffect = "move";

            const afterElement = getDragAfterElement(zone, e.clientY);
            if (afterElement == null) {
                zone.appendChild(draggedItem);
            } else {
                zone.insertBefore(draggedItem, afterElement);
            }
            zone.closest(".routine-folder").classList.add("drag-over");
        });

        zone.addEventListener("dragleave", () => {
            zone.closest(".routine-folder").classList.remove("drag-over");
        });

        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.closest(".routine-folder").classList.remove("drag-over");
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [
        ...container.querySelectorAll(".routine-card:not(.is-dragging)"),
    ];

    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        },
        { offset: Number.NEGATIVE_INFINITY },
    ).element;
}

async function commitOrderToDatabase() {
    const user = auth.currentUser;
    if (!user) return;

    const batch = writeBatch(db);
    const folders = document.querySelectorAll(".routine-folder");

    folders.forEach((folder) => {
        const folderId = folder.dataset.folderId;
        const cards = folder.querySelectorAll(".routine-card");

        cards.forEach((card, index) => {
            const routineId = card.dataset.routineId;
            const ref = doc(db, "routines", routineId);
            batch.update(ref, { folderId: folderId, order: index });
        });
    });

    try {
        await batch.commit();
        console.log("System: Structural integrity saved.");
    } catch (err) {
        console.error("Order commit failed:", err);
    }
}

// ==========================================
// Action Controllers (Three Dots Menu)
// ==========================================
function toggleMenu(e, id) {
    e.stopPropagation();
    const targetMenu = document.getElementById(`menu-${id}`);

    // Close others
    document.querySelectorAll(".routine-menu-dropdown.show").forEach((m) => {
        if (m !== targetMenu) m.classList.remove("show");
    });

    targetMenu.classList.toggle("show");
}

async function deleteRoutine(id) {
    if (!confirm("Clinical Warning: Permanently delete this routine?")) return;
    try {
        await deleteDoc(doc(db, "routines", id));
        fetchMyRoutines(auth.currentUser.uid);
    } catch (e) {
        alert("Deletion failed: " + e.message);
    }
}

async function duplicateRoutine(id) {
    try {
        const snap = await getDoc(doc(db, "routines", id));
        if (!snap.exists()) return;

        const data = snap.data();
        data.name = `${data.name} (Copy)`;
        data.createdAt = serverTimestamp();
        data.order = Date.now(); // Put at bottom

        await addDoc(collection(db, "routines"), data);
        fetchMyRoutines(auth.currentUser.uid);
    } catch (e) {
        alert("Duplication failed: " + e.message);
    }
}

async function editRoutine(id) {
    try {
        const snap = await getDoc(doc(db, "routines", id));
        if (!snap.exists()) return;

        const data = snap.data();
        selectedExercises = data.exercises || [];
        editingRoutineId = id;
        targetFolderId = data.folderId || "default";

        document.getElementById("routine-name-input").value = data.name;

        document
            .getElementById("workout-home")
            .classList.add("app-shell-hidden");
        document
            .getElementById("routine-builder")
            .classList.remove("app-shell-hidden");

        renderBuilderList();
    } catch (e) {
        alert("Edit failed: " + e.message);
    }
}

// ==========================================
// Folders Management
// ==========================================
async function createNewFolder() {
    const name = prompt("Enter precise folder name:");
    if (!name || name.trim() === "") return;
    if (name.trim().toLowerCase() === "my routines")
        return alert("Clinical Error: Root directory name is reserved.");

    const user = auth.currentUser;
    if (!user) return;

    try {
        await addDoc(collection(db, "routine_folders"), {
            uid: user.uid,
            name: name.trim(),
            order: Date.now(),
            createdAt: serverTimestamp(),
        });
        fetchMyRoutines(user.uid);
    } catch (e) {
        alert("Folder creation failed.");
    }
}

function toggleFolder(id) {
    const folder = document.querySelector(`[data-folder-id="${id}"]`);
    if (!folder) return;

    const isCollapsed = folder.classList.toggle("collapsed");
    localStorage.setItem(`mf_folder_${id}`, isCollapsed);
}

function openBuilderForFolder(folderId) {
    targetFolderId = folderId;
    editingRoutineId = null;
    selectedExercises = [];

    document.getElementById("routine-name-input").value = "";
    document.getElementById("workout-home").classList.add("app-shell-hidden");
    document
        .getElementById("routine-builder")
        .classList.remove("app-shell-hidden");

    renderBuilderList();
}

// Global dispatcher to start workout
window.dispatchStartWorkout = (routineId, routineName) => {
    document.dispatchEvent(
        new CustomEvent("metricfitStartWorkout", {
            detail: { routineId, routineName },
        }),
    );
};

// ==========================================
// Catalog Logic (Preserved exactly as requested)
// ==========================================
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
            muscle: ex.primaryMuscles?.[0] || "general",
            target: ex.primaryMuscles?.[0] || "general",
            equipment: ex.equipment || "none",
            category: ex.category || "",
            level: ex.level || "",
            restTimer: 90,
            images: ex.images || [],
        }));

        localStorage.setItem(
            "metricfit_exercise_db",
            JSON.stringify(globalExerciseDB),
        );
        renderCatalogDOM(globalExerciseDB);
    } catch (error) {
        console.error("API Error:", error);
        catalogList.innerHTML = `<p class="text-error text-center mt-md">Failed to load database.</p>`;
    }
}

function renderCatalogDOM(exercises) {
    const catalogList = document.getElementById("catalog-list");
    catalogList.innerHTML = "";

    let actionBar = document.getElementById("catalog-action-bar");
    if (!actionBar) {
        actionBar = document.createElement("div");
        actionBar.id = "catalog-action-bar";
        actionBar.style.display = "none";
        actionBar.innerHTML = `
            <button id="btn-add-selected" class="mf-btn mf-btn-primary w-100">
                <i class="fas fa-plus-circle"></i> Add <span id="selected-count">0</span> Exercise(s)
            </button>`;
        catalogList.parentElement.appendChild(actionBar);

        document
            .getElementById("btn-add-selected")
            .addEventListener("click", () => {
                catalogList
                    .querySelectorAll(".exercise-item.is-selected")
                    .forEach((row) => {
                        const ex = globalExerciseDB.find(
                            (e) => e.id === row.dataset.exId,
                        );
                        if (ex) selectedExercises.push(ex);
                    });
                renderBuilderList();
                document.getElementById("btn-close-catalog").click();
            });
    }

    actionBar.style.display = "none";
    const countEl = document.getElementById("selected-count");
    if (countEl) countEl.textContent = "0";

    if (exercises.length === 0) {
        catalogList.innerHTML = `<p class="text-muted text-center mt-md">No exercises found.</p>`;
        return;
    }

    exercises.slice(0, 60).forEach((ex) => {
        const img0 = ex.images?.[0]
            ? `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${ex.images[0]}`
            : null;
        const row = document.createElement("div");
        row.className = "exercise-item";
        row.dataset.exId = ex.id;

        row.innerHTML = `
            <div class="ex-avatar">
                ${img0 ? `<img src="${img0}" alt="" loading="lazy" onerror="this.style.display='none'">` : ``}
                <i class="fas fa-dumbbell ex-avatar-icon"></i>
            </div>
            <div class="ex-info">
                <h3>${ex.name}</h3>
                <p>${(ex.muscle || "general").toUpperCase()} | ${ex.equipment || "none"}</p>
            </div>
            <button class="ex-info-btn" title="View Details" data-info-btn><i class="fas fa-circle-info"></i></button>
            <input type="checkbox" class="catalog-checkbox" aria-label="Select ${ex.name}">
        `;

        row.addEventListener("click", (e) => {
            if (e.target.closest("[data-info-btn]")) return;
            row.classList.toggle("is-selected");
            const total = catalogList.querySelectorAll(
                ".exercise-item.is-selected",
            ).length;
            if (countEl) countEl.textContent = total;
            actionBar.style.display = total > 0 ? "block" : "none";
        });

        row.querySelector("[data-info-btn]").addEventListener("click", (e) => {
            e.stopPropagation();
            document.dispatchEvent(
                new CustomEvent("metricfitOpenExercise", { detail: ex }),
            );
        });

        catalogList.appendChild(row);
    });
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
                <button class="mf-btn-icon text-error" style="width:30px; height:30px;" onclick="removeExercise(${index})">
                    <i class="fas fa-trash text-sm"></i>
                </button>
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
