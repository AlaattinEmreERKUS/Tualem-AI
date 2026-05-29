"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, getAuthHeader, isAuthenticated, removeToken, getTokenPayload } from "@/lib/auth";
import "../auth.css";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost";

const MODELS = [
  { id: "groq:llama-3.1-8b-instant",      label: "⚡ Llama 3.1 8B (Groq)" },
  { id: "groq:llama-3.3-70b-versatile",   label: "⚡ Llama 3.3 70B (Groq)" },
  { id: "groq:gemma2-9b-it",              label: "⚡ Gemma2 9B (Groq)" },
  { id: "ollama:qwen3.5:9b",              label: "🖥️ Qwen3.5 9B (Yerel)" },
  { id: "ollama:llama3.2:3b",             label: "🖥️ Llama 3.2 3B (Yerel)" },
  { id: "moonshotai/kimi-k2.6:free",      label: "☁️ Kimi K2.6 (OpenRouter)" },
  { id: "google/gemma-4-31b-it:free",     label: "☁️ Gemma 4 31B (OpenRouter)" },
  { id: "meta-llama/llama-4-scout:free",  label: "☁️ Llama 4 Scout (OpenRouter)" },
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

  // Model seçici
  const [selectedModel, setSelectedModel] = useState("groq:llama-3.1-8b-instant");

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

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents/", { headers: getAuthHeader() });
      if (res.ok) { const d = await res.json(); setDocuments(d.results ?? d); }
    } catch {}
  }

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/profile/", { headers: getAuthHeader() });
      if (res.ok) {
        const d = await res.json();
        setProfileUsername(d.username || "");
        if (d.profile_photo) setProfilePhoto(d.profile_photo);
      }
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
    const ws = new WebSocket(`${WS_BASE}/ws/graph/chat/${room.id}/`);
    ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token: getToken() }));
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "auth_ok") return;
      const { role, message, is_streaming, sources } = data;
      if (role === "user") return;
      if (role === "system") {
        setMessages((prev) => [...prev, { sender: "system", text: message }]);
        return;
      }
      setIsTyping(false);
      if (role === "assistant" && !is_streaming && message) {
        setMessages((prev) => [...prev, { sender: "ai", text: message, sources: sources?.results ?? [] }]);
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
    wsRef.current.send(JSON.stringify({ type: "message", message: text, model, provider }));
  }

  function handleTestAction(actionType) {
    if (!wsRef.current) return;
    const labels = { test: "📝 Test oluşturuluyor...", ozet: "📋 Özet çıkarılıyor...", yolharitasi: "🗺️ Yol haritası oluşturuluyor..." };
    const text = labels[actionType];
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setIsTyping(true);
    const { provider, model } = parseModel(selectedModel);
    wsRef.current.send(JSON.stringify({ type: "message", message: text, model, provider, action: actionType }));
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
          fetchDocuments();
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

  function deleteDocument(id) {
    fetch(`/api/documents/${id}/`, { method: "DELETE", headers: getAuthHeader() })
      .then(() => setDocuments((prev) => prev.filter((d) => d.id !== id)))
      .catch(() => {});
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
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(124,58,237,0.2)", color: "var(--light-text)", fontSize: "0.8rem", cursor: "pointer" }}
          >
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>

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

      {/* --- HOME: Oda Grid Görünümü --- */}
      {showHome && !isWorkspaceActive && !showRoomSetup && !showModal && !showWebSearch && (
        <div style={{ paddingTop: "80px", minHeight: "100vh" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ color: "var(--light-text)", margin: 0 }}>Not Defterlerim</h2>
              <button
                onClick={openRoomSetup}
                style={{ padding: "8px 18px", borderRadius: "8px", background: "rgba(124,58,237,0.7)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                + Yeni Not Defteri
              </button>
            </div>

            {rooms.length === 0 ? (
              <div style={{ textAlign: "center", paddingTop: "4rem" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📓</div>
                <p style={{ color: "var(--light-muted)", fontSize: "1.1rem" }}>Henüz not defteri yok.</p>
                <button onClick={openRoomSetup} style={{ marginTop: "1rem", padding: "10px 24px", borderRadius: "8px", background: "rgba(124,58,237,0.7)", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  İlk not defterini oluştur
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => openRoom(room)}
                    style={{ background: "var(--panel-bg)", borderRadius: "12px", padding: "1.5rem", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", transition: "border-color 0.15s, transform 0.15s", position: "relative" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>💬</div>
                    <h3 style={{ color: "var(--light-text)", margin: "0 0 0.4rem", fontSize: "1rem", fontWeight: 700 }}>{room.title}</h3>
                    <p style={{ color: "var(--light-muted)", fontSize: "0.78rem", margin: 0 }}>
                      {new Date(room.created_at).toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                      style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,0,0,0.15)", border: "none", borderRadius: "6px", color: "var(--light-muted)", cursor: "pointer", padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      Sil
                    </button>
                  </div>
                ))}
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
                      {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
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

      {/* Ana workspace */}
      {isWorkspaceActive && (
        <div className="dashboard-layout" style={{ paddingTop: "60px" }}>

          {/* Sol panel */}
          <aside className="side-panel">
            <h4>Kaynaklarım</h4>
            <div className="source-list">
              {documents.length === 0 ? (
                <p className="no-source-text">Henüz kaynak eklenmedi.</p>
              ) : (
                documents.map((d) => (
                  <div className="source-item" key={d.id}>
                    <span className="source-name-text" title={d.file_name}>
                      <DocStatusIcon status={d.status} />{" "}
                      {d.file_name}
                    </span>
                    <div className="source-actions">
                      <button onClick={() => deleteDocument(d.id)} className="delete-source-btn">×</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button className="add-source-footer-btn" onClick={() => setShowModal(true)}>+ Yeni Kaynak</button>
          </aside>

          {/* Orta panel */}
          <section className="main-panel">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.sender === "ai" ? "ai" : m.sender === "system" ? "system" : "user"}`}>
                  <p>{m.text}</p>
                  {m.sources?.length > 0 && (
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", opacity: 0.7 }}>
                      {m.sources.map((s, si) => (
                        <div key={si}>📎 Chunk {s.chunk_index} — {s.content.slice(0, 80)}...</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isTyping && <div className="msg ai typing-dots"><span></span><span></span><span></span></div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-area">
              <input type="text" className="chat-input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Sorunuzu yazın..." />
              <button className="send-btn-icon" onClick={sendMessage}>➤</button>
            </div>
          </section>

          {/* Sağ panel */}
          <aside className="tool-panel">
            <h4>İşlemler</h4>
            <div className="action-buttons">
              <button className="action-btn" onClick={() => handleTestAction("test")}>📝 Test Oluştur</button>
              <button className="action-btn" onClick={() => handleTestAction("ozet")}>📋 Özet Çıkar</button>
              <button className="action-btn" onClick={() => handleTestAction("yolharitasi")}>🗺️ Yol Haritası</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
