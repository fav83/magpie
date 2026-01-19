import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import LegalPage from './pages/legal/LegalPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy-policy" element={<LegalPage slug="privacy-policy" />} />
    </Routes>
  );
}

export default App;
