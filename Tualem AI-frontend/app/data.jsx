// app/data.jsx — sahte içerik (akademik / GNN teması)

const NOTEBOOKS = [
  { id: 'nb1', title: 'Grafik Sinir Ağları — Vize', date: '12 Mayıs 2026', sources: 5, fav: true,  color: 1 },
  { id: 'nb2', title: 'Transformer Mimarileri',       date: '8 Mayıs 2026',  sources: 3, fav: true,  color: 3 },
  { id: 'nb3', title: 'Bilgi Grafikleri & RAG',        date: '2 Mayıs 2026',  sources: 4, fav: false, color: 2 },
  { id: 'nb4', title: 'Dağıtık Sistemler — Final',     date: '28 Nisan 2026', sources: 2, fav: false, color: 4 },
  { id: 'nb5', title: 'Doktora Tez Literatürü',        date: '19 Nisan 2026', sources: 8, fav: false, color: 5 },
  { id: 'nb6', title: 'Olasılıksal Grafik Modeller',   date: '11 Nisan 2026', sources: 3, fav: false, color: 1 },
];

// Aktif not defterinin kaynakları
const SOURCES = [
  { id: 's1', name: 'Kipf & Welling — Semi-Supervised GCN', type: 'arxiv',  ext: '1609.02907', status: 'ready',      included: true,  color: 0 },
  { id: 's2', name: 'Veličković — Graph Attention Networks', type: 'arxiv',  ext: '1710.10903', status: 'ready',      included: true,  color: 1 },
  { id: 's3', name: 'Li et al. — Deeper Insights into GCN',  type: 'pdf',    ext: '2.4 MB',     status: 'ready',      included: true,  color: 2 },
  { id: 's4', name: 'Chen et al. — GCNII (Simple & Deep)',   type: 'pdf',    ext: '1.8 MB',     status: 'processing', included: false, color: 3 },
  { id: 's5', name: 'Hamilton — GraphSAGE Sunumu',           type: 'pptx',   ext: '6.1 MB',     status: 'error',      included: false, color: 4 },
];

// Sohbet akışı
const INITIAL_CHAT = [
  { id: 'm0', role: 'system', text: 'Oturum başlatıldı · 3 kaynak sorguya dahil edildi' },
  { id: 'm1', role: 'user', text: 'Mesaj geçişli grafik sinir ağlarında over-smoothing problemi nedir, neden ortaya çıkar?' },
  {
    id: 'm2', role: 'ai',
    segments: [
      { t: 'Over-smoothing, GNN katman sayısı arttıkça düğüm temsillerinin birbirine yakınsayıp ayırt edilemez hale gelmesidir.', cite: [0] },
      { t: ' Her katmanda komşuluk toplaması (message passing) temsilleri komşularının ortalamasına doğru iter; yeterince derin bir ağda tüm düğümler neredeyse aynı vektöre çöker.', cite: [2] },
      { t: ' Bu, düğüm sınıflandırma başarımını ciddi biçimde düşürür ve derin GNN eğitimini zorlaştırır.', cite: [2, 0] },
    ],
    follow: ['Bu sorun nasıl çözülür?', 'GAT bu konuda farklı mı?', 'Bir örnekle açıkla'],
  },
];

// Kaynak alıntı detayları (rozet popover)
const CITATIONS = {
  0: { name: 'Kipf & Welling, 2017', quote: 'A multi-layer GCN with linear propagation can be seen as repeated Laplacian smoothing of features.' },
  1: { name: 'Veličković et al., 2018', quote: 'Attention assigns different importances to neighbours, mitigating uniform averaging.' },
  2: { name: 'Li et al., 2018', quote: 'Repeatedly applying Laplacian smoothing mixes node features and makes them indistinguishable.' },
  3: { name: 'Chen et al., 2020', quote: 'Initial residual and identity mapping let GCNII go deep without over-smoothing.' },
  4: { name: 'Hamilton et al., 2017', quote: 'Inductive node embeddings via neighbourhood sampling and aggregation.' },
};

