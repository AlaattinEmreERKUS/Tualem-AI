// app/auth.jsx — Giriş / Kayıt ekranı

function FeatureItem({ icon, title, desc }) {
  return (
    <div className="feature">
      <div className="f-ic"><Icon name={icon} size={20} /></div>
      <div>
        <div className="f-t">{title}</div>
        <div className="f-d">{desc}</div>
      </div>
    </div>
  );
}

// 6 haneli kod giriş ekranı
function VerifyForm({ email, onVerified, onBack }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [seconds, setSeconds] = useState(28);
  const refs = useRef([]);

  useEffect(() => {
    if (refs.current[0]) refs.current[0].focus();
  }, []);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, '').slice(-1);
    setCode(c => { const n = [...c]; n[i] = d; return n; });
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
    if (txt.length) { e.preventDefault(); setCode([...txt, '', '', '', '', '', ''].slice(0, 6)); refs.current[Math.min(txt.length, 5)]?.focus(); }
  };
  const filled = code.every(d => d !== '');

  return (
    <div className="auth-form">
      <button className="back-link" onClick={onBack}><Icon name="arrow-left" size={15} />Geri</button>
      <div className="verify-icon"><Icon name="mail" size={26} /></div>
      <h2>E-postanızı doğrulayın</h2>
      <p className="lede" style={{ marginBottom: 0 }}>
        <span className="verify-email">{email}</span> adresine 6 haneli bir kod gönderdik. Kodu aşağıya girin.
      </p>
      <div className="code-row" onPaste={onPaste}>
        {code.map((d, i) => (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            className={cx('code-box', d && 'filled')}
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => setDigit(i, e.target.value)}
            onKeyDown={e => onKey(i, e)}
          />
        ))}
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={!filled} onClick={onVerified}
        style={{ marginTop: 'var(--sp-4)', ...(filled ? {} : { opacity: 0.5, cursor: 'not-allowed' }) }}>
        Doğrula ve devam et<Icon name="arrow-right" size={16} />
      </button>
      <div className="resend">
        Kod gelmedi mi?{' '}
        {seconds > 0
          ? <span>Yeniden gönder ({seconds}s)</span>
          : <button onClick={() => setSeconds(28)}>Yeniden gönder</button>}
      </div>
    </div>
  );
}

function AuthScreen({ onAuth, theme, onToggleTheme }) {
  const [mode, setMode] = useState('login'); // login | register | verify
  const isReg = mode === 'register';
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('arda@metu.edu.tr');

  return (
    <div className="auth">
      {/* SOL — ürün tanıtımı */}
      <div className="auth-intro">
        <div className="brand">
          <span className="logo"><Icon name="network" size={26} /></span>
          <span className="wm">Tualem<small>AI</small></span>
        </div>
        <div>
          <h1 className="auth-headline">Kaynaklarınızdan düşünen bir çalışma ortağı.</h1>
          <p className="auth-sub">Belgelerinizi ve makalelerinizi bir bilgi grafiğine dönüştürün; sorun, özetleyin, test edin — her yanıt kaynağına bağlı.</p>
          <div className="feature-list">
            <FeatureItem icon="network" title="Bilgi grafiği" desc="Belgeler arasındaki kavramlar otomatik bağlanır; ilişkili fikirleri tek bakışta görün." />
            <FeatureItem icon="message-square" title="Kaynağa dayalı sohbet" desc="Her yanıtta hangi belgeden geldiğini gösteren kaynak rozetleri." />
            <FeatureItem icon="list-checks" title="Test & yol haritası" desc="Çalıştığınız konudan otomatik quiz ve adım adım öğrenme planı." />
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}>
          PDF · DOCX · PPTX · arXiv
        </div>
      </div>

      {/* SAĞ — form */}
      <div className="auth-form-wrap">
        <div className="auth-top-actions">
          <button className="icon-btn" onClick={onToggleTheme} title="Tema değiştir">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
        {mode === 'verify' ? (
          <VerifyForm email={email} onVerified={onAuth} onBack={() => setMode('register')} />
        ) : (
        <div className="auth-form">
          <h2>{isReg ? 'Hesap oluştur' : 'Tekrar hoş geldiniz'}</h2>
          <p className="lede">{isReg ? 'Çalışma ortamınızı birkaç saniyede kurun.' : 'Çalışma alanınıza giriş yapın.'}</p>

          <div className="form-rows">
            {isReg && (
              <div className="form-2col">
                <div className="field">
                  <label>Ad</label>
                  <div className="input"><Icon name="user" size={16} /><input placeholder="Arda" defaultValue="Arda" /></div>
                </div>
                <div className="field">
                  <label>Soyad</label>
                  <div className="input"><input placeholder="Yılmaz" defaultValue="Yılmaz" /></div>
                </div>
              </div>
            )}
            {isReg && (
              <div className="field">
                <label>Kullanıcı adı</label>
                <div className="input"><Icon name="at-sign" size={16} /><input placeholder="ardayilmaz" defaultValue="ardayilmaz" /></div>
              </div>
            )}
            <div className="field">
              <label>E-posta</label>
              <div className="input"><Icon name="mail" size={16} /><input type="email" placeholder="ad@universite.edu.tr" value={email} onChange={e => setEmail(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Şifre</label>
              <div className="input">
                <Icon name="lock" size={16} />
                <input type={showPw ? 'text' : 'password'} placeholder="••••••••" defaultValue="ogrenci2026" />
                <button className="icon-btn" style={{ padding: 2 }} onClick={() => setShowPw(s => !s)} tabIndex={-1}>
                  <Icon name={showPw ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>

            <button className="btn btn-primary btn-block btn-lg" onClick={() => isReg ? setMode('verify') : onAuth()} style={{ marginTop: 4 }}>
              {isReg ? 'Hesabı oluştur' : 'Giriş yap'}
              <Icon name="arrow-right" size={16} />
            </button>
          </div>

          <div className="auth-switch">
            {isReg ? 'Zaten hesabınız var mı? ' : 'Hesabınız yok mu? '}
            <button onClick={() => setMode(isReg ? 'login' : 'register')}>
              {isReg ? 'Giriş yapın' : 'Kayıt olun'}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { AuthScreen });
