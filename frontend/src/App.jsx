import { useEffect, useState } from 'react';
import RecommendView from './components/RecommendView.jsx';
import StudyView from './components/StudyView.jsx';
import useHealth from './lib/useHealth.js';
import { DEFAULT_OPTIONS, DEFAULT_PREFERENCES } from './lib/preferences.js';

const VIEWS = [
  { id: 'recommend', label: 'Recommend', hash: '#/' },
  { id: 'study', label: 'Study', hash: '#/study' }
];

function viewFromHash() {
  return window.location.hash === '#/study' ? 'study' : 'recommend';
}

export default function App() {
  const [view, setView] = useState(viewFromHash);
  const [sequence, setSequence] = useState([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [options] = useState(DEFAULT_OPTIONS);
  const health = useHealth();

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="unit">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="chassis">
        <header className="faceplate-top">
          <div className="brand">
            <h1 className="brand-name">NextTrack</h1>
            <span className="brand-model">NT-1 · NEXT TRACK PROCESSOR</span>
          </div>
          <nav className="mode-switch" aria-label="Mode">
            {VIEWS.map((v) => (
              <a key={v.id} href={v.hash} className={`mode-btn${v.id === view ? ' mode-btn-on' : ''}`}
                aria-current={v.id === view ? 'page' : undefined}>
                <span className="lamp" aria-hidden="true" />
                {v.label}
              </a>
            ))}
          </nav>
        </header>

        <main id="main" className="faceplate">
          {view === 'recommend' ? (
            <RecommendView sequence={sequence} setSequence={setSequence} preferences={preferences}
              setPreferences={setPreferences} options={options} health={health} />
          ) : (
            <StudyView sequence={sequence} preferences={preferences} health={health} />
          )}
        </main>

        <footer className="faceplate-bottom">
          <span className="silk">No account, no listening history. Nothing is stored between requests.</span>
          <span className="silk silk-dim">Everything on this panel lives in this tab and is gone when you close it.</span>
        </footer>
      </div>
    </div>
  );
}
