"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken, isAuthenticated } from "@/lib/auth";
import { getTheme, toggleTheme } from "@/lib/theme";
import { Icon } from "@/lib/icons";

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

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState("dark");
  const [showPw, setShowPw] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) { router.push("/dashboard"); return; }
    setTheme(getTheme());
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.requires_verification) {
          setError("E-posta doğrulanmamış. Kayıt sayfasından kodu girin.");
        } else {
          setError(data.detail || data.error || "Kullanıcı adı veya şifre hatalı.");
        }
        return;
      }
      setToken(data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
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
            <h1 className="auth-headline">Bilgiyi bağla, araştırmayı hızlandır.</h1>
            <p className="auth-sub">Kişisel araştırma alanınıza erişerek belgelerinizi, makalelerinizi ve kavramsal bağlantılarınızı tek yerden yönetin.</p>
            <div className="feature-list">
              <Feature icon="network" title="Bilgi grafiği" desc="Belgeler arasındaki kavramlar otomatik bağlanır; ilişkili fikirleri tek bakışta görün." />
              <Feature icon="message-square" title="Kaynağa dayalı sohbet" desc="Her yanıtta hangi belgeden geldiğini gösteren kaynak rozetleri." />
              <Feature icon="list-checks" title="Test & yol haritası" desc="Çalıştığınız konudan otomatik quiz ve adım adım öğrenme planı." />
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
          <div className="auth-form">
            <h2>Tekrar hoş geldiniz</h2>
            <p className="lede">Çalışma alanınıza giriş yapın.</p>

            {error && <div className="auth-error">{error}</div>}

            <form className="form-rows" onSubmit={handleSubmit}>
              <div className="field">
                <label>Kullanıcı adı veya e-posta</label>
                <div className="input">
                  <Icon name="user" size={16} />
                  <input placeholder="kullanıcı adı veya e-posta" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
                </div>
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
                {loading ? "Giriş yapılıyor…" : "Giriş yap"}
                <Icon name="arrow-right" size={16} />
              </button>
            </form>

            <div className="auth-switch">
              Hesabınız yok mu? <Link href="/register">Kayıt olun</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
