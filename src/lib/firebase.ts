
// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAb9DJcr88iMpQq-P8Nn186zh-FquoETL4",
  authDomain: "coach-efd5f.firebaseapp.com",
  projectId: "coach-efd5f",
  storageBucket: "coach-efd5f.firebasestorage.app",
  messagingSenderId: "533585606213",
  appId: "1:533585606213:web:1777982d81e0d9cfb6152c",
  measurementId: "G-VV4REGYD01"
};

let app: FirebaseApp;
let db: Firestore;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

db = getFirestore(app);

export { app, db };
