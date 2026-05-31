// app/workspace.jsx — Çalışma Alanı: 3 panel + 3 düzen varyasyonu

function PanelHead({ icon, title, count, children }) {
  return (
    <div className="panel-head">
      <div className="lt">
        <Icon name={icon} size={15} style={{ color: 'var(--text-muted)' }} />
        <span className="ttl">{title}</span>
        {count != null && <span className="cnt">{count}</span>}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>{children}</div>
    </div>
  );
}

function ChatColumn({ chat, typing, onSend, onFollow, layout, topSlot, bottomSlot, emptyState }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat, typing]);

  const showEmpty = emptyState && chat.filter(m => m.role !== 'system').length === 0 && !typing;

  return (
    <div className={cx('panel-chat', 'layout-' + layout)} style={{ position: 'relative' }}>
      {topSlot}
      {showEmpty ? emptyState : (
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {chat.map(m => {
            if (m.role === 'system') return <SystemMessage key={m.id} text={m.text} />;
            if (m.role === 'user') return <UserMessage key={m.id} text={m.text} />;
            return <AiMessage key={m.id} msg={m} onFollow={onFollow} onCopy={() => {}} />;
          })}
          {typing && <TypingBubble />}
        </div>
      </div>
      )}
      {bottomSlot}
      <Composer onSend={onSend} disabled={typing} />
    </div>
  );
}

