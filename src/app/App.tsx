import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from '../ui/components/TabBar';
import { PwaInstall } from '../ui/components/PwaInstall';
import { AppHeader } from '../ui/components/AppHeader';
import { AmbientBackground } from '../ui/components/AmbientBackground';
import { AppMenu } from '../ui/components/AppMenu';
import { SettingsProvider, useSettings } from '../hooks/useSettings';
import { checkAndRunPreUpgradeSafetyBackup } from '../data/backup/preUpgrade';

const HomeScreen = lazy(() => import('../ui/screens/HomeScreen').then((module) => ({ default: module.HomeScreen })));
const NotesScreen = lazy(() => import('../ui/screens/NotesScreen').then((module) => ({ default: module.NotesScreen })));
const CardsScreen = lazy(() => import('../ui/screens/CardsScreen').then((module) => ({ default: module.CardsScreen })));
const AnalysisScreen = lazy(() => import('../ui/screens/AnalysisScreen').then((module) => ({ default: module.AnalysisScreen })));
const BrowseScreen = lazy(() => import('../ui/screens/BrowseScreen').then((module) => ({ default: module.BrowseScreen })));
const SettingsScreen = lazy(() => import('../ui/screens/SettingsScreen').then((module) => ({ default: module.SettingsScreen })));
const ProfileScreen = lazy(() => import('../ui/screens/ProfileScreen').then((module) => ({ default: module.ProfileScreen })));

function AppContent() {
  const { settings, ready, error } = useSettings();
  const [storageError, setStorageError] = useState('');
  const [safetyBanner, setSafetyBanner] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    void checkAndRunPreUpgradeSafetyBackup().then((saved) => {
      if (saved) setSafetyBanner(true);
    });
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (ready) document.documentElement.dataset.theme = settings.theme;
  }, [ready, settings.theme]);

  useEffect(() => {
    if (!navigator.storage?.persist) return;
    void navigator.storage.persist().catch((reason: unknown) => {
      setStorageError(reason instanceof Error ? reason.message : 'Could not request persistent browser storage.');
    });
  }, []);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <AmbientBackground />
        {safetyBanner && (
          <div className="safety-banner" style={{ background: 'var(--indigo-tint)', color: 'var(--indigo)', padding: '8px 16px', fontSize: '13px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>We saved a safety copy of your data before upgrading.</span>
            <button className="text-button" onClick={() => setSafetyBanner(false)}>✕</button>
          </div>
        )}
        {(error || storageError) && <p className="error-message settings-error" role="alert">{error || storageError}</p>}
        <AppHeader menuOpen={menuOpen} onMenu={() => setMenuOpen((prev) => !prev)} />
        <Suspense fallback={<main className="screen loading-screen" role="status">Loading…</main>}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/cards" element={<CardsScreen />} />
            <Route path="/cards/browse" element={<BrowseScreen />} />
            <Route path="/analysis" element={<AnalysisScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PwaInstall />
        <TabBar />
        <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
