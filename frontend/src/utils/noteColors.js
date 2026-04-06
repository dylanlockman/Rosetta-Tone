// Finger-based color system. Notes are colored by which finger plays them,
// not by pitch class. Used by all instrument views and the tab/notation rows.
//
// Finger numbering convention:
//   0 = open string / unfingered (no color, neutral outline only)
//   1 = index
//   2 = middle
//   3 = ring
//   4 = pinky
//   T = thumb (piano only)

export const FINGER_COLORS = {
  0: '#94A3B8', // slate-400 — open / unfingered
  1: '#EF4444', // red-500   — index
  2: '#3B82F6', // blue-500  — middle
  3: '#22C55E', // green-500 — ring
  4: '#EAB308', // yellow-500 — pinky
  T: '#A855F7', // purple-500 — thumb (piano only)
};

export function getFingerColor(finger) {
  if (finger == null) return FINGER_COLORS[0];
  return FINGER_COLORS[finger] || FINGER_COLORS[0];
}

export function isOpen(finger) {
  return finger === 0 || finger == null;
}
