'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../auth.css';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);

  
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark');
    }
  }, []);

  
  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    
    if (newMode) {
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="page" style={{ 
      position: 'relative', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      overflowX: 'hidden' 
    }}>
      
      {}
      <nav className="navbar" style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '1.5rem 4rem',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1000
      }}>
        <div className="nav-left" style={{ fontWeight: '800', fontSize: '1.5rem' }}>
          ProjeAdı
        </div>
        <div className="nav-right">
          <button type="button" className="theme-btn" onClick={toggleTheme}>
            {isDark ? '☀️ Açık' : '🌙 Koyu'}
          </button>
        </div>
      </nav>

      {}
      <main className="main-content" style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        paddingTop: '80px',
        width: '100%' 
      }}>
        <div className="auth-shell">
          
          {}
          <section className="auth-left">
            <div>
              <div className="auth-badge">Research Intelligence Platform</div>
              <div className="auth-brand">
                <h1>Bilgiyi bağla, araştırmayı hızlandır.</h1>
                <p>Kişisel araştırma alanınıza erişerek çalışmalarınıza kaldığınız yerden devam edin.</p>
              </div>

              <div className="feature-list" style={{ marginTop: '30px' }}>
                <div className="feature-item" style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--accent-color)', marginBottom: '5px' }}>🚀 Akıllı Analiz</h4>
                  <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Yüklediğiniz dökümanlar saniyeler içinde taranır ve önemli noktalar çıkarılır.</p>
                </div>
                <div className="feature-item" style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--accent-color)', marginBottom: '5px' }}>🧠 Kavram Haritaları</h4>
                  <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Bilgiler arasındaki gizli bağlantıları görselleştirerek daha derin içgörüler edinin.</p>
                </div>
                <div className="feature-item">
                  <h4 style={{ color: 'var(--accent-color)', marginBottom: '5px' }}>🛡️ Güvenli Depolama</h4>
                  <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Tüm araştırmalarınız uçtan uca şifrelenmiş bir alanda güvenle saklanır.</p>
                </div>
              </div>
            </div>
          </section>

          {}
          <section className="auth-right">
            <div className="form-box">
              <div className="logo">Hoş Geldiniz</div>
              <h1 className="title">Giriş Yap</h1>
              <p className="sub">Hesabınıza giriş yaparak araştırmaya devam edin.</p>

              <form onSubmit={(e) => { e.preventDefault(); router.push('/'); }}>
                <label>Kullanıcı Adı</label>
                <input type="text" placeholder="Kullanıcı adınızı girin" required />

                <label>Şifre</label>
                <div className="password-wrapper">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Şifrenizi girin" 
                    required 
                  />
                  <button 
                    type="button" 
                    className="show-btn" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Gizle" : "Göster"}
                  </button>
                </div>

                <button className="btn" type="submit">Giriş Yap</button>
              </form>
              <div className="row">
                Hesabın yok mu? <Link href="/register">Kayıt ol</Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      {}
      <footer className="auth-footer" style={{
        padding: '1.5rem 4rem',
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        fontSize: '0.8rem',
        opacity: 0.6
      }}>
        <div>© 2026 ProjeAdı. Tüm hakları saklıdır.</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link href="#">Gizlilik Politikası</Link>
          <Link href="#">Kullanım Şartları</Link>
          <Link href="#">Yardım Merkezi</Link>
        </div>
      </footer>
    </div>
  );
}
