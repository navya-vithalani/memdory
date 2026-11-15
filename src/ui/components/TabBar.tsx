import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home' },
  { to: '/notes', label: 'Notes' },
  { to: '/cards', label: 'Cards' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/profile', label: 'Profile' }
];

export function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main navigation">
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
