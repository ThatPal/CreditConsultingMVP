import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CollectionSurface } from './CollectionSurface';

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('collection keyboard and optional storage boundary', () => {
  test('blocked storage does not prevent rendering or unmounting', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const view = render(
      <CollectionSurface title="Queue" mode="bounded">
        <button data-collection-item>Open record</button>
      </CollectionSurface>,
    );
    expect(screen.getByRole('button', { name: 'Open record' })).toBeEnabled();
    expect(() => view.unmount()).not.toThrow();
  });

  test('restores a valid offset and saves the mounted element offset on exit', () => {
    sessionStorage.setItem('collection-scroll:Queue', '90');
    const view = render(
      <CollectionSurface title="Queue" mode="bounded">
        Records
      </CollectionSurface>,
    );
    const region = screen.getByRole('region', { name: 'Queue records' });
    expect(region.scrollTop).toBe(90);
    region.scrollTop = 180;
    view.unmount();
    expect(sessionStorage.getItem('collection-scroll:Queue')).toBe('180');
  });

  test.each(['NaN', '-1', 'Infinity', 'not a number'])(
    'ignores invalid saved offset %s',
    (offset) => {
      sessionStorage.setItem('collection-scroll:Queue', offset);
      render(
        <CollectionSurface title="Queue" mode="bounded">
          Records
        </CollectionSurface>,
      );
      expect(screen.getByRole('region').scrollTop).toBe(0);
    },
  );

  test('editing fields and nested buttons retain their own arrow keys', () => {
    render(
      <CollectionSurface title="Queue" mode="bounded">
        <div data-collection-item tabIndex={0}>
          <input aria-label="Amount" type="number" />
          <textarea aria-label="Response" />
          <select aria-label="Outcome">
            <option>Pending</option>
            <option>Approved</option>
          </select>
          <div
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Notes"
            tabIndex={0}
          >
            Draft
          </div>
          <button>Nested action</button>
        </div>
        <button data-collection-item>Next record</button>
      </CollectionSurface>,
    );
    for (const control of [
      screen.getByLabelText('Amount'),
      screen.getByLabelText('Response'),
      screen.getByLabelText('Outcome'),
      screen.getByLabelText('Notes'),
      screen.getByText('Nested action'),
    ]) {
      control.focus();
      expect(fireEvent.keyDown(control, { key: 'ArrowDown' })).toBe(true);
      expect(control).toHaveFocus();
    }
  });

  test('moves among eligible rows, preserves modified keys and does not trap the last row', () => {
    render(
      <CollectionSurface title="Queue" mode="bounded">
        <button data-collection-item>First</button>
        <button data-collection-item disabled>
          Unavailable
        </button>
        <button data-collection-item hidden>
          Hidden
        </button>
        <button data-collection-item aria-disabled="true">
          Pending
        </button>
        <button data-collection-item>Last</button>
      </CollectionSurface>,
    );
    const first = screen.getByText('First');
    const last = screen.getByText('Last');
    first.focus();
    expect(fireEvent.keyDown(first, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(last).toHaveFocus();
    expect(fireEvent.keyDown(last, { key: 'ArrowDown' })).toBe(true);
    screen.getByRole('region').focus();
    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowUp' });
    expect(last).toHaveFocus();
  });

  test('nested collections cannot move focus into their parent collection', () => {
    render(
      <CollectionSurface title="Outer" mode="bounded">
        <CollectionSurface title="Inner" mode="bounded">
          <button data-collection-item>Inner last</button>
        </CollectionSurface>
        <button data-collection-item>Outer row</button>
      </CollectionSurface>,
    );
    const inner = screen.getByText('Inner last');
    inner.focus();
    fireEvent.keyDown(inner, { key: 'ArrowDown' });
    expect(inner).toHaveFocus();
  });
});
