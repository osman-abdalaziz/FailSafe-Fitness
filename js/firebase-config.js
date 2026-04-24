import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAGxi8q8kBbWH3_HPBecohzXAx1ljQDgmk",
    authDomain: "failsafe-fitness.firebaseapp.com",
    projectId: "failsafe-fitness",
    storageBucket: "failsafe-fitness.firebasestorage.app",
    messagingSenderId: "141342890668",
    appId: "1:141342890668:web:da900133ad12d3e2ce1d09",
    measurementId: "G-SR6VRSHGTJ",
};

// Initialize Firebase Engine
const app = initializeApp(firebaseConfig);

// Export instances to be used in app.js
export const auth = getAuth(app);
export const db = getFirestore(app);
