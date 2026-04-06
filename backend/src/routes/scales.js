import { Router } from 'express';
import { all, get } from '../db.js';

const router = Router();

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

router.get('/', (req, res) => {
  const scales = all('SELECT * FROM scales ORDER BY name');
  res.json(scales);
});

router.get('/:name/:root', (req, res) => {
  const scale = get('SELECT * FROM scales WHERE LOWER(name) = LOWER(?)',
    [req.params.name.replace(/-/g, ' ')]);
  if (!scale) return res.status(404).json({ error: 'Scale not found' });

  const root = req.params.root.charAt(0).toUpperCase() + req.params.root.slice(1);
  const rootIndex = CHROMATIC.indexOf(root);
  if (rootIndex === -1) return res.status(400).json({ error: 'Invalid root note' });

  const intervals = scale.intervals.split(',').map(Number);
  const notes = [root];
  let current = rootIndex;
  for (const interval of intervals) {
    current = (current + interval) % 12;
    notes.push(CHROMATIC[current]);
  }
  // Remove the last note if it duplicates the root (octave)
  if (notes.length > intervals.length) notes.pop();

  res.json({ name: scale.name, root, intervals: scale.intervals, notes });
});

export default router;
