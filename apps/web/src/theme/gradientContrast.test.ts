import { expect, test } from 'vitest';
import { designTokens } from './designTokens';
const rgb = (hex: string) =>
  hex
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16));
const blend = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i]! * (1 - t));
const lum = (a: number[]) =>
  a
    .map((x) => x / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
    .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i]!, 0);
const contrast = (a: number[], b: number[]) =>
  (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
test('body copy remains readable across the full glow/base blend bounds', () => {
  for (const [stops, glow, alpha] of [
    [['#1c3d43', '#173144', '#27344d'], '#70cde8', 0.2],
    [['#183a45', '#142b3e', '#292c4b'], '#66d8bd', 0.16],
  ] as const) {
    for (let segment = 0; segment < stops.length - 1; segment++)
      for (let step = 0; step <= 20; step++)
        for (let overlay = 0; overlay <= 10; overlay++) {
          const base = blend(rgb(stops[segment]!), rgb(stops[segment + 1]!), step / 20);
          const background = blend(rgb(glow), base, (alpha * overlay) / 10);
          for (const mark of [
            designTokens.accent.main,
            designTokens.color.cyan,
            ...(alpha === 0.16 ? [designTokens.color.coral, designTokens.color.amber] : []),
          ]) {
            expect(contrast(rgb(mark), background)).toBeGreaterThanOrEqual(3);
          }
          expect(
            contrast(rgb(designTokens.color.textSecondary), background),
          ).toBeGreaterThanOrEqual(4.5);
          expect(contrast(rgb(designTokens.color.textPrimary), background)).toBeGreaterThanOrEqual(
            4.5,
          );
        }
  }
});
