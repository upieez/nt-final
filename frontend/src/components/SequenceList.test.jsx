import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SequenceList from './SequenceList.jsx';
import { moveTrack, removeTrack } from '../lib/sequence.js';

function Harness({ initial }) {
  const [seq, setSeq] = useState(initial);
  return (
    <SequenceList
      sequence={seq}
      onMove={(i, d) => setSeq((s) => moveTrack(s, i, d))}
      onRemove={(i) => setSeq((s) => removeTrack(s, i))}
    />
  );
}

const seq = [
  { artist: 'Joy Division', title: 'Disorder' },
  { artist: 'The Cure', title: 'A Forest' }
];

describe('SequenceList', () => {
  it('marks the last track as most recent and reorders with the buttons', async () => {
    const user = userEvent.setup();
    render(<Harness initial={seq} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[1]).getByText('most recent')).toBeInTheDocument();
    expect(within(items[0]).getByRole('button', { name: /move .* up/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Move Joy Division - Disorder down' }));
    const after = screen.getAllByRole('listitem');
    expect(within(after[0]).getByText('A Forest')).toBeInTheDocument();
    expect(within(after[1]).getByText('most recent')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove The Cure - A Forest' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
