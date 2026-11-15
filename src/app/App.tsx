import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TabBar } from '../ui/components/TabBar';
import { AnalysisScreen } from '../ui/screens/AnalysisScreen';
import { CardsScreen } from '../ui/screens/CardsScreen';
import { HomeScreen } from '../ui/screens/HomeScreen';
import { NotesScreen } from '../ui/screens/NotesScreen';
import { ProfileScreen } from '../ui/screens/ProfileScreen';
import { useSettings } from '../hooks/useSettings';

export default function App() {
  const { settings, ready, error } = useSettings();

  useEffect(() => {
    if (ready) document.documentElement.dataset.theme = settings.theme;
  }, [ready, settings.theme]);

  return (
    <div className="app-shell">
      <div className="app-frame">
        {error && <p className="error-message settings-error" role="alert">{error}</p>}
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/notes" element={<NotesScreen />} />
          <Route path="/cards" element={<CardsScreen />} />
          <Route path="/analysis" element={<AnalysisScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TabBar />
      </div>
    </div>
  );
}
