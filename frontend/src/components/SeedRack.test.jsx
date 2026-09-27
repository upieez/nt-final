import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeedRack from './SeedRack.jsx';

const SEQ = [
  { artist: 'Joy Division', title: 'Disorder', image: 'https://img/1.png' },
  { artist: 'The Cure', title: 'A Forest', image: 'https://img/2.png' }
];

describe('SeedRack', () => {
  it('marks the rightmost slot as most recent and offers a + slot', () => {
    render(<SeedRack sequence={SEQ} onMove={() => {}} onRemove={() => {}} onAddRequest={() => {}} adding={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveClass('slot-recent');
    expect(screen.getByRole('button', { name: 'Add a track' })).toBeInTheDocument();
    expect(screen.getByText('2 / 5 · rightmost is most recent')).toBeInTheDocument();
  });

  it('ejects with the button and moves with the arrow keys', async () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<SeedRack sequence={SEQ} onMove={onMove} onRemove={onRemove} onAddRequest={() => {}} adding={false} />);
    await user.click(screen.getByRole('button', { name: 'Eject The Cure - A Forest' }));
    expect(onRemove).toHaveBeenCalledWith(1);
    const slot = screen.getByRole('group', { name: /Slot 1: Joy Division - Disorder/ });
    fireEvent.keyDown(slot, { key: 'ArrowRight' });
    expect(onMove).toHaveBeenCalledWith(0, 1);
    fireEvent.keyDown(slot, { key: 'Delete' });
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('hides the + slot when five seeds are loaded', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ artist: `A${i}`, title: `T${i}`, image: 'x' }));
    render(<SeedRack sequence={five} onMove={() => {}} onRemove={() => {}} onAddRequest={() => {}} adding={false} />);
    expect(screen.queryByRole('button', { name: 'Add a track' })).not.toBeInTheDocument();
  });
});
