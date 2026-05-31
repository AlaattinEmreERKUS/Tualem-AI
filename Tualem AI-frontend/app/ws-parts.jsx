// app/ws-parts.jsx — Çalışma Alanı alt bileşenleri

// ---- Kaynak rozeti (hover'da alıntı açılır) ----
function SourceBadge({ idx }) {
  const [open, setOpen] = useState(false);
  const c = CITATIONS[idx] || { name: 'Kaynak', quote: '' };
  return (
    <span
      className="src-badge"
      style={{ background: srcColor(idx) }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(o => !o)}
    >
      {idx + 1}
      {open && (
        <span className="cite-pop" onMouseEnter={() => setOpen(true)}>
          <span className="cp-head">
            <span className="src-badge" style={{ background: srcColor(idx), position: 'static', top: 0 }}>{idx + 1}</span>
            <span className="cp-nm">{c.name}</span>
          </span>
          <span className="cp-q">"{c.quote}"</span>
        </span>
      )}
    </span>
  );
}

// ---- Mesajlar ----
function SystemMessage({ text }) {
  return <div className="msg-system"><span className="ln"></span>{text}<span className="ln"></span></div>;
}

function UserMessage({ text }) {
  return <div className="msg-user">{text}</div>;
}

function AiMessage({ msg, onFollow, onCopy }) {
  return (
    <div className="msg-ai">
      <div className="who">
        <span className="av"><Icon name="sparkles" size={15} /></span>
        <span className="nm">Tualem</span>
      </div>
      <div className="body">
        <p>
          {msg.segments.map((seg, i) => (
            <React.Fragment key={i}>
              {seg.t}
              {(seg.cite || []).map(c => <SourceBadge key={c} idx={c} />)}
            </React.Fragment>
          ))}
        </p>
      </div>
      <div className="ai-actions">
        <button className="icon-btn" title="Kopyala" onClick={onCopy}><Icon name="file-text" size={15} /></button>
        <button className="icon-btn" title="Yeniden üret"><Icon name="loader" size={15} /></button>
      </div>
      {msg.follow && (
        <div className="ai-followups">
          {msg.follow.map((f, i) => (
            <button key={i} className="chip-follow" onClick={() => onFollow(f)}>{f}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg-ai">
      <div className="who">
        <span className="av"><Icon name="sparkles" size={15} /></span>
        <span className="nm">Tualem yanıtlıyor…</span>
      </div>
      <div className="typing"><i></i><i></i><i></i></div>
    </div>
  );
}

// ---- Composer ----
function Composer({ onSend, disabled }) {
  const [val, setVal] = useState('');
  const ref = useRef(null);
  const grow = (el) => { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; };
  const submit = () => {
    const t = val.trim();
    if (!t || disabled) return;
    onSend(t);
    setVal('');
    if (ref.current) ref.current.style.height = 'auto';
  };
  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        <div className="composer">
          <button className="icon-btn" title="Belge ekle" style={{ marginBottom: 2 }}><Icon name="paperclip" size={18} /></button>
          <textarea
            ref={ref}
            rows={1}
            placeholder="Kaynaklarınıza bir soru sorun…"
            value={val}
            onChange={(e) => { setVal(e.target.value); grow(e.target); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          />
          <button className="send" onClick={submit} disabled={!val.trim() || disabled}>
            <Icon name="arrow-up" size={18} />
          </button>
        </div>
        <div className="composer-hint">
          <span>3 kaynak sorguya dahil</span>
          <span>↵ gönder · ⇧↵ yeni satır</span>
        </div>
      </div>
    </div>
  );
}

// ---- Kaynak listesi (panel içeriği) ----
function SourcesList({ sources, onToggle, onDelete, compact }) {
  const statusMap = {
    ready: { cls: 'st-ready', icon: 'check-circle', label: 'Hazır' },
    processing: { cls: 'st-processing', icon: 'loader', label: 'İşleniyor', spin: true },
    error: { cls: 'st-error', icon: 'alert-circle', label: 'Hata' },
  };
  return (
    <>
      {sources.map(s => {
        const st = statusMap[s.status];
        return (
          <div key={s.id} className={cx('src-item', !s.included && 'excluded')}>
            <div className="src-dot" style={{ background: srcColor(s.color) }}>
              <Icon name={s.type === 'arxiv' ? 'globe' : s.type === 'pptx' ? 'layers' : 'file-text'} size={15} />
            </div>
            <div className="src-main">
              <div className="src-name">{s.name}</div>
              <div className="src-sub">
                <span className="src-type">{s.type === 'arxiv' ? 'arXiv' : s.type}</span>
                <span className={cx('status', st.cls)}>
                  <Icon name={st.icon} size={11} className={st.spin ? 'spin' : ''} />{st.label}
                </span>
              </div>
            </div>
            <div className="src-actions">
              <button
                className={cx('tg', s.included && 'on')}
                title={s.included ? 'Sorgudan çıkar' : 'Sorguya dahil et'}
                disabled={s.status !== 'ready'}
                style={s.status !== 'ready' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                onClick={() => s.status === 'ready' && onToggle(s.id)}
              ></button>
              <button className="icon-btn" style={{ padding: 4 }} title="Sil" onClick={() => onDelete(s.id)}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ---- İşlemler paneli içeriği ----
function ActionsContent({ onAction, onOpenRoadmap }) {
  const doneSteps = ROADMAP.steps.filter(s => s.done).length;
  const pct = Math.round((doneSteps / ROADMAP.steps.length) * 100);
  return (
    <>
      <div className="action-grid">
        <button className="action-btn" onClick={() => onAction('quiz')}>
          <span className="ab-ic"><Icon name="list-checks" size={20} /></span>
          <span><span className="ab-t" style={{ display: 'block' }}>Test Oluştur</span><span className="ab-d">Konudan otomatik quiz</span></span>
        </button>
        <button className="action-btn" onClick={() => onAction('summary')}>
          <span className="ab-ic"><Icon name="file-text" size={20} /></span>
          <span><span className="ab-t" style={{ display: 'block' }}>Özet Çıkar</span><span className="ab-d">Kaynaklardan derleme</span></span>
        </button>
        <button className="action-btn" onClick={() => onAction('roadmap')}>
          <span className="ab-ic"><Icon name="route" size={20} /></span>
          <span><span className="ab-t" style={{ display: 'block' }}>Yol Haritası</span><span className="ab-d">Adım adım öğrenme planı</span></span>
        </button>
      </div>

      <div className="panel-section-label"><Icon name="route" size={12} />Aktif yol haritası</div>
      <div className="roadmap-mini" onClick={onOpenRoadmap}>
        <div className="rm-top">
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{ROADMAP.title}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
        </div>
        <div className="rm-bar"><i style={{ width: pct + '%' }}></i></div>
      </div>

      <div className="panel-section-label"><Icon name="clock" size={12} />Geçmiş</div>
      {HISTORY.map(h => (
        <div key={h.id} className="hist-item" onClick={() => onAction(h.kind)}>
          <span className="hi-ic"><Icon name={h.kind === 'quiz' ? 'list-checks' : h.kind === 'roadmap' ? 'route' : 'file-text'} size={16} /></span>
          <span className="hi-t">{h.title}</span>
          <span className="hi-d">{h.date}</span>
        </div>
      ))}
    </>
  );
}

// Yanıt üretici (prototip)
function makeReply(query) {
  return {
    id: 'm' + Date.now(),
    role: 'ai',
    segments: [
      { t: 'Kaynaklarınıza göre bu konunun özü şu: derin GNN\u2019lerde art arda komşuluk toplaması temsilleri yakınsatır.', cite: [0] },
      { t: ' GAT gibi dikkat tabanlı yöntemler komşulara farklı ağırlık vererek bu etkiyi kısmen azaltır.', cite: [1] },
      { t: ' Pratikte GCNII\u2019nin artık bağlantıları derin mimarilerde en istikrarlı sonucu verir.', cite: [2, 0] },
    ],
    follow: ['Bir sayısal örnek ver', 'GraphSAGE ile karşılaştır', 'Bunu test et'],
  };
}

Object.assign(window, { SourceBadge, SystemMessage, UserMessage, AiMessage, TypingBubble, Composer, SourcesList, ActionsContent, makeReply });
