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
    [['#103568', '#09182f', '#161d43'], '#7b63ef', 0.14],
    [['#102643', '#0b1b32', '#101c35'], '#53a5ff', 0.12],
  ] as const) {
    for (let segment = 0; segment < stops.length - 1; segment++)
      for (let step = 0; step <= 20; step++)
        for (let overlay = 0; overlay <= 10; overlay++) {
          const base = blend(rgb(stops[segment]!), rgb(stops[segment + 1]!), step / 20);
          const background = blend(rgb(glow), base, (alpha * overlay) / 10);
          for (const mark of [
            designTokens.accent.main,
            designTokens.color.cyan,
            ...(alpha === 0.12 ? [designTokens.color.coral, designTokens.color.amber] : []),
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

test('action labels retain text contrast across approved dark and light gradients', () => {
  for (const gradient of [designTokens.gradient.brand, designTokens.gradient.focusAction]) {
    const stops = gradient.match(/#[0-9a-f]{6}/gi)!.map(rgb);
    for (let segment = 0; segment < stops.length - 1; segment++) {
      for (let step = 0; step <= 100; step++) {
        expect(
          contrast(rgb('#ffffff'), blend(stops[segment]!, stops[segment + 1]!, step / 100)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test('focus surface text and links remain readable on the light gradient', () => {
  for (const background of designTokens.gradient.advisory.match(/#[0-9a-f]{6}/gi)!) {
    for (const foreground of [
      designTokens.color.focusText,
      designTokens.color.focusTextMuted,
      designTokens.color.focusLink,
    ]) {
      expect(contrast(rgb(foreground), rgb(background))).toBeGreaterThanOrEqual(4.5);
    }
  }
});
