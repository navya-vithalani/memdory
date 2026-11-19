import { Link } from 'react-router-dom';
import { Mnemo } from './Mnemo';

type AppHeaderProps = {
  onMenu: () => void;
};

export function AppHeader({ onMenu }: AppHeaderProps) {
  return (
    <header className="app-header">
      <button className="header-menu" aria-label="Open menu" onClick={onMenu}><span /><span /><span /></button>
      <Link to="/" className="header-title">Remembree</Link>
      <Link to="/profile" className="header-mnemo" aria-label="Open profile"><Mnemo mood="happy" /></Link>
    </header>
  );
}
