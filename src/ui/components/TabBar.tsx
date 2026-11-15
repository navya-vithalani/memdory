import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/notes', label: 'Notes', icon: <><path d="M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z" /><path d="M14 4v5h5M8 13h8M8 17h6" /></> },
  { to: '/cards', label: 'Cards', icon: <><rect x="4" y="5" width="14" height="16" rx="2" /><path d="M8 3h10a2 2 0 0 1 2 2v12M8 10h6M8 14h6" /></> },
  { to: '/analysis', label: 'Analysis', icon: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></> }
];

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{tab.icon}</svg>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
