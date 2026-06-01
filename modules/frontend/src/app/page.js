"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isAuthenticated } from "@/library/auth";
import { getTheme, toggleTheme as toggleThemeFn } from "@/library/theme";
import { Icon } from "@/library/icons";

const FEATURES = [
  { icon: "file-text", title: "Belge Yükle", desc: "PDF, DOCX, PPTX dosyalarınızı yükleyin; sistem otomatik parçalar ve gömer." },
  { icon: "globe", title: "arXiv Araması", desc: "Bir konu girin — sistem arXiv'den ilgili makaleleri bulup işler." },
  { icon: "network", title: "Bilgi Grafiği", desc: "Kavramlar Neo4j grafiğinde ilişkilendirilerek daha derin bağlam oluşur." },
  { icon: "message-square", title: "Kaynağa Dayalı Sohbet", desc: "Her yanıt hangi belgeden geldiğini gösteren kaynak rozetleriyle gelir." },
];

export default function LandingPage() {
  const [theme, setTheme] = useState("dark");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setTheme(getTheme());
  }, []);

  return (
    <div className="app-root">
      <div className="app-shell" style={{ overflowY: "auto" }}>
        <div className="topnav">
          <div className="brand"><span className="logo"><Icon name="network" size={24} /></span><span className="wm">Tualem<small>AI</small></span></div>
          <div className="right">
            <button className="icon-btn" onClick={() => setTheme(toggleThemeFn())} title="Tema"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
            {loggedIn ? (
              <Link href="/dashboard" className="btn btn-primary" style={{ textDecoration: "none" }}>Dashboard<Icon name="arrow-right" size={16} /></Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary" style={{ textDecoration: "none" }}>Giriş yap</Link>
                <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none" }}>Kayıt ol</Link>
              </>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--sp-20) var(--sp-8)", width: "100%" }}>
          {/* Hero */}
          <section style={{ textAlign: "center", marginBottom: "var(--sp-20)" }}>
            <div className="status st-ready mono" style={{ display: "inline-flex", marginBottom: "var(--sp-6)" }}>Graph RAG · Neo4j · pgvector · LLM</div>
            <h1 style={{ fontSize: "var(--text-display)", lineHeight: 1.1, maxWidth: 640, margin: "0 auto var(--sp-5)" }}>
              Kaynaklarınızdan düşünen bir çalışma ortağı.
            </h1>
            <p style={{ fontSize: "var(--text-lg)", color: "var(--text-secondary)", maxWidth: 560, margin: "0 auto var(--sp-8)", lineHeight: 1.6 }}>
              Belgelerinizi bir bilgi grafiğine dönüştürün; sorun, özetleyin, test edin — her yanıt kaynağına bağlı.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/register" className="btn btn-primary btn-lg" style={{ textDecoration: "none" }}>Ücretsiz başla<Icon name="arrow-right" size={18} /></Link>
              <Link href="/login" className="btn btn-secondary btn-lg" style={{ textDecoration: "none" }}>Giriş yap</Link>
            </div>
          </section>

          {/* Özellikler */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--sp-4)" }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="feature" style={{ flexDirection: "column", gap: "var(--sp-3)" }}>
                <div className="f-ic"><Icon name={f.icon} size={20} /></div>
                <div>
                  <div className="f-t" style={{ fontSize: "var(--text-md)", marginBottom: 4 }}>{f.title}</div>
                  <div className="f-d">{f.desc}</div>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
