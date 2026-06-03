"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, getAuthHeader, isAuthenticated, removeToken, getTokenPayload } from "@/library/auth";
import { getTheme, toggleTheme as toggleThemeFn } from "@/library/theme";
import { Icon } from "@/library/icons";
import { getPreference, applyAccent } from "@/library/preferences";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost";

const MODELS = [
  { id: "groq:llama-3.3-70b-versatile",   label: "Llama 3.3 70B",   note: "Güçlü · büyük belgeler",   provider: "Groq" },
  { id: "groq:llama-3.1-8b-instant",      label: "Llama 3.1 8B",    note: "Hızlı · küçük belgeler",   provider: "Groq" },
  { id: "groq:gemma2-9b-it",              label: "Gemma2 9B",       note: "Hızlı · küçük belgeler",   provider: "Groq" },
  { id: "ollama:qwen3.5:9b",              label: "Qwen3.5 9B",      note: "Yerel · orta",             provider: "Yerel" },
  { id: "ollama:llama3.2:3b",             label: "Llama 3.2 3B",    note: "Yerel · çok hızlı",        provider: "Yerel" },
  { id: "moonshotai/kimi-k2.6:free",      label: "Kimi K2.6",       note: "128K · büyük belgeler",    provider: "OpenRouter" },
  { id: "google/gemma-4-31b-it:free",     label: "Gemma 4 31B",     note: "128K · güçlü",             provider: "OpenRouter" },
  { id: "meta-llama/llama-4-scout:free",  label: "Llama 4 Scout",   note: "10M · devasa belgeler",    provider: "OpenRouter" },
];

const SRC_VARS = ["var(--src-1)", "var(--src-2)", "var(--src-3)", "var(--src-4)", "var(--src-5)"];
const srcColor = (i) => SRC_VARS[((i || 0) % 5 + 5) % 5];

