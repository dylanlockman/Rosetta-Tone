import { useCallback, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { tabToScore } from '../utils/tabParser.js';
import { musicXmlToScore } from '../utils/importers/musicxml.js';
import { midiToScore } from '../utils/importers/midi.js';
import { scoreToBeats, scoreDuration } from '../utils/score.js';

const SAMPLE_TAB = `e|---0---2---3---|---0---2---3---|
B|---1---3---0---|---1---3---0---|
G|---0---2---0---|---0---2---0---|
D|---2---0---0---|---2---0---0---|
A|---3---0---2---|---3---0---2---|
E|---0---2---3---|---0---2---3---|`;

const ACCEPT = '.xml,.musicxml,.mxl,.mid,.midi';

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Parse an uploaded file into { score, source_type, raw_content }.
async function importFile(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'mid' || ext === 'midi') {
    const score = midiToScore(buf);
    return { score, source_type: 'midi', raw_content: bytesToBase64(bytes) };
  }

  const score = musicXmlToScore(bytes);
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return {
    score,
    source_type: 'musicxml',
    raw_content: isZip ? bytesToBase64(bytes) : new TextDecoder().decode(bytes),
  };
}

function ScorePreview({ score }) {
  const beats = scoreToBeats(score);
  const totalBeats = scoreDuration(score);
  const bars = Math.ceil(totalBeats / ((score.meta.timeSignature[0] * 4) / score.meta.timeSignature[1]));
  const onGuitar = score.events.filter(e => e.fret != null).length;
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850/80 px-4 py-3 text-sm space-y-1">
      <div className="text-chrome-100 font-medium">
        {score.events.length} notes · {beats.length} beats · {bars} bars
      </div>
      <div className="text-chrome-400 text-xs">
        {score.meta.bpm ? `${score.meta.bpm} BPM · ` : ''}
        {score.meta.timeSignature.join('/')}
        {score.meta.keyRoot ? ` · key of ${score.meta.keyRoot}` : ''}
        {' · '}
        {onGuitar === score.events.length
          ? 'all notes mapped to fretboard'
          : `${onGuitar}/${score.events.length} notes mapped to fretboard`}
      </div>
    </div>
  );
}

export default function AddSongModal({ onClose }) {
  const addSong = useStore(s => s.addSong);
  const [mode, setMode] = useState('paste'); // 'paste' | 'file'
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [imported, setImported] = useState(null); // { score, source_type, raw_content, fileName }
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setError(null);
    try {
      const result = await importFile(file);
      setImported({ ...result, fileName: file.name });
      const stem = file.name.replace(/\.[^.]+$/, '');
      setTitle(t => t || result.score.meta.title || stem);
      setArtist(a => a || result.score.meta.artist || '');
    } catch (e) {
      setImported(null);
      setError(`Could not import "${file.name}": ${e.message}`);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (mode === 'paste') {
      if (!title.trim() || !rawContent.trim()) {
        setError('Title and tab content are required');
        return;
      }
    } else if (!imported) {
      setError('Choose a MusicXML or MIDI file first');
      return;
    } else if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'paste') {
        // Validate before saving so a bad paste doesn't create an empty song.
        const score = tabToScore(rawContent, { title: title.trim(), artist: artist.trim() });
        await addSong({
          title: title.trim(), artist: artist.trim(),
          raw_content: rawContent, source_type: 'tab', score,
        });
      } else {
        imported.score.meta.title = title.trim();
        imported.score.meta.artist = artist.trim() || imported.score.meta.artist;
        await addSong({
          title: title.trim(), artist: artist.trim(),
          raw_content: imported.raw_content,
          source_type: imported.source_type,
          score: imported.score,
        });
      }
      onClose();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-ink-900 border border-ink-700 rounded-xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-700/60">
          <h3 className="text-lg font-semibold">Add Song</h3>
          <button onClick={onClose} className="text-chrome-400 hover:text-chrome-100 text-2xl leading-none">×</button>
        </div>

        {/* Source mode tabs */}
        <div className="flex gap-1 px-5 pt-4">
          {[
            { key: 'paste', label: 'Paste Tab' },
            { key: 'file', label: 'MusicXML / MIDI File' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setError(null); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === key
                  ? 'bg-ink-700 text-chrome-100'
                  : 'text-chrome-400 hover:text-chrome-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-chrome-400 mb-1 uppercase tracking-wide">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-ink-850 border border-ink-700 rounded-md text-chrome-100"
                placeholder="Song title"
              />
            </div>
            <div>
              <label className="block text-xs text-chrome-400 mb-1 uppercase tracking-wide">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                className="w-full px-3 py-2 bg-ink-850 border border-ink-700 rounded-md text-chrome-100"
                placeholder="Artist (optional)"
              />
            </div>
          </div>

          {mode === 'paste' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-chrome-400 uppercase tracking-wide">ASCII Tab *</label>
                <button
                  type="button"
                  onClick={() => setRawContent(SAMPLE_TAB)}
                  className="text-xs text-gold-400 hover:text-gold-300"
                >
                  Insert sample
                </button>
              </div>
              <textarea
                value={rawContent}
                onChange={e => setRawContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 bg-ink-850 border border-ink-700 rounded-md font-mono text-sm text-chrome-100 whitespace-pre"
                placeholder={'Paste 6-line ASCII tab here...\nBar lines (|) give the parser real timing.'}
              />
            </div>
          )}

          {mode === 'file' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragOver
                    ? 'border-gold-400 bg-gold-400/5'
                    : 'border-ink-600 hover:border-chrome-500'
                }`}
              >
                <div className="text-chrome-300 text-sm font-medium">
                  {imported ? imported.fileName : 'Drop a file here, or click to browse'}
                </div>
                <div className="text-chrome-500 text-xs mt-1">
                  .musicxml · .xml · .mxl · .mid · .midi
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
              </div>
              {imported && <ScorePreview score={imported.score} />}
            </div>
          )}

          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-chrome-300 hover:text-chrome-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-gold-400 hover:bg-gold-300 disabled:bg-ink-600 disabled:text-chrome-400 text-ink-950 font-semibold rounded-md"
            >
              {submitting ? 'Saving...' : 'Save Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
