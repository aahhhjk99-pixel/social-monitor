
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import App from "./App";

import "./styles.css";

// Register Service Worker for Web Push
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const basePath = import.meta.env.BASE_URL;

    navigator.serviceWorker
      .register(`${basePath}sw.js`, {
        scope: basePath
      })
      .catch((error) => {
        console.error("[Service Worker] Registration failed:", error);
      });
  });
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("لم يتم العثور على العنصر #root في ملف index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/social-monitor">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
