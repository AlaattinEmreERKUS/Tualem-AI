"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken, isAuthenticated } from "@/library/auth";
import { getTheme, toggleTheme } from "@/library/theme";
import { Icon } from "@/library/icons";

function Feature({ icon, title, desc }) {
  return (
    <div className="feature">
      <div className="f-ic"><Icon name={icon} size={20} /></div>
      <div>
        <div className="f-t">{title}</div>
        <div className="f-d">{desc}</div>
      </div>
    </div>
  );
}

// 6 haneli kod giriş ekranı
function VerifyForm({ email, password, onVerified, onBack }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(30);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refs = useRef([]);

  useEffect(() => { refs.current[0]?.focus(); }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    setCode((c) => { const n = [...c]; n[i] = d; return n; });
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6).split("");
    if (txt.length) { e.preventDefault(); setCode([...txt, "", "", "", "", "", ""].slice(0, 6)); refs.current[Math.min(txt.length, 5)]?.focus(); }
  };
  const filled = code.every((d) => d !== "");

  async function verify() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.join("") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Doğrulama başarısız."); return; }
      // Doğrulama token döner — direkt giriş
      if (data.access_token) { setToken(data.access_token); onVerified(); }
      else onVerified();
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    try {
      await fetch("/api/auth/resend-code/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSeconds(30);
    } catch {}
  }

  return (
    <div className="auth-form">
      <button className="back-link" onClick={onBack}><Icon name="arrow-left" size={15} />Geri</button>
      <div className="verify-icon"><Icon name="mail" size={26} /></div>
      <h2>E-postanızı doğrulayın</h2>
      <p className="lede" style={{ marginBottom: 0 }}>
        <span className="verify-email">{email}</span> adresine 6 haneli bir kod gönderdik.
      </p>
      {error && <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>}
      <div className="code-row" onPaste={onPaste}>
        {code.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            className={`code-box${d ? " filled" : ""}`}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKey(i, e)}
          />
        ))}
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={!filled || loading} onClick={verify} style={{ marginTop: "var(--sp-4)" }}>
        {loading ? "Doğrulanıyor…" : "Doğrula ve devam et"}<Icon name="arrow-right" size={16} />
      </button>
      <div className="resend">
        Kod gelmedi mi?{" "}
        {seconds > 0 ? <span>Yeniden gönder ({seconds}s)</span> : <button onClick={resend}>Yeniden gönder</button>}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("dark");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState("register"); // register | verify
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) { router.push("/dashboard"); return; }
    setTheme(getTheme());
  }, [router]);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, username, email, password, confirm_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.username?.[0] || data.email?.[0] || data.password?.[0] || data.error || "Kayıt başarısız.";
        setError(msg);
        return;
      }
      // Backend doğrulama istiyor → verify ekranı
      setMode("verify");
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-root">
      <div className="auth">
        {/* SOL — tanıtım */}
        <div className="auth-intro">
          <div className="brand">
            <span className="logo"><Icon name="network" size={26} /></span>
            <span className="wm">Tualem<small>AI</small></span>
          </div>
          <div>
            <h1 className="auth-headline">Kaynaklarınızdan düşünen bir çalışma ortağı.</h1>
            <p className="auth-sub">Belgelerinizi ve makalelerinizi bir bilgi grafiğine dönüştürün; sorun, özetleyin, test edin — her yanıt kaynağına bağlı.</p>
            <div className="feature-list">
              <Feature icon="network" title="Bilgi grafiği" desc="Belgeler arasındaki kavramlar otomatik bağlanır." />
              <Feature icon="message-square" title="Kaynağa dayalı sohbet" desc="Her yanıtta kaynak rozetleri." />
              <Feature icon="list-checks" title="Test & yol haritası" desc="Otomatik quiz ve öğrenme planı." />
            </div>
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>PDF · DOCX · PPTX · arXiv</div>
        </div>

        {/* SAĞ — form */}
        <div className="auth-form-wrap">
          <div className="auth-top-actions">
            <button className="icon-btn" onClick={() => setTheme(toggleTheme())} title="Tema değiştir">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
            </button>
          </div>

          {mode === "verify" ? (
            <VerifyForm email={email} password={password} onVerified={() => router.push("/dashboard")} onBack={() => setMode("register")} />
          ) : (
            <div className="auth-form">
              <h2>Hesap oluştur</h2>
              <p className="lede">Çalışma ortamınızı birkaç saniyede kurun.</p>

              {error && <div className="auth-error">{error}</div>}

              <form className="form-rows" onSubmit={handleRegister}>
                <div className="form-2col">
                  <div className="field">
                    <label>Ad</label>
                    <div className="input"><Icon name="user" size={16} /><input placeholder="Adınız" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                  </div>
                  <div className="field">
                    <label>Soyad</label>
                    <div className="input"><input placeholder="Soyadınız" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
                  </div>
                </div>
                <div className="field">
                  <label>Kullanıcı adı</label>
                  <div className="input"><Icon name="at-sign" size={16} /><input placeholder="kullanıcıadı" value={username} onChange={(e) => setUsername(e.target.value)} required /></div>
                </div>
                <div className="field">
                  <label>E-posta</label>
                  <div className="input"><Icon name="mail" size={16} /><input type="email" placeholder="ad@universite.edu.tr" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                </div>
                <div className="field">
                  <label>Şifre</label>
                  <div className="input">
                    <Icon name="lock" size={16} />
                    <input type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="icon-btn" style={{ padding: 2 }} onClick={() => setShowPw((s) => !s)} tabIndex={-1}>
                      <Icon name={showPw ? "eye-off" : "eye"} size={16} />
                    </button>
                  </div>
                </div>

                <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                  {loading ? "Hesap oluşturuluyor…" : "Hesabı oluştur"}<Icon name="arrow-right" size={16} />
                </button>
              </form>

              <div className="auth-switch">
                Zaten hesabınız var mı? <Link href="/login">Giriş yapın</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
