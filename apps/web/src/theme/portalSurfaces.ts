import { designTokens } from './designTokens';

/** Shared Portal structural surfaces. Light working planes retain existing focus tokens. */
export const portalSurfaces = {
  chrome: designTokens.color.sidebar,
  canvas: `${designTokens.gradient.ambient}, ${designTokens.color.canvas}`,
  panel: 'linear-gradient(125deg, #122746, #0b1b32 55%, #101c35)',
  overlay: 'linear-gradient(135deg, #102643, #08192c)',
  border: designTokens.color.border,
  selected: designTokens.gradient.active,
} as const;
