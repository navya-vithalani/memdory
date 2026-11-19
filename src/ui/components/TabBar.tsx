import { NavLink } from 'react-router-dom';

const stroke = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <NavLink to="/notes" className={({ isActive }) => `tab tab-notes${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
        <span>Notes</span>
      </NavLink>
      <NavLink to="/" end aria-label="Home" className={({ isActive }) => `tab-home${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M10 20v-5.5h4V20" /></svg>
      </NavLink>
      <NavLink to="/cards" className={({ isActive }) => `tab tab-cards${isActive ? ' active' : ''}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" {...stroke}><rect x="3" y="7" width="14" height="12" rx="2.5" /><path d="M7 7V5.5A2.5 2.5 0 0 1 9.5 3H18a3 3 0 0 1 3 3v8.5a2.5 2.5 0 0 1-2.5 2.5H17" /></svg>
        <span>Cards</span>
      </NavLink>
    </nav>
  );
}
