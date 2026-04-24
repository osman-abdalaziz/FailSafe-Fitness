// Import the functions you need from the SDKs you need

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";

// TODO: Add SDKs for Firebase products that you want to use

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
    apiKey: "AIzaSyAGxi8q8kBbWH3_HPBecohzXAx1ljQDgmk",
    authDomain: "failsafe-fitness.firebaseapp.com",
    projectId: "failsafe-fitness",
    storageBucket: "failsafe-fitness.firebasestorage.app",
    messagingSenderId: "141342890668",
    appId: "1:141342890668:web:da900133ad12d3e2ce1d09",
    measurementId: "G-SR6VRSHGTJ",
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
