"use client";

import { useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./auth.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {

  useEffect(() => {

    const savedTheme = localStorage.getItem("theme");

    if (savedTheme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }

  }, []);

  const toggleTheme = () => {

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }

  };

  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <title>
          ProjeAdı | AI Destekli Araştırma Asistanı
        </title>

        <meta
          name="description"
          content="Yeni nesil araştırma deneyimine katılın."
        />
      </head>

      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <div className="page">

          <header className="navbar">

            <div className="nav-left">
              <span style={{ fontWeight: 700 }}>
                🧠 ProjeAdı
              </span>
            </div>

            <div className="nav-right">

              <a href="/dashboard" className="nav-link">
                Dashboard
              </a>

              <a href="/profile" className="nav-link">
                Profil
              </a>

              <button
                className="theme-btn"
                onClick={toggleTheme}
                type="button"
                title="Tema değiştir"
              >
                🌙
              </button>

            </div>

          </header>

          <main className="main-content">
            {children}
          </main>

          <footer className="footer">
            © 2026 ProjeAdı AI destekli bilişsel bilgi
            grafiği ve araştırma asistanı
          </footer>

        </div>
      </body>
    </html>
  );
}
