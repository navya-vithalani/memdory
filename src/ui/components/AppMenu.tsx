import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mnemo } from './Mnemo';
import { APP_NAME, APP_VERSION } from '../../constants';

type AppMenuProps = {
  open: boolean;
  onClose: () => void;
};

const icon = (path: ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{path}</svg>;

const items: Array<{ label: string; to: string; icon: ReactNode }> = [
  { label: 'Import', to: '/cards?action=import', icon: icon(<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />) },
  { label: 'Start session', to: '/cards?action=start', icon: icon(<path d="M8 5v14l11-7z" />) },
  { label: 'Analysis', to: '/analysis', icon: icon(<path d="M4 19V9M10 19V5M16 19v-7M2 21h20" />) },
  { label: 'Streak & activity', to: '/profile', icon: icon(<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />) },
  { label: 'Export / restore backup', to: '/settings#backup', icon: icon(<path d="M12 21V9m0 0 4 4m-4-4-4 4M5 3h14" />) },
  { label: 'Settings', to: '/settings', icon: icon(<><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>) }
];

export function AppMenu({ open, onClose }: AppMenuProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const drawerRef = useRef<HTMLElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    drawerRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const slide = reduceMotion ? { duration: 0.15 } : { type: 'spring' as const, stiffness: 320, damping: 34 };

  return (
    <AnimatePresence onExitComplete={() => setAboutOpen(false)}>
      {open && (
        <>
          <motion.div key="scrim" className="menu-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
          <motion.aside key="drawer" ref={drawerRef} tabIndex={-1} className="menu-drawer" role="dialog" aria-modal="true" aria-label="Menu" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={slide}>
            <button className="menu-close" aria-label="Close menu" onClick={onClose}>{icon(<path d="M6 6l12 12M18 6 6 18" />)}</button>
            <div className="menu-brand"><Mnemo mood="happy" /><strong>{APP_NAME}</strong></div>
            <nav className="menu-list">
              {items.map((item) => (
                <button key={item.label} className="menu-item" onClick={() => { onClose(); navigate(item.to); }}>{item.icon}{item.label}</button>
              ))}
              <button className="menu-item" aria-expanded={aboutOpen} onClick={() => setAboutOpen((value) => !value)}>{icon(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>)}About</button>
              <button className="menu-item" disabled>{icon(<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />)}Connect<span className="menu-soon">Soon</span></button>
            </nav>
            {aboutOpen && <div className="menu-about"><strong>{APP_NAME} v{APP_VERSION}</strong>Offline-first flashcards and notes. Mnemo the clownfish helps you remember. Your data stays on this device.</div>}
            <div className="menu-footer"><Mnemo mood="sleepy" /><span>{APP_NAME} · v{APP_VERSION}</span></div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
