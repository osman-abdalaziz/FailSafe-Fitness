/**
 * ui-components.js
 * Handles advanced UX interactions (e.g., custom number inputs with long-press logic)
 */

document.addEventListener("DOMContentLoaded", () => {
    initCustomNumberInputs();
});

// MODIFIED CODE: Prevent double-binding on dynamic elements
function initCustomNumberInputs() {
    // Select only buttons that haven't been bound yet
    const numButtons = document.querySelectorAll(
        '[data-action="increment"]:not([data-bound="true"]), [data-action="decrement"]:not([data-bound="true"])',
    );

    numButtons.forEach((btn) => {
        btn.setAttribute("data-bound", "true"); // Mark as bound

        let pressTimer;
        let pressInterval;
        const action = btn.getAttribute("data-action");

        const wrapper = btn.closest(".mf-num-standard, .mf-num-central");
        if (!wrapper) return;
        const input = wrapper.querySelector('input[type="number"]');
        if (!input) return;

        const step = parseFloat(input.getAttribute("step")) || 1;
        const max = input.hasAttribute("max")
            ? parseFloat(input.getAttribute("max"))
            : Infinity;
        const min = input.hasAttribute("min")
            ? parseFloat(input.getAttribute("min"))
            : -Infinity;

        const updateValue = () => {
            // Check if input is disabled (Locked by Ghost Fill)
            if (input.disabled) return;

            let currentValue = parseFloat(input.value) || 0;
            let newValue = currentValue;

            if (action === "increment" && currentValue < max) {
                newValue = currentValue + step;
            } else if (action === "decrement" && currentValue > min) {
                newValue = currentValue - step;
            }

            input.value = parseFloat(newValue.toFixed(2));
            input.dispatchEvent(new Event("input", { bubbles: true }));
        };

        const startPress = (e) => {
            if (input.disabled) return;
            e.preventDefault();
            updateValue();
            pressTimer = setTimeout(() => {
                pressInterval = setInterval(updateValue, 75);
            }, 400);
        };

        const endPress = () => {
            clearTimeout(pressTimer);
            clearInterval(pressInterval);
        };

        btn.addEventListener("mousedown", startPress);
        btn.addEventListener("mouseup", endPress);
        btn.addEventListener("mouseleave", endPress);
        btn.addEventListener("touchstart", startPress, { passive: false });
        btn.addEventListener("touchend", endPress);
        btn.addEventListener("touchcancel", endPress);
    });
}

// Expose globally so the Workout Engine can re-trigger it for new rows
window.initCustomNumberInputs = initCustomNumberInputs;
