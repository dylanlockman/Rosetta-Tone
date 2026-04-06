import { useState } from 'react';
import { useStore } from '../store/useStore.js';

const SAMPLE_TAB = `e|---0---2---3---|---0---2---3---|
B|---1---3---0---|---1---3---0---|
G|---0---2---0---|---0---2---0---|
D|---2---0---0---|---2---0---0---|
A|---3---0---2---|---3---0---2---|
E|---0---2---3---|---0---2---3---|`;

export default function AddSongModal({ onClose }) {
  const addSong = useStore(s => s.addSong);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !rawContent.trim()) {
      setError('Title and tab content are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addSong({ title: title.trim(), artist: artist.trim(), raw_content: rawContent });
      onClose();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <h3 className="text-lg font-semibold">Add Song</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
              placeholder="Song title"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide">Artist</label>
            <input
              type="text"
              value={artist}
              onChange={e => setArtist(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100"
              placeholder="Artist (optional)"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs text-slate-400 uppercase tracking-wide">ASCII Tab *</label>
              <button
                type="button"
                onClick={() => setRawContent(SAMPLE_TAB)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Insert sample
              </button>
            </div>
            <textarea
              value={rawContent}
              onChange={e => setRawContent(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded font-mono text-sm text-slate-100 whitespace-pre"
              placeholder="Paste 6-line ASCII tab here..."
            />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-600 text-slate-900 font-medium rounded"
            >
              {submitting ? 'Saving...' : 'Save Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
