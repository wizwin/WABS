import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { API } from '../States';

export function useTags({
  indexer, setIndexer, checkedFiles, setCheckedFiles, globalFileCache, page, filterCategory,
  loadFiles, goToSearch, selected, setSelected, loadDashboard,
  showToastMessage, setActionInProgress, setDataOpProgress, actionInProgress, dataOpProgress
}) {
  const [objectTags, setObjectTags] = useState([]);
  const [isTaggingObject, setIsTaggingObject] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagsPage, setTagsPage] = useState(1);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const abortDataOpRef = useRef(false);

  // Fetches unique object: tags from the database to populate UI lists and dashboard charts.
  async function loadTags() {
    try {
      const tagsRes = await axios.get(`${API}/tags/objects?t=${Date.now()}`);
      if (tagsRes && tagsRes.data) {
        setObjectTags(tagsRes.data);
      }
    } catch (err) {
      console.warn('Failed to load tags', err);
    }
  }

  async function addTagsToSelected(tagsStr) {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying tags to prevent database conflicts.");
      return;
    }
    if (!tagsStr) return;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t);
    if (tags.length === 0) return;
    window.wabs_action_in_progress = true;
    const fileIds = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)?.id).filter(id => id);
    const filePaths = Array.from(checkedFiles);
    setActionInProgress(true);
    try {
      await axios.post(`${API}/tags/add`, { file_ids: fileIds, tags });
  
      const undoAction = {
        label: 'Undo',
        onClick: async () => {
          setActionInProgress(true);
          try {
            await axios.post(`${API}/tags/remove`, { file_ids: fileIds, tags });
            showToastMessage('Tagging undone.');
            if (page === 'explorer') {
              await loadFiles(0, false, filterCategory);
            } else if (page === 'search') {
              await goToSearch(filterCategory);
            }
            if (page === 'explorer' && selected && filePaths.includes(selected.path)) {
              const updatedFile = globalFileCache.current.get(selected.path);
              setSelected(updatedFile || null);
            }
            loadDashboard();
            loadTags();
          } catch (e) {
            alert('Error undoing tag: ' + (e?.response?.data?.detail || e.message));
          } finally {
            setActionInProgress(false);
          }
        }
      };
  
      showToastMessage(`Added tags to ${fileIds.length} files.`, undoAction);
      setIsTaggingObject(false);
      setTagInput('');
      setCheckedFiles(new Set());
      if (page === 'explorer') {
        await loadFiles(0, false, filterCategory);
      } else if (page === 'search') {
        await goToSearch(filterCategory);
      }
      if (page === 'explorer' && selected && filePaths.includes(selected.path)) {
        const updatedFile = globalFileCache.current.get(selected.path);
        setSelected(updatedFile || null);
      }
      loadDashboard();
      loadTags();
    } catch(err) {
      alert('Error adding tags: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }
  
  async function removeTagsFromSelected(tagsStr) {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying tags to prevent database conflicts.");
      return;
    }
    if (!tagsStr) return;
    const tags = tagsStr.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t);
    if (tags.length === 0) return;
    window.wabs_action_in_progress = true;
    const fileIds = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)?.id).filter(id => id);
    const filePaths = Array.from(checkedFiles);
    setActionInProgress(true);
    try {
      await axios.post(`${API}/tags/remove`, { file_ids: fileIds, tags });
  
      const undoAction = {
        label: 'Undo',
        onClick: async () => {
          setActionInProgress(true);
          try {
            await axios.post(`${API}/tags/add`, { file_ids: fileIds, tags });
            showToastMessage('Tag removal undone.');
            if (page === 'explorer') {
              await loadFiles(0, false, filterCategory);
            } else if (page === 'search') {
              await goToSearch(filterCategory);
            }
            if (page === 'explorer' && selected && filePaths.includes(selected.path)) {
              const updatedFile = globalFileCache.current.get(selected.path);
              setSelected(updatedFile || null);
            }
            loadDashboard();
            loadTags();
          } catch (e) {
            alert('Error undoing tag removal: ' + (e?.response?.data?.detail || e.message));
          } finally {
            setActionInProgress(false);
          }
        }
      };
  
      showToastMessage(`Removed tags from ${fileIds.length} files.`, undoAction);
      setIsTaggingObject(false);
      setTagInput('');
      setCheckedFiles(new Set());
      if (page === 'explorer') {
        await loadFiles(0, false, filterCategory);
      } else if (page === 'search') {
        await goToSearch(filterCategory);
      }
      if (page === 'explorer' && selected && filePaths.includes(selected.path)) {
        const updatedFile = globalFileCache.current.get(selected.path);
        setSelected(updatedFile || null);
      }
      loadDashboard();
      loadTags();
    } catch(err) {
      alert('Error removing tags: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }
  
  // Deletes a selected tag from every file in the index globally.
  async function deleteTagGlobally(tag) {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying tags to prevent database conflicts.");
      return;
    }
    window.wabs_action_in_progress = true;
    const tagName = tag.replace('object:', '').replace(/_/g, ' ');
    if (!window.confirm(`Are you sure you want to remove the tag "${tagName}" from ALL files? This cannot be undone.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    setActionInProgress(true);
    try {
      await axios.delete(`${API}/tags/objects/${encodeURIComponent(tag)}`);
      showToastMessage(`Tag "${tagName}" removed from all files.`);
      loadDashboard();
      loadTags();
    } catch(err) {
      alert('Error deleting tag: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }
  
  // Purges all automatically detected AI tags from every file and resets scanner progress.
  async function clearAllObjectTags() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying tags to prevent database conflicts.");
      return;
    }
    window.wabs_action_in_progress = true;
    if (!window.confirm(`Are you sure you want to remove ALL automatically detected object tags from EVERY file in the database? This action cannot be undone.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    setActionInProgress(true);
    try {
      await axios.delete(`${API}/tags/objects/all`);
      await axios.post(`${API}/reset-object-scanner-progress`);
      showToastMessage(`All object tags have been cleared.`);
      loadDashboard();
      loadTags();
    } catch(err) {
      alert('Error clearing all tags: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }
  
  // Serializes and downloads all custom/manual tags as a JSON backup file.
  async function exportTags() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before exporting tags to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    setActionInProgress(true);
    setDataOpProgress({ id: 'tags', action: 'export', current: 0, total: 0 });
    showToastMessage('Exporting tags...');
    try {
      const r = await axios.get(`${API}/system/export-tags`);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(r.data, null, 2));
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", dataStr);
      dlAnchorElem.setAttribute("download", `wabs_tags_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
      showToastMessage('Tags exported successfully.');
    } catch(err) {
      alert('Error exporting tags: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setDataOpProgress(null);
      setActionInProgress(false);
    }
  }
  
  // Imports tags from JSON with safety confirmations. Uses path remap fallbacks so tags survive migrations.
  function importTags() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before importing tags to prevent database conflicts.");
      return;
    }
    if (objectTags && objectTags.length > 0) {
      if (!window.confirm("You already have tags in your database. Importing again might create duplicated tags. Do you wish to continue?")) return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (window.wabs_action_in_progress) return;
        window.wabs_action_in_progress = true;
        try {
          const payload = JSON.parse(event.target.result);
          if (!Array.isArray(payload)) throw new Error("Invalid JSON format");
          setActionInProgress(true);
          setDataOpProgress({ id: 'tags', action: 'import', current: 0, total: payload.length });
          abortDataOpRef.current = false;
          let totalImported = 0;
          const chunkSize = 2000;
          for (let i = 0; i < payload.length; i += chunkSize) {
            if (abortDataOpRef.current) {
              showToastMessage('Import cancelled by user.');
              break;
            }
            setDataOpProgress({ id: 'tags', action: 'import', current: i, total: payload.length });
            showToastMessage(`Importing tags... ${Math.round((i / payload.length) * 100)}%`);
            const chunk = payload.slice(i, i + chunkSize);
            const r = await axios.post(`${API}/system/import-tags`, chunk);
            totalImported += r.data.imported_files;
          }
          if (!abortDataOpRef.current) {
            showToastMessage(`Successfully imported tags for ${totalImported} files.`);
          }
          loadTags();
        } catch (err) {
          alert('Error importing tags: ' + (err?.response?.data?.detail || err.message));
        } finally {
          window.wabs_action_in_progress = false;
          setDataOpProgress(null);
          setActionInProgress(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const filteredTags = useMemo(() => {
    return objectTags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase()));
  }, [objectTags, tagSearchQuery]);

  return {
    objectTags, setObjectTags,
    isTaggingObject, setIsTaggingObject,
    tagInput, setTagInput,
    tagsPage, setTagsPage,
    tagSearchQuery, setTagSearchQuery,
    loadTags, addTagsToSelected, removeTagsFromSelected, deleteTagGlobally, clearAllObjectTags, exportTags, importTags,
    filteredTags,
    abortTagsDataOpRef: abortDataOpRef
  };
}