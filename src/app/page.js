'use client';
import { useState, useEffect, useRef } from 'react';
import './auth.css';

export default function WorkspacePage() {
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  
  const [sources, setSources] = useState([]);
  const [messages, setMessages] = useState([{ sender: 'ai', text: 'Analiz hazır. Nereden başlayalım?' }]);
  const [inputValue, setInputValue] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [showWebInput, setShowWebInput] = useState(false);

  
  const fileInputRef = useRef(null);

  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const newSource = { id: Date.now(), name: `📚 ${file.name}`, type: 'file' };
      setSources([...sources, newSource]);
      setIsWorkspaceActive(true);
      setShowModal(false);
      // AI'dan karşılama mesajı
      setMessages(prev => [...prev, { sender: 'ai', text: `"${file.name}" dosyasını başarıyla analiz ettim. Bu döküman hakkında ne bilmek istersiniz?` }]);
    }
  };

  const handleWebAdd = () => {
    if (!webUrl.trim()) return;
    const newSource = { id: Date.now(), name: `🌐 ${webUrl.replace('https://', '')}`, type: 'web' };
    setSources([...sources, newSource]);
    setIsWorkspaceActive(true);
    setShowModal(false);
    setShowWebInput(false);
    setWebUrl('');
    setMessages(prev => [...prev, { sender: 'ai', text: `Web kaynağı içeriği başarıyla çekildi. Analize başlayabiliriz.` }]);
  };

  const sendMessage = (text = inputValue) => {
    const messageToSend = text || inputValue;
    if (!messageToSend.trim()) return;
    
    setMessages(prev => [...prev, { sender: 'user', text: messageToSend }]);
    if (!text) setInputValue('');

    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Kaynaklarımı tarıyorum, saniyeler içinde cevaplıyorum...' }]);
    }, 800);
  };

  
  const runQuickAction = (actionType) => {
    let userMsg = "";
    let aiResponse = "";

    switch(actionType) {
      case 'summary':
        userMsg = "Bu kaynağın özetini çıkarır mısın?";
        aiResponse = "Tabii, dökümanı analiz ettim. İşte ana noktalar: \n• Temel Kavramlar\n• Yöntem Analizi\n• Sonuç ve Öneriler...";
        break;
      case 'test':
        userMsg = "Bu içerikten bana bir test oluştur.";
        aiResponse = "İçeriğe dayalı 5 soruluk çoktan seçmeli test hazırladım. İlk soruyla başlayalım mı?";
        break;
      case 'map':
        userMsg = "Bilgi haritasını göster.";
        aiResponse = "Dökümandaki kavramlar arası ilişkileri haritalandırıyorum. Görselleştirme hazır!";
        break;
      default: break;
    }

    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);
    }, 1000);
  };

  return (
    <div className="page">
      <nav className="navbar">
        <div className="nav-left">ProjeAdı</div>
        <div className="nav-right">
          <button className="theme-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? '☀️ Açık' : '🌙 Koyu'}
          </button>
          <div className="nav-profile">
            <div className="profile-avatar">U</div>
            <span style={{fontSize: '14px', fontWeight: '600'}}>Kullanıcı</span>
          </div>
        </div>
      </nav>

      <main className="workspace-wrapper">
        {!isWorkspaceActive ? (
          <div className="empty-state-centered">
            <button className="add-btn" onClick={() => setShowModal(true)}>+</button>
            <p className="no-source-text" style={{fontWeight: '600'}}>
              Yeni bir çalışma alanı oluşturmak için kaynak ekleyin
            </p>
          </div>
        ) : (
          <div className="dashboard-layout">
            {/* SOL PANEL */}
            <aside className="side-panel">
              <h3 style={{fontSize: '16px', marginBottom: '15px'}}>Kaynaklarım</h3>
              <div className="chat-messages" style={{border: 'none', padding: 0}}>
                {sources.map(s => (
                  <div key={s.id} className="source-item">
                    <span className="source-name-text">{s.name}</span>
                    <button className="delete-source-btn" onClick={() => setSources(sources.filter(src => src.id !== s.id))}>×</button>
                  </div>
                ))}
              </div>
              <button className="add-source-footer-btn" onClick={() => setShowModal(true)}>+ Yeni Kaynak</button>
            </aside>

            {/* ORTA PANEL */}
            <section className="main-panel">
              <div className="chat-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`msg ${m.sender === 'ai' ? 'ai' : ''}`}
                    style={m.sender === 'user' ? { alignSelf: 'flex-end', background: 'var(--button-bg)', color: 'var(--button-text)' } : {}}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="chat-input-area">
                <input 
                  className="chat-input" 
                  placeholder="Araştırman hakkında bir soru sor..." 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button className="send-btn-icon" onClick={() => sendMessage()}>➤</button>
              </div>
            </section>

            {/* SAĞ PANEL - ARTIK AKTİF */}
            <aside className="tool-panel">
              <h3 style={{fontSize: '16px', marginBottom: '15px'}}>Hızlı İşlemler</h3>
              <div className="action-buttons">
                <button className="action-btn" onClick={() => runQuickAction('summary')}>📝 Özet Çıkar</button>
                <button className="action-btn" onClick={() => runQuickAction('test')}>📋 Test Oluştur</button>
                <button className="action-btn" onClick={() => runQuickAction('map')}>🗺️ Bilgi Haritası</button>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* MODAL GÜNCELLEMESİ */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="title" style={{fontSize: '22px', marginBottom: '10px'}}>Kaynak Ekle</h2>
            
            {!showWebInput ? (
              <div className="modal-options">
                {}
                <input type="file" ref={fileInputRef} style={{display:'none'}} onChange={handleFileChange} />
                <button className="modal-opt-btn" onClick={() => fileInputRef.current.click()}>
                  📁 Cihazdan Dosya Yükle
                </button>
                <button className="modal-opt-btn" onClick={() => setShowWebInput(true)}>
                  🌐 Web Bağlantısı Ekle
                </button>
              </div>
            ) : (
              <div className="web-input-area">
                <input 
                  type="text" 
                  className="chat-input" 
                  placeholder="https://example.com" 
                  style={{marginBottom:'10px', width:'100%'}}
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                />
                <button className="btn" onClick={handleWebAdd}>Ekle</button>
                <button className="modal-close" style={{marginTop:'5px'}} onClick={() => setShowWebInput(false)}>Geri Dön</button>
              </div>
            )}
            
            {!showWebInput && <button className="modal-close" onClick={() => setShowModal(false)}>Vazgeç</button>}
          </div>
        </div>
      )}
    </div>
  );
}
