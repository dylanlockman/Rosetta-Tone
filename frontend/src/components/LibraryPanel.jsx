import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import AddSongModal from './AddSongModal.jsx';

export default function LibraryPanel() {
  const songs = useStore(s => s.songs);
  const activeSong = useStore(s => s.activeSong);
  const fetchSongs = useStore(s => s.fetchSongs);
  const loadSong = useStore(s => s.loadSong);
  const deleteSong = useStore(s => s.deleteSong);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  return (
    <aside className="w-64 border-r border-slate-700 bg-slate-900 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Library</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-500 text-center">
            No songs yet. Click "+ Add Song" to start.
          </div>
        )}
        {songs.map(song => (
          <div
            key={song.id}
            className={`group flex items-center justify-between px-4 py-2 cursor-pointer border-l-2 transition-colors ${
              activeSong?.id === song.id
                ? 'bg-slate-800 border-cyan-400'
                : 'border-transparent hover:bg-slate-800/50'
            }`}
            onClick={() => loadSong(song.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 truncate">{song.title}</div>
              {song.artist && (
                <div className="text-xs text-slate-500 truncate">{song.artist}</div>
              )}
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${song.title}"?`)) deleteSong(song.id);
              }}
              title="Delete"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-slate-700">
        <button
          className="w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium rounded text-sm"
          onClick={() => setShowModal(true)}
        >
          + Add Song
        </button>
      </div>
      {showModal && <AddSongModal onClose={() => setShowModal(false)} />}
    </aside>
  );
}
