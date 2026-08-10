import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';

const VIEWS = [
  { id: 'recommend', label: 'Recommend', hash: '#/' },
  { id: 'study', label: 'Rating study', hash: '#/study' }
];

function viewFromHash() {
  return window.location.hash === '#/study' ? 'study' : 'recommend';
}

export default function App() {
  const [view, setView] = useState(viewFromHash);

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="app">
      <Header views={VIEWS} activeView={view} />
      <main id="main" className="main">
        {view === 'recommend' ? (
          <p className="muted">Seed builder coming next.</p>
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
