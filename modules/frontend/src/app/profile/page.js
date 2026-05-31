"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeader, isAuthenticated, removeToken, getToken } from "@/lib/auth";
import { getTheme, toggleTheme as toggleThemeFn } from "@/lib/theme";
import { Icon } from "@/lib/icons";
import { ACCENT_PALETTES, LAYOUT_OPTIONS, getPreference, setPreference, applyAccent } from "@/lib/preferences";

function LayoutMockup({ id, large = false }) {
  const h = large ? 160 : 68;
  const topH = large ? 20 : 8;

  const s = {
    wrap: { width: "100%", height: h, borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-sunken)", display: "flex", flexDirection: "column", border: "1px solid var(--border)" },
    top: { height: topH, background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 },
    body: { flex: 1, display: "flex", minHeight: 0 },
    panel: (w, right) => ({ width: w, background: "var(--surface)", ...(right ? { borderRight: "1px solid var(--border)" } : { borderLeft: "1px solid var(--border)" }), flexShrink: 0 }),
    chat: { flex: 1 },
    cmdBar: { height: large ? 32 : 12, background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", gap: large ? 5 : 3, padding: large ? "0 8px" : "0 4px" },
    rail: { width: large ? 24 : 10, background: "var(--surface)", borderRight: "1px solid var(--border)", flexShrink: 0 },
    floatBar: { height: large ? 28 : 10, background: "var(--surface-raised)", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", gap: large ? 5 : 3, padding: large ? "0 8px" : "0 4px" },
  };

  const chip = (label) => (
    <div style={{ height: large ? 20 : 5, minWidth: large ? 0 : 8, borderRadius: large ? 4 : 2, background: "var(--accent-subtle)", border: "1px solid var(--accent-line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "var(--accent)", fontWeight: 600, fontFamily: "var(--font-sans)", padding: large ? "0 6px" : 0, flexShrink: 0, lineHeight: 1 }}>
      {large ? label : ""}
    </div>
  );

  const sidebtn = (label) => (
    <div style={{ height: large ? 20 : 5, borderRadius: large ? 4 : 2, background: "var(--accent-subtle)", border: "1px solid var(--accent-line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "var(--accent)", fontWeight: 600, fontFamily: "var(--font-sans)", padding: large ? "0 6px" : 0, margin: large ? "0 6px 5px" : "0 4px 3px", lineHeight: 1 }}>
      {large ? label : ""}
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.top} />
      <div style={s.body}>
        {id === "klasik" && (
          <>
            <div style={s.panel("22%", true)} />
            <div style={s.chat} />
            <div style={{ ...s.panel("27%", false), display: "flex", flexDirection: "column", paddingTop: large ? 10 : 4 }}>
              {sidebtn("Test")}
              {sidebtn("Özet")}
              {sidebtn("Yol Haritası")}
            </div>
          </>
        )}
        {id === "komut" && (
          <>
            <div style={s.panel("25%", true)} />
            <div style={{ ...s.chat, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1 }} />
              <div style={s.cmdBar}>
                {chip("Test")}
                {chip("Özet")}
                {chip("Yol Haritası")}
              </div>
            </div>
          </>
        )}
        {id === "odak" && (
          <>
            <div style={s.rail} />
            <div style={{ ...s.chat, display: "flex", flexDirection: "column" }}>
              <div style={s.floatBar}>
                {chip("Test")}
                {chip("Özet")}
                {chip("Yol Haritası")}
              </div>
              <div style={{ flex: 1 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [theme, setTheme] = useState("dark");
  const [profile, setProfile] = useState({ username: "", email: "", first_name: "", last_name: "", fullname: "", profile_photo: null });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameMsg, setNameMsg] = useState(null);
  const [usernameMsg, setUsernameMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [photoMsg, setPhotoMsg] = useState(null);

  const [savedLayout, setSavedLayout] = useState("klasik");
  const [currentAccent, setCurrentAccent] = useState("amber");
  const [layoutPreview, setLayoutPreview] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    setTheme(getTheme());
    setSavedLayout(getPreference("layout", "klasik"));
    setCurrentAccent(getPreference("accent", "amber"));
    fetchProfile();
  }, [router]);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/profile/", { headers: getAuthHeader() });
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
        setFirstNameInput(d.first_name || "");
        setLastNameInput(d.last_name || "");
        setUsernameInput(d.username || "");
        setAvatarPreview(d.profile_photo || null);
      }
    } catch {}
    setLoading(false);
  }

  async function patchProfile(formData) {
    const res = await fetch("/api/auth/profile/", { method: "PATCH", headers: getAuthHeader(), body: formData });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: d };
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    uploadPhoto(file);
  }

  async function uploadPhoto(file) {
    setSaving(true); setPhotoMsg(null);
    const fd = new FormData();
    fd.append("profile_photo", file);
    try {
      const { ok, status, data } = await patchProfile(fd);
      if (ok) { setPhotoMsg({ ok: true, text: "Fotoğraf güncellendi." }); fetchProfile(); }
      else setPhotoMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Bekleyin." : data.error || `Hata (${status}).` });
    } catch { setPhotoMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function saveName() {
    setSaving(true); setNameMsg(null);
    const fd = new FormData();
    fd.append("first_name", firstNameInput.trim());
    fd.append("last_name", lastNameInput.trim());
    try {
      const { ok, status, data } = await patchProfile(fd);
      if (ok) { setNameMsg({ ok: true, text: "Ad/soyad güncellendi." }); setProfile((p) => ({ ...p, first_name: firstNameInput.trim(), last_name: lastNameInput.trim() })); }
      else setNameMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Bekleyin." : data.error || `Hata (${status}).` });
    } catch { setNameMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function saveUsername() {
    if (!usernameInput.trim()) return;
    setSaving(true); setUsernameMsg(null);
    const fd = new FormData();
    fd.append("username", usernameInput.trim());
    try {
      const { ok, status, data } = await patchProfile(fd);
      if (ok) { setUsernameMsg({ ok: true, text: "Kullanıcı adı güncellendi." }); setProfile((p) => ({ ...p, username: usernameInput.trim() })); }
      else setUsernameMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Bekleyin." : data.error || `Hata (${status}).` });
    } catch { setUsernameMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function changePassword() {
    if (!oldPassword || !newPassword) { setPasswordMsg({ ok: false, text: "Tüm alanları doldurun." }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ ok: false, text: "Yeni şifreler eşleşmiyor." }); return; }
    setSaving(true); setPasswordMsg(null);
    const fd = new FormData();
    fd.append("old_password", oldPassword);
    fd.append("new_password", newPassword);
    try {
      const { ok, status, data } = await patchProfile(fd);
      if (ok) { setPasswordMsg({ ok: true, text: "Şifre güncellendi." }); setOldPassword(""); setNewPassword(""); setConfirmPassword(""); }
      else setPasswordMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Bekleyin." : data.error || `Hata (${status}).` });
    } catch { setPasswordMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try { await fetch("/api/auth/logout/", { method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); } catch {}
    }
    removeToken();
    router.push("/login");
  }

  function pickAccent(id) {
    setCurrentAccent(id);
    applyAccent(id);
    setPreference("accent", id);
  }

  function confirmLayout(id) {
    setSavedLayout(id);
    setPreference("layout", id);
    setLayoutPreview(null);
  }

  const initials = (profile.first_name || profile.username || "K").slice(0, 2).toUpperCase();
  const Msg = ({ m }) => m ? <p className={`profile-msg ${m.ok ? "ok" : "err"}`}>{m.text}</p> : null;

  if (loading) return (
    <div className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <span className="spin" style={{ color: "var(--accent)" }}><Icon name="loader" size={28} /></span>
    </div>
  );

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="topnav">
          <div className="brand" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard")}><span className="logo"><Icon name="network" size={24} /></span><span className="wm">Tualem<small>AI</small></span></div>
          <div className="right">
            <button className="icon-btn" onClick={() => setTheme(toggleThemeFn())} title="Tema"><Icon name={theme === "dark" ? "sun" : "moon"} size={18} /></button>
          </div>
        </div>

        <div className="profile-scroll">
          <div className="profile-wrap">
            <button className="btn btn-ghost" onClick={() => router.push("/dashboard")} style={{ marginBottom: "var(--sp-5)", paddingLeft: 0 }}><Icon name="arrow-left" size={16} />Not defterleri</button>
            <h1>Profil</h1>
            <p className="pw-sub">Hesap bilgilerinizi ve oturum tercihlerinizi yönetin.</p>

            {/* Avatar */}
            <div className="avatar-row">
              <div className="avatar-lg">{avatarPreview ? <img src={avatarPreview} alt="" /> : initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="serif" style={{ fontSize: "var(--text-xl)" }}>{profile.fullname || profile.username}</div>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>@{profile.username} · {profile.email}</div>
                <Msg m={photoMsg} />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
              <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={saving}><Icon name="camera" size={16} />Avatarı değiştir</button>
            </div>

            {/* Ad / Soyad */}
            <div className="profile-card">
              <h3>Kişisel bilgiler</h3>
              <div className="form-rows">
                <div className="form-2col">
                  <div className="field"><label>Ad</label><div className="input"><input value={firstNameInput} onChange={(e) => setFirstNameInput(e.target.value)} /></div></div>
                  <div className="field"><label>Soyad</label><div className="input"><input value={lastNameInput} onChange={(e) => setLastNameInput(e.target.value)} /></div></div>
                </div>
                <Msg m={nameMsg} />
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={saveName} disabled={saving}><Icon name="check" size={16} />Kaydet</button>
              </div>
            </div>

            {/* Kullanıcı adı */}
            <div className="profile-card">
              <h3>Kullanıcı adı</h3>
              <div className="form-rows">
                <div className="field"><div className="input"><Icon name="at-sign" size={16} /><input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} /></div></div>
                <Msg m={usernameMsg} />
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={saveUsername} disabled={saving}><Icon name="check" size={16} />Kaydet</button>
              </div>
            </div>

            {/* Şifre */}
            <div className="profile-card">
              <h3>Şifre değiştir</h3>
              <div className="form-rows">
                <div className="field"><label>Mevcut şifre</label><div className="input"><Icon name="lock" size={16} /><input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="••••••••" /></div></div>
                <div className="form-2col">
                  <div className="field"><label>Yeni şifre</label><div className="input"><Icon name="lock" size={16} /><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" /></div></div>
                  <div className="field"><label>Yeni şifre (tekrar)</label><div className="input"><Icon name="lock" size={16} /><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" /></div></div>
                </div>
                <Msg m={passwordMsg} />
                <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={changePassword} disabled={saving}><Icon name="check" size={16} />Şifreyi güncelle</button>
              </div>
            </div>

            {/* Tercihler */}
            <div className="profile-card">
              <h3>Çalışma Alanı Tercihleri</h3>

              <div className="pref-section">
                <div className="pref-label">Düzen</div>
                <div className="layout-picker">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button key={opt.id} className={`lp-btn${savedLayout === opt.id ? " active" : ""}`} onClick={() => setLayoutPreview(opt.id)}>
                      <LayoutMockup id={opt.id} />
                      <span className="lp-name">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pref-section">
                <div className="pref-label">Vurgu Rengi</div>
                <div className="accent-swatches">
                  {ACCENT_PALETTES.map((a) => (
                    <button key={a.id} className={`accent-sw${currentAccent === a.id ? " active" : ""}`}
                      style={{ background: `oklch(0.720 0.140 ${a.h})` }}
                      onClick={() => pickAccent(a.id)}
                      title={a.label}
                    />
                  ))}
                </div>
                <div className="accent-preview-bar">
                  <button className="btn btn-primary" style={{ fontSize: 13, padding: "7px 16px" }}>Örnek buton</button>
                  <span className="status st-ready" style={{ fontSize: 12 }}><Icon name="check-circle" size={11} />Kaynak aktif</span>
                  <span className="src-badge" style={{ background: "var(--accent)", border: "none", cursor: "default" }}>1</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button className="btn btn-danger" onClick={handleLogout}><Icon name="log-out" size={16} />Çıkış yap</button>
            </div>
          </div>
        </div>
      </div>

      {layoutPreview && (
        <div className="overlay" onClick={() => setLayoutPreview(null)}>
          <div className="modal" style={{ width: "min(520px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="mh-lt">
                <span className="mh-ic"><Icon name="maximize" size={20} /></span>
                <div>
                  <h2>{LAYOUT_OPTIONS.find((o) => o.id === layoutPreview)?.label} Düzeni</h2>
                  <div className="mh-sub">Ön izleme</div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setLayoutPreview(null)}><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: "var(--sp-6)" }}>
              <LayoutMockup id={layoutPreview} large />
              <p style={{ color: "var(--text-muted)", marginTop: "var(--sp-4)", fontSize: "var(--text-sm)", lineHeight: 1.5 }}>
                {LAYOUT_OPTIONS.find((o) => o.id === layoutPreview)?.desc}
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setLayoutPreview(null)}>İptal</button>
              <button className="btn btn-primary" onClick={() => confirmLayout(layoutPreview)}>
                <Icon name="check" size={16} />Bu düzeni kullan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
