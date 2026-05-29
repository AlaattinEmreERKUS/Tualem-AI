"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeader, isAuthenticated, removeToken, getToken } from "@/lib/auth";
import "../auth.css";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({ username: "", email: "", fullname: "", profile_photo: null });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(true);

  const [usernameInput, setUsernameInput] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [usernameMsg, setUsernameMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [photoMsg, setPhotoMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchProfile();
  }, [router]);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/profile/", { headers: getAuthHeader() });
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
        setUsernameInput(d.username || "");
        setAvatarPreview(d.profile_photo || null);
      }
    } catch {}
    setLoading(false);
  }

  function handlePhotoSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    uploadPhoto(file);
  }

  async function patchProfile(formData) {
    const res = await fetch("/api/auth/profile/", { method: "PATCH", headers: getAuthHeader(), body: formData });
    const d = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: d };
  }

  async function uploadPhoto(file) {
    setSaving(true);
    setPhotoMsg(null);
    const formData = new FormData();
    formData.append("profile_photo", file);
    try {
      const { ok, status, data } = await patchProfile(formData);
      if (ok) setPhotoMsg({ ok: true, text: "Fotoğraf güncellendi." });
      else setPhotoMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Lütfen bekleyin." : data.error || `Hata (${status}).` });
    } catch { setPhotoMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function saveUsername() {
    if (!usernameInput.trim()) return;
    setSaving(true);
    setUsernameMsg(null);
    const formData = new FormData();
    formData.append("username", usernameInput.trim());
    try {
      const { ok, status, data } = await patchProfile(formData);
      if (ok) {
        setUsernameMsg({ ok: true, text: "Kullanıcı adı güncellendi." });
        setProfile((p) => ({ ...p, username: usernameInput.trim() }));
      } else {
        setUsernameMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Lütfen bekleyin." : data.error || `Hata (${status}).` });
      }
    } catch { setUsernameMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function changePassword() {
    if (!oldPassword || !newPassword) { setPasswordMsg({ ok: false, text: "Tüm alanları doldurun." }); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg({ ok: false, text: "Yeni şifreler eşleşmiyor." }); return; }
    setSaving(true);
    setPasswordMsg(null);
    const formData = new FormData();
    formData.append("old_password", oldPassword);
    formData.append("new_password", newPassword);
    try {
      const { ok, status, data } = await patchProfile(formData);
      if (ok) {
        setPasswordMsg({ ok: true, text: "Şifre güncellendi." });
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      } else {
        setPasswordMsg({ ok: false, text: status === 429 ? "Çok fazla istek. Lütfen bekleyin." : data.error || `Hata (${status}).` });
      }
    } catch { setPasswordMsg({ ok: false, text: "Bağlantı hatası." }); }
    setSaving(false);
  }

  async function handleLogout() {
    const token = getToken();
    if (token) {
      try {
        await fetch("/api/auth/logout/", { method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      } catch {}
    }
    removeToken();
    router.push("/login");
  }

  const avatarUrl = avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username || "U")}&background=7c3aed&color=fff&size=128`;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><p style={{ color: "var(--light-text)" }}>Yükleniyor...</p></div>;

  return (
    <div style={{ minHeight: "100vh", padding: "2rem", maxWidth: "640px", margin: "0 auto" }}>

      {/* Geri + Çıkış */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2rem" }}>
        <button onClick={() => router.push("/dashboard")} style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", padding: "8px 16px", fontSize: "0.85rem" }}>
          ← Dashboard
        </button>
        <button onClick={handleLogout} style={{ background: "rgba(255,0,0,0.2)", border: "none", borderRadius: "8px", color: "var(--light-text)", cursor: "pointer", padding: "8px 16px", fontSize: "0.85rem" }}>
          Çıkış Yap
        </button>
      </div>

      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <img src={avatarUrl} alt="Profil" style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(124,58,237,0.6)" }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ position: "absolute", bottom: 0, right: 0, background: "rgba(124,58,237,0.9)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: "0.75rem" }}
          >
            ✏️
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoSelect} />
        <p style={{ color: "var(--light-text)", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.75rem", marginBottom: 0 }}>{profile.fullname || profile.username}</p>
        <p style={{ color: "var(--light-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>{profile.email}</p>
        {photoMsg && <p style={{ color: photoMsg.ok ? "#4ade80" : "#f87171", fontSize: "0.82rem", marginTop: "0.5rem" }}>{photoMsg.text}</p>}
      </div>

      {/* Kullanıcı adı */}
      <div style={{ background: "var(--panel-bg)", borderRadius: "12px", padding: "1.5rem", marginBottom: "1rem" }}>
        <h4 style={{ color: "var(--light-text)", margin: "0 0 1rem" }}>Kullanıcı Adı</h4>
        <input
          type="text"
          className="chat-input"
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
          style={{ width: "100%", marginBottom: "0.75rem" }}
        />
        {usernameMsg && <p style={{ color: usernameMsg.ok ? "#4ade80" : "#f87171", fontSize: "0.82rem", margin: "0 0 0.5rem" }}>{usernameMsg.text}</p>}
        <button onClick={saveUsername} disabled={saving} style={{ background: "rgba(124,58,237,0.7)", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", padding: "8px 20px", fontWeight: 600 }}>
          Kaydet
        </button>
      </div>

      {/* Şifre değiştir */}
      <div style={{ background: "var(--panel-bg)", borderRadius: "12px", padding: "1.5rem" }}>
        <h4 style={{ color: "var(--light-text)", margin: "0 0 1rem" }}>Şifre Değiştir</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input type="password" className="chat-input" placeholder="Mevcut şifre" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          <input type="password" className="chat-input" placeholder="Yeni şifre" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input type="password" className="chat-input" placeholder="Yeni şifre (tekrar)" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        {passwordMsg && <p style={{ color: passwordMsg.ok ? "#4ade80" : "#f87171", fontSize: "0.82rem", margin: "0.5rem 0" }}>{passwordMsg.text}</p>}
        <button onClick={changePassword} disabled={saving} style={{ marginTop: "0.75rem", background: "rgba(124,58,237,0.7)", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", padding: "8px 20px", fontWeight: 600 }}>
          Şifreyi Güncelle
        </button>
      </div>
    </div>
  );
}
