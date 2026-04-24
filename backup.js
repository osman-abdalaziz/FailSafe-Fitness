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
