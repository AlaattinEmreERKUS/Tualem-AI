import "./globals.css";
import "./styles/tokens.css";
import "./styles/proto.css";
import "./styles/workspace.css";
import "./styles/modals.css";

export const metadata = {
  title: "Tualem AI | Akıllı Araştırma Asistanı",
  description: "Graph RAG tabanlı kişisel araştırma asistanı.",
};

// Tema ve accent flash önleme — render öncesi uygula
const themeInit = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.dataset.theme=t;document.documentElement.dataset.density='ferah';var AH={amber:62,sari:85,yesil:155,mavi:250,mor:290,pembe:340,kirmizi:25};var a=localStorage.getItem('tualem_pref_accent')||'amber';document.documentElement.style.setProperty('--accent-h',String(AH[a]||62));}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="tr" data-theme="dark" data-density="ferah">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
