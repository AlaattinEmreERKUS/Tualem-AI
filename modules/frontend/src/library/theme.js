"use client";

export function getTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme || "dark";
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch {}
}

export function toggleTheme() {
  const next = getTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