// Quiz
const QUIZ = {
  title: 'Grafik Sinir Ağları — Hızlı Test',
  questions: [
    {
      q: 'Over-smoothing problemi temel olarak neyden kaynaklanır?',
      options: [
        'Komşuluk toplamasının temsilleri tekrar tekrar ortalaması',
        'Öğrenme oranının çok yüksek seçilmesi',
        'Aktivasyon fonksiyonunun doğrusal olması',
        'Eğitim verisinin etiketsiz olması',
      ],
      answer: 0,
      why: 'Her message-passing katmanı bir Laplace düzleştirmesi gibi davranır; tekrarlandıkça temsiller birbirine yakınsar.',
    },
    {
      q: 'GAT (Graph Attention Network) komşulardan gelen bilgiyi nasıl birleştirir?',
      options: [
        'Basit ortalama ile',
        'Öğrenilen dikkat ağırlıklarıyla',
        'Maksimum havuzlama ile',
        'Rastgele örnekleme ile',
      ],
      answer: 1,
      why: 'GAT, her komşuya öğrenilen bir dikkat katsayısı atayarak farklı önem dereceleri verir.',
    },
    {
      q: 'GCNII over-smoothing\u2019i hangi iki mekanizma ile azaltır?',
      options: [
        'Dropout ve batch norm',
        'Başlangıç artık bağlantısı ve birim eşleme',
        'Daha geniş gizli katmanlar',
        'Veri artırma',
      ],
      answer: 1,
      why: 'GCNII initial residual + identity mapping kullanır; böylece çok derin ağlar bile çökmeden eğitilebilir.',
    },
    {
      q: 'GraphSAGE\u2019in temel katkısı nedir?',
      options: [
        'Transdüktif tam-grafik eğitimi',
        'Komşu örnekleme ile indüktif gömme öğrenme',
        'Dikkat mekanizması',
        'Spektral filtreleme',
      ],
      answer: 1,
      why: 'GraphSAGE komşuları örnekleyip toplayarak görülmemiş düğümler için de gömme üretebilir (indüktif).',
    },
  ],
};

// Yol haritası
const ROADMAP = {
  title: 'Grafik Sinir Ağlarında Ustalaşma',
  steps: [
    {
      title: 'Temeller: Grafik gösterimi',
      done: true,
      subs: [
        { t: 'Komşuluk matrisi ve derece matrisi', done: true },
        { t: 'Düğüm özellikleri ve etiketler', done: true },
      ],
    },
    {
      title: 'Message Passing çerçevesi',
      done: true,
      subs: [
        { t: 'Toplama (aggregate) ve güncelleme (update)', done: true },
        { t: 'GCN katman denklemi', done: true },
        { t: 'GraphSAGE örnekleme', done: false },
      ],
    },
    {
      title: 'Dikkat tabanlı GNN\u2019ler',
      done: false,
      subs: [
        { t: 'GAT dikkat katsayıları', done: false },
        { t: 'Çok-başlı dikkat', done: false },
      ],
    },
    {
      title: 'Derin GNN ve over-smoothing',
      done: false,
      subs: [
        { t: 'Laplace düzleştirme analizi', done: false },
        { t: 'GCNII ve artık bağlantılar', done: false },
        { t: 'PairNorm / DropEdge', done: false },
      ],
    },
  ],
};

// Özet (markdown benzeri yapı)
const SUMMARY = {
  title: 'Grafik Sinir Ağları — Çalışma Özeti',
  meta: '3 kaynaktan derlendi · ~6 dk okuma',
  blocks: [
    { type: 'h', text: 'Temel fikir' },
    { type: 'p', text: 'Grafik sinir ağları (GNN), düğümlerin komşularından bilgi toplayarak temsil öğrendiği modellerdir. Her katman bir "message passing" adımıdır: düğüm, komşularının özelliklerini toplar ve kendi temsilini günceller.' },
    { type: 'h', text: 'Önemli mimariler' },
    { type: 'li', text: 'GCN — komşuluk ortalaması ile spektral motivasyonlu toplama.', cite: 0 },
    { type: 'li', text: 'GAT — komşulara öğrenilen dikkat ağırlıkları atar.', cite: 1 },
    { type: 'li', text: 'GraphSAGE — örnekleme tabanlı indüktif gömme.', cite: 4 },
    { type: 'h', text: 'Over-smoothing' },
    { type: 'p', text: 'Derin GNN\u2019lerde tekrarlı toplama, düğüm temsillerini birbirine yakınsatır ve ayırt edilemez kılar. GCNII gibi yöntemler başlangıç artık bağlantısı ve birim eşleme ile bu sorunu hafifletir.', cite: 3 },
  ],
};

// Geçmiş üretilenler (sağ panel)
const HISTORY = [
  { id: 'h1', kind: 'summary', title: 'Çalışma Özeti', date: '14:32' },
  { id: 'h2', kind: 'quiz',    title: 'Hızlı Test (4 soru)', date: '14:18' },
  { id: 'h3', kind: 'roadmap', title: 'Öğrenme Yol Haritası', date: 'Dün' },
];

Object.assign(window, { NOTEBOOKS, SOURCES, INITIAL_CHAT, CITATIONS, QUIZ, ROADMAP, SUMMARY, HISTORY });
