"use client";

import { useState, useEffect, useRef } from "react";
import "../auth.css";

export default function DashboardPage() {
  const [showModal, setShowModal] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(false);
  const [sources, setSources] = useState([]);
  const [webUrl, setWebUrl] = useState("");
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Analiz hazır. Nereden başlayalım?" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const deleteSource = (id) => {
    setSources(sources.filter((s) => s.id !== id));
  };

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;

    input.onchange = (e) => {
      const files = Array.from(e.target.files).map((f) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: `📁 ${f.name}`,
        active: true,
      }));

      setSources((prev) => [...prev, ...files]);
      setIsWorkspaceActive(true);
      setShowModal(false);
    };

    input.click();
  };

  const handleAddWebSource = () => {
    if (webUrl.trim() === "") return;

    setSources((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: `🌐 ${webUrl}`,
        active: true,
      },
    ]);

    setWebUrl("");
    setShowWebSearch(false);
    setIsWorkspaceActive(true);
  };

  const sendMessage = () => {
    if (inputValue.trim() === "") return;

    const currentText = inputValue;

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: currentText },
    ]);

    setInputValue("");

    setIsTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: `"${currentText}" içeriğini kaynaklarınla karşılaştırarak inceliyorum. Başka bir sorun var mı?`,
        },
      ]);

      setIsTyping(false);
    }, 1500);
  };

  const handleTestAction = (type) => {
    let actionText = "";
    let aiResponse = "";

    if (type === "test") {
      actionText = "📝 Test oluşturur musun?";
      aiResponse =
        "Kaynaklarını tarıyorum... Senin için bir test hazırlıyorum. Birazdan paylaşacağım.";
    } else if (type === "ozet") {
      actionText = "📋 Özet çıkar.";
      aiResponse =
        "Belgelerini analiz ediyorum. Ana başlıklar halinde bir özet hazırlıyorum...";
    } else if (type === "yolharitasi") {
      actionText = "🗺️ Yol haritası çıkar.";
      aiResponse =
        "Harika! Kaynaklarına göre senin için bir öğrenme planı oluşturuyorum.";
    }

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: actionText },
    ]);

    setIsTyping(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "ai", text: aiResponse },
      ]);

      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="workspace-wrapper">
      {!isWorkspaceActive && !showModal && !showWebSearch && (
        <div className="empty-state-centered">
          <button
            className="add-btn"
            onClick={() => setShowModal(true)}
          >
            +
          </button>

          <p>Yeni bir not defteri oluşturmak için tıklayın</p>
        </div>
      )}

      {(showModal || showWebSearch) && (
        <div className="modal-overlay">
          <div className="modal-content">
            {showModal ? (
              <div>
                <h3>Yeni Kaynak Ekle</h3>

                <div className="modal-options">
                  <button
                    className="modal-opt-btn"
                    onClick={handleFileUpload}
                  >
                    📁 Kaynak Yükle
                  </button>

                  <button
                    className="modal-opt-btn"
                    onClick={() => {
                      setShowWebSearch(true);
                      setShowModal(false);
                    }}
                  >
                    🌐 Web'de Ara
                  </button>
                </div>
              </div>
            ) : (
              <div className="web-search-box">
                <h3>İnternetten Kaynak Ekle</h3>

                <input
                  type="text"
                  className="chat-input"
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="URL girin veya konu yazın..."
                />

                <button
                  className="web-add-submit-btn"
                  onClick={handleAddWebSource}
                >
                  Ekle
                </button>
              </div>
            )}

            <button
              className="modal-close-link"
              onClick={() => {
                setShowModal(false);
                setShowWebSearch(false);
              }}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {isWorkspaceActive && (
        <div className="dashboard-layout">
          <aside className="side-panel">
            <h4>Kaynaklarım</h4>

            <div className="source-list">
              {sources.length === 0 ? (
                <p className="no-source-text">
                  Henüz kaynak eklenmedi.
                </p>
              ) : (
                sources.map((s) => (
                  <div className="source-item" key={s.id}>
                    <span
                      className="source-name-text"
                      title={s.name}
                    >
                      {s.name}
                    </span>

                    <div className="source-actions">
                      <input
                        type="checkbox"
                        defaultChecked={s.active}
                      />

                      <button
                        onClick={() => deleteSource(s.id)}
                        className="delete-source-btn"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              className="add-source-footer-btn"
              onClick={() => setShowModal(true)}
            >
              + Yeni Kaynak
            </button>
          </aside>

          <section className="main-panel">
            <div className="chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.sender}`}>
                  {m.text}
                </div>
              ))}

              {isTyping && (
                <div className="msg ai typing-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
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
                onKeyDown={(e) =>
                  e.key === "Enter" && sendMessage()
                }
                placeholder="Sorunuzu yazın..."
              />

              <button
                className="send-btn-icon"
                onClick={sendMessage}
              >
                ➤
              </button>
            </div>
          </section>

          <aside className="tool-panel">
            <h4>İşlemler</h4>

            <div className="action-buttons">
              <button
                className="action-btn"
                onClick={() => handleTestAction("test")}
              >
                📝 Test Oluştur
              </button>

              <button
                className="action-btn"
                onClick={() => handleTestAction("ozet")}
              >
                📋 Özet Çıkar
              </button>

              <button
                className="action-btn"
                onClick={() => handleTestAction("yolharitasi")}
              >
                🗺️ Yol Haritası
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}