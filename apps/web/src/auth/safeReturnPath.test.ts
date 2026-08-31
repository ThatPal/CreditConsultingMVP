import { describe, expect, test } from 'vitest';
import { safeReturnPath } from './safeReturnPath';

describe('safeReturnPath', () => {
  test.each(['https://evil.example', '//evil.example', '%2F%2Fevil.example', '/\\evil.example'])(
    'rejects external redirect %s',
    (value) => {
      expect(safeReturnPath(value)).toBe('/client/overview');
    },
  );

  test('accepts an internal path with query and fragment', () => {
    expect(safeReturnPath('/client/account?tab=security#sessions')).toBe(
      '/client/account?tab=security#sessions',
    );
  });
});
