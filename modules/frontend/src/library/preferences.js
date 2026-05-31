export const ACCENT_PALETTES = [
  { id: "amber",    label: "Amber",    h: 62  },
  { id: "sari",     label: "Sarı",     h: 85  },
  { id: "yesil",    label: "Yeşil",    h: 155 },
  { id: "mavi",     label: "Mavi",     h: 250 },
  { id: "mor",      label: "Mor",      h: 290 },
  { id: "pembe",    label: "Pembe",    h: 340 },
  { id: "kirmizi",  label: "Kırmızı",  h: 25  },
];

export const LAYOUT_OPTIONS = [
  { id: "klasik", label: "Klasik", desc: "Kaynaklar solda, işlemler sağda, sohbet ortada. Tam kontrol." },
  { id: "komut",  label: "Komut",  desc: "Kaynak paneli + geniş sohbet alanı. İşlemler alttaki çubukta." },
  { id: "odak",   label: "Odak",   desc: "Minimal kenar rayı. Paneller gerektiğinde açılır, sohbet ön planda." },
];

export function getPreference(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return localStorage.getItem(`tualem_pref_${key}`) || fallback; } catch { return fallback; }
}

export function setPreference(key, value) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`tualem_pref_${key}`, value); } catch {}
}

export function applyAccent(accentId) {
  if (typeof window === "undefined") return;
  const p = ACCENT_PALETTES.find((a) => a.id === accentId);
  if (p) document.documentElement.style.setProperty("--accent-h", String(p.h));
}
