import { Router } from 'express';
import { all, get, run } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const songs = all('SELECT id, title, artist, source_type, created_at FROM songs ORDER BY created_at DESC');
  res.json(songs);
});

router.post('/', (req, res) => {
  const { title, artist, source_type, source_url, raw_content, parsed_json } = req.body;
  if (!title || !source_type || !raw_content) {
    return res.status(400).json({ error: 'title, source_type, and raw_content are required' });
  }
  const result = run(
    'INSERT INTO songs (title, artist, source_type, source_url, raw_content, parsed_json) VALUES (?, ?, ?, ?, ?, ?)',
    [title, artist || null, source_type, source_url || null, raw_content, parsed_json || null]
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.get('/:id', (req, res) => {
  const song = get('SELECT * FROM songs WHERE id = ?', [Number(req.params.id)]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  res.json(song);
});

router.delete('/:id', (req, res) => {
  const result = run('DELETE FROM songs WHERE id = ?', [Number(req.params.id)]);
  if (result.changes === 0) return res.status(404).json({ error: 'Song not found' });
  res.json({ deleted: true });
});

export default router;
