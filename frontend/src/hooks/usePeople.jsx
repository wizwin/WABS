import { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { API, parseFileDate, dateFormatter } from '../States';

export function usePeople({
  indexer, setIndexer, settings, page, setPage, selected, setSelected,
  checkedFiles, setCheckedFiles, globalFileCache, filterCategory,
  loadFiles, goToSearch, loadDashboard, showToastMessage,
  setActionInProgress, setDataOpProgress, setOffset, setStartOffset, setHasMore, actionInProgress, dataOpProgress,
  invalidateViewCache, loadVirtualFolders
}) {
  const [people, setPeople] = useState([]);
  const [currentPerson, setCurrentPerson] = useState(null);
  const [personFiles, setPersonFiles] = useState([]);
  const [peopleSortBy, setPeopleSortBy] = useState(() => {
    try {
      const saved = localStorage.getItem('wabs_people_sort_by');
      return saved ? saved : 'name';
    } catch (e) {
      return 'name';
    }
  });
  const [checkedPeople, setCheckedPeople] = useState(new Set());
  const [isTaggingPerson, setIsTaggingPerson] = useState(false);
  const [personTagInput, setPersonTagInput] = useState('');
  const [editingNames, setEditingNames] = useState({});
  const [unknownPeoplePage, setUnknownPeoplePage] = useState(1);
  const [namedPeoplePage, setNamedPeoplePage] = useState(1);
  const [namedPersonSearchQuery, setNamedPersonSearchQuery] = useState('');
  const [similarUnknowns, setSimilarUnknowns] = useState(null);
  const [similarUnknownsPage, setSimilarUnknownsPage] = useState(1);
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [checkedSimilar, setCheckedSimilar] = useState(new Set());
  const [similarityThreshold, setSimilarityThreshold] = useState(() => {
    try {
      const saved = localStorage.getItem('wabs_similarity_threshold');
      return saved !== null ? parseFloat(saved) : 0.55;
    } catch (e) {
      return 0.55;
    }
  });
  const [showUnknownsActions, setShowUnknownsActions] = useState(false);
  const [showSelectedUnknownsActions, setShowSelectedUnknownsActions] = useState(false);
  const [purgeThreshold, setPurgeThreshold] = useState(() => {
    try {
      const saved = localStorage.getItem('wabs_purge_threshold');
      return saved !== null ? parseInt(saved) : 3;
    } catch (e) {
      return 3;
    }
  });
  const [showSimilarPanel, setShowSimilarPanel] = useState(false);
  const [mergeConflictData, setMergeConflictData] = useState(null);
  const [personPreviewPhotos, setPersonPreviewPhotos] = useState([]);
  const [thumbUpdateTimestamps, setThumbUpdateTimestamps] = useState({});
  const [personConnections, setPersonConnections] = useState([]);
  const [allConnections, setAllConnections] = useState([]);

  const findSimilarAbortController = useRef(null);
  const aiActionAbortController = useRef(null);
  const abortDataOpRef = useRef(false);
  const personGalleryCache = useRef(new Map());

  useEffect(() => {
    if (selected && selected.is_person) {
      let isMounted = true;
      setPersonPreviewPhotos([]);
      axios.get(`${API}/people/${selected.id}/photos?offset=0&limit=6`)
        .then(r => {
          if (isMounted) setPersonPreviewPhotos(r.data);
        })
        .catch(e => console.warn(e));
      return () => { isMounted = false; };
    } else {
      setPersonPreviewPhotos([]);
    }
  }, [selected]);

  useEffect(() => {
    localStorage.setItem('wabs_similarity_threshold', similarityThreshold.toString());
  }, [similarityThreshold]);

  useEffect(() => {
    localStorage.setItem('wabs_purge_threshold', purgeThreshold.toString());
  }, [purgeThreshold]);

  useEffect(() => {
    localStorage.setItem('wabs_people_sort_by', peopleSortBy);
  }, [peopleSortBy]);

  useEffect(() => {
    if (Array.isArray(personFiles)) personFiles.forEach(f => globalFileCache.current.set(f.path, f));
  }, [personFiles, globalFileCache]);

  useEffect(() => {
    if (page === 'person_files' && currentPerson?.id && Array.isArray(personFiles)) {
      const existing = personGalleryCache.current.get(currentPerson.id);
      if (existing) {
        existing.files = personFiles;
        existing.offset = personFiles.length;
      }
    }
  }, [personFiles, currentPerson?.id, page]);

  const savePersonScroll = (personId) => {
    const targetId = personId || currentPerson?.id;
    if (!targetId) return;
    const contentEl = document.querySelector('.content');
    const top = contentEl ? contentEl.scrollTop : 0;
    const existing = personGalleryCache.current.get(targetId);
    if (existing) {
      existing.scrollTop = top;
      existing.files = personFiles;
      existing.offset = personFiles.length;
    } else {
      personGalleryCache.current.set(targetId, {
        files: personFiles,
        offset: personFiles.length,
        startOffset: 0,
        hasMore: false,
        scrollTop: top
      });
    }
  };

  async function loadPersonConnections(personId) {
    if (!personId) return;
    try {
      const r = await axios.get(`${API}/people/${personId}/connections`);
      if (r.data?.connections) {
        setPersonConnections(r.data.connections);
      }
    } catch (err) {
      console.warn('Failed to load person connections', err);
      setPersonConnections([]);
    }
  }

  async function loadAllConnections() {
    try {
      const r = await axios.get(`${API}/people-connections`);
      if (r.data?.connections) {
        setAllConnections(r.data.connections);
      }
    } catch (err) {
      console.warn('Failed to load all connections', err);
    }
  }

  async function addPersonConnection(personId, relatedPersonId, relationType) {
    try {
      const r = await axios.post(`${API}/people/${personId}/connections`, {
        related_person_id: relatedPersonId,
        relation_type: relationType
      });
      if (r.data?.connections) {
        setPersonConnections(r.data.connections);
      }
      loadAllConnections();
      loadPeople();
      if (showToastMessage) showToastMessage('Relationship connection added.');
    } catch (err) {
      alert('Error adding connection: ' + (err?.response?.data?.detail || err.message));
    }
  }

  async function removePersonConnection(personId, relatedPersonId, relationType = null) {
    try {
      const q = relationType ? `?relation_type=${encodeURIComponent(relationType)}` : '';
      await axios.delete(`${API}/people/${personId}/connections/${relatedPersonId}${q}`);
      setPersonConnections(prev => prev.filter(c => !(c.related_person_id === relatedPersonId && (!relationType || c.relation_type === relationType))));
      loadAllConnections();
      loadPeople();
      if (showToastMessage) showToastMessage('Relationship connection removed.');
    } catch (err) {
      alert('Error removing connection: ' + (err?.response?.data?.detail || err.message));
    }
  }

  // Fetches named and unknown profiles from the backend database.
  async function loadPeople() {
    try {
      loadAllConnections();
      const minPhotos = (settings.min_unknown_photos !== undefined && settings.min_unknown_photos !== '') ? settings.min_unknown_photos : 1;
      const r = await axios.get(`${API}/people?min_unknown_photos=${minPhotos}&t=${Date.now()}`);
      if (Array.isArray(r.data)) {
        setPeople(r.data);
        setCurrentPerson(prev => {
          if (!prev) return null;
          const updated = r.data.find(p => p.id === prev.id);
          return updated ? { ...prev, ...updated } : prev;
        });
      } else {
        console.warn('API returned non-array:', r.data);
        setPeople([]);
      }
    } catch (err) {
      console.warn('Failed to load people', err);
      setPeople([]);
    }
  }
  
  async function openPersonPhotos(person, forceReload = false) {
    try {
      loadPersonConnections(person.id);
      const cached = personGalleryCache.current.get(person.id);
      if (!forceReload && cached && Array.isArray(cached.files) && cached.files.length > 0) {
        setPersonFiles(cached.files);
        setCurrentPerson(person);
        setOffset(cached.offset || cached.files.length);
        setStartOffset(cached.startOffset || 0);
        setHasMore(cached.hasMore !== undefined ? cached.hasMore : false);
        setPage('person_files');
        setSimilarUnknowns(null);
        setSimilarUnknownsPage(1);
        setShowSimilarPanel(false);
        setIsTaggingPerson(false);
        setSelected(null);
        setCheckedFiles(new Set());
        if (cached.scrollTop) {
          setTimeout(() => {
            const contentEl = document.querySelector('.content');
            if (contentEl) {
              contentEl.scrollTo({ top: cached.scrollTop, behavior: 'auto' });
            }
          }, 40);
        }
        return;
      }

      const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
      const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
      const r = await axios.get(`${API}/people/${person.id}/photos?offset=0&limit=${limit}`);
      setPersonFiles(r.data);
      setCurrentPerson(person);
      setOffset(r.data.length);
      setStartOffset(0);
      setHasMore(r.data.length === limit);
      personGalleryCache.current.set(person.id, {
        files: r.data,
        offset: r.data.length,
        startOffset: 0,
        hasMore: r.data.length === limit,
        scrollTop: 0
      });
      setPage('person_files');
      setSimilarUnknowns(null);
      setSimilarUnknownsPage(1);
      setShowSimilarPanel(false);
      setIsTaggingPerson(false);
      setSelected(null);
      setCheckedFiles(new Set());
    } catch (err) {
      console.warn('Failed to load person photos', err);
    }
  }
  
  async function findSimilarUnknowns(personId, threshold = similarityThreshold) {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before searching for similarities.");
      return;
    }
    if (findSimilarAbortController.current) {
      findSimilarAbortController.current.abort();
    }
    const abortCtrl = new AbortController();
    findSimilarAbortController.current = abortCtrl;
    setIsFindingSimilar(true);
    setActionInProgress(true);
    window.wabs_action_in_progress = true;
    let wasCancelled = false;
    try {
      const r = await axios.get(`${API}/people/${personId}/similar-unknowns?threshold=${threshold}`, {
        signal: abortCtrl.signal
      });
      setSimilarUnknowns(r.data);
      setCheckedSimilar(new Set());
      setSimilarUnknownsPage(1);
      setIsFindingSimilar(false);
    } catch(err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
      } else {
        alert('Error finding similar unknowns: ' + (err?.response?.data?.detail || err.message));
        setSimilarUnknowns(null);
        setIsFindingSimilar(false);
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
      }
    }
  }
  
  function stopFindSimilarUnknowns() {
    cancelAiAction();
  }
  
  const updatePersonNameLocal = (id, newName) => setPeople(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  const savePersonName = async (id, newName) => { 
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      loadPeople();
      return;
    }
    setActionInProgress(true);
    try { await axios.post(`${API}/people/${id}/rename`, { name: newName }); loadPeople(); } catch (err) { alert('Error renaming person: ' + (err?.response?.data?.detail || err.message)); loadPeople(); } finally { setActionInProgress(false); }
  };
  
  const deletePerson = async (e, id, name) => { 
    e.stopPropagation(); 
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    if (name && !name.startsWith('Unknown Person')) {
      if (window.confirm(`Remove name "${name}"? This will move them back to the Unknown People list.`)) { 
        setActionInProgress(true);
        try { 
          await axios.post(`${API}/people/${id}/rename`, { name: `Unknown Person #${id}` }); 
          loadPeople(); 
        } catch(err) { alert(err?.response?.data?.detail || err.message); } finally { setActionInProgress(false); }
      }
    } else {
      if (window.confirm(`Delete "${name}" and ignore their faces?`)) { 
        setActionInProgress(true);
        try { 
          await axios.delete(`${API}/people/${id}`); 
          loadPeople(); 
        } catch(err) { alert(err?.response?.data?.detail || err.message); } finally { setActionInProgress(false); }
      } 
    }
  };
  
  // Triggers asynchronous cancellation on the backend and polls status until completely idle.
  async function cancelAiAction() {
    if (aiActionAbortController.current) {
      aiActionAbortController.current.abort();
      aiActionAbortController.current = null;
    }
    if (findSimilarAbortController.current) {
      findSimilarAbortController.current.abort();
      findSimilarAbortController.current = null;
    }
    setIsFindingSimilar(false);
    setIndexer(prev => ({
      ...prev,
      cancel_data_operation: true,
      data_operation_running: true
    }));
    try {
      await axios.post(`${API}/system/cancel-data-operation`);
    } catch (err) {
      console.warn("Failed to post cancel-data-operation", err);
    }
    const pollInterval = 100;
    const maxPollTime = 5000;
    const maxIterations = maxPollTime / pollInterval;
    for (let i = 0; i < maxIterations; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      try {
        const r = await axios.get(`${API}/indexer/status?t=${Date.now()}`);
        const status = r.data;
        if (status && !status.data_operation_running) {
          break;
        }
      } catch (err) {
        console.warn("Error polling indexer status during cancellation", err);
      }
    }
    window.wabs_action_in_progress = false;
    setActionInProgress(false);
    setDataOpProgress(null);
    setIndexer(prev => ({
      ...prev,
      cancel_data_operation: false,
      data_operation_running: false
    }));
  }
  
  async function clusterSelectedUnknowns() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles.");
      return;
    }
    window.wabs_action_in_progress = true;
    const unknownIds = Array.from(checkedPeople).filter(id => {
      const p = globalPeopleMap.get(id);
      return p && (p.name || '').startsWith('Unknown Person');
    });
    
    if (unknownIds.length === 0) {
      alert("Please select at least one Unknown Person to cluster.");
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (!window.confirm(`Are you sure you want to compare ${unknownIds.length} unknown profile(s) against ALL other unknown profiles? Matches above ${Math.round(similarityThreshold * 100)}% will be clustered together.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (aiActionAbortController.current) aiActionAbortController.current.abort();
    const abortCtrl = new AbortController();
    aiActionAbortController.current = abortCtrl;
    
    setActionInProgress(true);
    setDataOpProgress({ id: 'clusterSelected', current: 0, total: unknownIds.length });
    let wasCancelled = false;
    try {
      showToastMessage(`Clustering ${unknownIds.length} unknown profile(s)...`);
      let totalMerged = 0;
      const chunkSize = 250;
      for (let i = 0; i < unknownIds.length; i += chunkSize) {
        if (abortCtrl.signal.aborted) {
          throw new axios.Cancel('Clustering cancelled by user.');
        }
        setDataOpProgress({ id: 'clusterSelected', current: i, total: unknownIds.length });
        const chunk = unknownIds.slice(i, i + chunkSize);
        const r = await axios.post(`${API}/people/cluster-unknowns`, 
          { person_ids: chunk, threshold: similarityThreshold },
          { signal: abortCtrl.signal }
        );
        totalMerged += r.data.merged_count;
      }
      if (abortCtrl.signal.aborted) {
        throw new axios.Cancel('Clustering cancelled by user.');
      }
      setDataOpProgress({ id: 'clusterSelected', current: unknownIds.length, total: unknownIds.length });
      showToastMessage(`Successfully clustered ${totalMerged} profile(s).`);
      setCheckedPeople(new Set());
      loadPeople();
    } catch (err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Clustering cancelled by user.');
        setCheckedPeople(new Set());
        loadPeople();
      } else {
        alert('Error clustering people: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }
  
  // Groups all unknown profiles by similarity, sending requests in safe 250-profile batches to avoid timeouts.
  async function clusterAllUnknowns() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles.");
      return;
    }
    window.wabs_action_in_progress = true;
    const allUnknownIds = filteredUnknownPeople.map(p => p.id);
    
    if (allUnknownIds.length === 0) {
      alert("No Unknown Persons found.");
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (!window.confirm(`Are you sure you want to compare ALL ${allUnknownIds.length} unknown profile(s) against each other? This may take several moments. Matches above ${Math.round(similarityThreshold * 100)}% will be clustered together.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (aiActionAbortController.current) aiActionAbortController.current.abort();
    const abortCtrl = new AbortController();
    aiActionAbortController.current = abortCtrl;
    
    setActionInProgress(true);
    setDataOpProgress({ id: 'clusterAll', current: 0, total: allUnknownIds.length });
    let wasCancelled = false;
    try {
      showToastMessage(`Clustering ${allUnknownIds.length} unknown profile(s)...`);
      let totalMerged = 0;
      const chunkSize = 250;
      for (let i = 0; i < allUnknownIds.length; i += chunkSize) {
        if (abortCtrl.signal.aborted) {
          throw new axios.Cancel('Clustering cancelled by user.');
        }
        setDataOpProgress({ id: 'clusterAll', current: i, total: allUnknownIds.length });
        const chunk = allUnknownIds.slice(i, i + chunkSize);
        const r = await axios.post(`${API}/people/cluster-unknowns`, 
          { person_ids: chunk, threshold: similarityThreshold },
          { signal: abortCtrl.signal }
        );
        totalMerged += r.data.merged_count;
      }
      if (abortCtrl.signal.aborted) {
        throw new axios.Cancel('Clustering cancelled by user.');
      }
      setDataOpProgress({ id: 'clusterAll', current: allUnknownIds.length, total: allUnknownIds.length });
      showToastMessage(`Successfully clustered ${totalMerged} profile(s).`);
      setCheckedPeople(new Set());
      loadPeople();
    } catch (err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Clustering cancelled by user.');
        setCheckedPeople(new Set());
        loadPeople();
      } else {
        alert('Error clustering people: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }
  
  async function reclassifySelectedUnknowns() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles.");
      return;
    }
    window.wabs_action_in_progress = true;
    const unknownIds = Array.from(checkedPeople).filter(id => {
      const p = globalPeopleMap.get(id);
      return p && (p.name || '').startsWith('Unknown Person');
    });
    
    if (unknownIds.length === 0) {
      alert("Please select at least one Unknown Person to reclassify.");
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (!window.confirm(`Are you sure you want to re-evaluate ${unknownIds.length} unknown profile(s)? This will break them apart and re-cluster their faces using your current Similarity Threshold (${Math.round(similarityThreshold * 100)}%).`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (aiActionAbortController.current) aiActionAbortController.current.abort();
    const abortCtrl = new AbortController();
    aiActionAbortController.current = abortCtrl;
    
    setActionInProgress(true);
    setDataOpProgress({ id: 'reclassifySelected', current: 0, total: unknownIds.length });
    let wasCancelled = false;
    try {
      showToastMessage(`Reclassifying ${unknownIds.length} unknown profile(s)...`);
      let totalReclassified = 0;
      const chunkSize = 250;
      for (let i = 0; i < unknownIds.length; i += chunkSize) {
        if (abortCtrl.signal.aborted) {
          throw new axios.Cancel('Reclassification cancelled by user.');
        }
        setDataOpProgress({ id: 'reclassifySelected', current: i, total: unknownIds.length });
        const chunk = unknownIds.slice(i, i + chunkSize);
        const r = await axios.post(`${API}/people/reclassify`, 
          { person_ids: chunk, threshold: similarityThreshold },
          { signal: abortCtrl.signal }
        );
        totalReclassified += r.data.reclassified_count;
      }
      if (abortCtrl.signal.aborted) {
        throw new axios.Cancel('Reclassification cancelled by user.');
      }
      setDataOpProgress({ id: 'reclassifySelected', current: unknownIds.length, total: unknownIds.length });
      showToastMessage(`Successfully reclassified faces.`);
      setCheckedPeople(new Set());
      loadPeople();
    } catch (err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Reclassification cancelled by user.');
        setCheckedPeople(new Set());
        loadPeople();
      } else {
        alert('Error reclassifying people: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }
  
  // Deconstructs and re-evaluates all unknown profiles against all other profiles in 250-profile chunks.
  async function reclassifyAllUnknowns() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles.");
      return;
    }
    window.wabs_action_in_progress = true;
    const allUnknownIds = filteredUnknownPeople.map(p => p.id);
    
    if (allUnknownIds.length === 0) {
      alert("No Unknown Persons found.");
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (!window.confirm(`Are you sure you want to re-evaluate ALL ${allUnknownIds.length} unknown profile(s)? This will break them apart and re-cluster all their faces using your current Similarity Threshold (${Math.round(similarityThreshold * 100)}%). This may take a few moments.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (aiActionAbortController.current) aiActionAbortController.current.abort();
    const abortCtrl = new AbortController();
    aiActionAbortController.current = abortCtrl;
    
    setActionInProgress(true);
    setDataOpProgress({ id: 'reclassifyAll', current: 0, total: allUnknownIds.length });
    let wasCancelled = false;
    try {
      showToastMessage(`Reclassifying ${allUnknownIds.length} unknown profile(s)...`);
      let totalReclassified = 0;
      const chunkSize = 250;
      for (let i = 0; i < allUnknownIds.length; i += chunkSize) {
        if (abortCtrl.signal.aborted) {
          throw new axios.Cancel('Reclassification cancelled by user.');
        }
        setDataOpProgress({ id: 'reclassifyAll', current: i, total: allUnknownIds.length });
        const chunk = allUnknownIds.slice(i, i + chunkSize);
        const r = await axios.post(`${API}/people/reclassify`, 
          { person_ids: chunk, threshold: similarityThreshold },
          { signal: abortCtrl.signal }
        );
        totalReclassified += r.data.reclassified_count;
      }
      if (abortCtrl.signal.aborted) {
        throw new axios.Cancel('Reclassification cancelled by user.');
      }
      setDataOpProgress({ id: 'reclassifyAll', current: allUnknownIds.length, total: allUnknownIds.length });
      showToastMessage(`Successfully reclassified faces.`);
      setCheckedPeople(new Set());
      loadPeople();
    } catch (err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Reclassification cancelled by user.');
        setCheckedPeople(new Set());
        loadPeople();
      } else {
        alert('Error reclassifying people: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }
  
  async function executeMerge(primaryId) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    const ids = [primaryId, ...Array.from(checkedPeople).filter(id => id !== primaryId)];
    setActionInProgress(true);
    try {
      await axios.post(`${API}/people/merge`, { person_ids: ids });
      showToastMessage('People merged successfully.');
      setCheckedPeople(new Set());
      setMergeConflictData(null);
      loadPeople();
    } catch (err) {
      alert('Error merging people: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  function mergeSelectedPeople() {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before merging profiles to prevent database conflicts.");
      return;
    }
  
    const selectedProfiles = Array.from(checkedPeople).map(id => globalPeopleMap.get(id)).filter(Boolean);
    const validNames = Array.from(new Set(selectedProfiles
      .map(p => p.name)
      .filter(name => name && !name.startsWith('Unknown Person'))
    ));
  
    let primaryId = selectedProfiles[0].id;
  
    if (validNames.length > 1) {
      setMergeConflictData({ profiles: selectedProfiles, validNames });
      return;
    } else if (!window.confirm(`Are you sure you want to merge these ${checkedPeople.size} people into one?`)) {
      return;
    }
  
    executeMerge(primaryId);
  }
  
  async function setPersonThumbnail(personId, fileId) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    setActionInProgress(true);
    try {
      await axios.post(`${API}/people/${personId}/set-thumbnail`, { file_id: fileId });
      showToastMessage('Cover photo updated successfully.');
      setCheckedFiles(new Set());
      setThumbUpdateTimestamps(prev => ({ ...prev, [personId]: Date.now() }));
      loadPeople();
    } catch(err) {
      alert('Error setting thumbnail: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  async function autoSuggestThumbnail(personId) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles.");
      return;
    }
    setActionInProgress(true);
    try {
      showToastMessage('Analyzing photos for best cover...');
      const res = await axios.post(`${API}/people/${personId}/suggest-thumbnail`);
      if (res.data && res.data.success) {
        showToastMessage('Cover photo automatically updated!');
        setThumbUpdateTimestamps(prev => ({ ...prev, [personId]: Date.now() }));
        loadPeople();
        if (selected && selected.is_person && selected.id === personId) {
           setSelected(prev => ({...prev, thumbnail: `/people/${personId}/thumbnail?v=${res.data.new_thumbnail_id}`}));
        }
      }
    } catch(err) {
      alert('Error suggesting thumbnail: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  async function removePersonPhotosBulk(personId, fileIds) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    if (!window.confirm(`Are you sure you want to un-tag ${fileIds.length} photo(s) from this person?`)) return;
    
    setActionInProgress(true);
    try {
      for (const fileId of fileIds) {
        await axios.post(`${API}/people/${personId}/remove-photo`, { file_id: fileId });
      }
      
      const undoAction = {
        label: 'Undo',
        onClick: async () => {
          setActionInProgress(true);
          try {
            for (const id of fileIds) {
              await axios.post(`${API}/people/${personId}/add-photo`, { file_id: id });
            }
            showToastMessage('Removal undone successfully.');
            if (invalidateViewCache) invalidateViewCache();
            if (loadVirtualFolders) await loadVirtualFolders();
            loadPeople();
            openPersonPhotos(currentPerson);
          } catch (e) {
            alert('Error undoing removal: ' + (e?.response?.data?.detail || e.message));
          } finally {
            setActionInProgress(false);
          }
        }
      };
      
      if (invalidateViewCache) invalidateViewCache();
      if (loadVirtualFolders) await loadVirtualFolders();
      showToastMessage(`Removed ${fileIds.length} photo(s).`, undoAction);
      setPersonFiles(prev => prev.filter(f => !fileIds.includes(f.id)));
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error removing photo(s): ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  async function assignPhotosToPerson(personId, filePaths) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    if (!personId) return;
    const fileIds = filePaths.map(p => globalFileCache.current.get(p)?.id).filter(id => id);
    
    setActionInProgress(true);
    try {
      for (const id of fileIds) {
        await axios.post(`${API}/people/${personId}/add-photo`, { file_id: id });
      }
      
      const undoAction = {
        label: 'Undo',
        onClick: async () => {
          setActionInProgress(true);
          try {
            for (const id of fileIds) {
              await axios.post(`${API}/people/${personId}/remove-photo`, { file_id: id });
            }
            showToastMessage('Tagging undone successfully.');
            if (invalidateViewCache) invalidateViewCache();
            if (loadVirtualFolders) await loadVirtualFolders();
            loadPeople();
            if (page === 'explorer' || page === 'virtual_folder') {
              await loadFiles(0, false, filterCategory);
            } else if (page === 'search') {
              await goToSearch(filterCategory);
            }
            if ((page === 'explorer' || page === 'virtual_folder') && selected && filePaths.includes(selected.path)) {
              const updatedFile = globalFileCache.current.get(selected.path);
              setSelected(updatedFile || null);
            }
          } catch (e) {
            alert('Error undoing tag: ' + (e?.response?.data?.detail || e.message));
          } finally {
            setActionInProgress(false);
          }
        }
      };
      
      if (invalidateViewCache) invalidateViewCache();
      if (loadVirtualFolders) await loadVirtualFolders();
      showToastMessage(`Successfully tagged ${fileIds.length} photo(s).`, undoAction);
      setIsTaggingPerson(false);
      setCheckedFiles(new Set());
      if (page === 'explorer' || page === 'virtual_folder') {
        await loadFiles(0, false, filterCategory);
      } else if (page === 'search') {
        await goToSearch(filterCategory);
      }
      if ((page === 'explorer' || page === 'virtual_folder') && selected && filePaths.includes(selected.path)) {
        const updatedFile = globalFileCache.current.get(selected.path);
        setSelected(updatedFile || null);
      }
    } catch(err) {
      alert('Error tagging photo(s): ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  async function movePhotosToPerson(targetPersonId, filePaths) {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying profiles to prevent database conflicts.");
      return;
    }
    if (!targetPersonId) return;
    const fileIds = filePaths.map(p => globalFileCache.current.get(p)?.id).filter(id => id);
    if (fileIds.length === 0) return;
    
    setActionInProgress(true);
    const sourcePersonId = currentPerson?.id;
    try {
      for (const id of fileIds) {
        await axios.post(`${API}/people/${targetPersonId}/add-photo`, { file_id: id });
        await axios.post(`${API}/people/${currentPerson?.id}/remove-photo`, { file_id: id });
      }
      
      const undoAction = {
        label: 'Undo',
        onClick: async () => {
          setActionInProgress(true);
          try {
            for (const id of fileIds) {
              await axios.post(`${API}/people/${sourcePersonId}/add-photo`, { file_id: id });
              await axios.post(`${API}/people/${targetPersonId}/remove-photo`, { file_id: id });
            }
            showToastMessage('Move undone successfully.');
            if (invalidateViewCache) invalidateViewCache();
            if (loadVirtualFolders) await loadVirtualFolders();
            loadPeople();
            if (currentPerson && currentPerson.id === sourcePersonId) {
               openPersonPhotos(currentPerson);
            }
          } catch (e) {
            alert('Error undoing move: ' + (e?.response?.data?.detail || e.message));
          } finally {
            setActionInProgress(false);
          }
        }
      };
      
      if (invalidateViewCache) invalidateViewCache();
      if (loadVirtualFolders) await loadVirtualFolders();
      showToastMessage(`Successfully moved ${fileIds.length} photo(s).`, undoAction);
      setIsTaggingPerson(false);
      setCheckedFiles(new Set());
      setPersonFiles(prev => prev.filter(f => !fileIds.includes(f.id)));
      loadPeople();
    } catch(err) {
      alert('Error moving photo(s): ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }
  
  // Deletes low-quality Unknown profiles containing fewer than the configured photo threshold.
  async function purgeSmallUnknowns() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks (Indexing, Face/Object Scanning, Text Extraction, Hash Verification) before running the purge routine.");
      return;
    }
    window.wabs_action_in_progress = true;
    const thresholdToUse = purgeThreshold === '' ? 3 : purgeThreshold;
    if (!window.confirm(`Are you sure you want to permanently delete all Unknown Person profiles that have fewer than ${thresholdToUse} photos? This will also trigger a database cleanup and cannot be undone.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    
    if (aiActionAbortController.current) aiActionAbortController.current.abort();
    const abortCtrl = new AbortController();
    aiActionAbortController.current = abortCtrl;
    
    setActionInProgress(true);
    setDataOpProgress({ id: 'purge' });
    let wasCancelled = false;
    try {
      showToastMessage(`Purging unknown profiles with < ${thresholdToUse} photos...`);
      const r = await axios.post(`${API}/system/purge-unknowns`, { threshold: thresholdToUse }, { signal: abortCtrl.signal });
      showToastMessage(`Purged ${r.data.purged_profiles} small unknown profiles successfully.`);
      await loadDashboard();
      if (page === 'people') await loadPeople();
    } catch (err) {
      if (axios.isCancel(err) || err?.response?.data?.detail === 'Operation cancelled' || abortCtrl.signal.aborted) {
        wasCancelled = true;
        showToastMessage('Purge cancelled by user.');
        await loadDashboard();
        if (page === 'people') await loadPeople();
      } else {
        alert('Error purging profiles: ' + (err?.response?.data?.detail || err.message));
      }
    } finally {
      if (!wasCancelled) {
        window.wabs_action_in_progress = false;
        setActionInProgress(false);
        setDataOpProgress(null);
      }
    }
  }
  
  // Exports face database, serializing embeddings as compact Base64. Uses native Blob downloads to prevent browser freezing.
  async function exportKnownPeople() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before exporting known people to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    setActionInProgress(true);
    setDataOpProgress({ id: 'people', action: 'export', current: 0, total: 0 });
    showToastMessage('Exporting known people...');
    try {
      const r = await axios.get(`${API}/system/export-people`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `wabs_known_people_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
      URL.revokeObjectURL(url);
      showToastMessage('Known people exported successfully.');
    } catch(err) {
      alert('Error exporting people: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setDataOpProgress(null);
      setActionInProgress(false);
    }
  }
  
  function importKnownPeople() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before importing known people to prevent database conflicts.");
      return;
    }
    if (people && people.length > 0) {
      if (!window.confirm("You already have people in your database. Importing again might create duplicated profiles. Do you wish to continue?")) return;
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
          setDataOpProgress({ id: 'people', action: 'import', current: 0, total: payload.length });
          abortDataOpRef.current = false;
          let importedPeople = 0;
          let importedFaces = 0;
          const chunkSize = 50;
          for (let i = 0; i < payload.length; i += chunkSize) {
            if (abortDataOpRef.current) {
              showToastMessage('Import cancelled by user.');
              break;
            }
            setDataOpProgress({ id: 'people', action: 'import', current: i, total: payload.length });
            showToastMessage(`Importing people... ${Math.round((i / payload.length) * 100)}%`);
            const chunk = payload.slice(i, i + chunkSize);
            const r = await axios.post(`${API}/system/import-people`, chunk);
            importedPeople += r.data.imported_people;
            importedFaces += r.data.imported_faces;
          }
          if (!abortDataOpRef.current) {
            showToastMessage(`Imported ${importedPeople} people and ${importedFaces} faces.`);
          }
          loadPeople();
        } catch (err) {
          alert('Error importing people: ' + (err?.response?.data?.detail || err.message));
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

  async function setMeIdentity(name) {
    try {
      await axios.patch(`${API}/people/set-me`, { name: name || '' });
      showToastMessage(name ? `Identity set to "${name}".` : 'Identity cleared.');
      loadPeople();
    } catch (err) {
      alert('Error setting user identity: ' + (err?.response?.data?.detail || err.message));
    }
  }

  async function exportRelationships() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before exporting relationships to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    setActionInProgress(true);
    showToastMessage('Exporting relationships...');
    try {
      const r = await axios.get(`${API}/system/export-relationships`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `wabs_relationships_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
      URL.revokeObjectURL(url);
      showToastMessage('Relationships exported successfully.');
    } catch(err) {
      alert('Error exporting relationships: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  function importRelationships() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before importing relationships to prevent database conflicts.");
      return;
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
        setActionInProgress(true);
        showToastMessage('Importing relationships...');
        try {
          const payload = JSON.parse(event.target.result);
          const r = await axios.post(`${API}/system/import-relationships`, payload);
          showToastMessage(`Imported ${r.data.imported_persons || 0} person profiles and ${r.data.imported_social || 0} relationship records.`);
          loadPeople();
        } catch (err) {
          alert('Error importing relationships: ' + (err?.response?.data?.detail || err.message));
        } finally {
          window.wabs_action_in_progress = false;
          setActionInProgress(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const getPersonThumbUrl = (p) => {
    if (!p.thumbnail) return '';
    let url = p.thumbnail.startsWith('http') ? p.thumbnail : `${API}${p.thumbnail}`;
    const currentTheme = settings?.theme || 'dark';
    url += (url.includes('?') ? '&' : '?') + `theme=${currentTheme}`;
    if (thumbUpdateTimestamps[p.id]) {
      url += `&cb=${thumbUpdateTimestamps[p.id]}`;
    }
    return url;
  };

  const sortedSimilarUnknowns = useMemo(() => {
    if (!similarUnknowns) return null;
    
    const currentExactPaths = new Set();
    const currentPaths = new Set();
    const currentDates = new Set();
    personFiles.forEach(f => {
      if (f.path) {
        currentExactPaths.add(f.path.toLowerCase());
        const dir = f.path.substring(0, Math.max(f.path.lastIndexOf('/'), f.path.lastIndexOf('\\')));
        if (dir) currentPaths.add(dir.toLowerCase());
      }
      const d = parseFileDate(f);
      if (d) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        currentDates.add(`${d.getFullYear()}-${month}-${day}`);
      }
    });
  
    const enriched = similarUnknowns.map(p => {
      let overlap = 0;
      let inSamePhoto = false;
  
      if (p.sample_paths) {
        const pPaths = String(p.sample_paths).split('|');
        if (pPaths.some(path => currentExactPaths.has(path.toLowerCase()))) {
          inSamePhoto = true;
        }
        if (pPaths.some(path => { const dir = path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))); return dir && currentPaths.has(dir.toLowerCase()); })) {
          overlap += 2;
        }
      }
      if (p.sample_dates) {
        const pDates = String(p.sample_dates).split('|');
        if (pDates.some(d => {
          const parsed = new Date(d.replace(' ', 'T'));
          if (isNaN(parsed)) return false;
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const day = String(parsed.getDate()).padStart(2, '0');
          return currentDates.has(`${parsed.getFullYear()}-${month}-${day}`);
        })) overlap += 1;
      }
      if (inSamePhoto) overlap = -1;
      return { ...p, context_score: overlap, inSamePhoto };
    });
  
    return enriched.sort((a, b) => {
      const simA = Math.round((a.similarity || 0) * 100);
      const simB = Math.round((b.similarity || 0) * 100);
      if (simB !== simA) return simB - simA;
      if (a.inSamePhoto && !b.inSamePhoto) return 1;
      if (!a.inSamePhoto && b.inSamePhoto) return -1;
      if ((b.face_count || 0) !== (a.face_count || 0)) return (b.face_count || 0) - (a.face_count || 0);
      return (b.context_score || 0) - (a.context_score || 0);
    });
  }, [similarUnknowns, personFiles]);

  const visibleSimilar = useMemo(() => {
    if (!sortedSimilarUnknowns) return [];
    const hidden = new Set(settings.hidden_people || []);
    return sortedSimilarUnknowns.filter(p => !hidden.has(p.id) && !(p.name && hidden.has(p.name)));
  }, [sortedSimilarUnknowns, settings.hidden_people]);

  const [showRelationshipTree, setShowRelationshipTree] = useState(false);

  const activeCategoryFilter = settings?.people_category_filter || 'all';

  const namedPeopleBase = useMemo(() => {
    if (!Array.isArray(people)) return [];
    const hidden = new Set(settings.hidden_people || []);
    return people.filter(p => !(p.name || '').startsWith('Unknown Person') && !hidden.has(p.id) && !(p.name && hidden.has(p.name)));
  }, [people, settings.hidden_people]);

  const mePerson = useMemo(() => {
    if (!Array.isArray(people)) return null;
    const meName = (settings?.me_name || '').trim().toLowerCase();
    if (!meName) return people.find(p => p.is_me) || null;
    return people.find(p => (p.name || '').toLowerCase() === meName) || people.find(p => p.is_me) || null;
  }, [people, settings?.me_name]);

  const categoryCounts = useMemo(() => {
    const counts = {
      all: namedPeopleBase.length,
      Family: 0,
      Friends: 0,
      Others: 0,
      uncategorized: 0
    };
    namedPeopleBase.forEach(p => {
      if (p.category === 'Family') counts.Family++;
      else if (p.category === 'Friends') counts.Friends++;
      else if (p.category === 'Others') counts.Others++;
      else counts.uncategorized++;
    });
    return counts;
  }, [namedPeopleBase]);

  const categoryFilteredPeople = useMemo(() => {
    if (activeCategoryFilter === 'all') return namedPeopleBase;
    if (activeCategoryFilter === 'uncategorized') return namedPeopleBase.filter(p => !p.category);
    return namedPeopleBase.filter(p => p.category === activeCategoryFilter);
  }, [namedPeopleBase, activeCategoryFilter]);

  const filteredNamedPeople = useMemo(() => {
    const q = namedPersonSearchQuery.trim().toLowerCase();
    if (!q) return categoryFilteredPeople;
    return categoryFilteredPeople.filter(p => 
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.subcategory || '').toLowerCase().includes(q) ||
      (p.relation_label || '').toLowerCase().includes(q)
    );
  }, [categoryFilteredPeople, namedPersonSearchQuery]);

  // Structured Relationship Tree Data
  const relationshipTreeData = useMemo(() => {
    const meName = settings?.me_name || mePerson?.name || 'Me';
    
    // Group people by category and subcategory
    const familySubgroups = {
      spouse: { id: 'sub_spouse', name: 'Spouse / Partner', icon: 'favorite', color: '#ec4899', children: [] },
      parents: { id: 'sub_parents', name: 'Parents', icon: 'parent', color: '#38bdf8', children: [] },
      siblings: { id: 'sub_siblings', name: 'Siblings (Brothers & Sisters)', icon: 'sibling', color: '#6366f1', children: [] },
      kids: { id: 'sub_children', name: 'Children (Sons & Daughters)', icon: 'child', color: '#f59e0b', children: [] },
      grandparents: { id: 'sub_grandparents', name: 'Grandparents', icon: 'parent', color: '#06b6d4', children: [] },
      extended: {
        id: 'sub_extended',
        name: 'Extended Family & Relatives',
        icon: 'extended',
        color: '#8b5cf6',
        children: []
      }
    };

    const extendedSubgroups = {
      inlaws: { id: 'sub_inlaws', name: 'In-laws', icon: 'extended', color: '#f472b6', children: [] },
      auntuncle: { id: 'sub_auntuncle', name: 'Aunts & Uncles (Parents\' Siblings)', icon: 'extended', color: '#818cf8', children: [] },
      greatauntuncle: { id: 'sub_greatauntuncle', name: 'Great-Aunts & Uncles (Grandparents\' Siblings)', icon: 'extended', color: '#a5b4fc', children: [] },
      cousins1: { id: 'sub_cousins1', name: '1st Cousins (Parents\' Siblings\' Children)', icon: 'extended', color: '#a78bfa', children: [] },
      cousins1r: { id: 'sub_cousins1r', name: 'Cousins Once Removed (Parents\' / Grandparents\' Cousins)', icon: 'extended', color: '#c4b5fd', children: [] },
      cousins2: { id: 'sub_cousins2', name: '2nd / Distant Cousins', icon: 'extended', color: '#c084fc', children: [] },
      niecenephew: { id: 'sub_niecenephew', name: 'Nieces & Nephews (Siblings\' Children)', icon: 'extended', color: '#60a5fa', children: [] },
      otherfam: { id: 'sub_otherfam', name: 'Other Family & Ancestors', icon: 'home', color: '#94a3b8', children: [] }
    };

    const friendsSubgroups = {
      close: { id: 'sub_close', name: 'Close Friends', icon: 'star', color: '#10b981', children: [] },
      colleagues: { id: 'sub_colleagues', name: 'Colleagues & Work', icon: 'work', color: '#f59e0b', children: [] },
      classmates: { id: 'sub_classmates', name: 'Classmates / School', icon: 'school', color: '#06b6d4', children: [] },
      acquaintances: { id: 'sub_acquaintances', name: 'Acquaintances', icon: 'handshake', color: '#64748b', children: [] },
      otherfriends: { id: 'sub_otherfriends', name: 'Other Friends', icon: 'group', color: '#22c55e', children: [] }
    };

    const othersSubgroups = {
      neighbor: { id: 'sub_neighbor', name: 'Neighbors', icon: 'category', color: '#94a3b8', children: [] },
      service: { id: 'sub_service', name: 'Service & Professional Contacts', icon: 'work', color: '#a855f7', children: [] },
      other: { id: 'sub_other', name: 'Other Contacts', icon: 'category', color: '#64748b', children: [] }
    };

    const connectionsMap = new Map();
    (allConnections || []).forEach(c => {
      const key = (c.person_name || '').toLowerCase();
      if (!connectionsMap.has(key)) connectionsMap.set(key, []);
      connectionsMap.get(key).push(c);
      if (c.person_ai_id) {
        const idKey = `id_${c.person_ai_id}`;
        if (!connectionsMap.has(idKey)) connectionsMap.set(idKey, []);
        connectionsMap.get(idKey).push(c);
      }
    });

    (namedPeopleBase || []).forEach(p => {
      if (!p) return;
      const isMeFlag = (p.is_me || (p.name && (settings?.me_name || '').toLowerCase() === p.name.toLowerCase()));
      if (isMeFlag) return; // Don't place Me inside subbranches

      const personConns = connectionsMap.get(`id_${p.id}`) || connectionsMap.get((p.name || '').toLowerCase()) || [];

      const node = {
        ...p,
        nodeId: `person_${p.id}`,
        id: p.id,
        name: p.name || 'Unknown',
        label: p.relation_label || p.subcategory || '',
        count: p.face_count || 0,
        isPerson: true,
        thumbnail: p.thumbnail,
        category: p.category,
        subcategory: p.subcategory,
        connections: personConns
      };

      const cat = p.category;
      const sub = (p.subcategory || '').toLowerCase();

      if (cat === 'Family') {
        if (sub.includes('spouse') || sub.includes('partner') || sub.includes('wife') || sub.includes('husband')) {
          familySubgroups.spouse.children.push(node);
        } else if (sub.includes('parent') && !sub.includes('grand')) {
          familySubgroups.parents.children.push(node);
        } else if (sub.includes('grandparent') || sub.includes('ancestor')) {
          familySubgroups.grandparents.children.push(node);
        } else if (sub.includes('grandchild') || sub.includes('grandson') || sub.includes('granddaughter')) {
          extendedSubgroups.otherfam.children.push(node);
        } else if (sub.includes('child') || sub.includes('son') || sub.includes('daughter')) {
          familySubgroups.kids.children.push(node);
        } else if (sub.includes('in-law') || sub.includes('in law') || sub.includes('inlaw') || sub.includes("spouse's family")) {
          extendedSubgroups.inlaws.children.push(node);
        } else if (sub.includes('great-aunt') || sub.includes('great aunt') || sub.includes('great-uncle') || sub.includes('great uncle')) {
          extendedSubgroups.greatauntuncle.children.push(node);
        } else if (sub.includes('aunt') || sub.includes('uncle')) {
          extendedSubgroups.auntuncle.children.push(node);
        } else if (sub.includes('once removed') || sub.includes('1c1r')) {
          extendedSubgroups.cousins1r.children.push(node);
        } else if (sub.includes('cousin (1st)') || sub.includes('1st')) {
          extendedSubgroups.cousins1.children.push(node);
        } else if (sub.includes('cousin (2nd') || sub.includes('2nd') || sub.includes('distant') || sub.includes('3rd')) {
          extendedSubgroups.cousins2.children.push(node);
        } else if (sub.includes('niece') || sub.includes('nephew')) {
          extendedSubgroups.niecenephew.children.push(node);
        } else {
          extendedSubgroups.otherfam.children.push(node);
        }
      } else if (cat === 'Friends') {
        if (sub.includes('close')) {
          friendsSubgroups.close.children.push(node);
        } else if (sub.includes('colleague') || sub.includes('work') || sub.includes('office')) {
          friendsSubgroups.colleagues.children.push(node);
        } else if (sub.includes('classmate') || sub.includes('school') || sub.includes('college')) {
          friendsSubgroups.classmates.children.push(node);
        } else if (sub.includes('acquaintance')) {
          friendsSubgroups.acquaintances.children.push(node);
        } else {
          friendsSubgroups.otherfriends.children.push(node);
        }
      } else if (cat === 'Others') {
        if (sub.includes('neighbor')) {
          othersSubgroups.neighbor.children.push(node);
        } else if (sub.includes('service') || sub.includes('contact')) {
          othersSubgroups.service.children.push(node);
        } else {
          othersSubgroups.other.children.push(node);
        }
      }
    });

    // Populate Extended Family subgroup
    Object.values(extendedSubgroups).forEach(subg => {
      if (subg.children.length > 0) {
        familySubgroups.extended.children.push(subg);
      }
    });

    const activeFamilyChildren = Object.values(familySubgroups).filter(g => g.children.length > 0);
    const activeFriendsChildren = Object.values(friendsSubgroups).filter(g => g.children.length > 0);
    const activeOthersChildren = Object.values(othersSubgroups).filter(g => g.children.length > 0);

    const categoriesList = [];
    if (activeFamilyChildren.length > 0) {
      categoriesList.push({
        id: 'cat_family',
        name: 'Family',
        icon: 'home',
        color: '#3b82f6',
        children: activeFamilyChildren
      });
    }
    if (activeFriendsChildren.length > 0) {
      categoriesList.push({
        id: 'cat_friends',
        name: 'Friends',
        icon: 'group',
        color: '#22c55e',
        children: activeFriendsChildren
      });
    }
    if (activeOthersChildren.length > 0) {
      categoriesList.push({
        id: 'cat_others',
        name: 'Others',
        icon: 'category',
        color: '#a78bfa',
        children: activeOthersChildren
      });
    }

    return {
      id: 'root_me',
      name: meName,
      icon: 'me',
      color: '#3b82f6',
      isMe: true,
      children: categoriesList
    };
  }, [namedPeopleBase, settings?.me_name, mePerson, allConnections]);

  const savePersonCategory = async (personId, category, subcategory, relationLabel) => {
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before modifying relationships.");
      return;
    }
    // Update local state immediately for instant UI reactivity
    setPeople(prev => (prev || []).map(p => p.id === personId ? {
      ...p,
      category,
      subcategory,
      relation_label: relationLabel
    } : p));
    setCurrentPerson(prev => (prev && prev.id === personId ? {
      ...prev,
      category,
      subcategory,
      relation_label: relationLabel
    } : prev));

    setActionInProgress(true);
    try {
      await axios.patch(`${API}/people/${personId}/category`, {
        category,
        subcategory,
        relation_label: relationLabel
      });
      showToastMessage('Relationship updated successfully.');
      loadPeople();
    } catch (err) {
      alert('Error updating category: ' + (err?.response?.data?.detail || err.message));
      loadPeople();
    } finally {
      setActionInProgress(false);
    }
  };

  const filteredUnknownPeople = useMemo(() => {
    if (!Array.isArray(people)) return [];
    const hidden = new Set(settings.hidden_people || []);
    return people.filter(p => (p.name || '').startsWith('Unknown Person') && !hidden.has(p.id) && !(p.name && hidden.has(p.name)));
  }, [people, settings.hidden_people]);

  const globalPeopleMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(people)) {
      people.forEach(p => map.set(p.id, p));
    }
    return map;
  }, [people]);

  const hasUnknownSelected = useMemo(() => {
    return filteredUnknownPeople.some(p => checkedPeople.has(p.id));
  }, [checkedPeople, filteredUnknownPeople]);

  const sortedNamedPeopleForUI = useMemo(() => {
    const pinned = new Set(settings.pinned_people || []);
    return [...filteredNamedPeople].sort((a, b) => {
      const aPinned = pinned.has(a.id) || (a.name && pinned.has(a.name));
      const bPinned = pinned.has(b.id) || (b.name && pinned.has(b.name));
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (peopleSortBy === 'name') {
          return (a.name || '').localeCompare(b.name || '');
      } else {
          return (b.face_count - a.face_count || (a.name || '').localeCompare(b.name || ''));
      }
    });
  }, [filteredNamedPeople, peopleSortBy, settings.pinned_people]);

  const sortedUnknownPeopleForUI = useMemo(() => {
    return [...filteredUnknownPeople].sort((a, b) => peopleSortBy === 'name' ? (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }) : (b.face_count - a.face_count || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })));
  }, [filteredUnknownPeople, peopleSortBy]);

  const sortedNamedPeopleDropdown = useMemo(() => {
    return [...namedPeopleBase].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [namedPeopleBase]);
  
  const groupedPersonFiles = useMemo(() => {
    const groups = new Map();
    personFiles.forEach(file => {
      let key = 'Unknown Date';
      const d = parseFileDate(file);
      if (d) {
        key = dateFormatter.format(d);
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    });
    return groups;
  }, [personFiles]);

  return {
    people, setPeople, currentPerson, setCurrentPerson, personFiles, setPersonFiles,
    peopleSortBy, setPeopleSortBy, checkedPeople, setCheckedPeople, isTaggingPerson, setIsTaggingPerson,
    personTagInput, setPersonTagInput, editingNames, setEditingNames, unknownPeoplePage, setUnknownPeoplePage,
    namedPeoplePage, setNamedPeoplePage, namedPersonSearchQuery, setNamedPersonSearchQuery,
    similarUnknowns, setSimilarUnknowns, similarUnknownsPage, setSimilarUnknownsPage,
    isFindingSimilar, setIsFindingSimilar, checkedSimilar, setCheckedSimilar,
    similarityThreshold, setSimilarityThreshold, showUnknownsActions, setShowUnknownsActions,
    showSelectedUnknownsActions, setShowSelectedUnknownsActions, purgeThreshold, setPurgeThreshold,
    showSimilarPanel, setShowSimilarPanel, mergeConflictData, setMergeConflictData,
    personPreviewPhotos, setPersonPreviewPhotos,
    loadPeople, openPersonPhotos, findSimilarUnknowns, stopFindSimilarUnknowns,
    updatePersonNameLocal, savePersonName, deletePerson, cancelAiAction, clusterSelectedUnknowns,
    clusterAllUnknowns, reclassifySelectedUnknowns, reclassifyAllUnknowns, executeMerge, mergeSelectedPeople,
    setPersonThumbnail, autoSuggestThumbnail, removePersonPhotosBulk, assignPhotosToPerson, movePhotosToPerson,
    purgeSmallUnknowns, exportKnownPeople, importKnownPeople, getPersonThumbUrl,
    sortedSimilarUnknowns, visibleSimilar, namedPeopleBase, filteredNamedPeople, filteredUnknownPeople,
    globalPeopleMap, hasUnknownSelected, sortedNamedPeopleForUI, sortedUnknownPeopleForUI, sortedNamedPeopleDropdown,
    groupedPersonFiles,
    showRelationshipTree, setShowRelationshipTree,
    activeCategoryFilter, categoryCounts, relationshipTreeData, savePersonCategory, mePerson,
    setMeIdentity, exportRelationships, importRelationships,
    personConnections, setPersonConnections, allConnections, setAllConnections,
    loadPersonConnections, loadAllConnections, addPersonConnection, removePersonConnection, savePersonScroll,
    abortPeopleDataOpRef: abortDataOpRef,
    aiActionAbortController
  };
}