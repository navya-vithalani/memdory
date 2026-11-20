import { Link } from 'react-router-dom';
import { Mnemo } from './Mnemo';

type AppHeaderProps = {
  onMenu: () => void;
  menuOpen?: boolean;
};

export function AppHeader({ onMenu, menuOpen }: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        className={`header-menu${menuOpen ? ' is-open' : ''}`}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={onMenu}
      >
        <span />
        <span />
        <span />
      </button>
      <Link to="/" className="header-title">memdory</Link>
      <Link to="/profile" className="header-mnemo" aria-label="Open profile"><Mnemo mood="happy" /></Link>
    </header>
  );
}
