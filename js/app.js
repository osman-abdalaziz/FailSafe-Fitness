/**
 * app.js
 * Core application logic, Authentication state, and Zero-Latency SPA routing.
 */

import { auth, db } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    initAuthEngine();
    initRouter();
});

function initAuthEngine() {
    const viewAuth = document.getElementById("view-auth");
    const coreApp = document.getElementById("core-app");
    const coreNav = document.getElementById("core-nav");

    const sectionLogin = document.getElementById("section-login");
    const sectionRegister = document.getElementById("section-register");

    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");
    const btnLogout = document.getElementById("btn-logout");

    // 1. Session Persistence Observer (Triggers automatically on load and auth state change)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("System: Session Restored. UID:", user.uid);
            // Hide Auth, Show App
            viewAuth.style.display = "none";
            coreApp.classList.remove("app-shell-hidden");
            coreNav.classList.remove("app-shell-hidden");
        } else {
            console.log("System: No Active Session.");
            // Hide App, Show Auth
            viewAuth.style.display = "flex";
            coreApp.classList.add("app-shell-hidden");
            coreNav.classList.add("app-shell-hidden");
        }
    });

    // 2. UI Toggles
    document
        .getElementById("toggle-to-register")
        .addEventListener("click", () => {
            sectionLogin.classList.add("app-shell-hidden");
            sectionRegister.classList.remove("app-shell-hidden");
        });

    document.getElementById("toggle-to-login").addEventListener("click", () => {
        sectionRegister.classList.add("app-shell-hidden");
        sectionLogin.classList.remove("app-shell-hidden");
    });

    // 3. Handle Login
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            formLogin.reset(); // Clear fields after success
        } catch (error) {
            alert("Clinical Error: " + error.message);
        }
    });

    // 4. Handle Registration (Creating Clinical Profile)
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const confirmPassword = document.getElementById(
            "reg-password-confirm",
        ).value;

        // Validation
        if (password !== confirmPassword) {
            return alert("Clinical Warning: Passwords do not match.");
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password,
            );
            const user = userCredential.user;

            // Initialize user document in Firestore (Adding Name)
            await setDoc(doc(db, "users", user.uid), {
                fullName: name,
                email: email,
                createdAt: serverTimestamp(),
            });

            formRegister.reset(); // Clear fields after success
        } catch (error) {
            alert("Registration Failed: " + error.message);
        }
    });

    // 5. Handle Logout
    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth);
                // onAuthStateChanged will handle the UI switch automatically
            } catch (error) {
                alert("Logout Failed: " + error.message);
            }
        });
    }
}

function initRouter() {
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".app-view:not(#view-auth)");
    const pageTitle = document.getElementById("page-title");

    navItems.forEach((item) => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            navItems.forEach((nav) => nav.classList.remove("active"));
            views.forEach((view) => (view.style.display = "none"));
            item.classList.add("active");

            const targetId = item.getAttribute("data-target");
            const targetView = document.getElementById(targetId);
            if (targetView) targetView.style.display = "block";

            pageTitle.innerText = item.querySelector("span").innerText;

            // NEW: Hide sub-nav on main view switch
            if (targetId !== "view-workout") {
                document
                    .getElementById("session-sub-nav")
                    ?.classList.add("app-shell-hidden");
            } else {
                document
                    .getElementById("session-sub-nav")
                    ?.classList.remove("app-shell-hidden");
            }
        });
    });
}
