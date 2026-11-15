import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from '../ui/components/TabBar';
import { PwaInstall } from '../ui/components/PwaInstall';
import { useSettings } from '../hooks/useSettings';

const HomeScreen = lazy(() => import('../ui/screens/HomeScreen').then((module) => ({ default: module.HomeScreen })));
const NotesScreen = lazy(() => import('../ui/screens/NotesScreen').then((module) => ({ default: module.NotesScreen })));
const CardsScreen = lazy(() => import('../ui/screens/CardsScreen').then((module) => ({ default: module.CardsScreen })));
const AnalysisScreen = lazy(() => import('../ui/screens/AnalysisScreen').then((module) => ({ default: module.AnalysisScreen })));
const ProfileScreen = lazy(() => import('../ui/screens/ProfileScreen').then((module) => ({ default: module.ProfileScreen })));

export default function App() {
  const { settings, ready, error } = useSettings();
  const [storageError, setStorageError] = useState('');

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
        {(error || storageError) && <p className="error-message settings-error" role="alert">{error || storageError}</p>}
        <Suspense fallback={<main className="screen loading-screen" role="status">Loading…</main>}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/cards" element={<CardsScreen />} />
            <Route path="/analysis" element={<AnalysisScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PwaInstall />
        <TabBar />
      </div>
    </div>
  );
}
