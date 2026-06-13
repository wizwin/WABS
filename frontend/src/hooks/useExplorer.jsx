import { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { API, parseFileDate, dateFormatter } from '../States';

export function useExplorer({
  settings, page, setPage, query, setQuery, showToastMessage, sharedState
}) {
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searchCache, setSearchCache] = useState([]);
  const [offset, setOffset] = useState(0);
  const [startOffset, setStartOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const loadingPreviousRef = useRef(false);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [checkedFiles, setCheckedFiles] = useState(new Set());
  const globalFileCache = useRef(new Map());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const lastCheckedPath = useRef(null);
  const [activeDate, setActiveDate] = useState('');

  const searchTimeout = useRef(null);
  const searchAbortController = useRef(null);
  const loadFilesAbortController = useRef(null);
  const syncDateTimeoutRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(files)) files.forEach(f => globalFileCache.current.set(f.path, f));
  }, [files]);

  useEffect(() => {
    if (Array.isArray(searchCache)) searchCache.forEach(f => globalFileCache.current.set(f.path, f));
  }, [searchCache]);

  useEffect(() => {
    if (checkedFiles.size === 0 && showSelectedOnly) {
      setShowSelectedOnly(false);
    }
  }, [checkedFiles.size, showSelectedOnly]);

  const checkFileReadOnly = (filePath) => {
    if (settings.read_only_mode !== false) return true;
    if (!settings.backup_configs) return false;
    
    const normFile = String(filePath).replace(/\\/g, '/').toLowerCase();
    const config = settings.backup_configs.find(c => {
      return c.backup_path && normFile.startsWith(String(c.backup_path).replace(/\\/g, '/').toLowerCase());
    });
    return config ? config.read_only_mode !== false : false;
  };

  const isSelectionReadOnly = useMemo(() => {
    return Array.from(checkedFiles).some(checkFileReadOnly);
  }, [checkedFiles, settings]);

  async function loadFiles(nextOffset = 0, append = false, cat = filterCategory, sBy = sortBy, sOrd = sortOrder) {
    if (loadFilesAbortController.current) {
      loadFilesAbortController.current.abort();
    }
    loadFilesAbortController.current = new AbortController();
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    try {
      const r = await axios.get(`${API}/files?category=${cat}&offset=${nextOffset}&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`, {
        signal: loadFilesAbortController.current.signal
      });
      if(append){
        setFiles(prev => {
          const existing = new Set(prev.map(f => f.path));
          const additions = r.data.filter(f => !existing.has(f.path));
          return [...prev, ...additions];
        });
      } else {
        setFiles(r.data);
        setStartOffset(nextOffset);
      }
      setOffset(nextOffset + r.data.length);
      setHasMore(r.data.length === limit);
      if(!append){
        setSearchCache([]);
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn('Load files failed', err);
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  function doSearch(value, cat = filterCategory, sBy = sortBy, sOrd = sortOrder) {
    setQuery(value);
  
    if(searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  
    searchTimeout.current = setTimeout(async () => {
      if(!value){
        if (page !== 'search') {
          setPage('explorer');
        }
        setSelected(null);
        setCheckedFiles(new Set());
        await loadFiles(0, false, cat, sBy, sOrd);
        return;
      }
  
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      searchAbortController.current = new AbortController();
  
      const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
      const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
      setLoadingMore(true);
      setSelected(null);
      setCheckedFiles(new Set());
      const safeQuery = value.replace(/,/g, ' ');
      try {
        const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${cat}&offset=0&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`, {
          signal: searchAbortController.current.signal
        });
        setSearchCache(r.data);
        setFiles(r.data);
        setOffset(r.data.length);
        setHasMore(r.data.length === limit);
        setPage('search');
        setLoadingMore(false);
      } catch (err) {
        if (!axios.isCancel(err)) {
          setLoadingMore(false);
          console.warn('Search failed', err);
          setHasMore(false);
        }
      }
    }, 600);
  }

  async function goToSearch(cat = filterCategory, sBy = sortBy, sOrd = sortOrder) {
    setSelected(null);
    setCheckedFiles(new Set());
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    if(query){
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      searchAbortController.current = new AbortController();
  
      setLoadingMore(true);
      const safeQuery = query.replace(/,/g, ' ');
      try {
        const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${cat}&offset=0&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`, {
          signal: searchAbortController.current.signal
        });
        setSearchCache(r.data);
        setFiles(r.data);
        setOffset(r.data.length);
        setStartOffset(0);
        setHasMore(r.data.length === limit);
        setLoadingMore(false);
      } catch (err) {
        if (!axios.isCancel(err)) {
          setLoadingMore(false);
          console.warn('Search failed', err);
          setHasMore(false);
        }
      }
    } else {
      await loadFiles(0, false, cat, sBy, sOrd);
    }
    setPage('search');
  }

  async function loadMore() {
    if(loadingMore || loadingMoreRef.current || !hasMore) return;
  
    setLoadingMore(true);
    loadingMoreRef.current = true;
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    if(page === 'explorer'){
      await loadFiles(offset, true, filterCategory, sortBy, sortOrder);
    } else if(page === 'search'){
      if (searchAbortController.current) searchAbortController.current.abort();
      searchAbortController.current = new AbortController();
  
      const safeQuery = query.replace(/,/g, ' ');
      try {
        const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${filterCategory}&offset=${offset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`, {
          signal: searchAbortController.current.signal
        });
        setFiles(prev => {
          const existing = new Set(prev.map(f => f.path));
          const additions = r.data.filter(f => !existing.has(f.path));
          return [...prev, ...additions];
        });
        setSearchCache(prev => {
          const existing = new Set(prev.map(f => f.path));
          const additions = r.data.filter(f => !existing.has(f.path));
          return [...prev, ...additions];
        });
        setOffset(offset + r.data.length);
        setHasMore(r.data.length === limit);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.warn('Load more search failed', err);
          setHasMore(false);
        }
      }
    } else if(page === 'person_files') {
      const currentPerson = sharedState.current?.people?.currentPerson;
      if (currentPerson) {
        try {
          const r = await axios.get(`${API}/people/${currentPerson.id}/photos?offset=${offset}&limit=${limit}`);
          sharedState.current.people.setPersonFiles(prev => {
            const existing = new Set(prev.map(f => f.path));
            const additions = r.data.filter(f => !existing.has(f.path));
            return [...prev, ...additions];
          });
          setOffset(offset + r.data.length);
          setHasMore(r.data.length === limit);
        } catch (err) {
          console.warn('Load more person photos failed', err);
          setHasMore(false);
        }
      }
    }
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }

  async function loadPrevious() {
    if(loadingPrevious || loadingPreviousRef.current || startOffset <= 0) return;
  
    setLoadingPrevious(true);
    loadingPreviousRef.current = true;
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    const fetchLimit = Math.min(limit, startOffset);
    const nextStartOffset = startOffset - fetchLimit;
  
    try {
      let r;
      if(page === 'explorer'){
        r = await axios.get(`${API}/files?category=${filterCategory}&offset=${nextStartOffset}&limit=${fetchLimit}&sort_by=${sortBy}&sort_order=${sortOrder}`);
      } else if(page === 'search'){
        const safeQuery = query.replace(/,/g, ' ');
        r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${filterCategory}&offset=${nextStartOffset}&limit=${fetchLimit}&sort_by=${sortBy}&sort_order=${sortOrder}`);
      } else if(page === 'person_files') {
        const currentPerson = sharedState.current?.people?.currentPerson;
        if (currentPerson) {
          r = await axios.get(`${API}/people/${currentPerson.id}/photos?offset=${nextStartOffset}&limit=${fetchLimit}`);
        }
      }
  
      if (r && r.data) {
        const contentEl = document.querySelector('.content');
        const oldScrollHeight = contentEl ? contentEl.scrollHeight : 0;
        const oldScrollTop = contentEl ? contentEl.scrollTop : 0;
  
        if (page === 'explorer' || page === 'search') {
          setFiles(prev => {
            const existing = new Set(prev.map(f => f.path));
            const additions = r.data.filter(f => !existing.has(f.path));
            return [...additions, ...prev];
          });
          if (page === 'search') {
            setSearchCache(prev => {
              const existing = new Set(prev.map(f => f.path));
              const additions = r.data.filter(f => !existing.has(f.path));
              return [...additions, ...prev];
            });
          }
        } else if (page === 'person_files' && sharedState.current?.people?.setPersonFiles) {
          sharedState.current.people.setPersonFiles(prev => {
            const existing = new Set(prev.map(f => f.path));
            const additions = r.data.filter(f => !existing.has(f.path));
            return [...additions, ...prev];
          });
        }
        
        setStartOffset(nextStartOffset);
        setTimeout(() => {
          if (contentEl) {
            contentEl.scrollTop = oldScrollTop + (contentEl.scrollHeight - oldScrollHeight);
          }
        }, 50);
      }
    } catch (err) {
      if (!axios.isCancel(err)) console.warn('Load previous failed', err);
    }
    
    setLoadingPrevious(false);
    loadingPreviousRef.current = false;
  }

  const syncActiveDate = (containerElement) => {
    if (!containerElement) return;
    if (syncDateTimeoutRef.current) clearTimeout(syncDateTimeoutRef.current);
    
    syncDateTimeoutRef.current = setTimeout(() => {
      const containerRect = containerElement.getBoundingClientRect();
      const headers = document.querySelectorAll('.date-header');
      let currentActive = null;
      
      for (let i = 0; i < headers.length; i++) {
        const rect = headers[i].getBoundingClientRect();
        if (rect.top - containerRect.top <= 120) {
          currentActive = headers[i].getAttribute('data-date');
        } else {
          break;
        }
      }
      
      if (!currentActive && headers.length > 0) currentActive = headers[0].getAttribute('data-date');
      if (currentActive) setActiveDate(prev => prev !== currentActive ? currentActive : prev);
    }, 50);
  };

  function handleScroll(e) {
    const {scrollTop, scrollHeight, clientHeight} = e.currentTarget;
    if(scrollHeight - scrollTop - clientHeight < 120) loadMore();
    if(scrollTop < 120 && startOffset > 0) loadPrevious();
    syncActiveDate(e.currentTarget);
  }

  async function openFile(itemPath) {
    try { await axios.post(`${API}/open-path`, { path: itemPath }); }
    catch(err){ alert(err?.response?.data?.detail || err.message || 'Unable to open file.'); }
  }

  async function openContainingFolder(itemPath) {
    try { await axios.post(`${API}/open-folder`, { path: itemPath }); }
    catch(err){ alert(err?.response?.data?.detail || err.message || 'Unable to open folder.'); }
  }

  const handleItemClick = (e, item) => {
    if (e.target.tagName && e.target.tagName.toLowerCase() === 'input' && e.target.type === 'checkbox') return;

    setSelected(item);
    const currentIndex = sortedFiles.findIndex(f => f.path === item.path);
    if (currentIndex === -1) return;
  
    if (e.shiftKey) {
      document.getSelection()?.removeAllRanges();
      let startIdx = currentIndex;
      if (lastCheckedPath.current) {
        const lastIdx = sortedFiles.findIndex(f => f.path === lastCheckedPath.current);
        if (lastIdx !== -1) startIdx = lastIdx;
      }
      const start = Math.min(startIdx, currentIndex);
      const end = Math.max(startIdx, currentIndex);
      const next = new Set(checkedFiles);
      for (let i = start; i <= end; i++) next.add(sortedFiles[i].path);
      setCheckedFiles(next);
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(checkedFiles);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      setCheckedFiles(next);
      lastCheckedPath.current = item.path;
    } else {
      if (checkedFiles.size > 0) setCheckedFiles(new Set([item.path]));
      lastCheckedPath.current = item.path;
    }
  };

  const toggleCheck = (e, path) => {
    e.stopPropagation();
    lastCheckedPath.current = path;
    const next = new Set(checkedFiles);
    if(next.has(path)) next.delete(path);
    else next.add(path);
    setCheckedFiles(next);
  };

  const selectAll = () => {
    const visiblePaths = sortedFiles.map(f => f.path);
    const allVisibleChecked = visiblePaths.length > 0 && visiblePaths.every(p => checkedFiles.has(p));
    const next = new Set(checkedFiles);
    if (allVisibleChecked) {
      visiblePaths.forEach(p => next.delete(p));
    } else {
      visiblePaths.forEach(p => next.add(p));
    }
    setCheckedFiles(next);
  };

  const selectVerifiedDuplicates = () => {
    const nextChecked = new Set(checkedFiles);
    const hashGroups = {};
    sortedFiles.forEach(f => {
      if (f.metadata?.sha256) {
        if (!hashGroups[f.metadata.sha256]) hashGroups[f.metadata.sha256] = [];
        hashGroups[f.metadata.sha256].push(f);
      }
    });
  
    let addedCount = 0;
    let hasVerifiedDups = false;
    Object.values(hashGroups).forEach(group => {
      if (group.length > 1) {
        hasVerifiedDups = true;
        for (let i = 1; i < group.length; i++) {
          if (!nextChecked.has(group[i].path)) {
            nextChecked.add(group[i].path);
            addedCount++;
          }
        }
      }
    });
  
    if (addedCount === 0) {
      if (hasVerifiedDups) {
        showToastMessage("All verified duplicate copies are already selected.");
      } else {
        alert("No verified duplicate copies found. Please run 'Verify Hashes' first.");
      }
    } else {
      setCheckedFiles(nextChecked);
      showToastMessage(`Auto-selected ${addedCount} verified duplicate(s).`);
    }
  };

  async function deleteSelected() {
    if (filterCategory === 'duplicates') {
      const filesToDelete = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)).filter(Boolean);
      
      if (!(settings.allow_unverified_deletion ?? settings.ui_preferences?.allow_unverified_deletion)) {
        const hasUnverified = filesToDelete.some(f => !f.metadata?.sha256);
        if (hasUnverified) {
          alert('Deletion Blocked: One or more selected files lack a verified SHA-256 sum.\n\nBecause your cold storage backup might be offline, we cannot guarantee these are true duplicates yet. You can override this protection in the Settings menu.');
          return;
        }
      }

      const hashCountsInDeletion = {};
      filesToDelete.forEach(f => {
        if (f.metadata?.sha256) {
          hashCountsInDeletion[f.metadata.sha256] = (hashCountsInDeletion[f.metadata.sha256] || 0) + 1;
        }
      });

      const totalHashCounts = {};
      files.forEach(f => {
        if (f.metadata?.sha256) {
          totalHashCounts[f.metadata.sha256] = (totalHashCounts[f.metadata.sha256] || 0) + 1;
        }
      });

      for (const hash of Object.keys(hashCountsInDeletion)) {
        if (hashCountsInDeletion[hash] === totalHashCounts[hash]) {
          alert('Deletion Blocked: You cannot delete all verified copies of a file. You must keep at least one copy.');
          return;
        }
      }
    }
  
    if(!window.confirm(`Are you sure you want to permanently delete ${checkedFiles.size} files from your disk and database? This action cannot be undone.`)) return;
    try {
      await axios.post(`${API}/delete-files`, { paths: Array.from(checkedFiles) });
      setFiles(prev => prev.filter(f => !checkedFiles.has(f.path)));
      setCheckedFiles(new Set());
      if(selected && checkedFiles.has(selected.path)) setSelected(null);
    } catch(err) {
      alert('Error deleting files: ' + (err?.response?.data?.detail || err.message));
    }
  }

  async function openSelected() {
    if (checkedFiles.size > 5) {
      const proceed = window.confirm(`You are trying to open ${checkedFiles.size} files at once. This might open too many windows and slow down your system. Do you want to proceed?`);
      if (!proceed) return;
    }
    for(const path of checkedFiles) await openFile(path);
  }

  async function copySelected() {
    try {
      const dest = await axios.get(`${API}/choose-path?mode=directory`);
      if (!dest.data || !dest.data.path) return;
      const res = await axios.post(`${API}/copy-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
      alert(`Successfully copied ${res.data.copied} files.`);
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error copying files: ' + (err?.response?.data?.detail || err.message));
    }
  }

  async function moveSelected() {
    try {
      const dest = await axios.get(`${API}/choose-path?mode=directory`);
      if (!dest.data || !dest.data.path) return;
      const res = await axios.post(`${API}/move-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
      const updates = res.data.updates || {};
      setFiles(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
      setSearchCache(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
      alert(`Successfully moved ${res.data.moved} files.`);
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error moving files: ' + (err?.response?.data?.detail || err.message));
    }
  }

  function locateSelectedFileInExplorer() {
    if (checkedFiles.size !== 1) return;
    const path = Array.from(checkedFiles)[0];
    let file = globalFileCache.current.get(path);
    if (!file) return;

    let q = '';
    const d = parseFileDate(file);
    if (d) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        q = `date:${d.getFullYear()}-${month}-${day}`;
    } else {
        q = `name:"${file.filename}"`;
    }

    setFilterCategory('all');
    setQuery(q);
    setPage('search');
    setSelected(file);
    setCheckedFiles(new Set([file.path]));
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setLoadingMore(true);
    
    if (searchAbortController.current) searchAbortController.current.abort();
    searchAbortController.current = new AbortController();

    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    const safeQuery = q.replace(/,/g, ' ');
    
    axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=all&offset=0&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`, {
        signal: searchAbortController.current.signal
    }).then(r => {
        let newFiles = r.data;
        if (!newFiles.some(f => f.path === file.path)) newFiles = [...newFiles, file];
        setSearchCache(newFiles);
        setFiles(newFiles);
        setOffset(r.data.length);
        setHasMore(r.data.length === limit);
        setLoadingMore(false);
        setTimeout(() => {
            const escapedPath = file.path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const el = document.querySelector(`[data-path="${escapedPath}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'center' });
            } else {
                const dateKey = d ? dateFormatter.format(d) : 'Unknown Date';
                document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
        }, 300);
    }).catch((err) => {
        if (!axios.isCancel(err)) setLoadingMore(false);
    });
  }

  const handleFilterChange = (e) => {
    const newCat = e.target.value;
    setFilterCategory(newCat);
    setShowSelectedOnly(false);
    setCheckedFiles(new Set());
    if (newCat === 'duplicates') {
      setSortBy('size');
      setSortOrder('desc');
    }
    setSelected(null);
    if (page === 'explorer') {
      loadFiles(0, false, newCat, newCat === 'duplicates' ? 'size' : sortBy, newCat === 'duplicates' ? 'desc' : sortOrder);
    } else if (page === 'search') {
      doSearch(query, newCat, newCat === 'duplicates' ? 'size' : sortBy, newCat === 'duplicates' ? 'desc' : sortOrder);
    }
  };
  
  const handleCategoryClick = (category) => {
    setFilterCategory(category);
    setPage('explorer');
    setSelected(null);
    setShowSelectedOnly(false);
    setCheckedFiles(new Set());
    if (category === 'duplicates') {
      setSortBy('size');
      setSortOrder('desc');
    }
    loadFiles(0, false, category, category === 'duplicates' ? 'size' : sortBy, category === 'duplicates' ? 'desc' : sortOrder);
  };

  const sortedFiles = useMemo(() => {
    let baseFiles = files || [];
    if (showSelectedOnly) {
      baseFiles = Array.from(checkedFiles).map(p => globalFileCache.current?.get(p)).filter(Boolean);
    }
  
    if (filterCategory === 'duplicates' && !showSelectedOnly) {
      const sizeGroups = {};
      baseFiles.forEach(f => {
        if (!sizeGroups[f.size]) sizeGroups[f.size] = [];
        sizeGroups[f.size].push(f);
      });
  
      baseFiles = baseFiles.filter(f => {
        const group = sizeGroups[f.size];
        if (f.metadata?.sha256) {
          const sameHashCount = group.filter(g => g.metadata?.sha256 === f.metadata.sha256).length;
          const unhashedCount = group.filter(g => !g.metadata?.sha256).length;
          if (sameHashCount === 1 && unhashedCount === 0) return false;
        }
        return true;
      });
      
      const newSizeGroups = {};
      baseFiles.forEach(f => {
        if (!newSizeGroups[f.size]) newSizeGroups[f.size] = [];
        newSizeGroups[f.size].push(f);
      });
      baseFiles = baseFiles.filter(f => newSizeGroups[f.size].length > 1);
    }
  
    const sorted = [...baseFiles].sort((a,b) => {
      let aVal, bVal;
      if(sortBy === 'date'){
        const d1 = parseFileDate(a);
        const d2 = parseFileDate(b);
        aVal = d1 ? d1.getTime() : 0;
        bVal = d2 ? d2.getTime() : 0;
      } else if(sortBy === 'size'){
        const parseSize = (s) => {
          if (!s) return 0;
          const str = String(s).replace(/,/g, '');
          const match = str.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i);
          if(!match) return parseFloat(str) || 0;
          const num = parseFloat(match[1]);
          const unit = match[2].toUpperCase();
          const mult = {B:1, KB:1024, MB:1024**2, GB:1024**3, TB:1024**4}[unit];
          return num * mult;
        };
        aVal = parseSize(a.size);
        bVal = parseSize(b.size);
      } else if(sortBy === 'filename'){
        aVal = String(a.filename || '').toLowerCase();
        bVal = String(b.filename || '').toLowerCase();
      }
      if(sortOrder === 'asc'){
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    return sorted;
  }, [files, sortBy, sortOrder, showSelectedOnly, checkedFiles, filterCategory]);
  
  const groupedFiles = useMemo(() => {
    if (filterCategory === 'duplicates') {
      const map = new Map();
      map.set('Duplicate Files', sortedFiles);
      return map;
    }
    const groups = new Map();
    sortedFiles.forEach(file => {
      let key = 'Unknown Date';
      const d = parseFileDate(file);
      if (d) key = dateFormatter.format(d);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    });
    return groups;
  }, [sortedFiles, filterCategory]);

  useEffect(() => {
    syncActiveDate(document.querySelector('.content'));
  }, [groupedFiles, page]);

  return {
    files, setFiles, selected, setSelected, searchCache, setSearchCache, offset, setOffset,
    startOffset, setStartOffset, hasMore, setHasMore, loadingMore, setLoadingMore,
    loadingPrevious, setLoadingPrevious, sortBy, setSortBy, sortOrder, setSortOrder,
    filterCategory, setFilterCategory, viewMode, setViewMode, checkedFiles, setCheckedFiles,
    globalFileCache, showSelectedOnly, setShowSelectedOnly, activeDate, setActiveDate,
    checkFileReadOnly, isSelectionReadOnly, loadFiles, doSearch, goToSearch, loadMore,
    loadPrevious, syncActiveDate, handleScroll, openFile, openContainingFolder, handleItemClick,
    toggleCheck, selectAll, selectVerifiedDuplicates, deleteSelected, openSelected,
    copySelected, moveSelected, locateSelectedFileInExplorer, handleFilterChange,
    handleCategoryClick, sortedFiles, groupedFiles
  };
}