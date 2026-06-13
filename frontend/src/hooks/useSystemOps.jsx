import axios from 'axios';
import { API } from '../States';

export function useSystemOps({
  indexer, setIndexer, setStats, setActionInProgress, setDataOpProgress,
  showToastMessage, loadDashboard, combinedOptions, explorer, tagsState, peopleState, page
}) {

  async function indexerAction(action){
    const isAnyRunning = indexer.running || indexer.combined_scanner_running;
    if ((action === 'start' || action === 'update' || action === 'reindex') && isAnyRunning) {
      return;
    }

    setActionInProgress(true);
    try {
      if(action === 'reindex'){
        if(!window.confirm('Are you sure you want to completely re-index the archive? This will wipe the current database and may take a considerable amount of time for large backups.')) return;
        await axios.post(`${API}/indexer/reindex`, combinedOptions)
        explorer.setFiles([])
        explorer.setSearchCache([])
        explorer.setSelected(null)
        explorer.setCheckedFiles(new Set())
        explorer.setOffset(0)
        explorer.setStartOffset(0)
        explorer.setHasMore(false)
        setStats({total:0,photos:0,videos:0,audio:0,documents:0,ebooks:0,code:0,fonts:0,databases:0,compressed:0,installers:0,binaries:0,others:0,duplicates:0,searchable_documents:0,tagged_objects:0,untagged_media:0})
        tagsState.setObjectTags([])
      } else if (action === 'start' || action === 'update') {
        await axios.post(`${API}/indexer/${action}`, combinedOptions)
      } else {
        await axios.post(`${API}/indexer/${action}`)
        
        if (action === 'pause') {
          explorer.globalFileCache.current.clear();
          if (Array.isArray(explorer.files)) explorer.files.forEach(f => explorer.globalFileCache.current.set(f.path, f));
          if (Array.isArray(peopleState.personFiles)) peopleState.personFiles.forEach(f => explorer.globalFileCache.current.set(f.path, f));
          if (Array.isArray(explorer.searchCache)) explorer.searchCache.forEach(f => explorer.globalFileCache.current.set(f.path, f));
          
          try {
            await axios.post(`${API}/system/free-memory`);
          } catch(err) {}
        }
      }
      await loadDashboard()
    } finally {
      setActionInProgress(false);
    }
  }

  async function backupDatabase() {
    if (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) {
      alert("Please stop all background tasks (Indexing, Face/Object Scanning, Text Extraction, Hash Verification) before backing up the database to ensure data consistency.");
      return;
    }
    try {
      const dest = await axios.get(`${API}/choose-path?mode=directory`);
      if (!dest.data || !dest.data.path) return;
      setActionInProgress(true);
      setDataOpProgress({ id: 'backup' });
      await axios.post(`${API}/system/backup`, { destination: dest.data.path });
      showToastMessage('Data safely backed up to ' + dest.data.path);
    } catch (err) {
      alert('Error backing up database: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
      setDataOpProgress(null);
    }
  }

  async function cleanupDatabase() {
    if (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) {
      alert("Please stop all background tasks (Indexing, Face/Object Scanning, Text Extraction, Hash Verification) before running the cleanup routine.");
      return;
    }
    if (!window.confirm('Are you sure you want to run the cleanup routine? This will scan the entire database for missing files, remove their dead links, clean up empty AI profiles, and vacuum the databases. This may take several minutes for large archives.')) return;
    setActionInProgress(true);
    setDataOpProgress({ id: 'cleanup' });
    try {
      showToastMessage('Database cleanup & optimization in progress...');
      const r = await axios.post(`${API}/system/cleanup`);
      showToastMessage(`Cleanup complete. Removed ${r.data.removed_files} missing files.`);
      await loadDashboard(); 
      if (r.data.removed_files > 0) {
        explorer.globalFileCache.current.clear();
        explorer.setCheckedFiles(new Set());
        explorer.setSelected(null);
        if (page === 'explorer') await explorer.loadFiles(0, false, explorer.filterCategory);
        else if (page === 'search') await explorer.goToSearch(explorer.filterCategory);
      }
    } catch (err) {
      alert('Error running cleanup: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
      setDataOpProgress(null);
    }
  }

  async function stopVerifyDuplicates() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, hasher_stopped: true }));
      await axios.post(`${API}/stop-verify-duplicates`)
      showToastMessage('Stopping duplicate verification...')
      await loadDashboard();
    } catch(err) {
      alert('Error stopping verification: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setActionInProgress(false);
    }
  }

  async function verifyDuplicates() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, hasher_running: true, hasher_stopped: false }));
      await axios.post(`${API}/verify-duplicates`)
      showToastMessage('Duplicate verification started in background...')
      await loadDashboard();
    } catch(err) {
      setIndexer(prev => ({ ...prev, hasher_running: false }));
      alert('Error starting verification: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setActionInProgress(false);
    }
  }

  return {
    indexerAction, backupDatabase, cleanupDatabase, stopVerifyDuplicates, verifyDuplicates
  };
}