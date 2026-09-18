import { designTokens } from './designTokens';

/** Shared Portal structural surfaces. Light working planes retain existing focus tokens. */
export const portalSurfaces = {
  chrome: designTokens.color.sidebar,
  canvas: `${designTokens.gradient.ambient}, ${designTokens.color.canvas}`,
  panel: 'linear-gradient(135deg, rgba(12,53,65,.88), rgba(8,31,44,.96))',
  overlay: 'linear-gradient(135deg, #0c3541, #081f2c)',
  border: designTokens.color.border,
  selected: designTokens.gradient.active,
} as const;
