import { Link } from 'react-router-dom';

export function AppHeader() {
  return (
    <header className="app-header">
      <Link to="/" className="header-brand" aria-label="remembree home">
        <span className="brand-mark" aria-hidden="true">r</span>
        <span>remembree</span>
      </Link>
      <Link to="/profile" className="header-profile" aria-label="Open profile settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 21c.7-3.5 3.1-5.3 7-5.3s6.3 1.8 7 5.3" /></svg>
      </Link>
    </header>
  );
}
