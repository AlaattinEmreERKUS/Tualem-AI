// app/home.jsx — Ana sayfa: Not Defterleri grid'i

function TopNav({ theme, onToggleTheme, onProfile, onTweaksHint }) {
  return (
    <div className="topnav">
      <div className="brand">
        <span className="logo"><Icon name="network" size={24} /></span>
        <span className="wm">Tualem<small>AI</small></span>
      </div>
      <div className="right">
        <button className="icon-btn" onClick={onToggleTheme} title="Tema değiştir">
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <button className="icon-btn" title="Ayarlar"><Icon name="settings" size={18} /></button>
        <div className="avatar" onClick={onProfile} title="Profil">AY</div>
      </div>
    </div>
  );
}

function NotebookCard({ nb, onOpen, onToggleFav, onMenu, menuOpen, onCloseMenu, onDelete }) {
  return (
    <div className="nb-card" onClick={() => onOpen(nb)}>
      <div className="nb-top">
        <div className="nb-ic" style={{ background: `color-mix(in oklab, ${srcColorN(nb.color)} 18%, transparent)`, color: srcColorN(nb.color) }}>
          <Icon name="book-open" size={20} />
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className={cx('icon-btn', 'fav-star', nb.fav && 'on')} onClick={(e) => { e.stopPropagation(); onToggleFav(nb.id); }} title="Favori">
            <Icon name="star" size={17} style={nb.fav ? { fill: 'currentColor' } : {}} />
          </button>
          <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onMenu(nb.id); }} title="Menü">
            <Icon name="more-vertical" size={17} />
          </button>
        </div>
      </div>
      <h3>{nb.title}</h3>
      <div className="nb-meta">
        <Icon name="file-text" size={13} />
        <span>{nb.sources} kaynak</span>
        <span className="dotsep"></span>
        <span>{nb.date}</span>
      </div>

      {menuOpen && (
        <div className="menu" style={{ top: 44, right: 12 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { onToggleFav(nb.id); onCloseMenu(); }}>
            <Icon name="star" size={16} />{nb.fav ? 'Favoriden çıkar' : 'Favorile'}
          </button>
          <button onClick={onCloseMenu}><Icon name="pencil" size={16} />Yeniden adlandır</button>
          <div className="sep"></div>
          <button className="danger" onClick={() => { onDelete(nb.id); onCloseMenu(); }}>
            <Icon name="trash" size={16} />Sil
          </button>
        </div>
      )}
    </div>
  );
}

const srcColorN = (i) => `var(--src-${(i % 5) + 1})`;

function HomeScreen({ theme, onToggleTheme, onOpenNotebook, onProfile }) {
  const [notebooks, setNotebooks] = usePersistentState('tualem_notebooks', NOTEBOOKS);
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState(null);

  useEffect(() => {
    const close = () => setMenuId(null);
    if (menuId) { window.addEventListener('click', close); return () => window.removeEventListener('click', close); }
  }, [menuId]);

  const toggleFav = (id) => setNotebooks(ns => ns.map(n => n.id === id ? { ...n, fav: !n.fav } : n));
  const del = (id) => setNotebooks(ns => ns.filter(n => n.id !== id));
  const createNotebook = () => {
    const nb = { id: 'nb' + Date.now(), title: 'Adsız not defteri', date: 'Az önce', sources: 0, fav: false, color: Math.floor(Math.random() * 5) + 1, empty: true };
    setNotebooks(ns => [nb, ...ns]);
    onOpenNotebook(nb, true);
  };

  const filtered = notebooks.filter(n => n.title.toLowerCase().includes(query.toLowerCase()));
  const favs = filtered.filter(n => n.fav);
  const rest = filtered.filter(n => !n.fav);

  const renderCard = (nb) => (
    <NotebookCard
      key={nb.id} nb={nb}
      onOpen={() => onOpenNotebook(nb, !!nb.empty)}
      onToggleFav={toggleFav}
      onMenu={(id) => setMenuId(m => m === id ? null : id)}
      menuOpen={menuId === nb.id}
      onCloseMenu={() => setMenuId(null)}
      onDelete={del}
    />
  );

  return (
    <div className="app-shell">
      <TopNav theme={theme} onToggleTheme={onToggleTheme} onProfile={onProfile} />
      <div className="home-scroll">
        <div className="home-wrap">
          <h1 className="greeting">Merhaba, Arda</h1>
          <p className="home-sub">Kaldığınız yerden devam edin ya da yeni bir çalışma seansı başlatın.</p>

          <div className="home-toolbar">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input placeholder="Not defterlerinde ara…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={createNotebook}>
              <Icon name="plus" size={16} />Yeni not defteri
            </button>
          </div>

          {notebooks.length === 0 ? (
            <div className="empty-state">
              <div className="es-ic"><Icon name="book-open" size={28} /></div>
              <h3>Henüz not defteriniz yok</h3>
              <p>İlk araştırma seansınızı başlatın: belgelerinizi yükleyin, arXiv makalelerini ekleyin ve kaynaklarınıza soru sormaya başlayın.</p>
              <button className="btn btn-primary btn-lg" onClick={createNotebook}><Icon name="plus" size={18} />İlk not defterini oluştur</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-search">
              <div className="es-ic"><Icon name="search" size={32} /></div>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>"{query}" için sonuç yok</div>
              <div style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>Farklı bir arama deneyin.</div>
            </div>
          ) : (
            <>
              {favs.length > 0 && (
                <>
                  <div className="section-label">
                    <Icon name="star" size={13} style={{ fill: 'currentColor', color: 'var(--accent)' }} />
                    Favoriler<span className="ln"></span>
                  </div>
                  <div className="nb-grid">{favs.map(renderCard)}</div>
                </>
              )}

              <div className="section-label">
                <Icon name="folder" size={13} />
                Tüm not defterleri<span className="ln"></span>
              </div>
              <div className="nb-grid">
                {rest.map(renderCard)}
                <div className="nb-card nb-new" onClick={createNotebook}>
                  <div className="plus-circ"><Icon name="plus" size={20} /></div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Yeni not defteri</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, TopNav });
