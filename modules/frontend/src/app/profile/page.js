"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeader, getTokenPayload, isAuthenticated, removeToken } from "@/lib/auth";
import "../auth.css";

export default function ProfilePage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [userData, setUserData] = useState({ username: "", email: "", image: "" });
  const [formData, setFormData] = useState({ username: "", email: "" });
  const [docCount, setDocCount] = useState(0);
  const [roomCount, setRoomCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    const payload = getTokenPayload();
    if (payload) {
      const uname = payload.username || "";
      const email = payload.email || "";
      setUserData({
        username: uname,
        email,
        image: `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=7c3aed&color=fff`,
      });
      setFormData({ username: uname, email });
    }
    fetchCounts();
  }, [router]);

  async function fetchCounts() {
    try {
      const [docsRes, roomsRes] = await Promise.all([
        fetch("/api/documents/", { headers: getAuthHeader() }),
        fetch("/api/chat/rooms/", { headers: getAuthHeader() }),
      ]);
      if (docsRes.ok) {
        const d = await docsRes.json();
        setDocCount((d.results ?? d).length);
      }
      if (roomsRes.ok) {
        const r = await roomsRes.json();
        setRoomCount((r.results ?? r).length);
      }
    } catch {}
  }

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  return (
    <div className="profile-page">
      <div className="profile-left">
        <div className="profile-card">
          <div className="profile-avatar">
            {userData.image && <img src={userData.image} alt="profile" />}
          </div>
          <h1>{userData.username}</h1>
          <p>{userData.email}</p>
          <button className="edit-btn" onClick={() => setShowModal(true)}>Profili Düzenle</button>
          <button className="edit-btn" style={{ marginTop: "8px", background: "rgba(255,0,0,0.15)" }} onClick={handleLogout}>Çıkış Yap</button>
        </div>
      </div>

      <div className="profile-right">
        <div className="profile-stats">
          <div className="stat-box">
            <h2>{docCount}</h2>
            <p>Kaynak</p>
          </div>
          <div className="stat-box">
            <h2>{roomCount}</h2>
            <p>Sohbet</p>
          </div>
          <div className="stat-box">
            <h2>{docCount}</h2>
            <p>Analiz</p>
          </div>
        </div>

        <div className="activity-box">
          <h2>Hızlı Erişim</h2>
          <div className="activity-item" style={{ cursor: "pointer" }} onClick={() => router.push("/dashboard")}>
            💬 Dashboard&apos;a git
          </div>
          <div className="activity-item">
            📄 {docCount} belge yüklendi
          </div>
          <div className="activity-item">
            🧠 {roomCount} sohbet oluşturuldu
          </div>
        </div>
      </div>

      {showModal && (
        <div className="profile-modal">
          <div className="profile-modal-content">
            <div className="modal-top">
              <h2>Profili Düzenle</h2>
              <button onClick={() => setShowModal(false)} className="close-modal-btn">✕</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); setUserData((prev) => ({ ...prev, username: formData.username, email: formData.email })); setShowModal(false); }}>
              <label>Kullanıcı Adı</label>
              <input type="text" name="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              <button type="submit" className="save-profile-btn">Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
