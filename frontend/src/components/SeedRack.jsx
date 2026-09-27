import { useState } from 'react';
import AlbumArt from './AlbumArt.jsx';
import { MAX_SEQUENCE, trackLabel } from '../lib/sequence.js';

// Five seed slots, newest right
export default function SeedRack({ sequence, onMove, onRemove, onAddRequest, adding, locked = false }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const full = sequence.length >= MAX_SEQUENCE;
  const last = sequence.length - 1;

  function keyMove(e, i) {
    if (locked) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); onMove(i, -1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); onMove(i, 1); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(i); }
  }

  function drop(target) {
    if (locked || dragIndex === null || dragIndex === target) return;
    onMove(dragIndex, target - dragIndex);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <section className={`rack${locked ? ' rack-locked' : ''}`} aria-labelledby="rack-h">
      <div className="rack-head">
        <h2 id="rack-h" className="silk-h">Seed tracks</h2>
        <span className="silk silk-dim">{sequence.length} / {MAX_SEQUENCE} · rightmost is most recent</span>
      </div>
      <ol className="slots" aria-label="Seed tracks, oldest first">
        {sequence.map((track, i) => (
          <li key={`${track.artist}|${track.title}`}
            className={`slot slot-filled${i === last ? ' slot-recent' : ''}${overIndex === i ? ' slot-over' : ''}${dragIndex === i ? ' slot-dragging' : ''}`}
            draggable={!locked}
            onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(i); }}
            onDragLeave={() => setOverIndex(null)}
            onDrop={(e) => { e.preventDefault(); drop(i); }}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}>
            <div className="slot-well" tabIndex={0} role="group" aria-label={`Slot ${i + 1}: ${trackLabel(track)}. Arrow keys move, Delete ejects.`}
              onKeyDown={(e) => keyMove(e, i)}>
              <AlbumArt track={track} decorative />
              <span className="slot-number" aria-hidden="true">{i + 1}</span>
            </div>
            <span className="slot-caption" aria-hidden="true">
              <span className="slot-title">{track.title}</span>
              <span className="slot-artist">{track.artist}</span>
            </span>
            <button type="button" className="eject" disabled={locked} onClick={() => onRemove(i)} aria-label={`Eject ${trackLabel(track)}`}>
              <span aria-hidden="true">&#9650;</span> Eject
            </button>
            {i === last && <span className="slot-flag" aria-hidden="true">Most recent</span>}
          </li>
        ))}
        {!full && (
          <li className="slot slot-empty">
            <button type="button" className={`slot-well slot-add${adding ? ' slot-add-on' : ''}`} onClick={onAddRequest} disabled={locked}
              aria-pressed={adding} aria-label="Add a track">
              <span aria-hidden="true">+</span>
            </button>
            <span className="slot-caption silk-dim" aria-hidden="true">{adding ? 'Type above' : 'Add'}</span>
          </li>
        )}
      </ol>
    </section>
  );
}
