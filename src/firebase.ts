import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCAy8-hZ5yNqEJ2CA7ZfRVKS4wPJUB9c44",
  authDomain: "social-monitor-b981c.firebaseapp.com",
  projectId: "social-monitor-b981c",
  storageBucket: "social-monitor-b981c.firebasestorage.app",
  messagingSenderId: "726708653101",
  appId: "1:726708653101:web:0850433174c7998673fca4"
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

export default app;
