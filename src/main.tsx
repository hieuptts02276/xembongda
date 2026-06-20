import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.css';

type Match = {
  id: string;
  home: string;
  away: string;
  league: string;
  kickoff: string;
  streamUrl: string;
  venue: string;
};

type Note = { rating: number; text: string };
type Consent = { birthYear: number; parentName?: string; parentEmail?: string; confirmedAt?: string };

const STORAGE = {
  matches: 'xb_matches_v1',
  favorites: 'xb_favorites_v1',
  notes: 'xb_notes_v1',
  consent: 'xb_consent_v1',
  theme: 'xb_theme_v1',
};

const sampleMatches: Match[] = [
  { id: crypto.randomUUID(), home: 'Việt Nam', away: 'Thái Lan', league: 'AFF Cup', kickoff: new Date(Date.now() + 86400000).toISOString().slice(0, 16), streamUrl: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg', venue: 'Mỹ Đình' },
  { id: crypto.randomUUID(), home: 'Arsenal', away: 'Liverpool', league: 'Premier League', kickoff: new Date(Date.now() + 172800000).toISOString().slice(0, 16), streamUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk', venue: 'Emirates' },
];

function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') && parsed.pathname === '/watch') {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v') ?? ''}`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    return url;
  } catch {
    return url;
  }
}

function ageFromBirthYear(year: number) {
  return new Date().getFullYear() - year;
}

function App() {
  const [matches, setMatches] = useState<Match[]>(() => load(STORAGE.matches, sampleMatches));
  const [favorites, setFavorites] = useState<string[]>(() => load(STORAGE.favorites, []));
  const [notes, setNotes] = useState<Record<string, Note>>(() => load(STORAGE.notes, {}));
  const [consent, setConsent] = useState<Consent | null>(() => load<Consent | null>(STORAGE.consent, null));
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState('Tất cả');
  const [activeId, setActiveId] = useState(matches[0]?.id ?? '');
  const [theme, setTheme] = useState(() => load(STORAGE.theme, 'light'));

  useEffect(() => save(STORAGE.matches, matches), [matches]);
  useEffect(() => save(STORAGE.favorites, favorites), [favorites]);
  useEffect(() => save(STORAGE.notes, notes), [notes]);
  useEffect(() => save(STORAGE.consent, consent), [consent]);
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    save(STORAGE.theme, theme);
  }, [theme]);

  const filtered = useMemo(() => matches.filter(match => {
    const text = `${match.home} ${match.away} ${match.league} ${match.venue}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (league === 'Tất cả' || match.league === league);
  }).sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()), [matches, query, league]);
  const leagues = ['Tất cả', ...Array.from(new Set(matches.map(match => match.league)))];
  const active = matches.find(match => match.id === activeId) ?? filtered[0];
  const canWatch = consent && (ageFromBirthYear(consent.birthYear) >= 13 || consent.confirmedAt);

  function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const match: Match = {
      id: crypto.randomUUID(),
      home: String(form.get('home')),
      away: String(form.get('away')),
      league: String(form.get('league')),
      kickoff: String(form.get('kickoff')),
      streamUrl: toEmbedUrl(String(form.get('streamUrl'))),
      venue: String(form.get('venue')),
    };
    setMatches(prev => [match, ...prev]);
    setActiveId(match.id);
    event.currentTarget.reset();
  }

  function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const birthYear = Number(form.get('birthYear'));
    const under13 = ageFromBirthYear(birthYear) < 13;
    const next: Consent = { birthYear };
    if (under13) {
      const parentName = String(form.get('parentName')).trim();
      const parentEmail = String(form.get('parentEmail')).trim();
      if (!parentName || !parentEmail) {
        alert('Người dưới 13 tuổi cần tên và email phụ huynh để xác nhận.');
        return;
      }
      next.parentName = parentName;
      next.parentEmail = parentEmail;
      next.confirmedAt = new Date().toISOString();
    }
    setConsent(next);
  }

  function downloadIcs(match: Match) {
    const start = new Date(match.kickoff);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `UID:${match.id}@xembongda`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${match.home} vs ${match.away}`, `LOCATION:${match.venue}`, `DESCRIPTION:${match.league} - ${match.streamUrl}`, 'END:VEVENT', 'END:VCALENDAR'].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    link.download = `${match.home}-${match.away}.ics`;
    link.click();
  }

  return <div>
    <nav className="navbar navbar-expand-lg bg-primary navbar-dark sticky-top shadow-sm">
      <div className="container"><span className="navbar-brand fw-bold"><i className="bi bi-dribbble me-2" />XemBongDa Live</span><button className="btn btn-outline-light" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><i className="bi bi-moon-stars" /> Đổi giao diện</button></div>
    </nav>
    <main className="container py-4">
      <section className="hero p-4 p-md-5 rounded-4 mb-4 text-white">
        <h1 className="display-5 fw-bold">Ứng dụng xem bóng đá đa tính năng</h1>
        <p className="lead mb-0">Quản lý lịch, xem luồng hợp lệ, lưu yêu thích, ghi chú, nhắc lịch và kiểm soát phụ huynh cho người dưới 13 tuổi.</p>
      </section>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card shadow-sm mb-4"><div className="card-body">
            <h2 className="h5">1. Xác nhận độ tuổi</h2>
            <form onSubmit={submitConsent}>
              <label className="form-label">Năm sinh</label><input className="form-control mb-2" name="birthYear" type="number" min="1900" max={new Date().getFullYear()} required />
              <div className="alert alert-info small">Nếu người xem dưới 13 tuổi theo năm sinh, phụ huynh phải nhập tên và email để xác nhận.</div>
              <input className="form-control mb-2" name="parentName" placeholder="Tên phụ huynh (bắt buộc nếu dưới 13)" />
              <input className="form-control mb-2" name="parentEmail" type="email" placeholder="Email phụ huynh" />
              <button className="btn btn-primary w-100">Lưu xác nhận</button>
            </form>
            {consent && <p className="mt-3 mb-0 small">Trạng thái: <span className="badge text-bg-success">{ageFromBirthYear(consent.birthYear) < 13 ? `Phụ huynh ${consent.parentName} đã xác nhận` : 'Đủ 13 tuổi trở lên'}</span></p>}
          </div></div>

          <div className="card shadow-sm"><div className="card-body">
            <h2 className="h5">2. Thêm trận đấu thật của bạn</h2>
            <form onSubmit={addMatch} className="row g-2">
              {['home:Đội nhà', 'away:Đội khách', 'league:Giải đấu', 'venue:Sân'].map(item => { const [name, label] = item.split(':'); return <div className="col-12" key={name}><input className="form-control" name={name} placeholder={label} required /></div>; })}
              <div className="col-12"><input className="form-control" name="kickoff" type="datetime-local" required /></div>
              <div className="col-12"><input className="form-control" name="streamUrl" placeholder="URL nhúng/YouTube hợp lệ" required /></div>
              <div className="col-12"><button className="btn btn-success w-100">Thêm vào lịch</button></div>
            </form>
          </div></div>
        </div>

        <div className="col-lg-8">
          <div className="card shadow-sm mb-4"><div className="card-body">
            <div className="row g-2 mb-3"><div className="col-md-7"><input className="form-control" placeholder="3. Tìm đội, giải, sân..." value={query} onChange={e => setQuery(e.target.value)} /></div><div className="col-md-5"><select className="form-select" value={league} onChange={e => setLeague(e.target.value)}>{leagues.map(item => <option key={item}>{item}</option>)}</select></div></div>
            <div className="list-group match-list">{filtered.map(match => <button key={match.id} className={`list-group-item list-group-item-action ${active?.id === match.id ? 'active' : ''}`} onClick={() => setActiveId(match.id)}><div className="d-flex justify-content-between"><strong>{match.home} vs {match.away}</strong><span>{new Date(match.kickoff).toLocaleString('vi-VN')}</span></div><small>{match.league} • {match.venue}</small></button>)}</div>
          </div></div>

          {active && <div className="card shadow-sm"><div className="card-body">
            <div className="d-flex flex-wrap justify-content-between gap-2"><h2 className="h4">{active.home} vs {active.away}</h2><div><button className="btn btn-outline-warning me-2" onClick={() => setFavorites(prev => prev.includes(active.id) ? prev.filter(id => id !== active.id) : [...prev, active.id])}>4. {favorites.includes(active.id) ? 'Bỏ yêu thích' : 'Yêu thích'}</button><button className="btn btn-outline-primary" onClick={() => downloadIcs(active)}>5. Tải nhắc lịch</button></div></div>
            <p><span className="badge text-bg-secondary">6. Đếm ngược: {Math.max(0, Math.ceil((new Date(active.kickoff).getTime() - Date.now()) / 3600000))} giờ</span> <span className="badge text-bg-info">7. {active.league}</span></p>
            {canWatch ? <div className="ratio ratio-16x9 mb-3"><iframe title="Trình xem bóng đá" src={toEmbedUrl(active.streamUrl)} allowFullScreen /></div> : <div className="alert alert-warning">8. Trình xem bị khóa cho đến khi hoàn tất xác nhận tuổi/phụ huynh.</div>}
            <div className="row g-3"><div className="col-md-6"><h3 className="h6">9. Ghi chú & chấm điểm</h3><input className="form-range" type="range" min="1" max="5" value={notes[active.id]?.rating ?? 3} onChange={e => setNotes(prev => ({ ...prev, [active.id]: { ...prev[active.id], rating: Number(e.target.value), text: prev[active.id]?.text ?? '' } }))} /><textarea className="form-control" value={notes[active.id]?.text ?? ''} onChange={e => setNotes(prev => ({ ...prev, [active.id]: { rating: prev[active.id]?.rating ?? 3, text: e.target.value } }))} placeholder="Cảm nhận trận đấu" /></div><div className="col-md-6"><h3 className="h6">10. Thống kê cá nhân</h3><ul className="list-group"><li className="list-group-item">Tổng trận: {matches.length}</li><li className="list-group-item">Yêu thích: {favorites.length}</li><li className="list-group-item">Đã ghi chú: {Object.keys(notes).length}</li></ul><button className="btn btn-danger mt-3" onClick={() => setMatches(prev => prev.filter(m => m.id !== active.id))}>11. Xóa trận đang chọn</button></div></div>
          </div></div>}
        </div>
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
