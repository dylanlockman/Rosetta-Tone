// Shared layout constants for the multi-track view.
// All time-based rows (NotationView, TabView) and the Playhead use these
// to keep beats aligned across tracks.

export const BEAT_WIDTH = 60;
export const LEFT_GUTTER = 80;
export const RIGHT_PADDING = 40;

export function beatToX(beatIndex) {
  return LEFT_GUTTER + beatIndex * BEAT_WIDTH;
}

export function xToBeat(x) {
  return Math.round((x - LEFT_GUTTER) / BEAT_WIDTH);
}
