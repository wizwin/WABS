import axios from 'axios';
import { API } from '../States';

export function useSystemOps({
  indexer, setIndexer, setStats, setActionInProgress, setDataOpProgress,
  showToastMessage, loadDashboard, combinedOptions, explorer, tagsState, peopleState, page, actionInProgress, dataOpProgress
}) {

  // Handles start, stop, pause, resume, and full reindexing controls for the main file indexer.
  async function indexerAction(action){
    if (window.wabs_action_in_progress) return;
    const isAnyRunning = indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation) || actionInProgress || !!dataOpProgress;
    if ((action === 'start' || action === 'update' || action === 'reindex') && isAnyRunning) {
      return;
    }
    if ((action === 'stop' || action === 'pause' || action === 'resume') && actionInProgress) {
      return;
    }

    const isStartingAction = action === 'start' || action === 'update' || action === 'reindex';
    if (isStartingAction) {
      window.wabs_action_in_progress = true;
    }
    setActionInProgress(true);
    try {
      if(action === 'reindex'){
        if(!window.confirm('Are you sure you want to completely re-index the archive? This will wipe the current database and may take a considerable amount of time for large backups.')) {
          if (isStartingAction) window.wabs_action_in_progress = false;
          return;
        }
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
      if (isStartingAction) {
        window.wabs_action_in_progress = false;
      }
      setActionInProgress(false);
    }
  }

  // Triggers an offline backup of WABS configuration and database files to a chosen folder.
  async function backupDatabase() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks (Indexing, Face/Object Scanning, Text Extraction, Hash Verification) before backing up the database to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    try {
      const dest = await axios.get(`${API}/choose-path?mode=directory`);
      if (!dest.data || !dest.data.path) {
        window.wabs_action_in_progress = false;
        return;
      }
      setActionInProgress(true);
      setDataOpProgress({ id: 'backup' });
      await axios.post(`${API}/system/backup`, { destination: dest.data.path });
      showToastMessage('Data safely backed up to ' + dest.data.path);
    } catch (err) {
      alert('Error backing up database: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
      setDataOpProgress(null);
    }
  }

  // Scans for missing files, cleans dead links/AI references, and vacuums databases. Bypasses offline paths to prevent accidental purges.
  async function cleanupDatabase() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks (Indexing, Face/Object Scanning, Text Extraction, Hash Verification) before running the cleanup routine.");
      return;
    }
    window.wabs_action_in_progress = true;
    if (!window.confirm('Are you sure you want to run the cleanup routine? This will scan the entire database for missing files, remove their dead links, clean up empty AI profiles, and vacuum the databases. This may take several minutes for large archives.')) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    const abortCtrl = new AbortController();
    if (peopleState?.aiActionAbortController) {
      if (peopleState.aiActionAbortController.current) peopleState.aiActionAbortController.current.abort();
      peopleState.aiActionAbortController.current = abortCtrl;
    }

    setActionInProgress(true);
    setDataOpProgress({ id: 'cleanup' });
    let wasCancelled = false;
    try {
      showToastMessage('Database cleanup & optimization in progress...');
      const r = await axios.post(`${API}/system/cleanup`, {}, { signal: abortCtrl.signal });
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
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Cleanup cancelled by user.');
        await loadDashboard();
      } else {
        alert('Error running cleanup: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }

  async function stopVerifyDuplicates() {
    if (actionInProgress) return;
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

  // Triggers background SHA-256 verification of files sharing matching sizes/names to locate duplicates.
  async function verifyDuplicates() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before verifying duplicates.");
      return;
    }
    window.wabs_action_in_progress = true;
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
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  return {
    indexerAction, backupDatabase, cleanupDatabase, stopVerifyDuplicates, verifyDuplicates
  };
}