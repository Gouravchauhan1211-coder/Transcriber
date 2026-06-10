import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SpeakerPage from './pages/SpeakerPage';
import ViewerPage from './pages/ViewerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/speak/:sessionId" element={<SpeakerPage />} />
      <Route path="/view/:sessionId" element={<ViewerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
