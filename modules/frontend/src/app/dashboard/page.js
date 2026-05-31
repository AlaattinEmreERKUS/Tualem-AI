"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, getAuthHeader, isAuthenticated, removeToken, getTokenPayload } from "@/lib/auth";
import "../auth.css";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost";

const BADGE_COLORS = ["#7c3aed", "#2563eb", "#059669", "#d97706", "#dc2626", "#0891b2"];

// --- Export helpers ---
function exportMD(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(content, title) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>` +
    `<style>body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;line-height:1.7}` +
    `h1{border-bottom:2px solid #333;padding-bottom:10px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:Arial}</style>` +
    `</head><body><h1>${title}</h1><pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`
  );
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function exportDOC(content, title) {
  const html =
    `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>` +
    `<head><meta charset="utf-8"><title>${title}</title></head>` +
    `<body><h1>${title}</h1><pre style="font-family:Arial">${content.replace(/</g, "&lt;")}</pre></body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${title}.doc`; a.click();
  URL.revokeObjectURL(url);
}

const _panelBtnStyle = {
  padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)",
  cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
};

// --- Özet Panel ---
function OzetPanel({ content, onClose }) {
  const title = "Belge Özeti";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--light-text)" }}>📋 Özet</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--light-muted)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", fontSize: "0.8rem", color: "var(--light-text)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {content}
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}>
        <button onClick={() => exportMD(content, "ozet.md")} style={_panelBtnStyle}>⬇ MD</button>
        <button onClick={() => exportPDF(content, title)} style={_panelBtnStyle}>⬇ PDF</button>
        <button onClick={() => exportDOC(content, title)} style={_panelBtnStyle}>⬇ DOC</button>
      </div>
    </div>
  );
}