function SourceManagerOverlay({ sources, onToggle, onDelete, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 'min(880px, 94vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="panel-head" style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
          <div className="lt"><Icon name="folder" size={18} style={{ color: 'var(--accent)' }} /><span className="ttl" style={{ fontSize: 'var(--text-md)' }}>Kaynak Yöneticisi</span><span className="cnt">{sources.length}</span></div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ padding: 'var(--sp-5) var(--sp-6)', overflowY: 'auto' }}>
          <div className="upload-zone" style={{ marginBottom: 'var(--sp-5)', padding: 'var(--sp-8)' }}>
            <Icon name="upload" size={26} />
            <div className="uz-t">Belge yükleyin veya arXiv bağlantısı yapıştırın</div>
            <div className="uz-d">PDF · DOCX · PPTX · arXiv ID</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <SourcesList sources={sources} onToggle={onToggle} onDelete={onDelete} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Workspace({ notebook, emptyStart, theme, onToggleTheme, onHome, onProfile, layout, onActiveModal }) {
  const [chat, setChat] = useState(emptyStart ? [] : INITIAL_CHAT);
  const [sources, setSources] = useState(emptyStart ? [] : SOURCES);
  const [typing, setTyping] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [slideover, setSlideover] = useState(null); // odak: 'sources' | 'actions'
  const [modal, setModal] = useState(null); // 'quiz' | 'roadmap' | 'summary'

  useEffect(() => { onActiveModal && onActiveModal(modal); }, [modal]);

  const isEmpty = sources.length === 0;

  const toggleSrc = (id) => setSources(ss => ss.map(s => s.id === id ? { ...s, included: !s.included } : s));
  const delSrc = (id) => setSources(ss => ss.filter(s => s.id !== id));

  // Boş not defterine örnek kaynak ekle (demo akışı)
  const addSampleSources = () => {
    setSources(SOURCES);
    setChat([{ id: 'm0', role: 'system', text: '3 kaynak işlendi ve sorguya dahil edildi · sormaya başlayabilirsiniz' }]);
  };

  const send = (text) => {
    const um = { id: 'u' + Date.now(), role: 'user', text };
    setChat(c => [...c, um]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChat(c => [...c, makeReply(text)]);
    }, 1300);
  };

  const readyCount = sources.filter(s => s.included && s.status === 'ready').length;

  // ---- Panel parçaları ----
  const sourcesPanel = (
    <div className="panel panel-sources">
      <PanelHead icon="folder" title="Kaynaklar" count={sources.length}>
        <button className="icon-btn" title="Tam ekran" onClick={() => setMgrOpen(true)}><Icon name="maximize" size={16} /></button>
        <button className="icon-btn" title="Daralt" onClick={() => setLeftOpen(false)}><Icon name="panel-left" size={16} /></button>
      </PanelHead>
      <div className="panel-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {isEmpty
          ? <div className="src-empty"><div className="se-ic"><Icon name="folder" size={30} /></div><div className="se-t">Henüz kaynak yok</div><div className="se-d">Belge yükleyin veya arXiv makalesi ekleyerek başlayın.</div></div>
          : <SourcesList sources={sources} onToggle={toggleSrc} onDelete={delSrc} />}
      </div>
      <div className="src-foot">
        <div className="upload-zone" onClick={isEmpty ? addSampleSources : () => setMgrOpen(true)}>
          <Icon name="upload" size={20} />
          <div className="uz-t">Belge ekle</div>
          <div className="uz-d">PDF · DOCX · PPTX · arXiv</div>
        </div>
      </div>
    </div>
  );

  const actionsPanel = (
    <div className="panel panel-actions">
      <PanelHead icon="sparkles" title="İşlemler">
        <button className="icon-btn" title="Daralt" onClick={() => setRightOpen(false)}><Icon name="panel-right" size={16} /></button>
      </PanelHead>
      <div className="panel-scroll">
        {isEmpty && (
          <div className="actions-hint"><Icon name="alert-circle" size={15} style={{ flex: '0 0 auto', marginTop: 1 }} />Test, özet ve yol haritası için önce en az bir kaynak ekleyin.</div>
        )}
        <div className={cx(isEmpty && 'actions-locked')}>
          <ActionsContent onAction={(k) => setModal(k)} onOpenRoadmap={() => setModal('roadmap')} />
        </div>
      </div>
    </div>
  );

  // Boş sohbet onboarding bloğu
  const chatEmptyState = (
    <div className="chat-empty">
      <div className="ce-ic"><Icon name="sparkles" size={26} /></div>
      <h2>{notebook?.title || 'Yeni çalışma seansı'}</h2>
      <p>Bu not defteri henüz boş. Kaynaklarınızı ekleyin; Tualem onları bir bilgi grafiğine işleyip sorularınızı yanıtlamaya hazır olsun.</p>
      <button className="btn btn-primary btn-lg" onClick={addSampleSources}><Icon name="upload" size={18} />Belge yükle veya arXiv ekle</button>
      <div className="ce-steps">
        <div className="ce-step"><span className="ce-n">1</span>Kaynak ekle</div>
        <div className="ce-step"><span className="ce-n">2</span>Soru sor</div>
        <div className="ce-step"><span className="ce-n">3</span>Test &amp; özet üret</div>
      </div>
    </div>
  );

  // ---- Düzen varyasyonları ----
  let body;
  if (layout === 'odak') {
    body = (
      <>
        <div className="slim-rail">
          <button className={cx('rail-btn', slideover === 'sources' && 'active')} title="Kaynaklar" onClick={() => setSlideover(s => s === 'sources' ? null : 'sources')}>
            <Icon name="folder" size={19} /><span className="rail-badge"></span>
          </button>
          <button className={cx('rail-btn', slideover === 'actions' && 'active')} title="İşlemler" onClick={() => setSlideover(s => s === 'actions' ? null : 'actions')}>
            <Icon name="sparkles" size={19} />
          </button>
          <div style={{ flex: 1 }}></div>
          <button className="rail-btn" title="Kaynak yöneticisi" onClick={() => setMgrOpen(true)}><Icon name="maximize" size={18} /></button>
        </div>
        <ChatColumn
          chat={chat} typing={typing} onSend={send} onFollow={send} layout={layout} emptyState={isEmpty ? chatEmptyState : null}
          topSlot={(
            <div className="float-actions">
              <button onClick={() => setModal('quiz')}><Icon name="list-checks" size={15} className="cb-ic" style={{ color: 'var(--accent)' }} />Test</button>
              <button onClick={() => setModal('summary')}><Icon name="file-text" size={15} style={{ color: 'var(--accent)' }} />Özet</button>
              <button onClick={() => setModal('roadmap')}><Icon name="route" size={15} style={{ color: 'var(--accent)' }} />Yol Haritası</button>
            </div>
          )}
        />
        {slideover && (
          <div className="slideover">
            <PanelHead icon={slideover === 'sources' ? 'folder' : 'sparkles'} title={slideover === 'sources' ? 'Kaynaklar' : 'İşlemler'} count={slideover === 'sources' ? sources.length : null}>
              <button className="icon-btn" onClick={() => setSlideover(null)}><Icon name="x" size={16} /></button>
            </PanelHead>
            <div className="panel-scroll">
              {slideover === 'sources'
                ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><SourcesList sources={sources} onToggle={toggleSrc} onDelete={delSrc} /></div>
                : <ActionsContent onAction={(k) => { setModal(k); setSlideover(null); }} onOpenRoadmap={() => { setModal('roadmap'); setSlideover(null); }} />}
            </div>
          </div>
        )}
      </>
    );
  } else if (layout === 'komut') {
    body = (
      <>
        {leftOpen ? sourcesPanel : <div className="reopen-tab left" onClick={() => setLeftOpen(true)}><Icon name="chevron-right" size={15} /></div>}
        <ChatColumn
          chat={chat} typing={typing} onSend={send} onFollow={send} layout={layout} emptyState={isEmpty ? chatEmptyState : null}
          bottomSlot={(
            <div className="command-bar">
              <div className="command-group">
                <button onClick={() => setModal('summary')}><Icon name="file-text" size={16} className="cb-ic" />Özet Çıkar</button>
                <button onClick={() => setModal('quiz')}><Icon name="list-checks" size={16} className="cb-ic" />Test Oluştur</button>
                <button onClick={() => setModal('roadmap')}><Icon name="route" size={16} className="cb-ic" />Yol Haritası</button>
              </div>
            </div>
          )}
        />
      </>
    );
  } else { // klasik
    body = (
      <>
        {leftOpen ? sourcesPanel : <div className="reopen-tab left" onClick={() => setLeftOpen(true)}><Icon name="chevron-right" size={15} /></div>}
        <ChatColumn chat={chat} typing={typing} onSend={send} onFollow={send} layout={layout} emptyState={isEmpty ? chatEmptyState : null} />
        {rightOpen ? actionsPanel : <div className="reopen-tab right" onClick={() => setRightOpen(true)}><Icon name="chevron-left" size={15} /></div>}
      </>
    );
  }

  return (
    <div className="ws-shell">
      <div className="ws-top">
        <div className="lt">
          <button className="icon-btn" onClick={onHome} title="Not defterleri"><Icon name="arrow-left" size={18} /></button>
          <div className="ws-sep"></div>
          <div className="ws-title">
            <span className="nb-dot" style={{ background: srcColor((notebook?.color || 1) - 1) }}></span>
            <h1>{notebook?.title || 'Çalışma Seansı'}</h1>
          </div>
          <span className="status st-ready" style={{ marginLeft: 8 }}><Icon name="check-circle" size={11} />{readyCount} kaynak aktif</span>
        </div>
        <div className="rt">
          <button className="icon-btn" onClick={onToggleTheme} title="Tema"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} /></button>
          <div className="avatar" onClick={onProfile} style={{ width: 30, height: 30, fontSize: 12 }}>AY</div>
        </div>
      </div>
      <div className="ws-body">{body}</div>

      {mgrOpen && <SourceManagerOverlay sources={sources} onToggle={toggleSrc} onDelete={delSrc} onClose={() => setMgrOpen(false)} />}
      {modal === 'quiz' && <TestModal onClose={() => setModal(null)} />}
      {modal === 'roadmap' && <RoadmapModal onClose={() => setModal(null)} />}
      {modal === 'summary' && <SummaryModal onClose={() => setModal(null)} />}
    </div>
  );
}

Object.assign(window, { Workspace });
