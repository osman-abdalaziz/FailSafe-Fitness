/**
 * ui-components.js
 * Handles advanced UX interactions (e.g., custom number inputs with long-press logic)
 */

document.addEventListener("DOMContentLoaded", () => {
    initCustomNumberInputs();
});

function initCustomNumberInputs() {
    // Select all custom increment/decrement buttons
    const numButtons = document.querySelectorAll(
        '[data-action="increment"], [data-action="decrement"]',
    );

    numButtons.forEach((btn) => {
        let pressTimer;
        let pressInterval;
        const action = btn.getAttribute("data-action");

        // Find the adjacent input field dynamically based on the wrapper structure
        const wrapper = btn.closest(".mf-num-standard, .mf-num-central");
        if (!wrapper) return;
        const input = wrapper.querySelector('input[type="number"]');
        if (!input) return;

        // Retrieve steps and limits dynamically from the HTML attributes
        const step = parseFloat(input.getAttribute("step")) || 1;
        const max = input.hasAttribute("max")
            ? parseFloat(input.getAttribute("max"))
            : Infinity;
        const min = input.hasAttribute("min")
            ? parseFloat(input.getAttribute("min"))
            : -Infinity;

        const updateValue = () => {
            let currentValue = parseFloat(input.value) || 0;
            let newValue = currentValue;

            if (action === "increment" && currentValue < max) {
                newValue = currentValue + step;
            } else if (action === "decrement" && currentValue > min) {
                newValue = currentValue - step;
            }

            // Fix JS floating point issues (e.g., 0.1 + 0.2 = 0.30000000000000004)
            input.value = parseFloat(newValue.toFixed(2));

            // Dispatch event so other scripts know the value changed
            input.dispatchEvent(new Event("input", { bubbles: true }));
        };

        const startPress = (e) => {
            e.preventDefault(); // Prevents text selection / double-tap zoom
            updateValue(); // Fire once immediately on click

            // Wait 400ms, if still holding, start rapid fire every 75ms
            pressTimer = setTimeout(() => {
                pressInterval = setInterval(updateValue, 75);
            }, 400);
        };

        const endPress = () => {
            clearTimeout(pressTimer);
            clearInterval(pressInterval);
        };

        // Attach listeners for both Mouse (Desktop) and Touch (Mobile)
        btn.addEventListener("mousedown", startPress);
        btn.addEventListener("mouseup", endPress);
        btn.addEventListener("mouseleave", endPress);

        btn.addEventListener("touchstart", startPress, { passive: false });
        btn.addEventListener("touchend", endPress);
        btn.addEventListener("touchcancel", endPress);
    });
}
