/**
 * app.js
 * Core application logic, Authentication state, and Zero-Latency SPA routing.
 */

document.addEventListener("DOMContentLoaded", () => {
    initAuthEngine();
    initRouter();
});

// MODIFIED CODE: Real Firebase Authentication Logic
function initAuthEngine() {
    const authForm = document.getElementById("auth-form");
    const btnLogin = document.getElementById("btn-login");
    const btnRegister = document.getElementById("btn-register");

    // Handle Login
    authForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value;
        const password = document.getElementById("auth-password").value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("System: Login Successful");
                toggleAppShell(true);
            })
            .catch((error) => {
                alert("Clinical Error: " + error.message);
            });
    });

    // Handle Registration (Creating Clinical Profile)
    btnRegister.addEventListener("click", () => {
        const email = document.getElementById("auth-email").value;
        const password = document.getElementById("auth-password").value;

        if (!email || !password) return alert("Credentials required.");

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Initialize user document in Firestore
                const user = userCredential.user;
                db.collection("users").doc(user.uid).set({
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    email: email,
                });
                toggleAppShell(true);
            })
            .catch((error) => {
                alert("Registration Failed: " + error.message);
            });
    });
}

function toggleAppShell(isAuthenticated) {
    const viewAuth = document.getElementById("view-auth");
    const coreApp = document.getElementById("core-app");
    const coreNav = document.getElementById("core-nav");

    if (isAuthenticated) {
        viewAuth.style.display = "none";
        coreApp.classList.remove("app-shell-hidden");
        coreNav.classList.remove("app-shell-hidden");
    }
}

function initRouter() {
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".app-view:not(#view-auth)"); // Exclude Auth from standard routing
    const pageTitle = document.getElementById("page-title");

    navItems.forEach((item) => {
        item.addEventListener("click", (e) => {
            e.preventDefault();

            // 1. Remove active state from all nav items
            navItems.forEach((nav) => nav.classList.remove("active"));

            // 2. Hide all core views entirely
            views.forEach((view) => {
                view.style.display = "none";
            });

            // 3. Set the clicked nav item to active
            item.classList.add("active");

            // 4. Show the targeted view (Zero-Latency display toggle)
            const targetId = item.getAttribute("data-target");
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.style.display = "block";
            }

            // 5. Update the Top Header Title dynamically
            const titleText = item.querySelector("span").innerText;
            pageTitle.innerText = titleText;
        });
    });
}
