// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";import { getFirestore } from "firebase/firestore";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTS8ymB6THZZNs4Bka-xx5W8kQ5oUR6NI",
  authDomain: "betting-at-developers-smc.firebaseapp.com",
  databaseURL: "https://betting-at-developers-smc-default-rtdb.firebaseio.com",
  projectId: "betting-at-developers-smc",
  storageBucket: "betting-at-developers-smc.firebasestorage.app",
  messagingSenderId: "1086266960540",
  appId: "1:1086266960540:web:688378cae5d7f170c45b59",
  measurementId: "G-QNQN61GB9V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app); // Commented out for server-side
const database = getDatabase(app);
// const firestore = getFirestore(app);

export { app, database };