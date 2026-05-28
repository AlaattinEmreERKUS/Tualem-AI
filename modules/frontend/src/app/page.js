'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth';
import './auth.css';

export default function LandingPage() {
  const [isDark, setIsDark] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <nav className="navbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 4rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.4rem' }}>🧠 Tualem AI</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="theme-btn" onClick={toggleTheme} type="button">
            {isDark ? '☀️ Açık' : '🌙 Koyu'}
          </button>
          {loggedIn ? (
            <Link href="/dashboard" className="btn" style={{ padding: '10px 22px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ padding: '10px 22px', borderRadius: '8px', border: '1.5px solid var(--button-bg)', color: 'var(--text)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                Giriş Yap
              </Link>
              <Link href="/register" className="btn" style={{ padding: '10px 22px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}>
                Kayıt Ol
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem 2rem' }}>
        <div className="auth-badge" style={{ marginBottom: '1.5rem' }}>Graph RAG · Neo4j · pgvector · LLM</div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.2, maxWidth: '800px', marginBottom: '1.5rem' }}>
          Belgelerinizle konuşun,<br />bilgiyi grafikleştirin.
        </h1>
        <p style={{ fontSize: '1.15rem', maxWidth: '600px', opacity: 0.75, marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Tualem AI, yüklediğiniz dokümanları vektör ve bilgi grafı olarak saklar.
          Sorularınıza kaynaklarınıza dayalı, bağlamsal yanıtlar üretir.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/register" className="btn" style={{ padding: '14px 36px', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
            Ücretsiz Başla
          </Link>
          <Link href="/login" style={{ padding: '14px 36px', borderRadius: '10px', fontSize: '1rem', fontWeight: 600, border: '1.5px solid var(--button-bg)', color: 'var(--text)', textDecoration: 'none', display: 'inline-block' }}>
            Giriş Yap
          </Link>
        </div>
      </section>

      {/* Özellikler */}
      <section style={{ padding: '4rem 4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {[
          { icon: '📄', title: 'Belge Yükle', desc: 'PDF, TXT veya DOCX dosyalarınızı yükleyin. Sistem otomatik olarak chunk\'lar ve embed eder.' },
          { icon: '🔬', title: 'arXiv Araması', desc: 'Belge yoksa bir konu girin — sistem arXiv\'den ilgili makaleleri bulup işleme alır.' },
          { icon: '🕸️', title: 'Bilgi Grafı', desc: 'Belgelerinizdeki kavramlar Neo4j grafiğinde ilişkilendirilerek daha derin bağlam oluşturulur.' },
          { icon: '💬', title: 'Gerçek Zamanlı Chat', desc: 'WebSocket ile anlık sohbet. Yapay zeka kaynaklarınıza dayanarak yanıtlar üretir.' },
        ].map((f) => (
          <div key={f.title} className="feature-card" style={{ padding: '28px', borderRadius: '14px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>{f.title}</h3>
            <p style={{ opacity: 0.75, lineHeight: 1.6, fontSize: '0.9rem' }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={{ textAlign: 'center', padding: '3rem 2rem 5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>Araştırmanıza bugün başlayın</h2>
        <Link href="/register" className="btn" style={{ padding: '14px 40px', borderRadius: '10px', fontSize: '1rem', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
          Hesap Oluştur
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.8rem', opacity: 0.5, borderTop: '1px solid rgba(128,128,128,0.2)' }}>
        © 2026 Tualem AI — Graph RAG destekli araştırma asistanı
      </footer>
    </div>
  );
}
