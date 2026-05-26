"use client";

import { useState } from "react";
import "../auth.css";

export default function ProfilePage() {
  const [showModal, setShowModal] = useState(false);

  const [userData, setUserData] = useState({
    username: "Tugba",
    email: "tugba@example.com",
    image:
      "https://ui-avatars.com/api/?name=Tugba&background=7c3aed&color=fff",
  });

  const [formData, setFormData] = useState({
    username: userData.username,
    email: userData.email,
    password1: "",
    password2: "",
  });

  const openProfileModal = () => {
    setShowModal(true);
  };

  const closeProfileModal = () => {
    setShowModal(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (
      formData.password1 !== "" &&
      formData.password1 !== formData.password2
    ) {
      alert("Şifreler eşleşmiyor!");
      return;
    }

    setUserData({
      ...userData,
      username: formData.username,
      email: formData.email,
    });

    alert("Profil güncellendi!");
    closeProfileModal();
  };

  return (
    <div className="profile-page">
      <div className="profile-left">
        <div className="profile-card">
          <div className="profile-avatar">
            <img src={userData.image} alt="profile" />
          </div>

          <h1>{userData.username}</h1>

          <p>{userData.email}</p>

          <button
            className="edit-btn"
            onClick={openProfileModal}
          >
            Profili Düzenle
          </button>
        </div>
      </div>

      <div className="profile-right">
        <div className="profile-stats">
          <div className="stat-box">
            <h2>12</h2>
            <p>Kaynak</p>
          </div>

          <div className="stat-box">
            <h2>48</h2>
            <p>AI Sohbeti</p>
          </div>

          <div className="stat-box">
            <h2>19</h2>
            <p>Analiz</p>
          </div>
        </div>

        <div className="activity-box">
          <h2>Son Aktiviteler</h2>

          <div className="activity-item">
            📄 Yeni kaynak eklendi
          </div>

          <div className="activity-item">
            🧠 AI analiz oluşturdu
          </div>

          <div className="activity-item">
            💬 Yeni sohbet başlatıldı
          </div>
        </div>
      </div>

      {showModal && (
        <div className="profile-modal">
          <div className="profile-modal-content">
            <div className="modal-top">
              <h2>Profili Düzenle</h2>

              <button
                onClick={closeProfileModal}
                className="close-modal-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Kullanıcı Adı</label>

              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
              />

              <label>Email</label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />

              <label>Yeni Şifre</label>

              <input
                type="password"
                name="password1"
                value={formData.password1}
                onChange={handleChange}
              />

              <label>Şifre Tekrar</label>

              <input
                type="password"
                name="password2"
                value={formData.password2}
                onChange={handleChange}
              />

              <label>Profil Fotoğrafı</label>

              <input type="file" />

              <button
                type="submit"
                className="save-profile-btn"
              >
                Değişiklikleri Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
