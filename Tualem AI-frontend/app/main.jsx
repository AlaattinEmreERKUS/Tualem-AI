// app/main.jsx — kök uygulama: yönlendirme, tema, Tweaks

const ACCENTS = [
  { hex: '#c98a4e', h: 62 },   // amber
  { hex: '#4f80e8', h: 250 },  // mavi
  { hex: '#1c9d80', h: 165 },  // teal
  { hex: '#7c6cf0', h: 285 },  // indigo
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "accent": "#c98a4e",
  "density": "ferah",
  "layout": "klasik"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = usePersistentState('tualem_route', 'auth');
  const [nbObj, setNbObj] = usePersistentState('tualem_nbobj', null);
  const [emptyNb, setEmptyNb] = usePersistentState('tualem_empty', false);
  const [modalActive, setModalActive] = useState(null);

  // Tema + accent + yoğunluk uygula
  useEffect(() => {
    document.documentElement.dataset.theme = t.theme;
    document.documentElement.dataset.density = t.density;
    const acc = ACCENTS.find(a => a.hex === t.accent) || ACCENTS[0];
    document.documentElement.style.setProperty('--accent-h', acc.h);
  }, [t.theme, t.density, t.accent]);

  const toggleTheme = () => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark');
  const notebook = nbObj || window.NOTEBOOKS[0];

  const openNotebook = (nb, empty = false) => { setNbObj(nb); setEmptyNb(empty); setRoute('workspace'); };

  let screen;
  if (route === 'auth') {
    screen = <AuthScreen onAuth={() => setRoute('home')} theme={t.theme} onToggleTheme={toggleTheme} />;
  } else if (route === 'home') {
    screen = <HomeScreen theme={t.theme} onToggleTheme={toggleTheme} onOpenNotebook={openNotebook} onProfile={() => setRoute('profile')} />;
  } else if (route === 'workspace') {
    screen = <Workspace notebook={notebook} emptyStart={emptyNb} theme={t.theme} onToggleTheme={toggleTheme} onHome={() => setRoute('home')} onProfile={() => setRoute('profile')} layout={t.layout} onActiveModal={setModalActive} />;
  } else {
    screen = <ProfileScreen theme={t.theme} onToggleTheme={toggleTheme} onHome={() => setRoute('home')} onProfile={() => setRoute('profile')} />;
  }

  return (
    <>
      {screen}
      <TweaksPanel>
        <TweakSection label="Tema" />
        <TweakRadio label="Görünüm" value={t.theme} options={['dark', 'light']} onChange={(v) => setTweak('theme', v)} />
        <TweakColor label="Vurgu rengi" value={t.accent} options={ACCENTS.map(a => a.hex)} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Düzen" />
        <TweakRadio label="Yoğunluk" value={t.density} options={['ferah', 'dengeli', 'sıkı']} onChange={(v) => setTweak('density', v)} />
        <TweakSelect label="Çalışma alanı düzeni" value={t.layout}
          options={[
            { value: 'klasik', label: 'Klasik — 3 panel' },
            { value: 'komut', label: 'Komut — alt çubuk' },
            { value: 'odak', label: 'Odak — slim rail' },
          ]}
          onChange={(v) => { setTweak('layout', v); if (route !== 'workspace') openNotebook(notebook); }} />
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)', padding: '4px 2px 0', lineHeight: 1.5 }}>
          Düzen varyasyonları Çalışma Alanı ekranında görünür.
        </div>
        <TweakSection label="Demo" />
        <TweakSelect label="Ekrana git" value={route}
          options={[
            { value: 'auth', label: 'Giriş / Kayıt' },
            { value: 'home', label: 'Ana sayfa' },
            { value: 'workspace', label: 'Çalışma alanı' },
            { value: 'profile', label: 'Profil' },
          ]}
          onChange={(v) => setRoute(v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
