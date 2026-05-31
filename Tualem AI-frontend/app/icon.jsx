// app/icon.jsx — paylaşılan React yardımcıları
const { useState, useEffect, useRef, useCallback } = React;

// Lucide ikon bileşeni (window.TUALEM_ICONS'tan okur)
function Icon({ name, size = 20, stroke = 1.75, className = '', style = {} }) {
  const inner = (window.TUALEM_ICONS && window.TUALEM_ICONS[name]) || window.TUALEM_ICONS.circle;
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: '0 0 auto', display: 'block', ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

// localStorage'a bağlı state (yenilemede konum/durum korunur)
function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s !== null ? JSON.parse(s) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

// Basit className birleştirici
const cx = (...a) => a.filter(Boolean).join(' ');

// Kaynak rengi tokenı
const srcColor = (i) => `var(--src-${((i) % 5) + 1})`;

Object.assign(window, { Icon, usePersistentState, cx, srcColor });
