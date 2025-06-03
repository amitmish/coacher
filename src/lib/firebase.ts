
// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database"; // Changed from firestore

// TODO: Replace with your actual Firebase project configuration
// This config should be the same, but ensure your project has Realtime Database enabled.
const firebaseConfig = {
  apiKey: "AIzaSyAb9DJcr88iMpQq-P8Nn186zh-FquoETL4",
  authDomain: "coach-efd5f.firebaseapp.com",
  projectId: "coach-efd5f",
  storageBucket: "coach-efd5f.firebasestorage.app",
  messagingSenderId: "533585606213",
  appId: "1:533585606213:web:1777982d81e0d9cfb6152c",
  measurementId: "G-VV4REGYD01",
  // You might need to add databaseURL for Realtime Database if not inferred
  databaseURL: "https://coach-efd5f-default-rtdb.firebaseio.com" // Example, verify yours
};

let app: FirebaseApp;
let db: Database; // Changed from Firestore

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getDatabase(app); // Changed from getFirestore(app)

export { app, db };
