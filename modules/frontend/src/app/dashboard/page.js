"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getToken, getAuthHeader, isAuthenticated, removeToken } from "@/lib/auth";
import "../auth.css";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost";

export default function DashboardPage() {
  const router = useRouter();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [arxivTopic, setArxivTopic] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [roomError, setRoomError] = useState('');

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchRooms();
    fetchDocuments();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  async function fetchRooms() {
    try {
      const res = await fetch("/api/chat/rooms/", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.results ?? data);
      }
    } catch {}
  }

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents/", { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.results ?? data);
      }
    } catch {}
  }

  async function createRoom() {
    setRoomError('');
    try {
      const res = await fetch("/api/chat/rooms/", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Sohbet ${new Date().toLocaleTimeString("tr-TR")}` }),
      });
      if (res.ok) {
        const room = await res.json();
        setRooms((prev) => [room, ...prev]);
        openRoom(room);
      } else {
        const data = await res.json().catch(() => ({}));
        setRoomError(data.error || data.detail || `Hata: ${res.status}`);
      }
    } catch (e) {
      setRoomError('Sunucuya bağlanılamadı.');
    }
  }

  function openRoom(room) {
    wsRef.current?.close();
    setActiveRoom(room);
    setMessages([{ sender: "ai", text: "Merhaba! Soru sorabilir veya kaynak ekleyebilirsiniz." }]);

    const token = getToken();
    const ws = new WebSocket(`${WS_BASE}/ws/graph/chat/${room.id}/?token=${token}`);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const { role, message, is_streaming, sources } = data;

      if (role === "user") return;

      if (role === "system") {
        setIsTyping(false);
        setMessages((prev) => [...prev, { sender: "system", text: message }]);
        return;
      }

      if (role === "assistant" && !is_streaming && message) {
        setIsTyping(false);
        setMessages((prev) => [...prev, {
          sender: "ai",
          text: message,
          sources: sources?.results ?? [],
        }]);
      }
    };

    ws.onclose = () => {};
    wsRef.current = ws;
  }

  function sendMessage() {
    if (!inputValue.trim() || !wsRef.current) return;
    const text = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setIsTyping(true);
    wsRef.current.send(JSON.stringify({ type: "message", message: text }));
  }

  async function handleFileUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt,.docx";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setShowModal(false);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/documents/", {
          method: "POST",
          headers: getAuthHeader(),
          body: formData,
        });
        if (res.ok) {
          const doc = await res.json();
          setDocuments((prev) => [{ id: doc.document_id, file_name: file.name, status: "pending" }, ...prev]);
          if (wsRef.current) {
            setMessages((prev) => [...prev, { sender: "system", text: `"${file.name}" yüklendi ve işleme alındı.` }]);
          }
        }
      } catch {}
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

  function handleTestAction(type) {
    if (!wsRef.current) return;
    const prompts = {
      test: "Kaynaklarıma göre bir test oluşturur musun?",
      ozet: "Kaynaklarımın özetini çıkarır mısın?",
      yolharitasi: "Kaynaklarıma göre bir öğrenme yol haritası oluşturur musun?",
    };
    const text = prompts[type];
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setIsTyping(true);
    wsRef.current.send(JSON.stringify({ type: "message", message: text }));
  }

  function deleteDocument(id) {
    fetch(`/api/documents/${id}/`, { method: "DELETE", headers: getAuthHeader() })
      .then(() => setDocuments((prev) => prev.filter((d) => d.id !== id)))
      .catch(() => {});
  }

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  const isWorkspaceActive = !!activeRoom;

  return (
    <div className="workspace-wrapper">
      {/* Üst bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 2rem", background: "var(--panel-bg)", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--light-text)" }}>🧠 Tualem AI</span>
        <div style={{ display: "flex", gap: "12px" }}>
          {rooms.length > 0 && (
            <select
              style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "var(--light-text)", fontSize: "0.85rem" }}
              value={activeRoom?.id ?? ""}
              onChange={(e) => {
                const room = rooms.find((r) => String(r.id) === e.target.value);
                if (room) openRoom(room);
              }}
            >
              <option value="">Oda seç</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          )}
          <button onClick={createRoom} style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,255,255,0.15)", color: "var(--light-text)", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>+ Yeni Oda</button>
          <button onClick={handleLogout} style={{ padding: "6px 14px", borderRadius: "6px", background: "rgba(255,0,0,0.2)", color: "var(--light-text)", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>Çıkış</button>
        </div>
      </div>

      {/* Boş durum */}
      {!isWorkspaceActive && !showModal && !showWebSearch && (
        <div className="empty-state-centered" style={{ paddingTop: "60px" }}>
          <button className="add-btn" onClick={createRoom}>+</button>
          <p>Yeni bir sohbet odası oluşturmak için tıklayın</p>
          {roomError && (
            <p style={{ color: '#ff6b6b', fontSize: '0.85rem', marginTop: '8px' }}>{roomError}</p>
          )}
        </div>
      )}

      {/* Modal */}
      {(showModal || showWebSearch) && (
        <div className="modal-overlay">
          <div className="modal-content">
            {showModal ? (
              <div>
                <h3>Yeni Kaynak Ekle</h3>
                <div className="modal-options">
                  <button className="modal-opt-btn" onClick={handleFileUpload}>📁 Dosya Yükle</button>
                  <button className="modal-opt-btn" onClick={() => { setShowWebSearch(true); setShowModal(false); }}>🔬 arXiv&apos;de Ara</button>
                </div>
              </div>
            ) : (
              <div className="web-search-box">
                <h3>arXiv Literatür Araması</h3>
                <input
                  type="text"
                  className="chat-input"
                  value={arxivTopic}
                  onChange={(e) => setArxivTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleArxivSearch()}
                  placeholder="Konu girin (ör: transformer models, graph neural networks)"
                />
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
          {/* Sol panel — Kaynaklar */}
          <aside className="side-panel">
            <h4>Kaynaklarım</h4>
            <div className="source-list">
              {documents.length === 0 ? (
                <p className="no-source-text">Henüz kaynak eklenmedi.</p>
              ) : (
                documents.map((d) => (
                  <div className="source-item" key={d.id}>
                    <span className="source-name-text" title={d.file_name}>
                      {d.status === "pending" || d.status === "processing" ? "⏳ " : "📄 "}
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

          {/* Orta panel — Chat */}
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
              {isTyping && (
                <div className="msg ai typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <input
                type="text"
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Sorunuzu yazın..."
              />
              <button className="send-btn-icon" onClick={sendMessage}>➤</button>
            </div>
          </section>

          {/* Sağ panel — İşlemler */}
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
