import { Router } from 'express';
import { all, get } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const chords = all('SELECT id, name, tuning FROM chords ORDER BY name');
  res.json(chords);
});

router.get('/all/full', (req, res) => {
  const rows = all('SELECT id, name, tuning, fingering FROM chords ORDER BY name');
  res.json(rows.map(r => ({ ...r, fingering: JSON.parse(r.fingering) })));
});

router.get('/:name', (req, res) => {
  const chord = get('SELECT * FROM chords WHERE LOWER(name) = LOWER(?)',
    [req.params.name]);
  if (!chord) return res.status(404).json({ error: 'Chord not found' });
  res.json({ ...chord, fingering: JSON.parse(chord.fingering) });
});

export default router;
