import express from 'express';
import cors from 'cors';
import songsRouter from './routes/songs.js';
import scalesRouter from './routes/scales.js';
import chordsRouter from './routes/chords.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use('/api/songs', songsRouter);
app.use('/api/scales', scalesRouter);
app.use('/api/chords', chordsRouter);

app.listen(PORT, () => {
  console.log(`RosettaTone API running on http://localhost:${PORT}`);
});
