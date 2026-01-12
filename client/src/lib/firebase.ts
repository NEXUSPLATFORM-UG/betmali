import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Set persistence to session level to prevent login state surviving across sessions/logout refresh
setPersistence(auth, browserSessionPersistence).catch(err => console.error("Auth persistence error:", err));
export const database = getDatabase(app);
