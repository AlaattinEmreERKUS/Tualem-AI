import "./globals.css";
import "./styles/tokens.css";
import "./styles/proto.css";
import "./styles/workspace.css";
import "./styles/modals.css";

export const metadata = {
  title: "Tualem AI | Akıllı Araştırma Asistanı",
  description: "Graph RAG tabanlı kişisel araştırma asistanı.",
};

// Tema flash'ını önle — render öncesi data-theme uygula
const themeInit = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.dataset.theme=t;document.documentElement.dataset.density='ferah';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

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
