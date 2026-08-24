import HealthBadge from './HealthBadge.jsx';

export default function Header({ views, activeView }) {
  return (
    <header className="header">
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="header-row">
        <div className="brand">
          <h1 className="brand-title">NextTrack</h1>
          <p className="brand-tagline">Tell it what you just played. It picks what comes next.</p>
        </div>
        <nav className="nav" aria-label="Sections">
          {views.map((v) => (
            <a
              key={v.id}
              href={v.hash}
              className={`nav-link${v.id === activeView ? ' nav-link-active' : ''}`}
              aria-current={v.id === activeView ? 'page' : undefined}
            >
              {v.label}
            </a>
          ))}
        </nav>
      </div>
      <p className="header-note">
        No account, no listening history. Each recommendation is computed only from the tracks and
        preferences you send in that one request. <HealthBadge />
      </p>
    </header>
  );
}
