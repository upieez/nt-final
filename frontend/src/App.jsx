import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import SeedBuilder from './components/SeedBuilder.jsx';
import { addTrack, moveTrack, removeTrack } from './lib/sequence.js';

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

  useEffect(() => {
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const seedProps = {
    sequence,
    onAdd: (track) => setSequence((s) => addTrack(s, track)),
    onMove: (i, dir) => setSequence((s) => moveTrack(s, i, dir)),
    onRemove: (i) => setSequence((s) => removeTrack(s, i)),
    onClear: () => setSequence([])
  };

  return (
    <div className="app">
      <Header views={VIEWS} activeView={view} />
      <main id="main" className="main">
        {view === 'recommend' ? (
          <SeedBuilder {...seedProps} />
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
