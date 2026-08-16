import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import RecommendView from './components/RecommendView.jsx';
import { DEFAULT_OPTIONS, DEFAULT_PREFERENCES } from './lib/preferences.js';

const VIEWS = [
  { id: 'recommend', label: 'Recommend', hash: '#/' },
  { id: 'study', label: 'Rating study', hash: '#/study' }
];

function viewFromHash() {
  return window.location.hash === '#/study' ? 'study' : 'recommend';
}

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [sequence, setSequence] = useState([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const shared = { sequence, setSequence, preferences, setPreferences, options, setOptions };

  return (
    <div className="app">
      <Header views={VIEWS} activeView={view} />
      <main id="main" className="main">
        {view === 'recommend' ? (
          <RecommendView {...shared} />
        ) : (
          <p className="muted">Rating study coming next.</p>
        )}
      </main>
      <footer className="footer">
        <p>
          NextTrack keeps nothing between requests. Everything on this page lives in your browser tab
          and is gone when you close it.
        </p>
      </footer>
    </div>
  );
}
