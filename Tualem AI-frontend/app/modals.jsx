// app/modals.jsx — Test, Yol Haritası, Özet modalleri + Profil ekranı

// ---- TEST MODALİ ----
function TestModal({ onClose }) {
  const qs = QUIZ.questions;
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // qIndex -> selectedOption
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const q = qs[idx];
  const sel = answers[idx];
  const pick = (o) => { if (!revealed) setAnswers(a => ({ ...a, [idx]: o })); };
  const check = () => setRevealed(true);
  const next = () => {
    if (idx + 1 < qs.length) { setIdx(idx + 1); setRevealed(false); }
    else setFinished(true);
  };

  const correct = qs.filter((qq, i) => answers[i] === qq.answer).length;
  const pct = Math.round((correct / qs.length) * 100);
  const wrongTopics = qs.filter((qq, i) => answers[i] !== qq.answer).map(qq => qq.q.split(' ').slice(0, 3).join(' '));

  const optState = (o) => {
    if (!revealed) return sel === o ? 'selected' : '';
    if (o === q.answer) return 'correct';
    if (o === sel) return 'wrong';
    return '';
  };

  const ringCirc = 2 * Math.PI * 64;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal quiz-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="list-checks" size={20} /></span>
            <div><h2>{QUIZ.title}</h2><div className="mh-sub">{finished ? 'Sonuç' : `Soru ${idx + 1} / ${qs.length}`}</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            {!finished && (
              <div className="quiz-progress">
                <div className="qp-bar"><i style={{ width: ((idx + (revealed ? 1 : 0)) / qs.length * 100) + '%' }}></i></div>
              </div>
            )}
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
        </div>

        <div className="modal-body">
          {!finished ? (
            <div className="quiz-q">
              <div className="quiz-qnum">Soru {idx + 1}</div>
              <div className="quiz-qtext">{q.q}</div>
              <div className="quiz-opts">
                {q.options.map((o, i) => (
                  <button key={i} className="q-opt" data-s={optState(i)} disabled={revealed} onClick={() => pick(i)}>
                    <span className="q-key">{String.fromCharCode(65 + i)}</span>
                    <span className="q-tx">{o}</span>
                    {revealed && i === q.answer && <span className="q-mark" style={{ color: 'var(--ok)' }}><Icon name="check" size={18} /></span>}
                    {revealed && i === sel && i !== q.answer && <span className="q-mark" style={{ color: 'var(--err)' }}><Icon name="x" size={18} /></span>}
                  </button>
                ))}
              </div>
              {revealed && (
                <div className="quiz-why">
                  <b>{sel === q.answer ? 'Doğru. ' : 'Açıklama: '}</b>{q.why}
                </div>
              )}
            </div>
          ) : (
            <div className="quiz-result">
              <div className="score-ring">
                <svg width="150" height="150" viewBox="0 0 150 150">
                  <circle cx="75" cy="75" r="64" fill="none" stroke="var(--bg-sunken)" strokeWidth="11" />
                  <circle cx="75" cy="75" r="64" fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - pct / 100)} transform="rotate(-90 75 75)" style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }} />
                </svg>
                <div className="pct"><span className="n">{pct}%</span><span className="l">Skor</span></div>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', marginBottom: 6 }}>
                {pct >= 75 ? 'Çok iyi!' : pct >= 50 ? 'Fena değil' : 'Tekrar çalışmalı'}
              </h2>
              <div className="result-breakdown">
                <div className="rb"><Icon name="check-circle" size={18} style={{ color: 'var(--ok)' }} /><span className="num" style={{ color: 'var(--ok)' }}>{correct}</span> doğru</div>
                <div className="rb"><Icon name="x-circle" size={18} style={{ color: 'var(--err)' }} /><span className="num" style={{ color: 'var(--err)' }}>{qs.length - correct}</span> yanlış</div>
              </div>
              {wrongTopics.length > 0 && (
                <div className="weak-topics">
                  <div className="wt-label">Tekrar edilecek konular</div>
                  {wrongTopics.map((t, i) => <span key={i} className="weak-chip"><Icon name="book-open" size={13} />{t}…</span>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          {!finished ? (
            !revealed
              ? <button className="btn btn-primary" disabled={sel == null} onClick={check} style={sel == null ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>Kontrol et</button>
              : <button className="btn btn-primary" onClick={next}>{idx + 1 < qs.length ? 'Sonraki soru' : 'Sonucu gör'}<Icon name="arrow-right" size={16} /></button>
          ) : (
            <button className="btn btn-primary" onClick={() => { setIdx(0); setAnswers({}); setRevealed(false); setFinished(false); }}>
              <Icon name="loader" size={16} />Tekrar dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- YOL HARİTASI MODALİ ----
function RoadmapModal({ onClose }) {
  const [steps, setSteps] = useState(() => JSON.parse(JSON.stringify(ROADMAP.steps)));

  const toggleStep = (i) => setSteps(s => s.map((st, j) => j === i ? { ...st, done: !st.done, subs: st.subs.map(x => ({ ...x, done: !st.done })) } : st));
  const toggleSub = (i, j) => setSteps(s => s.map((st, k) => {
    if (k !== i) return st;
    const subs = st.subs.map((x, m) => m === j ? { ...x, done: !x.done } : x);
    return { ...st, subs, done: subs.every(x => x.done) };
  }));

  const totalSubs = steps.reduce((a, s) => a + s.subs.length, 0);
  const doneSubs = steps.reduce((a, s) => a + s.subs.filter(x => x.done).length, 0);
  const pct = Math.round((doneSubs / totalSubs) * 100);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal road-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="route" size={20} /></span>
            <div><h2>{ROADMAP.title}</h2><div className="mh-sub">{doneSubs} / {totalSubs} adım tamamlandı</div></div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="road-overall">
          <div className="ro-top"><span style={{ color: 'var(--text-muted)' }}>Genel ilerleme</span><span className="mono" style={{ fontWeight: 600 }}>{pct}%</span></div>
          <div className="ro-bar"><i style={{ width: pct + '%' }}></i></div>
        </div>
        <div className="modal-body" style={{ paddingTop: 'var(--sp-2)' }}>
          <div className="road-steps">
            {steps.map((st, i) => (
              <div key={i} className={cx('road-step', st.done && 'done')}>
                <div className={cx('step-check', st.done && 'done')} onClick={() => toggleStep(i)}>
                  <Icon name="check" size={16} />
                </div>
                <div className="step-main">
                  <div className={cx('step-title', st.done && 'done')}>{st.title}</div>
                  {st.subs.map((sub, j) => (
                    <div key={j} className={cx('substep', sub.done && 'done')} onClick={() => toggleSub(i, j)}>
                      <span className={cx('sc', sub.done && 'done')}><Icon name="check" size={12} /></span>
                      <span className="st">{sub.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- ÖZET MODALİ ----
function SummaryModal({ onClose }) {
  const dl = (fmt) => {
    const text = SUMMARY.title + '\n\n' + SUMMARY.blocks.map(b => b.type === 'h' ? '\n## ' + b.text : b.type === 'li' ? '- ' + b.text : b.text).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tualem-ozet.' + (fmt === 'PDF' ? 'txt' : fmt === 'DOC' ? 'txt' : 'md');
    a.click();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal sum-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-lt">
            <span className="mh-ic"><Icon name="file-text" size={20} /></span>
            <div><h2>{SUMMARY.title}</h2><div className="mh-sub">{SUMMARY.meta}</div></div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body sum-body">
          {(() => {
            const out = []; let li = [];
            const flush = (k) => { if (li.length) { out.push(<ul key={'u' + k}>{li}</ul>); li = []; } };
            SUMMARY.blocks.forEach((b, i) => {
              if (b.type === 'h') { flush(i); out.push(<h3 key={i}>{b.text}</h3>); }
              else if (b.type === 'p') { flush(i); out.push(<p key={i}>{b.text}{b.cite != null && <SourceBadge idx={b.cite} />}</p>); }
              else if (b.type === 'li') { li.push(<li key={i}>{b.text}{b.cite != null && <SourceBadge idx={b.cite} />}</li>); }
            });
            flush('end');
            return out;
          })()}
        </div>
        <div className="modal-foot">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>İndirme formatı</span>
          <div className="dl-group">
            <button className="dl-btn" onClick={() => dl('MD')}><Icon name="download" size={14} />MD</button>
            <button className="dl-btn" onClick={() => dl('PDF')}><Icon name="download" size={14} />PDF</button>
            <button className="dl-btn" onClick={() => dl('DOC')}><Icon name="download" size={14} />DOC</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- PROFİL EKRANI ----
function ProfileScreen({ theme, onToggleTheme, onHome, onProfile }) {
  return (
    <div className="app-shell">
      <TopNav theme={theme} onToggleTheme={onToggleTheme} onProfile={onProfile} />
      <div className="profile-scroll">
        <div className="profile-wrap">
          <button className="btn btn-ghost" onClick={onHome} style={{ marginBottom: 'var(--sp-5)', paddingLeft: 0 }}><Icon name="arrow-left" size={16} />Not defterleri</button>
          <h1>Profil</h1>
          <p className="pw-sub">Hesap bilgilerinizi ve oturum tercihlerinizi yönetin.</p>

          <div className="avatar-row">
            <div className="avatar-lg">AY</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)' }}>Arda Yılmaz</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>@ardayilmaz · arda@metu.edu.tr</div>
            </div>
            <button className="btn btn-secondary"><Icon name="camera" size={16} />Avatarı değiştir</button>
          </div>

          <div className="profile-card">
            <h3>Kişisel bilgiler</h3>
            <div className="form-rows">
              <div className="form-2col">
                <div className="field"><label>Ad</label><div className="input"><input defaultValue="Arda" /></div></div>
                <div className="field"><label>Soyad</label><div className="input"><input defaultValue="Yılmaz" /></div></div>
              </div>
              <div className="field"><label>Kullanıcı adı</label><div className="input"><Icon name="at-sign" size={16} /><input defaultValue="ardayilmaz" /></div></div>
              <div className="field"><label>E-posta</label><div className="input"><Icon name="mail" size={16} /><input defaultValue="arda@metu.edu.tr" /></div></div>
            </div>
          </div>

          <div className="profile-card">
            <h3>Şifre değiştir</h3>
            <div className="form-rows">
              <div className="field"><label>Mevcut şifre</label><div className="input"><Icon name="lock" size={16} /><input type="password" defaultValue="parola" /></div></div>
              <div className="form-2col">
                <div className="field"><label>Yeni şifre</label><div className="input"><Icon name="lock" size={16} /><input type="password" placeholder="••••••••" /></div></div>
                <div className="field"><label>Yeni şifre (tekrar)</label><div className="input"><Icon name="lock" size={16} /><input type="password" placeholder="••••••••" /></div></div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn btn-ghost" style={{ color: 'var(--err)' }}><Icon name="log-out" size={16} />Çıkış yap</button>
            <button className="btn btn-primary"><Icon name="check" size={16} />Değişiklikleri kaydet</button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TestModal, RoadmapModal, SummaryModal, ProfileScreen });
