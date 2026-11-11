
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import App from "./App";

import "./styles.css";

// التأكد من وجود عنصر التطبيق في index.html
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'لم يتم العثور على العنصر #root في ملف index.html'
  );
}

// إنشاء جذر React
const root = ReactDOM.createRoot(rootElement);

// تشغيل التطبيق
root.render(
  <React.StrictMode>
    <BrowserRouter basename="/social-monitor">
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
