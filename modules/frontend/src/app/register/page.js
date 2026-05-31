'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { setToken } from '@/lib/auth';
import '../auth.css';

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <div className="page" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.5rem 4rem', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1000
      }}>
        <div className="nav-left" style={{ fontWeight: '800', fontSize: '1.5rem' }}>🧠 Tualem AI</div>
        <button type="button" className="theme-btn" onClick={toggleTheme}>
          {isDark ? '☀️ Açık' : '🌙 Koyu'}
        </button>
      </nav>

      <main className="main-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '80px' }}>
        <div className="auth-shell">
          <section className="auth-left">
            <div>
              <div className="auth-badge">Research Intelligence Platform</div>
              <div className="auth-brand">
                <h1>Yeni nesil araştırma deneyimine katılın.</h1>
                <p>Tualem AI, araştırma süreçlerini sadece saklamaz; onları analiz eder, bağlar ve anlamlı bilgi yapılarına dönüştürür.</p>
              </div>
              <div className="feature-list">
                <div className="feature-card">
                  <h3>Kişisel Bilgi Alanı</h3>
                  <p>Araştırmalarınızı, kaynaklarınızı ve kavramsal ilişkilerinizi tek bir yapı altında yönetin.</p>
                </div>
                <div className="feature-card">
                  <h3>Yapay Zekâ Destekli Rehberlik</h3>
                  <p>Bilgi keşfi, sınıflandırma ve içerik ilişkilendirme süreçlerinde akıllı destek alın.</p>
                </div>
                <div className="feature-card">
                  <h3>Daha Derin Analiz</h3>
                  <p>Bilgiyi yalnızca depolamak yerine, aralarındaki bağlantıları görünür hale getirerek daha derin içgörüler üretin.</p>
                </div>
              </div>
            </div>
            <div className="auth-footer-note" style={{ marginTop: '20px', opacity: 0.7 }}>
              Daha güçlü bir araştırma altyapısı için hesabınızı oluşturun.
            </div>
          </section>

          <section className="auth-right">
            <div className="form-box">
              <div className="logo">Yeni Hesap</div>
              <h1 className="title">Kayıt Ol</h1>

              {error && (
                <div style={{ background: 'var(--error-bg)', color: 'var(--error-text)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setLoading(true);
                try {
                  const res = await fetch('/api/auth/register/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ first_name: firstName, last_name: lastName, username, email, password, confirm_password: confirmPassword }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    const msg = data.username?.[0] || data.email?.[0] || data.password?.[0] || data.confirm_password?.[0] || data.error || 'Kayıt başarısız.';
                    setError(msg);
                    return;
                  }
                  const loginRes = await fetch('/api/auth/login/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier: username, password }),
                  });
                  if (loginRes.ok) {
                    const loginData = await loginRes.json();
                    setToken(loginData.access_token);
                    router.push('/dashboard');
                  } else {
                    router.push('/login');
                  }
                } catch {
                  setError('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.');
                } finally {
                  setLoading(false);
                }
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label>Ad</label>
                    <input type="text" placeholder="Adınız" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div>
                    <label>Soyad</label>
                    <input type="text" placeholder="Soyadınız" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <label>Kullanıcı Adı</label>
                <input type="text" placeholder="Kullanıcı adınızı girin" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <label>Email</label>
                <input type="email" placeholder="Email adresinizi girin" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <label>Şifre</label>
                <div className="password-wrapper">
                  <input type={showPass ? "text" : "password"} placeholder="Şifrenizi girin" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" className="show-btn" onClick={() => setShowPass(!showPass)}>
                    {showPass ? "Gizle" : "Göster"}
                  </button>
                </div>
                <label>Şifre Tekrar</label>
                <div className="password-wrapper">
                  <input type={showConfirm ? "text" : "password"} placeholder="Şifrenizi tekrar girin" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  <button type="button" className="show-btn" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? "Gizle" : "Göster"}
                  </button>
                </div>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
                </button>
              </form>
              <div className="row">Zaten hesabın var mı? <Link href="/login">Giriş yap</Link></div>
            </div>
          </section>
        </div>
      </main>

      <footer className="auth-footer" style={{ padding: '1.5rem 4rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.6 }}>
        <div>© 2026 Tualem AI. Tüm hakları saklıdır.</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <Link href="#">Gizlilik</Link>
          <Link href="#">Şartlar</Link>
          <Link href="#">Destek</Link>
        </div>
      </footer>
    </div>
  );
}