// ============================================================
// Export helpers
// ============================================================
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
    `<style>body{font-family:Georgia,serif;padding:40px;max-width:760px;margin:0 auto;line-height:1.7}h1{border-bottom:2px solid #333;padding-bottom:10px}pre{white-space:pre-wrap;word-wrap:break-word;font-family:Georgia,serif}</style>` +
    `</head><body><h1>${title}</h1><pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`
  );
  win.document.close();
  setTimeout(() => win.print(), 500);
}
function exportDOC(content, title) {
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><pre>${content.replace(/</g, "&lt;")}</pre></body></html>`;
  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${title}.doc`; a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Kaynak rozetleri
// ============================================================
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
    <div className="src-badges">
      <span className="sb-label">kaynak</span>
      {entries.map(([docId, { file_name, chunks }], idx) => {
        const isHovered = hovered === docId;
        return (
          <div key={docId} style={{ position: "relative" }} onMouseEnter={() => setHovered(docId)} onMouseLeave={() => setHovered(null)}>
            <span className="src-badge" style={{ background: srcColor(idx) }}>{idx + 1}</span>
            {isHovered && (
              <div className="cite-pop">
                <div className="cp-head">
                  <span className="src-badge" style={{ background: srcColor(idx), border: 0 }}>{idx + 1}</span>
                  <span className="cp-nm">{file_name}</span>
                </div>
                {chunks.map((c, ci) => (
                  <div key={ci} className="cp-q" style={{ marginTop: ci > 0 ? 6 : 0 }}>
                    Parça {c.chunk_index + 1}: {c.content.slice(0, 140)}{c.content.length > 140 ? "…" : ""}
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

// ============================================================
// Test Modal
// ============================================================
function TestModal({ data, onClose }) {
  const qs = data?.questions ?? [];
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const q = qs[idx];
  const sel = answers[idx];

  const pick = (key) => { if (!revealed) setAnswers((a) => ({ ...a, [idx]: key })); };
  const check = () => setRevealed(true);
  const next = () => {
    if (idx + 1 < qs.length) { setIdx(idx + 1); setRevealed(false); }
    else setFinished(true);
  };

  const correct = qs.filter((qq, i) => answers[i] === qq.answer).length;
  const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
  const wrongTopics = qs.filter((qq, i) => answers[i] !== qq.answer).map((qq) => qq.question.split(" ").slice(0, 4).join(" "));
  const ringCirc = 2 * Math.PI * 64;

  const optState = (key) => {
    if (!revealed) return sel === key ? "selected" : "";
    if (key === q?.answer) return "correct";
    if (key === sel) return "wrong";
    return "";
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal quiz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="list-checks" size={20} /></span>
            <div><h2>Test</h2><div className="mh-sub">{finished ? "Sonuç" : `Soru ${idx + 1} / ${qs.length}`}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
            {!finished && (
              <div className="quiz-progress">
                <div className="qp-bar"><i style={{ width: ((idx + (revealed ? 1 : 0)) / qs.length * 100) + "%" }} /></div>
              </div>
            )}
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {!finished ? (
            q && (
              <div className="quiz-q">
                <div className="quiz-qnum">Soru {idx + 1}</div>
                <div className="quiz-qtext">{q.question}</div>
                <div className="quiz-opts">
                  {Object.entries(q.options || {}).map(([key, val]) => (
                    <button key={key} className="q-opt" data-s={optState(key)} disabled={revealed} onClick={() => pick(key)}>
                      <span className="q-key">{key}</span>
                      <span className="q-tx">{val}</span>
                      {revealed && key === q.answer && <span className="q-mark" style={{ color: "var(--ok)" }}><Icon name="check" size={18} /></span>}
                      {revealed && key === sel && key !== q.answer && <span className="q-mark" style={{ color: "var(--err)" }}><Icon name="x" size={18} /></span>}
                    </button>
                  ))}
                </div>
                {revealed && q.why && (
                  <div className="quiz-why">
                    <b>{sel === q.answer ? "Doğru. " : "Açıklama: "}</b>{q.why}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="quiz-result">
              <div className="score-ring">
                <svg width="150" height="150" viewBox="0 0 150 150">
                  <circle cx="75" cy="75" r="64" fill="none" stroke="var(--bg-sunken)" strokeWidth="11" />
                  <circle cx="75" cy="75" r="64" fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - pct / 100)} transform="rotate(-90 75 75)" style={{ transition: "stroke-dashoffset 0.6s var(--ease)" }} />
                </svg>
                <div className="pct"><span className="n">{pct}%</span><span className="l">Skor</span></div>
              </div>
              <h2 className="serif" style={{ fontSize: "var(--text-xl)", marginBottom: 6 }}>
                {pct >= 75 ? "Çok iyi!" : pct >= 50 ? "Fena değil" : "Tekrar çalışmalı"}
              </h2>
              <div className="result-breakdown">
                <div className="rb"><Icon name="check-circle" size={18} style={{ color: "var(--ok)" }} /><span className="num" style={{ color: "var(--ok)" }}>{correct}</span> doğru</div>
                <div className="rb"><Icon name="x-circle" size={18} style={{ color: "var(--err)" }} /><span className="num" style={{ color: "var(--err)" }}>{qs.length - correct}</span> yanlış</div>
              </div>
              {wrongTopics.length > 0 && (
                <div className="weak-topics">
                  <div className="wt-label">Tekrar edilecek konular</div>
                  {wrongTopics.map((t, i) => <span key={i} className="weak-chip"><Icon name="book-open" size={13} />{t}…</span>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          {!finished ? (
            !revealed
              ? <button className="btn btn-primary" disabled={sel == null} onClick={check} style={sel == null ? { opacity: 0.5, cursor: "not-allowed" } : {}}>Kontrol et</button>
              : <button className="btn btn-primary" onClick={next}>{idx + 1 < qs.length ? "Sonraki soru" : "Sonucu gör"}<Icon name="arrow-right" size={16} /></button>
          ) : (
            <button className="btn btn-secondary" onClick={() => { setIdx(0); setAnswers({}); setRevealed(false); setFinished(false); }}>
              <Icon name="loader" size={16} />Tekrar dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Yol Haritası Modal
// ============================================================
function RoadmapModal({ data, onClose }) {
  const [steps, setSteps] = useState(() =>
    (data?.steps ?? []).map((s) => ({ ...s, done: false, subs: (s.substeps ?? []).map((x) => ({ ...x, done: false })) }))
  );
  const toggleStep = (i) => setSteps((s) => s.map((st, j) => j === i ? { ...st, done: !st.done, subs: st.subs.map((x) => ({ ...x, done: !st.done })) } : st));
  const toggleSub = (i, j) => setSteps((s) => s.map((st, k) => {
    if (k !== i) return st;
    const subs = st.subs.map((x, m) => m === j ? { ...x, done: !x.done } : x);
    return { ...st, subs, done: subs.length > 0 && subs.every((x) => x.done) };
  }));
  const totalSubs = steps.reduce((a, s) => a + s.subs.length, 0);
  const doneSubs = steps.reduce((a, s) => a + s.subs.filter((x) => x.done).length, 0);
  const totalUnits = totalSubs || steps.length;
  const doneUnits = totalSubs ? doneSubs : steps.filter((s) => s.done).length;
  const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal road-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="route" size={20} /></span>
            <div><h2>{data?.title || "Öğrenme Yol Haritası"}</h2><div className="mh-sub">{doneUnits} / {totalUnits} adım tamamlandı</div></div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="road-overall">
          <div className="ro-top"><span style={{ color: "var(--text-muted)" }}>Genel ilerleme</span><span className="mono" style={{ fontWeight: 600 }}>{pct}%</span></div>
          <div className="ro-bar"><i style={{ width: pct + "%" }} /></div>
        </div>
        <div className="modal-body" style={{ paddingTop: "var(--sp-2)" }}>
          <div className="road-steps">
            {steps.map((st, i) => (
              <div key={i} className={`road-step${st.done ? " done" : ""}`}>
                <div className={`step-check${st.done ? " done" : ""}`} onClick={() => toggleStep(i)}><Icon name="check" size={16} /></div>
                <div className="step-main">
                  <div className={`step-title${st.done ? " done" : ""}`}>{st.title}</div>
                  {st.description && <div className="step-desc">{st.description}</div>}
                  {st.duration && <div className="step-duration"><Icon name="clock" size={11} />{st.duration}</div>}
                  {st.subs.map((sub, j) => (
                    <div key={j} className={`substep${sub.done ? " done" : ""}`} onClick={() => toggleSub(i, j)}>
                      <span className={`sc${sub.done ? " done" : ""}`}><Icon name="check" size={12} /></span>
                      <span>
                        <span className="st-tt">{sub.title}</span>
                        {sub.detail && <span className="st-dt"> — {sub.detail}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Özet Modal
// ============================================================
function SummaryModal({ content, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal sum-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="file-text" size={20} /></span>
            <div><h2>Çalışma Özeti</h2><div className="mh-sub">kaynaklardan derlendi</div></div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body sum-body">{content}</div>
        <div className="modal-foot">
          <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>İndirme formatı</span>
          <div className="dl-group">
            <button className="dl-btn" onClick={() => exportMD(content, "tualem-ozet.md")}><Icon name="download" size={14} />MD</button>
            <button className="dl-btn" onClick={() => exportPDF(content, "Çalışma Özeti")}><Icon name="download" size={14} />PDF</button>
            <button className="dl-btn" onClick={() => exportDOC(content, "Çalışma Özeti")}><Icon name="download" size={14} />DOC</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Kaynak listesi
// ============================================================
function SourcesList({ documents, excludedDocs, onToggle, onDelete }) {
  const statusMap = {
    completed: { cls: "st-ready", icon: "check-circle", label: "Hazır" },
    failed: { cls: "st-error", icon: "alert-circle", label: "Hata" },
  };
  return (
    <>
      {documents.map((d) => {
        const excluded = excludedDocs.has(d.id);
        const isProcessing = d.status !== "completed" && d.status !== "failed";
        const st = isProcessing ? { cls: "st-processing", icon: "loader", label: "İşleniyor", spin: true } : statusMap[d.status] || statusMap.completed;
        const ext = (d.file_name || "").split(".").pop().toLowerCase();
        const icon = ext === "pptx" || ext === "ppt" ? "layers" : "file-text";
        return (
          <div key={d.id} className={`src-item${excluded ? " excluded" : ""}`}>
            <div className="src-dot" style={{ background: srcColor((d.file_name || "").length) }}><Icon name={icon} size={15} /></div>
            <div className="src-main">
              <div className="src-name" title={d.file_name}>{d.file_name}</div>
              <div className="src-sub">
                <span className="src-type">{ext}</span>
                <span className={`status ${st.cls}`}><Icon name={st.icon} size={11} className={st.spin ? "spin" : ""} />{st.label}</span>
              </div>
            </div>
            <div className="src-actions">
              <button className={`tg${excluded ? "" : " on"}`} title={excluded ? "Sorguya dahil et" : "Sorgudan çıkar"} onClick={() => onToggle(d.id)} />
              <button className="icon-btn" style={{ padding: 4 }} title="Sil" onClick={() => onDelete(d.id)}><Icon name="trash" size={15} /></button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ============================================================
// Composer
// ============================================================
function Composer({ value, setValue, onSend, disabled, onAttach, sourceCount }) {
  const ref = useRef(null);
  const grow = (el) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; };
  const submit = () => { const t = value.trim(); if (!t || disabled) return; onSend(); if (ref.current) ref.current.style.height = "auto"; };
  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        <div className="composer">
          <button className="icon-btn" title="Belge ekle" style={{ marginBottom: 2 }} onClick={onAttach}><Icon name="paperclip" size={18} /></button>
          <textarea ref={ref} rows={1} placeholder="Kaynaklarınıza bir soru sorun…" value={value}
            onChange={(e) => { setValue(e.target.value); grow(e.target); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button className="send" onClick={submit} disabled={!value.trim() || disabled}><Icon name="arrow-up" size={18} /></button>
        </div>
        <div className="composer-hint">
          <span>{sourceCount} kaynak aktif</span>
          <span>↵ gönder · ⇧↵ yeni satır</span>
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay({ label }) {
  return (
    <div className="overlay">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span className="spin" style={{ color: "var(--accent)", display: "flex" }}><Icon name="loader" size={32} /></span>
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{label}</span>
      </div>
    </div>
  );
}

// ============================================================
// Ana sayfa
// ============================================================
export default function DashboardPage() {
  const router = useRouter();

  const [theme, setTheme] = useState("dark");
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHome, setShowHome] = useState(true);

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileFirstName, setProfileFirstName] = useState("");

  const [query, setQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [favoritedRooms, setFavoritedRooms] = useState(new Set());
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const [selectedModel, setSelectedModel] = useState("groq:llama-3.3-70b-versatile");

  const [showRoomSetup, setShowRoomSetup] = useState(false);
  const [roomSetupStep, setRoomSetupStep] = useState(1);
  const [newRoomName, setNewRoomName] = useState("");
  const [roomError, setRoomError] = useState("");
  const [pendingRoom, setPendingRoom] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [arxivTopic, setArxivTopic] = useState("");

  const [excludedDocs, setExcludedDocs] = useState(new Set());
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showSourcesFullscreen, setShowSourcesFullscreen] = useState(false);

  const [savedActionsMap, setSavedActionsMap] = useState({});
  const [testModal, setTestModal] = useState(null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [summaryPanel, setSummaryPanel] = useState(null);
  const [layout, setLayout] = useState(() => getPreference("layout", "klasik"));
  const [odakSlideover, setOdakSlideover] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const actionMsgIdRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    setTheme(getTheme());
    applyAccent(getPreference("accent", "amber"));
    try { setFavoritedRooms(new Set(JSON.parse(localStorage.getItem("tualem_favorites") || "[]"))); } catch {}
    const payload = getTokenPayload();
    if (payload) setProfileUsername(payload.username || "");
    fetchRooms();
    fetchProfile();
  }, [router]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => () => wsRef.current?.close(), []);
  useEffect(() => { if (layout !== "odak") setOdakSlideover(null); }, [layout]);

  async function fetchRooms() {
    try {
      const res = await fetch("/api/chat/rooms/", { headers: getAuthHeader() });
      if (res.ok) {
        const d = await res.json();
        const list = d.results ?? d;
        console.log("[fetchRooms] raw:", JSON.stringify(list).slice(0, 300));
        setRooms(Array.isArray(list) ? list : []);
      }
    } catch (e) { console.error("[fetchRooms] error:", e); }
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

  function toggleTheme() { setTheme(toggleThemeFn()); }

  function toggleFavorite(roomId) {
    setFavoritedRooms((prev) => {
      const next = new Set(prev);
      next.has(roomId) ? next.delete(roomId) : next.add(roomId);
      try { localStorage.setItem("tualem_favorites", JSON.stringify([...next])); } catch {}
      return next;
    });
  }
  function openEditRoom(room) { setEditingRoom(room); setEditingTitle(room.title); setOpenMenuId(null); }
  async function saveRoomEdit() {
    if (!editingRoom || !editingTitle.trim()) return;
    try {
      const res = await fetch(`/api/chat/rooms/${editingRoom.id}/`, {
        method: "PATCH", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
      const label = { test: "Test", ozet: "Özet", yolharitasi: "Yol Haritası" }[type] || type;
      const entry = { type, data, label, timestamp: Date.now() };
      const updated = [entry, ...existing].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(updated));
      setSavedActionsMap((prev) => ({ ...prev, [roomId]: updated }));
    } catch {}
  }

  function openRoomSetup() { setNewRoomName(""); setRoomError(""); setRoomSetupStep(1); setShowRoomSetup(true); }

  async function proceedToSourceStep() {
    const name = newRoomName.trim();
    if (!name) { setRoomError("Sohbet ismi gerekli."); return; }
    setRoomError("");
    try {
      const res = await fetch("/api/chat/rooms/", {
        method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
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
    const room = pendingRoom;
    openRoom(room);
    setShowHome(false);
    setPendingRoom(null);
    if (sourceChoice === "file") setTimeout(() => triggerFileUpload(room), 300);
    else if (sourceChoice === "arxiv") setTimeout(() => setShowWebSearch(true), 300);
  }

  function resetActionState() {
    setTestModal(null); setRoadmapData(null); setSummaryPanel(null);
  }

  function openRoom(room) {
    wsRef.current?.close();
    setActiveRoom(room);
    setShowHome(false);
    setMessages([{ sender: "system", text: "Sohbete hoş geldiniz · soru sorun veya kaynak ekleyin" }]);
    resetActionState();
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
      if (role === "system") return;
      setIsTyping(false);
      if (role === "assistant" && !is_streaming && message) {
        if (action_type) handleActionResponse(action_type, message);
        else setMessages((prev) => [...prev, { sender: "ai", text: message, sources: sources?.results ?? [] }]);
      }
    };
    ws.onclose = (e) => {
      console.warn("[WS] closed | code=" + e.code + " reason=" + e.reason);
      if (e.code === 4001 || e.code === 4002 || e.code === 4003) return;
      setMessages((prev) => [...prev, { sender: "system", text: `Bağlantı kesildi (${e.code}). Odaya tekrar girin.` }]);
    };
    ws.onerror = (e) => {
      console.error("[WS] error", e);
      setMessages((prev) => [...prev, { sender: "system", text: `WebSocket bağlantı hatası — ${WS_BASE}/ws/graph/chat/${room.id}/` }]);
    };
    wsRef.current = ws;
  }

  async function deleteRoom(id) {
    console.log("[deleteRoom] called with id=", id, typeof id);
    if (!id || id === "undefined") { console.warn("[deleteRoom] blocked undefined id"); return; }
    await fetch(`/api/chat/rooms/${id}/`, { method: "DELETE", headers: getAuthHeader() });
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (activeRoom?.id === id) { setActiveRoom(null); setShowHome(true); wsRef.current?.close(); }
  }

  function parseModel(selected) {
    if (selected.startsWith("ollama:")) return { provider: "ollama", model: selected.slice(7) };
    if (selected.startsWith("groq:")) return { provider: "groq", model: selected.slice(5) };
    return { provider: "openrouter", model: selected };
  }

  function sendMessage() {
    if (!inputValue.trim() || !wsRef.current) return;
    const text = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setIsTyping(true);
    const { provider, model } = parseModel(selectedModel);
    wsRef.current.send(JSON.stringify({ type: "message", message: text, model, provider, excluded_doc_ids: Array.from(excludedDocs) }));
  }

  function handleActionResponse(actionType, rawContent) {
    const roomId = activeRoom?.id;
    const msgId = actionMsgIdRef.current;
    const updMsg = (text) => { if (msgId) setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text } : m)); };
    if (actionType === "yolharitasi") {
      try { const parsed = JSON.parse(rawContent); setRoadmapData(parsed); if (roomId) saveActionToStorage(roomId, "yolharitasi", parsed); updMsg("Yol haritası hazır — İşlemler panelinden açabilirsiniz."); }
      catch { setSummaryPanel({ content:rawContent }); updMsg("Yol haritası verisi işlenemedi, ham metin gösteriliyor."); }
    } else if (actionType === "test") {
      try { const parsed = JSON.parse(rawContent); setTestModal({ data:parsed }); if (roomId) saveActionToStorage(roomId, "test", parsed); updMsg("Test hazır."); }
      catch { setSummaryPanel({ content:rawContent }); setTestModal(null); updMsg("Test verisi işlenemedi, ham metin gösteriliyor."); }
    } else if (actionType === "ozet") {
      setSummaryPanel({ content: rawContent });
      if (roomId) saveActionToStorage(roomId, "ozet", rawContent);
      updMsg("Özet hazır.");
    }
  }

  function handleAction(actionType) {
    if (!wsRef.current) return;
    const queryMap = { test: "belge içeriği soru cevap", ozet: "belge ana konular özet", yolharitasi: "konular sıra öğrenme" };
    const msgLabels = { test: "Test oluşturuluyor…", ozet: "Özet çıkarılıyor…", yolharitasi: "Yol haritası hazırlanıyor…" };
    const msgId = `action_${Date.now()}`;
    actionMsgIdRef.current = msgId;
    setMessages((prev) => [...prev, { sender: "system", text: msgLabels[actionType] || "İşlem başlatılıyor…", msgId }]);
    const { provider, model } = parseModel(selectedModel);
    wsRef.current.send(JSON.stringify({ type: "message", message: queryMap[actionType], model, provider, action: actionType, excluded_doc_ids: Array.from(excludedDocs) }));
  }

  function pollDocumentStatus(documentId, fileName) {
    const stepLabels = { text_extraction: "Metin çıkarılıyor", chunking: "Parçalanıyor", entity_extraction: "Entiteler çıkarılıyor", neo4j_write: "Graf yazılıyor", vector_write: "Vektörler hesaplanıyor" };
    const msgId = `poll_${documentId}`;
    setMessages((prev) => [...prev, { sender: "system", text: `"${fileName}" işleniyor…`, msgId }]);
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/status/`, { headers: getAuthHeader() });
        if (!res.ok) return;
        const data = await res.json();
        if (data.current_step === "completed") {
          clearInterval(interval);
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: "completed" } : d));
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `"${fileName}" hazır` } : m));
          fetchDocuments(activeRoom?.id);
        } else if (data.current_step === "failed") {
          clearInterval(interval);
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: "failed" } : d));
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `"${fileName}" işlenemedi` } : m));
        } else {
          setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, status: data.current_step } : d));
          const label = stepLabels[data.current_step] || data.current_step;
          setMessages((prev) => prev.map((m) => m.msgId === msgId ? { ...m, text: `"${fileName}" — ${label}…` } : m));
        }
      } catch {}
    }, 3000);
  }

  function triggerFileUpload(roomOverride) {
    const room = roomOverride ?? activeRoom;
    const input = document.createElement("input");
    input.type = "file"; input.multiple = true; input.accept = ".pdf,.txt,.docx,.pptx,.ppt";
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      setShowModal(false); setShowSourcesFullscreen(false);
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        if (room?.id) formData.append("room_id", room.id);
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
    setArxivTopic(""); setShowWebSearch(false); setIsTyping(true);
  }

  function toggleDocExclusion(id) {
    setExcludedDocs((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  async function deleteDocument(id) {
    try {
      const res = await fetch(`/api/documents/${id}/`, { method: "DELETE", headers: getAuthHeader() });
      if (res.ok || res.status === 204) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        setExcludedDocs((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } else {
        const body = await res.json().catch(() => ({}));
        setMessages((prev) => [...prev, { sender: "system", text: `Kaynak silinemedi: ${body.error || res.status}` }]);
      }
    } catch {
      setMessages((prev) => [...prev, { sender: "system", text: "Kaynak silinirken bağlantı hatası." }]);
    }
  }

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try { await fetch("/api/auth/logout/", { method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); } catch {}
    }
    removeToken();
    router.push("/login");
  }

  const isWorkspaceActive = !!activeRoom;
  const initials = (profileFirstName || profileUsername || "K").slice(0, 2).toUpperCase();
  const readyCount = documents.filter((d) => d.status === "completed" && !excludedDocs.has(d.id)).length;
  const isEmpty = documents.length === 0;
  const savedActions = activeRoom ? (savedActionsMap[activeRoom.id] || []) : [];

  const Avatar = ({ size = 34 }) => (
    <div className="avatar" onClick={() => router.push("/profile")} title="Profil" style={{ width: size, height: size }}>
      {profilePhoto ? <img src={profilePhoto} alt="" /> : initials}
    </div>
  );

  function renderModals() {
    return (
      <>
        {showRoomSetup && (
          <div className="overlay" onClick={() => { setShowRoomSetup(false); setPendingRoom(null); }}>
            <div className="modal" style={{ width: "min(440px, 94vw)", padding: "var(--sp-6)" }} onClick={(e) => e.stopPropagation()}>
              {roomSetupStep === 1 ? (
                <>
                  <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--sp-4)" }}>Yeni Not Defteri</h2>
                  <div className="form-rows">
                    <div className="field">
                      <label>İsim</label>
                      <div className="input"><Icon name="book-open" size={16} /><input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && proceedToSourceStep()} placeholder="ör: Makine Öğrenmesi Notları" autoFocus /></div>
                    </div>
                    <div className="field">
                      <label>Model</label>
                      <select className="ws-model" style={{ maxWidth: "100%", width: "100%" }} value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                        {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.note}</option>)}
                      </select>
                    </div>
                    {roomError && <div className="auth-error">{roomError}</div>}
                    <button className="btn btn-primary btn-block" onClick={proceedToSourceStep}>Devam<Icon name="arrow-right" size={16} /></button>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: "var(--text-xl)", marginBottom: 6 }}>Kaynak Ekle</h2>
                  <p className="lede" style={{ marginBottom: "var(--sp-5)" }}>Hemen kaynak ekleyin veya geçin.</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn btn-secondary btn-block" onClick={() => finishSetup("file")}><Icon name="upload" size={16} />Dosya Yükle</button>
                    <button className="btn btn-secondary btn-block" onClick={() => finishSetup("arxiv")}><Icon name="globe" size={16} />arXiv'de Ara</button>
                    <button className="btn btn-ghost btn-block" onClick={() => finishSetup("skip")}>Şimdilik Atla</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {(showModal || showWebSearch) && (
          <div className="overlay" onClick={() => { setShowModal(false); setShowWebSearch(false); }}>
            <div className="modal" style={{ width: "min(440px, 94vw)", padding: "var(--sp-6)" }} onClick={(e) => e.stopPropagation()}>
              {showWebSearch ? (
                <>
                  <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--sp-4)" }}>arXiv Literatür Araması</h2>
                  <div className="field" style={{ marginBottom: "var(--sp-4)" }}>
                    <div className="input"><Icon name="search" size={16} /><input value={arxivTopic} onChange={(e) => setArxivTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleArxivSearch()} placeholder="Konu (ör: transformer models)" autoFocus /></div>
                  </div>
                  <button className="btn btn-primary btn-block" onClick={handleArxivSearch}><Icon name="download" size={16} />Ara ve İndir</button>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: "var(--text-xl)", marginBottom: "var(--sp-4)" }}>Yeni Kaynak Ekle</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button className="btn btn-secondary btn-block" onClick={() => { setShowModal(false); triggerFileUpload(); }}><Icon name="upload" size={16} />Dosya Yükle</button>
                    <button className="btn btn-secondary btn-block" onClick={() => { setShowWebSearch(true); setShowModal(false); }}><Icon name="globe" size={16} />arXiv'de Ara</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {editingRoom && (
          <div className="overlay" onClick={() => setEditingRoom(null)}>
            <div className="modal" style={{ width: "min(420px, 94vw)", padding: "var(--sp-6)" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--sp-4)" }}>Not Defterini Düzenle</h2>
              <div className="field" style={{ marginBottom: "var(--sp-4)" }}>
                <div className="input"><Icon name="pencil" size={16} /><input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveRoomEdit()} autoFocus /></div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={() => setEditingRoom(null)}>İptal</button>
                <button className="btn btn-primary" onClick={saveRoomEdit}>Kaydet</button>
              </div>
            </div>
          </div>
        )}

        {showSourcesFullscreen && (
          <div className="overlay" onClick={() => setShowSourcesFullscreen(false)}>
            <div className="modal" style={{ width: "min(640px, 94vw)", maxHeight: "86vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <div className="mh-lt"><span className="mh-ic"><Icon name="folder" size={18} /></span><div><h2>Kaynak Yöneticisi</h2><div className="mh-sub">{documents.length} kaynak</div></div></div>
                <button className="icon-btn" onClick={() => setShowSourcesFullscreen(false)}><Icon name="x" size={18} /></button>
              </div>
              <div className="modal-body" style={{ padding: "var(--sp-5) var(--sp-6)" }}>
                {isEmpty ? <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Henüz kaynak yok.</p>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><SourcesList documents={documents} excludedDocs={excludedDocs} onToggle={toggleDocExclusion} onDelete={deleteDocument} /></div>}
              </div>
              <div className="modal-foot">
                <button className="btn btn-secondary" onClick={triggerFileUpload}><Icon name="upload" size={16} />Dosya Yükle</button>
                <button className="btn btn-secondary" onClick={() => { setShowWebSearch(true); setShowSourcesFullscreen(false); }}><Icon name="globe" size={16} />arXiv</button>
              </div>
            </div>
          </div>
        )}

        {testModal && <TestModal data={testModal.data} onClose={() => setTestModal(null)} />}
        {roadmapData && <RoadmapModal data={roadmapData} onClose={() => setRoadmapData(null)} />}
        {summaryPanel && <SummaryModal content={summaryPanel.content} onClose={() => setSummaryPanel(null)} />}
      </>
    );
  }

  // ---------- HOME ----------
  if (showHome && !isWorkspaceActive) {
    const filtered = rooms.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()));
    const favs = filtered.filter((r) => favoritedRooms.has(r.id));
    const rest = filtered.filter((r) => !favoritedRooms.has(r.id));

    const Card = (room) => {
      const isFav = favoritedRooms.has(room.id);
      const menuOpen = openMenuId === room.id;
      return (
        <div className="nb-card" key={room.id} onClick={() => openRoom(room)}>
          <div className="nb-top">
            <div className="nb-ic" style={{ background: `color-mix(in oklab, ${srcColor(room.title.length)} 18%, transparent)`, color: srcColor(room.title.length) }}>
              <Icon name="book-open" size={20} />
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <button className={`icon-btn fav-star${isFav ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFavorite(room.id); }} title="Favori">
                <Icon name="star" size={17} style={isFav ? { fill: "currentColor" } : {}} />
              </button>
              <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : room.id); }} title="Menü">
                <Icon name="more-vertical" size={17} />
              </button>
            </div>
          </div>
          <h3>{room.title}</h3>
          <div className="nb-meta">
            <Icon name="clock" size={13} />
            <span>{room.created_at ? new Date(room.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—"}</span>
          </div>
          {menuOpen && (
            <div className="menu" style={{ top: 44, right: 12 }} onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { toggleFavorite(room.id); setOpenMenuId(null); }}><Icon name="star" size={16} />{isFav ? "Favoriden çıkar" : "Favorile"}</button>
              <button onClick={() => openEditRoom(room)}><Icon name="pencil" size={16} />Yeniden adlandır</button>
              <div className="sep" />
              <button className="danger" onClick={() => { deleteRoom(room.id); setOpenMenuId(null); }}><Icon name="trash" size={16} />Sil</button>
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="app-root">
        <div className="app-shell" onClick={() => setOpenMenuId(null)}>
          <div className="topnav">
            <div className="brand"><span className="logo"><Icon name="network" size={24} /></span><span className="wm">Tualem<small>AI</small></span></div>
            <div className="right">
              <button className="icon-btn" onClick={toggleTheme} title="Tema"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
              <button className="icon-btn" onClick={handleLogout} title="Çıkış"><Icon name="log-out" size={18} /></button>
              <Avatar />
            </div>
          </div>
          <div className="home-scroll">
            <div className="home-wrap">
              <h1 className="greeting">Merhaba, {profileFirstName || profileUsername} <span className="wave">👋</span></h1>
              <p className="home-sub">Kaldığınız yerden devam edin ya da yeni bir çalışma seansı başlatın.</p>

              <div className="home-toolbar">
                <div className="search-box"><Icon name="search" size={16} /><input placeholder="Not defterlerinde ara…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <button className="btn btn-primary" onClick={openRoomSetup}><Icon name="plus" size={16} />Yeni not defteri</button>
              </div>

              {rooms.length === 0 ? (
                <div className="empty-state">
                  <div className="es-ic"><Icon name="book-open" size={28} /></div>
                  <h3>Henüz not defteriniz yok</h3>
                  <p>İlk araştırma seansınızı başlatın: belgelerinizi yükleyin, arXiv makalelerini ekleyin ve kaynaklarınıza soru sormaya başlayın.</p>
                  <button className="btn btn-primary btn-lg" onClick={openRoomSetup}><Icon name="plus" size={18} />İlk not defterini oluştur</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-search"><div className="es-ic"><Icon name="search" size={32} /></div><div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>"{query}" için sonuç yok</div></div>
              ) : (
                <>
                  {favs.length > 0 && (
                    <>
                      <div className="section-label"><Icon name="star" size={13} style={{ fill: "currentColor", color: "var(--accent)" }} />Favoriler<span className="ln" /></div>
                      <div className="nb-grid">{favs.map(Card)}</div>
                    </>
                  )}
                  <div className="section-label"><Icon name="folder" size={13} />Tüm not defterleri<span className="ln" /></div>
                  <div className="nb-grid">
                    {rest.map(Card)}
                    <div className="nb-card nb-new" onClick={openRoomSetup}>
                      <div className="plus-circ"><Icon name="plus" size={20} /></div>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Yeni not defteri</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {renderModals()}
      </div>
    );
  }

  // ---------- WORKSPACE ----------
  const sourcesPanel = (
    <div className="panel panel-sources" style={{ width: leftCollapsed ? 52 : 304 }}>
      {leftCollapsed ? (
        <div className="collapsed-rail">
          <button className="icon-btn" onClick={() => setLeftCollapsed(false)} title="Genişlet"><Icon name="panel-left" size={16} /></button>
          <button className="icon-btn" onClick={() => setShowSourcesFullscreen(true)} title="Kaynak Yöneticisi"><Icon name="folder" size={16} /></button>
          <button className="icon-btn" onClick={() => setShowModal(true)} title="Kaynak ekle"><Icon name="plus" size={16} /></button>
        </div>
      ) : (
        <>
          <div className="panel-head">
            <div className="lt"><Icon name="folder" size={15} style={{ color: "var(--text-muted)" }} /><span className="ttl">Kaynaklar</span><span className="cnt">{documents.length}</span></div>
            <div style={{ display: "flex", gap: 2 }}>
              <button className="icon-btn" title="Tam ekran" onClick={() => setShowSourcesFullscreen(true)}><Icon name="maximize" size={16} /></button>
              <button className="icon-btn" title="Daralt" onClick={() => setLeftCollapsed(true)}><Icon name="panel-left" size={16} /></button>
            </div>
          </div>
          <div className="panel-scroll" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {isEmpty
              ? <div className="src-empty"><div className="se-ic"><Icon name="folder" size={30} /></div><div className="se-t">Henüz kaynak yok</div><div className="se-d">Belge yükleyin veya arXiv makalesi ekleyin.</div></div>
              : <SourcesList documents={documents} excludedDocs={excludedDocs} onToggle={toggleDocExclusion} onDelete={deleteDocument} />}
          </div>
          <div className="src-foot">
            <div className="upload-zone" onClick={() => setShowModal(true)}>
              <Icon name="upload" size={20} /><div className="uz-t">Belge ekle</div><div className="uz-d">PDF · DOCX · PPTX · arXiv</div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const actionsPanel = (
    <div className="panel panel-actions" style={{ width: rightCollapsed ? 52 : 324 }}>
      {rightCollapsed ? (
        <div className="collapsed-rail">
          <button className="icon-btn" onClick={() => setRightCollapsed(false)} title="Genişlet"><Icon name="panel-right" size={16} /></button>
          <button className="icon-btn" onClick={() => handleAction("test")} title="Test"><Icon name="list-checks" size={16} /></button>
          <button className="icon-btn" onClick={() => handleAction("ozet")} title="Özet"><Icon name="file-text" size={16} /></button>
          <button className="icon-btn" onClick={() => handleAction("yolharitasi")} title="Yol Haritası"><Icon name="route" size={16} /></button>
        </div>
      ) : (
        <>
          <div className="panel-head">
            <div className="lt"><Icon name="sparkles" size={15} style={{ color: "var(--text-muted)" }} /><span className="ttl">İşlemler</span></div>
            <button className="icon-btn" title="Daralt" onClick={() => setRightCollapsed(true)}><Icon name="panel-right" size={16} /></button>
          </div>
          <div className="panel-scroll">
            {isEmpty && <div className="actions-hint"><Icon name="alert-circle" size={15} style={{ flex: "0 0 auto", marginTop: 1 }} />Test, özet ve yol haritası için önce kaynak ekleyin.</div>}
            <div className={isEmpty ? "actions-locked" : ""}>
              <div className="action-grid">
                <button className="action-btn" onClick={() => handleAction("test")}>
                  <span className="ab-ic"><Icon name="list-checks" size={20} /></span>
                  <span><span className="ab-t">Test Oluştur</span><span className="ab-d">Konudan otomatik quiz</span></span>
                </button>
                <button className="action-btn" onClick={() => handleAction("ozet")}>
                  <span className="ab-ic"><Icon name="file-text" size={20} /></span>
                  <span><span className="ab-t">Özet Çıkar</span><span className="ab-d">Kaynaklardan derleme</span></span>
                </button>
                <button className="action-btn" onClick={() => handleAction("yolharitasi")}>
                  <span className="ab-ic"><Icon name="route" size={20} /></span>
                  <span><span className="ab-t">Yol Haritası</span><span className="ab-d">Adım adım öğrenme planı</span></span>
                </button>
              </div>

              {roadmapData && (
                <>
                  <div className="panel-section-label"><Icon name="route" size={12} />Aktif yol haritası</div>
                  <button className="roadmap-mini" onClick={() => setRoadmapData({ ...roadmapData })}>
                    <div className="rm-top"><span className="rm-title">{roadmapData.title || "Yol Haritası"}</span><Icon name="arrow-right" size={14} style={{ color: "var(--text-muted)" }} /></div>
                  </button>
                </>
              )}

              {savedActions.length > 0 && (
                <>
                  <div className="panel-section-label"><Icon name="clock" size={12} />Geçmiş</div>
                  {savedActions.map((item, i) => (
                    <button key={i} className="hist-item" onClick={() => {
                      if (item.type === "test") { setTestModal({ data:item.data }); }
                      else if (item.type === "yolharitasi") setRoadmapData(item.data);
                      else setSummaryPanel({ content:item.data });
                    }}>
                      <span className="hi-ic"><Icon name={item.type === "test" ? "list-checks" : item.type === "yolharitasi" ? "route" : "file-text"} size={16} /></span>
                      <span className="hi-t">{item.label}</span>
                      <span className="hi-d">{new Date(item.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="app-root">
      <div className="ws-shell">
        <div className="ws-top">
          <div className="lt">
            <button className="icon-btn" onClick={() => { setActiveRoom(null); setShowHome(true); wsRef.current?.close(); }} title="Not defterleri"><Icon name="arrow-left" size={18} /></button>
            <div className="ws-sep" />
            <div className="ws-title"><span className="nb-dot" style={{ background: srcColor((activeRoom?.title || "").length) }} /><h1>{activeRoom?.title || "Çalışma Seansı"}</h1></div>
            <span className="status st-ready" style={{ marginLeft: 8 }}><Icon name="check-circle" size={11} />{readyCount} kaynak aktif</span>
          </div>
          <div className="rt">
            <select className="ws-model" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} title="Model">
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} ({m.provider})</option>)}
            </select>
            {rooms.length > 1 && (
              <select className="ws-model" value={activeRoom?.id ?? ""} onChange={(e) => { const room = rooms.find((r) => String(r.id) === e.target.value); if (room) openRoom(room); }} title="Oda">
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            )}
            <button className="icon-btn" onClick={toggleTheme} title="Tema"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
            <button className="icon-btn" onClick={handleLogout} title="Çıkış"><Icon name="log-out" size={18} /></button>
            <Avatar size={30} />
          </div>
        </div>

        <div className="ws-body">
          {layout === "odak" ? (
            <>
              <div className="slim-rail">
                <button className={`rail-btn${odakSlideover === "sources" ? " active" : ""}`} title="Kaynaklar" onClick={() => setOdakSlideover((s) => s === "sources" ? null : "sources")}><Icon name="folder" size={19} /></button>
                <button className={`rail-btn${odakSlideover === "actions" ? " active" : ""}`} title="İşlemler" onClick={() => setOdakSlideover((s) => s === "actions" ? null : "actions")} style={{ position: "relative" }}>
                <Icon name="sparkles" size={19} />
                {savedActions.length > 0 && <span className="rail-badge" />}
              </button>
                <div style={{ flex: 1 }} />
                <button className="rail-btn" title="Kaynak yöneticisi" onClick={() => setShowSourcesFullscreen(true)}><Icon name="maximize" size={18} /></button>
              </div>
              <div className="panel-chat">
                <div className="float-actions">
                  <button onClick={() => handleAction("test")}><Icon name="list-checks" size={15} />Test</button>
                  <button onClick={() => handleAction("ozet")}><Icon name="file-text" size={15} />Özet</button>
                  <button onClick={() => handleAction("yolharitasi")}><Icon name="route" size={15} />Yol Haritası</button>
                </div>
                <div className="chat-scroll">
                  <div className="chat-inner">
                    {messages.map((m, i) => {
                      if (m.sender === "system") return <div key={i} className="msg-system"><span className="ln" />{m.text}<span className="ln" /></div>;
                      if (m.sender === "user") return <div key={i} className="msg-user">{m.text}</div>;
                      return (
                        <div key={i} className="msg-ai">
                          <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem</span></div>
                          <div className="body"><p>{m.text}</p></div>
                          {m.sources?.length > 0 && <SourceBadges sources={m.sources} />}
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="msg-ai">
                        <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem yanıtlıyor…</span></div>
                        <div className="typing"><i /><i /><i /></div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <Composer value={inputValue} setValue={setInputValue} onSend={sendMessage} disabled={isTyping} onAttach={() => setShowModal(true)} sourceCount={readyCount} />
              </div>
              {odakSlideover && (
                <div className="slideover">
                  <div className="panel-head">
                    <div className="lt">
                      <Icon name={odakSlideover === "sources" ? "folder" : "sparkles"} size={15} style={{ color: "var(--text-muted)" }} />
                      <span className="ttl">{odakSlideover === "sources" ? "Kaynaklar" : "İşlemler"}</span>
                      {odakSlideover === "sources" && <span className="cnt">{documents.length}</span>}
                    </div>
                    <button className="icon-btn" onClick={() => setOdakSlideover(null)}><Icon name="x" size={16} /></button>
                  </div>
                  <div className="panel-scroll" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {odakSlideover === "sources"
                      ? (isEmpty
                          ? <div className="src-empty"><div className="se-ic"><Icon name="folder" size={30} /></div><div className="se-t">Henüz kaynak yok</div><div className="se-d">Belge yükleyin veya arXiv makalesi ekleyin.</div></div>
                          : <SourcesList documents={documents} excludedDocs={excludedDocs} onToggle={toggleDocExclusion} onDelete={deleteDocument} />)
                      : (
                        <div style={{ padding: "var(--sp-3)", display: "flex", flexDirection: "column", gap: 10 }}>
                          {isEmpty && <div className="actions-hint"><Icon name="alert-circle" size={15} style={{ flex: "0 0 auto", marginTop: 1 }} />Test, özet ve yol haritası için önce kaynak ekleyin.</div>}
                          <div className={isEmpty ? "action-grid actions-locked" : "action-grid"}>
                            <button className="action-btn" onClick={() => { handleAction("test"); setOdakSlideover(null); }}>
                              <span className="ab-ic"><Icon name="list-checks" size={20} /></span>
                              <span><span className="ab-t">Test Oluştur</span><span className="ab-d">Konudan otomatik quiz</span></span>
                            </button>
                            <button className="action-btn" onClick={() => { handleAction("ozet"); setOdakSlideover(null); }}>
                              <span className="ab-ic"><Icon name="file-text" size={20} /></span>
                              <span><span className="ab-t">Özet Çıkar</span><span className="ab-d">Kaynaklardan derleme</span></span>
                            </button>
                            <button className="action-btn" onClick={() => { handleAction("yolharitasi"); setOdakSlideover(null); }}>
                              <span className="ab-ic"><Icon name="route" size={20} /></span>
                              <span><span className="ab-t">Yol Haritası</span><span className="ab-d">Adım adım öğrenme planı</span></span>
                            </button>
                          </div>
                          {roadmapData && (
                            <>
                              <div className="panel-section-label"><Icon name="route" size={12} />Aktif yol haritası</div>
                              <button className="roadmap-mini" onClick={() => { setRoadmapData({ ...roadmapData }); setOdakSlideover(null); }}>
                                <div className="rm-top"><span className="rm-title">{roadmapData.title || "Yol Haritası"}</span><Icon name="arrow-right" size={14} style={{ color: "var(--text-muted)" }} /></div>
                              </button>
                            </>
                          )}
                          {savedActions.length > 0 && (
                            <>
                              <div className="panel-section-label"><Icon name="clock" size={12} />Geçmiş</div>
                              {savedActions.map((item, i) => (
                                <button key={i} className="hist-item" onClick={() => {
                                  if (item.type === "test") setTestModal({ data:item.data });
                                  else if (item.type === "yolharitasi") setRoadmapData(item.data);
                                  else setSummaryPanel({ content:item.data });
                                  setOdakSlideover(null);
                                }}>
                                  <span className="hi-ic"><Icon name={item.type === "test" ? "list-checks" : item.type === "yolharitasi" ? "route" : "file-text"} size={16} /></span>
                                  <span className="hi-t">{item.label}</span>
                                  <span className="hi-d">{new Date(item.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                                </button>
                              ))}
                            </>
                          )}
                        </div>
                      )
                    }
                  </div>
                  {odakSlideover === "sources" && (
                    <div className="src-foot">
                      <div className="upload-zone" onClick={() => setShowModal(true)}>
                        <Icon name="upload" size={20} /><div className="uz-t">Belge ekle</div><div className="uz-d">PDF · DOCX · PPTX · arXiv</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : layout === "komut" ? (
            <>
              {sourcesPanel}
              <div className="panel-chat">
                <div className="chat-scroll">
                  <div className="chat-inner">
                    {messages.map((m, i) => {
                      if (m.sender === "system") return <div key={i} className="msg-system"><span className="ln" />{m.text}<span className="ln" /></div>;
                      if (m.sender === "user") return <div key={i} className="msg-user">{m.text}</div>;
                      return (
                        <div key={i} className="msg-ai">
                          <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem</span></div>
                          <div className="body"><p>{m.text}</p></div>
                          {m.sources?.length > 0 && <SourceBadges sources={m.sources} />}
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="msg-ai">
                        <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem yanıtlıyor…</span></div>
                        <div className="typing"><i /><i /><i /></div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <Composer value={inputValue} setValue={setInputValue} onSend={sendMessage} disabled={isTyping} onAttach={() => setShowModal(true)} sourceCount={readyCount} />
                <div className="command-bar">
                  <div className="command-group">
                    <button onClick={() => handleAction("test")}><Icon name="list-checks" size={16} />Test Oluştur</button>
                    <button onClick={() => handleAction("ozet")}><Icon name="file-text" size={16} />Özet Çıkar</button>
                    <button onClick={() => handleAction("yolharitasi")}><Icon name="route" size={16} />Yol Haritası</button>
                  </div>
                  {savedActions.length > 0 && (
                    <>
                      <div className="cmd-sep" />
                      <div className="command-group" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
                        {savedActions.slice(0, 5).map((item, i) => (
                          <button key={i} className="hist-chip" onClick={() => {
                            if (item.type === "test") setTestModal({ data:item.data });
                            else if (item.type === "yolharitasi") setRoadmapData(item.data);
                            else setSummaryPanel({ content:item.data });
                          }}>
                            <Icon name={item.type === "test" ? "list-checks" : item.type === "yolharitasi" ? "route" : "file-text"} size={13} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {sourcesPanel}
              <div className="panel-chat">
                <div className="chat-scroll">
                  <div className="chat-inner">
                    {messages.map((m, i) => {
                      if (m.sender === "system") return <div key={i} className="msg-system"><span className="ln" />{m.text}<span className="ln" /></div>;
                      if (m.sender === "user") return <div key={i} className="msg-user">{m.text}</div>;
                      return (
                        <div key={i} className="msg-ai">
                          <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem</span></div>
                          <div className="body"><p>{m.text}</p></div>
                          {m.sources?.length > 0 && <SourceBadges sources={m.sources} />}
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="msg-ai">
                        <div className="who"><span className="av"><Icon name="sparkles" size={15} /></span><span className="nm">Tualem yanıtlıyor…</span></div>
                        <div className="typing"><i /><i /><i /></div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                <Composer value={inputValue} setValue={setInputValue} onSend={sendMessage} disabled={isTyping} onAttach={() => setShowModal(true)} sourceCount={readyCount} />
              </div>
              {actionsPanel}
            </>
          )}
        </div>
      </div>
      {renderModals()}
    </div>
  );
}
