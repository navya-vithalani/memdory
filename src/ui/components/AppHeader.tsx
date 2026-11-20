import { Link, useLocation } from 'react-router-dom';
import { Mnemo } from './Mnemo';
import { APP_NAME } from '../../constants';

type AppHeaderProps = {
  onMenu: () => void;
  menuOpen?: boolean;
};

function getScreenTitle(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/notes')) return 'Notes';
  if (pathname === '/cards/browse') return 'Browse Cards';
  if (pathname === '/map') return 'Learning Map';
  if (pathname.startsWith('/cards')) return 'Cards';
  if (pathname.startsWith('/analysis')) return 'Study Insights';
  if (pathname.startsWith('/activity')) return 'Streak & Activity';
  if (pathname.startsWith('/profile') || pathname.startsWith('/settings')) return 'Profile';
  return 'Home';
}

export function AppHeader({ onMenu, menuOpen }: AppHeaderProps) {
  const location = useLocation();
  const title = getScreenTitle(location.pathname);

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
      <h1 className="header-title">{title}</h1>
      <Link to="/profile" className="header-brand-group" aria-label="Open profile and settings">
        <Mnemo mood="happy" className="header-mascot" />
        <span className="header-brand-name">{APP_NAME}</span>
      </Link>
    </header>
  );
}
