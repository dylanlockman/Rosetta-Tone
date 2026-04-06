import { useEffect } from 'react';
import { useStore } from './store/useStore.js';
import Header from './components/Header.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TrackContainer from './components/TrackContainer.jsx';

export default function App() {
  const fetchChordLibrary = useStore(s => s.fetchChordLibrary);

  useEffect(() => {
    fetchChordLibrary();
  }, [fetchChordLibrary]);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex flex-1 min-h-0">
        <LibraryPanel />
        <TrackContainer />
      </div>
    </div>
  );
}