// --- Test Modal (tam ekran overlay) ---
function TestModal({ data, answers, setAnswers, submitted, setSubmitted, onClose }) {
  const questions = data?.questions ?? [];
  const score = submitted ? questions.reduce((acc, q, i) => acc + (answers[i] === q.answer ? 1 : 0), 0) : 0;
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
  const passing = score >= Math.ceil(questions.length / 2);

  const OPTION_COLORS = { A: "#7c3aed", B: "#2563eb", C: "#059669", D: "#d97706" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#12121f", borderRadius: "20px", width: "min(820px, 100%)", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div>
            <h3 style={{ color: "#fff", margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>📝 Test</h3>
            <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.4)" }}>{questions.length} soru</span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", cursor: "pointer", width: 36, height: 36, fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Skor (sonuç sonrası) */}
        {submitted && (
          <div style={{ flexShrink: 0, margin: "20px 28px 0", background: passing ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", borderRadius: "14px", padding: "18px 22px", border: `1px solid ${passing ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: "2.2rem", fontWeight: 800, color: passing ? "#4ade80" : "#f87171", lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "4px" }}>{score}/{questions.length} doğru</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: passing ? "#4ade80" : "#f87171", borderRadius: "4px", transition: "width 0.6s ease" }} />
              </div>
              {score < questions.length && (
                <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", marginTop: "8px" }}>
                  Eksik: {questions.filter((q, i) => answers[i] !== q.answer).map((q) => q.question.slice(0, 30) + "…").join(" • ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sorular */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 28px", display: "flex", flexDirection: "column", gap: "20px" }}>
          {questions.map((q, qi) => {
            const qCorrect = submitted && answers[qi] === q.answer;
            const qWrong = submitted && answers[qi] && answers[qi] !== q.answer;
            return (
              <div key={qi} style={{ borderRadius: "14px", overflow: "hidden", border: `1px solid ${submitted ? (qCorrect ? "rgba(74,222,128,0.35)" : qWrong ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.08)"}` }}>
                {/* Soru başlığı */}
                <div style={{ background: "rgba(255,255,255,0.04)", padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: submitted ? (qCorrect ? "rgba(74,222,128,0.2)" : qWrong ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.08)") : "rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: submitted ? (qCorrect ? "#4ade80" : qWrong ? "#f87171" : "rgba(255,255,255,0.6)") : "#a78bfa" }}>
                    {submitted ? (qCorrect ? "✓" : qWrong ? "✗" : qi + 1) : qi + 1}
                  </span>
                  <span style={{ fontSize: "0.95rem", color: "#fff", fontWeight: 500, lineHeight: 1.5 }}>{q.question}</span>
                </div>

                {/* Şıklar — düğme tabanlı */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.06)" }}>
                  {Object.entries(q.options || {}).map(([key, val]) => {
                    const sel = answers[qi] === key;
                    const isAns = submitted && key === q.answer;
                    const isWrong = submitted && sel && key !== q.answer;
                    const color = OPTION_COLORS[key] || "#7c3aed";
                    return (
                      <button
                        key={key}
                        disabled={submitted}
                        onClick={() => !submitted && setAnswers((prev) => ({ ...prev, [qi]: key }))}
                        style={{
                          background: isAns ? "rgba(74,222,128,0.12)" : isWrong ? "rgba(248,113,113,0.12)" : sel ? `${color}22` : "#12121f",
                          border: "none",
                          borderLeft: `3px solid ${isAns ? "#4ade80" : isWrong ? "#f87171" : sel ? color : "transparent"}`,
                          padding: "14px 16px",
                          textAlign: "left",
                          cursor: submitted ? "default" : "pointer",
                          transition: "background 0.15s",
                          display: "flex", alignItems: "flex-start", gap: "10px",
                        }}
                        onMouseEnter={(e) => { if (!submitted && !sel) e.currentTarget.style.background = `${color}15`; }}
                        onMouseLeave={(e) => { if (!submitted && !sel) e.currentTarget.style.background = "#12121f"; }}
                      >
                        <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "6px", background: isAns ? "rgba(74,222,128,0.2)" : isWrong ? "rgba(248,113,113,0.2)" : sel ? `${color}33` : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: isAns ? "#4ade80" : isWrong ? "#f87171" : sel ? color : "rgba(255,255,255,0.4)" }}>
                          {key}
                        </span>
                        <span style={{ fontSize: "0.88rem", color: isAns ? "#4ade80" : isWrong ? "#f87171" : sel ? "#fff" : "rgba(255,255,255,0.7)", lineHeight: 1.45 }}>{val}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Açıklama */}
                {submitted && q.explanation && (
                  <div style={{ padding: "12px 18px", background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "0.82rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                    💡 {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Alt buton */}
        {!submitted && (
          <div style={{ padding: "16px 28px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
            <button onClick={() => setSubmitted(true)} style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.03em" }}>
              Sonuçları Gör →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Yol Haritası Modal ---
function RoadmapModal({ data, onClose }) {
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const steps = data?.steps ?? [];
  const toggleStep = (i) => setCompletedSteps((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "var(--panel-bg)", borderRadius: "20px", padding: "28px", width: "min(700px, 90vw)", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", gap: "16px", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ color: "var(--light-text)", margin: 0, fontSize: "1.1rem" }}>🗺️ {data?.title || "Öğrenme Yol Haritası"}</h3>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        <div style={{ flexShrink: 0, background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "8px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: "4px", height: "6px" }}>
            <div style={{ width: `${steps.length ? (completedSteps.size / steps.length) * 100 : 0}%`, background: "#7c3aed", height: "100%", borderRadius: "4px", transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap" }}>{completedSteps.size}/{steps.length} tamamlandı</span>
        </div>

        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
          {steps.map((step, i) => {
            const done = completedSteps.has(i);
            return (
              <div key={i} onClick={() => toggleStep(i)} style={{ background: done ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${done ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.1)"}`, borderRadius: "12px", padding: "14px 16px", cursor: "pointer", transition: "all 0.2s", display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "rgba(74,222,128,0.3)" : "rgba(124,58,237,0.3)", color: done ? "#4ade80" : "#a78bfa", fontWeight: 700, fontSize: "0.8rem" }}>
                  {done ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: done ? "#4ade80" : "var(--light-text)", textDecoration: done ? "line-through" : "none", marginBottom: "4px" }}>{step.title}</div>
                  <div style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.5, marginBottom: "8px" }}>{step.description}</div>
                  {step.duration && <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", marginBottom: "8px" }}>⏱ {step.duration}</div>}
                  {step.substeps?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {step.substeps.map((sub, si) => (
                        <div key={si} style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", borderLeft: "2px solid rgba(124,58,237,0.4)" }}>
                          <span style={{ fontSize: "0.68rem", color: "#a78bfa", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>{si + 1}.</span>
                          <div>
                            <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>{sub.title}</div>
                            {sub.detail && <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{sub.detail}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SourceBadges({ sources }) {
  const [hovered, setHovered] = useState(null);

  const grouped = sources.reduce((acc, s) => {
    const key = s.document_id;
    if (!acc[key]) acc[key] = { file_name: s.file_name || "Kaynak", chunks: [] };
    acc[key].chunks.push(s);
    return acc;
  }, {});

  const entries = Object.entries(grouped);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", alignItems: "center" }}>
      <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginRight: "2px" }}>kaynak:</span>
      {entries.map(([docId, { file_name, chunks }], idx) => {
        const color = BADGE_COLORS[idx % BADGE_COLORS.length];
        const isHovered = hovered === docId;
        const abbrev = file_name.replace(/\.[^.]+$/, "").slice(0, 2).toUpperCase();

        return (
          <div key={docId} style={{ position: "relative" }}
            onMouseEnter={() => setHovered(docId)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: color, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.65rem", fontWeight: 700, cursor: "pointer",
              border: "2px solid rgba(255,255,255,0.2)", userSelect: "none", flexShrink: 0,
            }}>
              {abbrev}
            </div>
            {isHovered && (
              <div style={{
                position: "absolute", bottom: "34px", left: "50%", transform: "translateX(-50%)",
                background: "#1e1e2e", border: `1px solid ${color}`, borderRadius: "8px",
                padding: "10px 12px", minWidth: "220px", maxWidth: "320px",
                zIndex: 50, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", pointerEvents: "none",
              }}>
                <div style={{ fontWeight: 700, fontSize: "0.78rem", color, marginBottom: "6px", wordBreak: "break-word" }}>
                  📄 {file_name}
                </div>
                {chunks.map((c, ci) => (
                  <div key={ci} style={{
                    fontSize: "0.72rem", color: "rgba(255,255,255,0.7)",
                    borderTop: ci > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    paddingTop: ci > 0 ? "4px" : 0, marginTop: ci > 0 ? "4px" : 0,
                  }}>
                    <span style={{ color, fontWeight: 600 }}>Parça {c.chunk_index + 1}:</span>{" "}
                    {c.content.slice(0, 150)}{c.content.length > 150 ? "…" : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const MODELS = [
  { id: "groq:llama-3.1-8b-instant",      label: "⚡ Llama 3.1 8B",     note: "8K ctx · hızlı · küçük belgeler",    provider: "Groq" },
  { id: "groq:llama-3.3-70b-versatile",   label: "⚡ Llama 3.3 70B",    note: "32K ctx · güçlü · büyük belgeler",   provider: "Groq" },
  { id: "groq:gemma2-9b-it",              label: "⚡ Gemma2 9B",         note: "8K ctx · hızlı · küçük belgeler",    provider: "Groq" },
  { id: "ollama:qwen3.5:9b",              label: "🖥️ Qwen3.5 9B",       note: "Yerel · orta kapasite",              provider: "Yerel" },
  { id: "ollama:llama3.2:3b",             label: "🖥️ Llama 3.2 3B",     note: "Yerel · çok hızlı · basit sorular",  provider: "Yerel" },
  { id: "moonshotai/kimi-k2.6:free",      label: "☁️ Kimi K2.6",        note: "128K ctx · ücretsiz · büyük belgeler", provider: "OpenRouter" },
  { id: "google/gemma-4-31b-it:free",     label: "☁️ Gemma 4 31B",      note: "128K ctx · ücretsiz · güçlü",        provider: "OpenRouter" },
  { id: "meta-llama/llama-4-scout:free",  label: "☁️ Llama 4 Scout",    note: "10M ctx · ücretsiz · devasa belgeler", provider: "OpenRouter" },
];

export default function DashboardPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHome, setShowHome] = useState(true);

  // Profil
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileFirstName, setProfileFirstName] = useState("");

  // Kart 3 nokta menüsü + düzenleme
  const [openMenuId, setOpenMenuId] = useState(null);
  const [favoritedRooms, setFavoritedRooms] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tualem_favorites") || "[]")); }
    catch { return new Set(); }
  });
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Test modal
  const [testModal, setTestModal] = useState(null); // { data, loading }

  // Kaydedilen aksiyonlar (roomId → array)
  const [savedActionsMap, setSavedActionsMap] = useState({});

  // Model seçici
  const [selectedModel, setSelectedModel] = useState("groq:llama-3.3-70b-versatile");

  // Oda kurulum modal
  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [roomSetupStep, setRoomSetupStep] = useState(1);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomError, setRoomError] = useState("");
  const [pendingRoom, setPendingRoom] = useState(null);

  // Kaynak modal
  const [showModal, setShowModal] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [arxivTopic, setArxivTopic] = useState("");

  // Kaynakları hariç tutma
  const [excludedDocs, setExcludedDocs] = useState(new Set());

  // Panel genişlik kontrolü
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showSourcesFullscreen, setShowSourcesFullscreen] = useState(false);

  // Aksiyon paneli
  const [actionPanel, setActionPanel] = useState(null); // { type, data, loading }
  const [testAnswers, setTestAnswers] = useState({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [roadmapData, setRoadmapData] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    const payload = getTokenPayload();
    if (payload) setProfileUsername(payload.username || "");
    fetchRooms();
    fetchDocuments();
    fetchProfile();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => { return () => wsRef.current?.close(); }, []);

  async function fetchRooms() {
    try {
      const res = await fetch("/api/chat/rooms/", { headers: getAuthHeader() });
      if (res.ok) { const d = await res.json(); setRooms(d.results ?? d); }
    } catch {}
  }

  async function fetchDocuments(roomId = null) {
    try {
      const url = roomId ? `/api/documents/?room_id=${roomId}` : "/api/documents/";
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) { const d = await res.json(); setDocuments(d.results ?? d); }
    } catch {}
  }

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/profile/", { headers: getAuthHeader() });
      if (res.ok) {
        const d = await res.json();
        setProfileUsername(d.username || "");
        setProfileFirstName(d.first_name || "");
        if (d.profile_photo) setProfilePhoto(d.profile_photo);
      }
    } catch {}
  }

  function toggleFavorite(roomId) {
    setFavoritedRooms((prev) => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      try { localStorage.setItem("tualem_favorites", JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function openEditRoom(room) {
    setEditingRoom(room);
    setEditingTitle(room.title);
    setOpenMenuId(null);
  }

  async function saveRoomEdit() {
    if (!editingRoom || !editingTitle.trim()) return;
    try {
      const res = await fetch(`/api/chat/rooms/${editingRoom.id}/`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (res.ok) {
        setRooms((prev) => prev.map((r) => r.id === editingRoom.id ? { ...r, title: editingTitle.trim() } : r));
        if (activeRoom?.id === editingRoom.id) setActiveRoom((r) => ({ ...r, title: editingTitle.trim() }));
      }
    } catch {}
    setEditingRoom(null);
  }

  function loadSavedActions(roomId) {
    try {
      const raw = localStorage.getItem(`tualem_actions_${roomId}`);
      if (raw) setSavedActionsMap((prev) => ({ ...prev, [roomId]: JSON.parse(raw) }));
    } catch {}
  }

  function saveActionToStorage(roomId, type, data) {
    try {
      const key = `tualem_actions_${roomId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      const label = { test: "📝 Test", ozet: "📋 Özet", yolharitasi: "🗺️ Yol Haritası" }[type] || type;
      const entry = { type, data, label, timestamp: Date.now() };
      const updated = [entry, ...existing].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(updated));
      setSavedActionsMap((prev) => ({ ...prev, [roomId]: updated }));
    } catch {}
  }

  function openRoomSetup() {
    setNewRoomName("");
    setRoomError("");
    setRoomSetupStep(1);
    setShowRoomSetup(true);
  }

  async function proceedToSourceStep() {
    const name = newRoomName.trim();
    if (!name) { setRoomError("Sohbet ismi gerekli."); return; }
    setRoomError("");
    try {
      const res = await fetch("/api/chat/rooms/", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: name }),
      });
      if (res.ok) {
        const room = await res.json();
        setRooms((prev) => [room, ...prev]);
        setPendingRoom(room);
        setRoomSetupStep(2);
      } else {
        const d = await res.json().catch(() => ({}));
        setRoomError(d.error || d.detail || `Hata: ${res.status}`);
      }
    } catch { setRoomError("Sunucuya bağlanılamadı."); }
  }

  function finishSetup(sourceChoice) {
    setShowRoomSetup(false);
    if (!pendingRoom) return;
    openRoom(pendingRoom);
    setShowHome(false);
    setPendingRoom(null);
    if (sourceChoice === "file") setTimeout(() => triggerFileUpload(), 300);
    else if (sourceChoice === "arxiv") setTimeout(() => setShowWebSearch(true), 300);
  }

  function openRoom(room) {
    wsRef.current?.close();
    setActiveRoom(room);
    setShowHome(false);
    setMessages([{ sender: "ai", text: "Merhaba! Soru sorabilir veya kaynak ekleyebilirsiniz." }]);
    setActionPanel(null);
    setTestModal(null);
    setRoadmapData(null);
    setTestAnswers({});
    setTestSubmitted(false);
    setOpenMenuId(null);
    setDocuments([]);
    fetchDocuments(room.id);
    loadSavedActions(room.id);
    const ws = new WebSocket(`${WS_BASE}/ws/graph/chat/${room.id}/`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: getToken() }));
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "auth_ok") return;
      const { role, message, is_streaming, sources, action_type } = data;
      if (role === "user") return;
      if (role === "system") {
        setMessages((prev) => [...prev, { sender: "system", text: message }]);
        return;
      }
      setIsTyping(false);
      if (role === "assistant" && !is_streaming && message) {
        if (action_type) {
          handleActionResponse(action_type, message);
        } else {
          setMessages((prev) => [...prev, { sender: "ai", text: message, sources: sources?.results ?? [] }]);
        }
      }
    };
    ws.onclose = (e) => {
      if (e.code === 4001 || e.code === 4002 || e.code === 4003) return;
      setMessages((prev) => [...prev, { sender: "system", text: "⚠️ Bağlantı kesildi. Odaya tekrar girin." }]);
    };
    ws.onerror = () => setMessages((prev) => [...prev, { sender: "system", text: "⚠️ WebSocket bağlantı hatası." }]);
    wsRef.current = ws;
  }

  async function deleteRoom(id) {
    await fetch(`/api/chat/rooms/${id}/`, { method: "DELETE", headers: getAuthHeader() });
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (activeRoom?.id === id) { setActiveRoom(null); setShowHome(true); wsRef.current?.close(); }
  }

  function parseModel(selected) {
    if (selected.startsWith("ollama:")) return { provider: "ollama", model: selected.slice(7) };
    if (selected.startsWith("groq:"))   return { provider: "groq",   model: selected.slice(5) };
    return { provider: "openrouter", model: selected };
  }

  function sendMessage() {
    if (!inputValue.trim() || !wsRef.current) return;
    const text = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setIsTyping(true);
    const { provider, model } = parseModel(selectedModel);
    wsRef.current.send(JSON.stringify({
      type: "message", message: text, model, provider,
      excluded_doc_ids: Array.from(excludedDocs),
    }));
  }

  function handleActionResponse(actionType, rawContent) {
    const roomId = activeRoom?.id;
    if (actionType === "yolharitasi") {
      setActionPanel(null);
      try {
        const parsed = JSON.parse(rawContent);
        setRoadmapData(parsed);
        if (roomId) saveActionToStorage(roomId, "yolharitasi", parsed);
      } catch { setActionPanel({ type: "ozet", data: rawContent, loading: false }); }
    } else if (actionType === "test") {
      try {
        const parsed = JSON.parse(rawContent);
        setTestAnswers({});
        setTestSubmitted(false);
        setTestModal({ data: parsed, loading: false });
        setActionPanel(null);
        if (roomId) saveActionToStorage(roomId, "test", parsed);
      } catch {
        setActionPanel({ type: "ozet", data: rawContent, loading: false });
        setTestModal(null);
      }
    } else if (actionType === "ozet") {
      setActionPanel({ type: "ozet", data: rawContent, loading: false });
      if (roomId) saveActionToStorage(roomId, "ozet", rawContent);
    }
  }

  function handleTestAction(actionType) {
    if (!wsRef.current) return;
    const queryMap = {
      test: "belge içeriği soru cevap",
      ozet: "belge ana konular özet",
      yolharitasi: "konular sıra öğrenme",
    };
    if (actionType === "test") {
      setTestModal({ data: null, loading: true });
      setActionPanel(null);
    } else {
      setActionPanel({ type: actionType, data: null, loading: true });
    }
    const { provider, model } = parseModel(selectedModel);
    wsRef.current.send(JSON.stringify({
      type: "message", message: queryMap[actionType], model, provider, action: actionType,
      excluded_doc_ids: Array.from(excludedDocs),
    }));
  }

  function pollDocumentStatus(documentId, fileName) {
    const stepLabels = {
      text_extraction: "Metin çıkarılıyor", chunking: "Parçalanıyor",
      entity_extraction: "Entiteler çıkarılıyor", neo4j_write: "Graf yazılıyor",
      vector_write: "Vektörler hesaplanıyor",
    };
    const msgId = `poll_${documentId}`;
    setMessages((prev) => [...prev, { sender: "system", text: `⏳ "${fileName}" işleniyor...`, msgId }]);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/status/`, { headers: getAuthHeader() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.current_step === "completed") {
          clearInterval(interval);
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: "completed" } : d));
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `✅ "${fileName}" hazır!` } : m));
          fetchDocuments(activeRoom?.id);
        } else if (data.current_step === "failed") {
          clearInterval(interval);
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: "failed" } : d));
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `❌ "${fileName}" işlenemedi.` } : m));
        } else {
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: data.current_step } : d));
          const label = stepLabels[data.current_step] || data.current_step;
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `⏳ "${fileName}" — ${label}...` } : m));
        }
      } catch {}
    }, 3000);
  }

  function triggerFileUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.txt,.docx,.pptx,.ppt";
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      setShowModal(false);
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (activeRoom?.id) formData.append("room_id", activeRoom.id);
        try {
          const res = await fetch("/api/documents/", { method: "POST", headers: getAuthHeader(), body: formData });
          if (res.ok) {
            const doc = await res.json();
            setDocuments((prev) => [{ id: doc.document_id, file_name: file.name, status: "pending" }, ...prev]);
            pollDocumentStatus(doc.document_id, file.name);
          }
        } catch {}
      }
    };
    input.click();
  }

  function handleArxivSearch() {
    if (!arxivTopic.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "search_topic", topic: arxivTopic.trim(), max_results: 5 }));
    setArxivTopic("");
    setShowWebSearch(false);
    setIsTyping(true);
  }

  function toggleDocExclusion(id) {
    setExcludedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteDocument(id) {
    try {
      const res = await fetch(`/api/documents/${id}/`, { method: "DELETE", headers: getAuthHeader() });
      if (res.ok || res.status === 204) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setExcludedDocs((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } else {
        const body = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { sender: "system", text: `❌ Kaynak silinemedi: ${body.error || res.status}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { sender: "system", text: "❌ Kaynak silinirken bağlantı hatası oluştu." }]);
    }
  }

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/auth/logout/", {
          method: "POST",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch {}
    }
    removeToken();
    router.push("/login");
  }

  const avatarUrl = profilePhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileUsername || "U")}&background=7c3aed&color=fff`;
  const isWorkspaceActive = !!activeRoom;

  // --- Belge durumu ikonu ---
  function DocStatusIcon({ status }) {
    if (status === "pending" || (status && status !== "completed" && status !== "failed")) {
      return <span className="doc-spinner">⏳</span>;
    }
    if (status === "completed") return <span style={{ color: "#4ade80" }}>✅</span>;
    if (status === "failed") return <span style={{ color: "#f87171" }}>❌</span>;
    return <span>📄</span>;
  }

  return (
    <div className="workspace-wrapper">

      {/* Üst bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 2rem", background: "var(--panel-bg)", borderBottom: "1px solid rgba(255,255,255,0.1)", gap: "12px", flexWrap: "wrap" }}>
        <span
          onClick={() => { setActiveRoom(null); setShowHome(true); wsRef.current?.close(); }}
          style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--light-text)", cursor: "pointer", userSelect: "none" }}
        >
          🧠 Tualem AI
        </span>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(124,58,237,0.2)", color: "var(--light-text)", fontSize: "0.8rem", cursor: "pointer" }}
            >
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>)}
            </select>
            {(() => {
              const m = MODELS.find((x) => x.id === selectedModel);
              return m ? <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", paddingLeft: "2px" }}>{m.note}</span> : null;
            })()}
          </div>

          {isWorkspaceActive && rooms.length > 1 && (
            <select
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "var(--light-text)", fontSize: "0.85rem" }}
              value={activeRoom?.id ?? ""}
              onChange={(e) => { const room = rooms.find((r) => String(r.id) === e.target.value); if (room) openRoom(room); }}
            >
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}

          {!isWorkspaceActive && (
            <button onClick={openRoomSetup} style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,255,255,0.15)", color: "var(--light-text)", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
              + Yeni Oda
            </button>
          )}

          {/* Profil avatarı */}
          <img
            src={avatarUrl}
            alt="Profil"
            onClick={() => router.push("/profile")}
            style={{ width: 34, height: 34, borderRadius: "50%", cursor: "pointer", border: "2px solid rgba(255,255,255,0.3)", objectFit: "cover" }}
          />

          <button onClick={handleLogout} style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,0,0,0.2)", color: "var(--light-text)", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
            Çıkış
          </button>
        </div>
      </div>

      {/* --- HOME --- */}
      {showHome && !isWorkspaceActive && !showRoomSetup && !showModal && !showWebSearch && (
        <div style={{ paddingTop: "80px", minHeight: "100vh" }} onClick={() => setOpenMenuId(null)}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2.5rem 2rem" }}>

            {/* Hoş geldin */}
            <div style={{ marginBottom: "2.5rem" }}>
              <h1 style={{ color: "var(--light-text)", margin: "0 0 0.3rem", fontSize: "1.8rem", fontWeight: 800 }}>
                Merhaba, {profileFirstName || profileUsername} 👋
              </h1>
              <p style={{ color: "var(--light-muted)", margin: 0, fontSize: "0.95rem" }}>
                Araştırma seanslarına devam et veya yeni bir tane başlat.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ color: "var(--light-text)", margin: 0, fontSize: "1.1rem", fontWeight: 700, opacity: 0.8 }}>
                Not Defterlerim {rooms.length > 0 && <span style={{ fontSize: "0.85rem", opacity: 0.5 }}>({rooms.length})</span>}
              </h2>
              <button onClick={openRoomSetup} style={{ padding: "9px 20px", borderRadius: "8px", background: "rgba(124,58,237,0.8)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                + Yeni Not Defteri
              </button>
            </div>

            {rooms.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: "5rem" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📓</div>
                <p style={{ color: "var(--light-muted)", fontSize: "1.1rem" }}>Henüz not defteri yok.</p>
                <button onClick={openRoomSetup} style={{ marginTop: "1rem", padding: "10px 24px", borderRadius: "8px", background: "rgba(124,58,237,0.7)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  İlk not defterini oluştur
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
                {[...rooms].sort((a, b) => (favoritedRooms.has(b.id) ? 1 : 0) - (favoritedRooms.has(a.id) ? 1 : 0)).map((room) => {
                  const isFav = favoritedRooms.has(room.id);
                  const menuOpen = openMenuId === room.id;
                  return (
                    <div key={room.id} style={{ position: "relative" }}>
                      <div
                        onClick={() => openRoom(room)}
                        style={{ background: "var(--panel-bg)", borderRadius: "16px", padding: "2rem 1.75rem 1.5rem", border: `1px solid ${isFav ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`, cursor: "pointer", transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s", minHeight: "180px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: isFav ? "0 0 0 1px rgba(251,191,36,0.2)" : "none" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = isFav ? "rgba(251,191,36,0.7)" : "#7c3aed"; e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isFav ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = isFav ? "0 0 0 1px rgba(251,191,36,0.2)" : "none"; }}
                      >
                        <div>
                          <div style={{ fontSize: "2.2rem", marginBottom: "1rem" }}>{isFav ? "⭐" : "📓"}</div>
                          <h3 style={{ color: "var(--light-text)", margin: "0 0 0.5rem", fontSize: "1.05rem", fontWeight: 700, paddingRight: "2rem" }}>{room.title}</h3>
                          <p style={{ color: "var(--light-muted)", fontSize: "0.78rem", margin: 0 }}>
                            {new Date(room.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {/* 3 nokta butonu */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : room.id); }}
                        style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "6px", color: "var(--light-text)", cursor: "pointer", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", zIndex: 2 }}
                      >⋮</button>

                      {/* Dropdown menü */}
                      {menuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: "absolute", top: "42px", right: "8px", background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", padding: "6px", zIndex: 10, minWidth: "160px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                        >
                          {[
                            { icon: isFav ? "⭐" : "☆", label: isFav ? "Favoriden Kaldır" : "Favorilere Ekle", action: () => { toggleFavorite(room.id); setOpenMenuId(null); } },
                            { icon: "✏️", label: "Düzenle", action: () => openEditRoom(room) },
                            { icon: "🗑️", label: "Sil", action: () => { deleteRoom(room.id); setOpenMenuId(null); }, danger: true },
                          ].map((item) => (
                            <button key={item.label} onClick={item.action} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "9px 12px", background: "none", border: "none", borderRadius: "7px", color: item.danger ? "#f87171" : "rgba(255,255,255,0.85)", cursor: "pointer", fontSize: "0.82rem", textAlign: "left" }}
                              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
                              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                            >
                              <span>{item.icon}</span>{item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Oda kurulum modal */}
      {showRoomSetup && (
        <div className="modal-overlay">
          <div className="modal-content">
            {roomSetupStep === 1 ? (
              <div>
                <h3>Yeni Not Defteri</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", opacity: 0.8 }}>İsim</label>
                    <input type="text" className="chat-input" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && proceedToSourceStep()} placeholder="ör: Makine Öğrenmesi Notları" autoFocus />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", opacity: 0.8 }}>Model</label>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(124,58,237,0.2)", color: "var(--light-text)", fontSize: "0.85rem" }}>
                      {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
                    </select>
                  </div>
                  {roomError && <p style={{ color: "#ff6b6b", fontSize: "0.82rem" }}>{roomError}</p>}
                  <button className="web-add-submit-btn" onClick={proceedToSourceStep}>Devam →</button>
                </div>
              </div>
            ) : (
              <div>
                <h3>Kaynak Ekle</h3>
                <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "16px" }}>Hemen kaynak ekleyebilir veya geçebilirsiniz.</p>
                <div className="modal-options">
                  <button className="modal-opt-btn" onClick={() => finishSetup("file")}>📁 Dosya Yükle</button>
                  <button className="modal-opt-btn" onClick={() => finishSetup("arxiv")}>🔬 arXiv&apos;de Ara</button>
                  <button className="modal-opt-btn" style={{ opacity: 0.7 }} onClick={() => finishSetup("skip")}>Şimdilik Atla</button>
                </div>
              </div>
            )}
            <button className="modal-close-link" onClick={() => { setShowRoomSetup(false); setPendingRoom(null); }}>Kapat</button>
          </div>
        </div>
      )}

      {/* Kaynak modal */}
      {(showModal || showWebSearch) && (
        <div className="modal-overlay">
          <div className="modal-content">
            {showModal ? (
              <div>
                <h3>Yeni Kaynak Ekle</h3>
                <div className="modal-options">
                  <button className="modal-opt-btn" onClick={() => { setShowModal(false); triggerFileUpload(); }}>📁 Dosya Yükle</button>
                  <button className="modal-opt-btn" onClick={() => { setShowWebSearch(true); setShowModal(false); }}>🔬 arXiv&apos;de Ara</button>
                </div>
              </div>
            ) : (
              <div className="web-search-box">
                <h3>arXiv Literatür Araması</h3>
                <input type="text" className="chat-input" value={arxivTopic} onChange={(e) => setArxivTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleArxivSearch()} placeholder="Konu girin (ör: transformer models)" />
                <button className="web-add-submit-btn" onClick={handleArxivSearch}>Ara ve İndir</button>
              </div>
            )}
            <button className="modal-close-link" onClick={() => { setShowModal(false); setShowWebSearch(false); }}>Kapat</button>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {testModal && !testModal.loading && (
        <TestModal
          data={testModal.data}
          answers={testAnswers}
          setAnswers={setTestAnswers}
          submitted={testSubmitted}
          setSubmitted={setTestSubmitted}
          onClose={() => { setTestModal(null); setTestAnswers({}); setTestSubmitted(false); }}
        />
      )}
      {testModal?.loading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
          <div className="typing-dots"><span /><span /><span /></div>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>Test oluşturuluyor…</span>
        </div>
      )}

      {/* Yol Haritası Modal */}
      {roadmapData && <RoadmapModal data={roadmapData} onClose={() => setRoadmapData(null)} />}

      {/* Oda Düzenleme Modal */}
      {editingRoom && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--panel-bg)", borderRadius: "16px", padding: "24px", width: "min(420px, 90vw)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <h3 style={{ color: "var(--light-text)", margin: "0 0 16px", fontSize: "1rem" }}>✏️ Not Defterini Düzenle</h3>
            <input
              type="text"
              className="chat-input"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveRoomEdit()}
              style={{ width: "100%", marginBottom: "14px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setEditingRoom(null)} style={{ padding: "8px 16px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", border: "none", color: "var(--light-text)", cursor: "pointer" }}>İptal</button>
              <button onClick={saveRoomEdit} style={{ padding: "8px 20px", borderRadius: "8px", background: "rgba(124,58,237,0.8)", border: "none", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Kaynak Yöneticisi Tam Ekran */}
      {showSourcesFullscreen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#12121f", borderRadius: "20px", width: "min(640px, 100%)", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
              <h3 style={{ color: "#fff", margin: 0, fontSize: "1rem", fontWeight: 700 }}>📂 Kaynak Yöneticisi</h3>
              <button onClick={() => setShowSourcesFullscreen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", cursor: "pointer", width: 34, height: 34, fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {documents.length === 0 ? (
                <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: "2rem" }}>Henüz kaynak yok.</p>
              ) : (
                documents.map((d) => {
                  const excluded = excludedDocs.has(d.id);
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", background: excluded ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", borderRadius: "10px", marginBottom: "8px", border: "1px solid rgba(255,255,255,0.08)", opacity: excluded ? 0.5 : 1, transition: "opacity 0.2s" }}>
                      <DocStatusIcon status={d.status} />
                      <span style={{ flex: 1, fontSize: "0.88rem", color: "#fff", wordBreak: "break-all" }}>{d.file_name}</span>
                      <button onClick={() => toggleDocExclusion(d.id)} title={excluded ? "Dahil et" : "Çıkar"} style={{ background: excluded ? "rgba(255,165,0,0.15)" : "rgba(124,58,237,0.15)", border: "none", borderRadius: "6px", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: "4px 8px", fontSize: "0.75rem" }}>
                        {excluded ? "🔇" : "🔊"}
                      </button>
                      <button onClick={() => deleteDocument(d.id)} style={{ background: "rgba(248,113,113,0.1)", border: "none", borderRadius: "6px", color: "#f87171", cursor: "pointer", padding: "4px 10px", fontSize: "0.85rem" }}>×</button>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ padding: "14px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "10px", flexShrink: 0 }}>
              <button onClick={() => { triggerFileUpload(); setShowSourcesFullscreen(false); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(124,58,237,0.7)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>📁 Dosya Yükle</button>
              <button onClick={() => { setShowWebSearch(true); setShowSourcesFullscreen(false); }} style={{ flex: 1, padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>🔬 arXiv</button>
            </div>
          </div>
        </div>
      )}

      {/* Ana workspace */}
      {isWorkspaceActive && (
        <div className="dashboard-layout" style={{ paddingTop: "60px", gridTemplateColumns: `${leftCollapsed ? "48px" : "280px"} 1fr ${rightCollapsed ? "48px" : "280px"}`, transition: "grid-template-columns 0.25s ease" }}>

          {/* Sol panel */}
          <aside className="side-panel" style={{ overflow: leftCollapsed ? "hidden" : "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: leftCollapsed ? 0 : "10px" }}>
              {!leftCollapsed && <h4 style={{ margin: 0 }}>Kaynaklarım</h4>}
              <div style={{ display: "flex", gap: "4px", marginLeft: leftCollapsed ? 0 : "auto" }}>
                {!leftCollapsed && <button onClick={() => setShowSourcesFullscreen(true)} title="Tam ekran" style={{ background: "none", border: "none", color: "var(--light-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "2px 4px" }}>⤢</button>}
                <button onClick={() => setLeftCollapsed(!leftCollapsed)} title={leftCollapsed ? "Genişlet" : "Daralt"} style={{ background: "none", border: "none", color: "var(--light-muted)", cursor: "pointer", fontSize: "0.85rem", padding: "2px 4px" }}>
                  {leftCollapsed ? "▶" : "◀"}
                </button>
              </div>
            </div>
            {leftCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", paddingTop: "12px" }}>
                <button onClick={() => setShowSourcesFullscreen(true)} title="Kaynak Yöneticisi" style={{ background: "rgba(124,58,237,0.2)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1rem" }}>📂</button>
                <button onClick={() => setShowModal(true)} title="Kaynak Ekle" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1rem" }}>+</button>
              </div>
            ) : (
            <div className="source-list">
              {documents.length === 0 ? (
                <p className="no-source-text">Henüz kaynak eklenmedi.</p>
              ) : (
                documents.map((d) => {
                  const excluded = excludedDocs.has(d.id);
                  return (
                    <div
                      className="source-item"
                      key={d.id}
                      style={{ opacity: excluded ? 0.4 : 1, transition: "opacity 0.2s" }}
                    >
                      <span className="source-name-text" title={d.file_name}>
                        <DocStatusIcon status={d.status} />{" "}
                        {d.file_name}
                      </span>
                      <div className="source-actions">
                        <button
                          onClick={() => toggleDocExclusion(d.id)}
                          title={excluded ? "Sorguya dahil et" : "Sorgudan çıkar"}
                          style={{
                            background: excluded ? "rgba(255,165,0,0.2)" : "rgba(124,58,237,0.2)",
                            border: "none", borderRadius: "4px", color: "var(--light-muted)",
                            cursor: "pointer", padding: "2px 6px", fontSize: "0.7rem", marginRight: "4px",
                          }}
                        >
                          {excluded ? "🔇" : "🔊"}
                        </button>
                        <button onClick={() => deleteDocument(d.id)} className="delete-source-btn">×</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <button className="add-source-footer-btn" onClick={() => setShowModal(true)}>+ Yeni Kaynak</button>
            )}
          </aside>

          {/* Orta panel */}
          <section className="main-panel">
            <div className="chat-messages">
              {messages.map((m, i) => {
                if (m.sender === "system") {
                  return (
                    <div key={i} style={{ alignSelf: "center", maxWidth: "80%", textAlign: "center", padding: "6px 14px", borderRadius: "20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                      {m.text}
                    </div>
                  );
                }
                if (m.sender === "user") {
                  return (
                    <div key={i} style={{ alignSelf: "flex-end", maxWidth: "75%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <div style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", fontSize: "0.88rem", lineHeight: 1.55 }}>
                        {m.text}
                      </div>
                    </div>
                  );
                }
                // AI mesajı
                return (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "80%", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--light-text)", borderRadius: "4px 18px 18px 18px", padding: "10px 16px", fontSize: "0.88rem", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {m.text}
                    </div>
                    {m.sources?.length > 0 && <SourceBadges sources={m.sources} />}
                  </div>
                );
              })}
              {isTyping && (
                <div style={{ alignSelf: "flex-start", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px 18px 18px 18px", padding: "12px 18px" }}>
                  <div className="typing-dots"><span></span><span></span><span></span></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
              <input type="text" className="chat-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Sorunuzu yazın..." />
              <button className="send-btn-icon" onClick={sendMessage}>➤</button>
            </div>
          </section>

          {/* Sağ panel */}
          <aside className="tool-panel" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {rightCollapsed ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", paddingTop: "12px" }}>
                <button onClick={() => setRightCollapsed(false)} title="Genişlet" style={{ background: "none", border: "none", color: "var(--light-muted)", cursor: "pointer", fontSize: "0.85rem" }}>◀</button>
                <button onClick={() => handleTestAction("test")} title="Test" style={{ background: "rgba(124,58,237,0.2)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1rem" }}>📝</button>
                <button onClick={() => handleTestAction("ozet")} title="Özet" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1rem" }}>📋</button>
                <button onClick={() => handleTestAction("yolharitasi")} title="Yol Haritası" style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", width: 32, height: 32, fontSize: "1rem" }}>🗺️</button>
              </div>
            ) : actionPanel?.type === "ozet" ? (
              actionPanel.loading ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                  <div className="typing-dots"><span /><span /><span /></div>
                  <span style={{ fontSize: "0.8rem", color: "var(--light-muted)" }}>Özet çıkarılıyor…</span>
                </div>
              ) : (
                <OzetPanel content={actionPanel.data} onClose={() => setActionPanel(null)} />
              )
            ) : actionPanel?.type === "yolharitasi" && actionPanel.loading ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                <div className="typing-dots"><span /><span /><span /></div>
                <span style={{ fontSize: "0.8rem", color: "var(--light-muted)" }}>Yol haritası hazırlanıyor…</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexShrink: 0 }}>
                  <h4 style={{ margin: 0 }}>İşlemler</h4>
                  <button onClick={() => setRightCollapsed(true)} title="Daralt" style={{ background: "none", border: "none", color: "var(--light-muted)", cursor: "pointer", fontSize: "0.85rem" }}>▶</button>
                </div>
                <div className="action-buttons" style={{ flexShrink: 0 }}>
                  <button className="action-btn" onClick={() => handleTestAction("test")}>📝 Test Oluştur</button>
                  <button className="action-btn" onClick={() => handleTestAction("ozet")}>📋 Özet Çıkar</button>
                  <button className="action-btn" onClick={() => handleTestAction("yolharitasi")}>🗺️ Yol Haritası</button>
                </div>

                {/* Yol haritası hızlı erişim */}
                {roadmapData && (
                  <div style={{ flexShrink: 0, marginTop: "12px" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--light-muted)", marginBottom: "6px", fontWeight: 600, opacity: 0.7 }}>YOL HARİTASI</div>
                    <button onClick={() => setRoadmapData({ ...roadmapData })} style={{ width: "100%", padding: "10px 12px", background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", fontSize: "0.8rem", textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(124,58,237,0.2)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "rgba(124,58,237,0.12)"}
                    >
                      <span>🗺️</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roadmapData.title || "Yol Haritası"}</span>
                      <span style={{ opacity: 0.5, fontSize: "0.7rem" }}>↗</span>
                    </button>
                  </div>
                )}

                {/* Kaydedilen aksiyonlar */}
                {activeRoom && (savedActionsMap[activeRoom.id] || []).length > 0 && (
                  <div style={{ marginTop: "16px", flex: 1, overflowY: "auto" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--light-muted)", marginBottom: "8px", fontWeight: 600, opacity: 0.7 }}>GEÇMİŞ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {(savedActionsMap[activeRoom.id] || []).map((item, i) => (
                        <button key={i} onClick={() => {
                          if (item.type === "test") { setTestAnswers({}); setTestSubmitted(false); setTestModal({ data: item.data, loading: false }); }
                          else if (item.type === "yolharitasi") setRoadmapData(item.data);
                          else setActionPanel({ type: "ozet", data: item.data, loading: false });
                        }} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", fontSize: "0.75rem", textAlign: "left" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                        >
                          <span>{item.label}</span>
                          <span style={{ marginLeft: "auto", opacity: 0.4, fontSize: "0.68rem" }}>
                            {new Date(item.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
