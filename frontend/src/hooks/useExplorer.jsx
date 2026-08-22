import { useState, useRef, useMemo, useEffect } from 'react';
import axios from 'axios';
import { API, parseFileDate, dateFormatter } from '../States';

export function useExplorer({
  settings, page, setPage, query, setQuery, showToastMessage, sharedState, indexer, actionInProgress, dataOpProgress, setActionInProgress,
  viewType, setViewType
}) {
  const [files, setFiles] = useState([]);
  const [directories, setDirs] = useState([]);
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
  const suppressNextAutoLoad = useRef(false);
  const isRestoringScroll = useRef(false);
  const [activeDate, setActiveDate] = useState('');

  const viewContexts = useRef({
    explorer_flat: {
      files: [],
      offset: 0,
      startOffset: 0,
      hasMore: true,
      scrollTop: 0
    },
    explorer_tree: {
      files: [],
      offset: 0,
      startOffset: 0,
      hasMore: true,
      scrollTop: 0
    },
    virtual_folder_flat: {
      files: [],
      offset: 0,
      startOffset: 0,
      hasMore: true,
      scrollTop: 0
    },
    virtual_folder_tree: {
      files: [],
      offset: 0,
      startOffset: 0,
      hasMore: true,
      scrollTop: 0
    }
  });
  const invalidateViewCache = () => {
    viewContexts.current = {};
  };
  const folderTreeScrollTopRef = useRef(0);
  const timelineScrollTopRef = useRef(0);

  // Physical Navigation states
  const [activeFolderPath, setActiveFolderPath] = useState(null);
  const [physHistory, setPhysHistory] = useState([null]);
  const [physHistoryIdx, setPhysHistoryIdx] = useState(0);

  const navigateToPhys = (path, isHistoryAction = false) => {
    setActiveFolderPath(path);
    if (!isHistoryAction) {
      const nextHist = physHistory.slice(0, physHistoryIdx + 1);
      nextHist.push(path);
      setPhysHistory(nextHist);
      setPhysHistoryIdx(nextHist.length - 1);
    }
  };

  const goBackPhys = () => {
    if (physHistoryIdx > 0) {
      const idx = physHistoryIdx - 1;
      setPhysHistoryIdx(idx);
      navigateToPhys(physHistory[idx], true);
    }
  };

  const goForwardPhys = () => {
    if (physHistoryIdx < physHistory.length - 1) {
      const idx = physHistoryIdx + 1;
      setPhysHistoryIdx(idx);
      navigateToPhys(physHistory[idx], true);
    }
  };

  const goUpPhys = () => {
    if (!activeFolderPath) return;
    const cleanPath = activeFolderPath.replace(/\\/g, '/');
    const cleanActive = cleanPath.toLowerCase();
    const backups = settings?.backup_configs || [];
    const isBackupRoot = backups.some(b => {
      const bp = String(b.backup_path || '').replace(/\\/g, '/').toLowerCase();
      return bp && cleanActive === bp;
    });

    if (isBackupRoot) {
      navigateToPhys(null);
      return;
    }

    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      navigateToPhys(null);
    } else {
      parts.pop();
      const parentPath = parts.join('/');
      const parentLower = parentPath.toLowerCase();
      
      const isAncestor = backups.some(b => {
        if (!b.backup_path) return false;
        const bp = String(b.backup_path).replace(/\\/g, '/').toLowerCase();
        return bp.startsWith(parentLower + '/') || (parentLower.endsWith(':') && bp.startsWith(parentLower));
      });
      
      if (isAncestor) {
        navigateToPhys(null);
      } else {
        navigateToPhys(parentPath);
      }
    }
  };

  // Virtual Folder states
  const [virtualFolderId, setVirtualFolderId] = useState(null);
  const [currentVirtualFolder, setCurrentVirtualFolder] = useState(null);
  const [virtualFolders, setVirtualFolders] = useState([]);
  const [virtualFolderViewType, setVirtualFolderViewType] = useState('tree');
  const prevViewType = useRef(page === 'virtual_folder' ? virtualFolderViewType : viewType);
  const prevPage = useRef(page);
  const prevFilterCategory = useRef(filterCategory);
  const prevSortBy = useRef(sortBy);
  const prevSortOrder = useRef(sortOrder);
  const prevActiveFolderPath = useRef(activeFolderPath);
  const prevVirtualFolderId = useRef(virtualFolderId);
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const cooldownRetryRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  // Lazy file counts: keyed by folder id. Populated on-demand via fetchFolderCount.
  const [virtualFolderCounts, setVirtualFolderCounts] = useState({});
  const [loadingAllCounts, setLoadingAllCounts] = useState(false);

  const fetchFolderCount = (id) => {
    setVirtualFolderCounts(prev => ({ ...prev, [id]: 'loading' }));
    return axios.get(`${API}/virtual-folders/${id}/count`)
      .then(r => {
        setVirtualFolderCounts(prev => ({ ...prev, [id]: r.data.file_count }));
        return r.data.file_count;
      })
      .catch(() => {
        setVirtualFolderCounts(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return null;
      });
  };

  const refreshFolderAndAncestorsCount = (folderId) => {
    if (!folderId) return;
    fetchFolderCount(folderId);
    const folder = (virtualFolders || []).find(f => f.id === folderId);
    if (folder && folder.parent_id) {
      refreshFolderAndAncestorsCount(folder.parent_id);
    }
  };

  const loadAllFolderCounts = async () => {
    if (!virtualFolders || virtualFolders.length === 0) return;
    setLoadingAllCounts(true);
    try {
      for (const folder of virtualFolders) {
        await fetchFolderCount(folder.id);
      }
    } finally {
      setLoadingAllCounts(false);
    }
  };

  const handleOpenFolder = (folder) => {
    setVirtualFolderId(folder.id);
    setCurrentVirtualFolder(folder);
    setFilterCategory('all');
    setPage('virtual_folder');
  };

  // Virtual Folder Navigation states
  const [virtHistory, setVirtHistory] = useState([null]);
  const [virtHistoryIdx, setVirtHistoryIdx] = useState(0);
  const [isNavigatingVirt, setIsNavigatingVirt] = useState(false);

  useEffect(() => {
    if (page === 'virtual_folder') {
      if (isNavigatingVirt) {
        setIsNavigatingVirt(false);
        return;
      }
      if (virtHistory[virtHistoryIdx] !== virtualFolderId) {
        const nextHist = virtHistory.slice(0, virtHistoryIdx + 1);
        nextHist.push(virtualFolderId);
        setVirtHistory(nextHist);
        setVirtHistoryIdx(nextHist.length - 1);
      }
    }
  }, [virtualFolderId, page]);

  const goBackVirt = () => {
    if (virtHistoryIdx > 0) {
      const prevIdx = virtHistoryIdx - 1;
      const prevFolderId = virtHistory[prevIdx];
      const prevFolder = (virtualFolders || []).find(f => f.id === prevFolderId);
      setIsNavigatingVirt(true);
      setVirtHistoryIdx(prevIdx);
      setVirtualFolderId(prevFolderId);
      setCurrentVirtualFolder(prevFolder || null);
      if (!prevFolderId) {
        setPage('virtual_folders');
      }
    }
  };

  const goForwardVirt = () => {
    if (virtHistoryIdx < virtHistory.length - 1) {
      const nextIdx = virtHistoryIdx + 1;
      const nextFolderId = virtHistory[nextIdx];
      const nextFolder = (virtualFolders || []).find(f => f.id === nextFolderId);
      setIsNavigatingVirt(true);
      setVirtHistoryIdx(nextIdx);
      setVirtualFolderId(nextFolderId);
      setCurrentVirtualFolder(nextFolder || null);
      if (!nextFolderId) {
        setPage('virtual_folders');
      }
    }
  };

  const goUpVirt = () => {
    if (currentVirtualFolder) {
      const parentId = currentVirtualFolder.parent_id;
      const parent = parentId ? (virtualFolders || []).find(f => f.id === parentId) : null;
      setVirtualFolderId(parentId);
      setCurrentVirtualFolder(parent);
      if (!parentId) {
        setPage('virtual_folders');
      }
    }
  };

  const isPhys = page !== 'virtual_folder';
  const canGoBack = isPhys ? physHistoryIdx > 0 : virtHistoryIdx > 0;
  const canGoForward = isPhys ? physHistoryIdx < physHistory.length - 1 : virtHistoryIdx < virtHistory.length - 1;
  const canGoUp = isPhys ? activeFolderPath !== null : currentVirtualFolder !== null;

  const handleBack = isPhys ? goBackPhys : goBackVirt;
  const handleForward = isPhys ? goForwardPhys : goForwardVirt;
  const handleUp = isPhys ? goUpPhys : goUpVirt;

  async function loadVirtualFolders() {
    try {
      const r = await axios.get(`${API}/virtual-folders`);
      setVirtualFolders(r.data);
      if (currentVirtualFolder) {
        const fresh = r.data.find(f => f.id === currentVirtualFolder.id);
        if (fresh) {
          setCurrentVirtualFolder(fresh);
        }
      }
    } catch (err) {
      console.warn('Failed to load virtual folders', err);
    }
  }

  async function loadDirectories() {
    try {
      const r = await axios.get(`${API}/directories`);
      setDirs(r.data);
    } catch (err) {
      console.warn('Failed to load directories', err);
    }
  }

  async function createVirtualFolder(name, parentId = null, isDynamic = false, queryText = null, metadataJson = null) {
    try {
      const r = await axios.post(`${API}/virtual-folders`, {
        name,
        parent_id: parentId,
        is_dynamic: isDynamic,
        query: queryText,
        metadata_json: metadataJson
      });
      await loadVirtualFolders();
      if (r.data?.id) {
        fetchFolderCount(r.data.id);
      }
      if (parentId) {
        refreshFolderAndAncestorsCount(parentId);
      }
      return r.data;
    } catch (err) {
      alert('Failed to create virtual folder: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function deleteVirtualFolder(folderId) {
    try {
      const folderToDelete = (virtualFolders || []).find(f => f.id === folderId);
      const parentId = folderToDelete?.parent_id;
      
      // Determine all descendant folder IDs to delete
      const getDescendantIds = (fid) => {
        const ids = [fid];
        const children = (virtualFolders || []).filter(f => f.parent_id === fid);
        children.forEach(c => {
          ids.push(...getDescendantIds(c.id));
        });
        return ids;
      };
      const deletedFolderIds = getDescendantIds(folderId);
      const deletedTokens = new Set(deletedFolderIds.map(id => `virtual_folder:${id}`));

      await axios.delete(`${API}/virtual-folders/${folderId}`);
      
      // Remove deleted folders from selection
      setCheckedFiles(prev => {
        const next = new Set(prev);
        deletedTokens.forEach(t => next.delete(t));
        return next;
      });

      setVirtualFolderCounts(prev => {
        const next = { ...prev };
        deletedFolderIds.forEach(id => delete next[id]);
        return next;
      });
      if (parentId) {
        refreshFolderAndAncestorsCount(parentId);
      }
      if (virtualFolderId === folderId || deletedFolderIds.includes(virtualFolderId)) {
        const parent = parentId ? (virtualFolders || []).find(f => f.id === parentId) : null;
        if (parent) {
          setVirtualFolderId(parent.id);
          setCurrentVirtualFolder(parent);
          setPage('virtual_folder');
          await loadFiles(0, false, filterCategory, sortBy, sortOrder, 'virtual_folder', parent.id);
        } else {
          setVirtualFolderId(null);
          setCurrentVirtualFolder(null);
          setPage('virtual_folders');
        }
      }
      await loadVirtualFolders();
    } catch (err) {
      alert('Failed to delete virtual folder: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function renameVirtualFolder(folderId, name, metadataJson = null) {
    try {
      const payload = { name };
      if (metadataJson !== null) {
        payload.metadata_json = metadataJson;
      }
      const r = await axios.put(`${API}/virtual-folders/${folderId}`, payload);
      if (virtualFolderId === folderId) {
        setCurrentVirtualFolder(r.data);
      }
      await loadVirtualFolders();
    } catch (err) {
      alert('Failed to rename virtual folder: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function updateVirtualFolderQuery(folderId, queryText) {
    try {
      const r = await axios.put(`${API}/virtual-folders/${folderId}`, { query: queryText });
      if (virtualFolderId === folderId) {
        setCurrentVirtualFolder(r.data);
      }
      await loadVirtualFolders();
      refreshFolderAndAncestorsCount(folderId);
    } catch (err) {
      alert('Failed to update folder query: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function addFilesToVirtualFolder(folderId, fileIds, paths = []) {
    try {
      const r = await axios.post(`${API}/virtual-folders/${folderId}/files`, { file_ids: fileIds, paths: paths });
      if (r.data.added > 0) {
        showToastMessage(`Successfully added ${r.data.added} file(s) to virtual folder.`);
      } else {
        showToastMessage(`Selected file(s) are already in this virtual folder.`, null, 'warning');
      }
      invalidateViewCache();
      await loadVirtualFolders();
      refreshFolderAndAncestorsCount(folderId);
      if (virtualFolderId === folderId) {
        setCheckedFiles(new Set());
        await loadFiles(0, false, filterCategory, sortBy, sortOrder);
      }
      return r.data;
    } catch (err) {
      alert('Failed to add files to virtual folder: ' + (err.response?.data?.detail || err.message));
    }
  }

  async function removeFilesFromVirtualFolder(folderId, fileIds, paths = [], recursive = true) {
    try {
      await axios.post(`${API}/virtual-folders/${folderId}/files/delete`, { file_ids: fileIds, paths: paths, recursive: recursive });
      showToastMessage(`Removed file(s) from virtual folder.`);
      invalidateViewCache();
      await loadVirtualFolders();
      refreshFolderAndAncestorsCount(folderId);
      setCheckedFiles(new Set());
      await loadFiles(0, false, filterCategory, sortBy, sortOrder);
    } catch (err) {
      alert('Failed to remove files: ' + (err.response?.data?.detail || err.message));
    }
  }

  useEffect(() => {
    loadVirtualFolders();
    loadDirectories();
  }, []);

  useEffect(() => {
    if (page === 'explorer' || page === 'virtual_folder' || page === 'virtual_folders') {
      loadVirtualFolders();
      loadDirectories();
    }
  }, [page, viewType]);

  // Robust Content Pane Cache Manager:
  // Saves and restores view contexts (loaded files list, pagination offset, startOffset, and scroll position)
  // across page transitions, view toggles, category filter changes, sorting options, and active folder paths.
  useEffect(() => {
    const oldPage = prevPage.current;
    const newPage = page;
    const oldView = prevViewType.current;
    const newView = page === 'virtual_folder' ? virtualFolderViewType : viewType;
    const oldCat = prevFilterCategory.current;
    const newCat = filterCategory;
    const oldSortBy = prevSortBy.current;
    const newSortBy = sortBy;
    const oldSortOrder = prevSortOrder.current;
    const newSortOrder = sortOrder;
    const oldActiveFolderPath = prevActiveFolderPath.current;
    const newActiveFolderPath = activeFolderPath;
    const oldVirtualFolderId = prevVirtualFolderId.current;
    const newVirtualFolderId = virtualFolderId;

    if (
      oldPage === newPage &&
      oldView === newView &&
      oldCat === newCat &&
      oldSortBy === newSortBy &&
      oldSortOrder === newSortOrder &&
      oldActiveFolderPath === newActiveFolderPath &&
      oldVirtualFolderId === newVirtualFolderId
    ) {
      return;
    }

    if (suppressNextAutoLoad.current) {
      prevPage.current = newPage;
      prevViewType.current = newView;
      prevFilterCategory.current = newCat;
      prevSortBy.current = newSortBy;
      prevSortOrder.current = newSortOrder;
      prevActiveFolderPath.current = newActiveFolderPath;
      prevVirtualFolderId.current = newVirtualFolderId;
      return;
    }

    const isOldPreserved = oldPage === 'explorer' || oldPage === 'virtual_folder';
    const isNewPreserved = newPage === 'explorer' || newPage === 'virtual_folder';

    if (isOldPreserved) {
      const oldCacheKey = `${oldPage}_${oldView}_${oldCat}`;
      viewContexts.current[oldCacheKey] = {
        ...viewContexts.current[oldCacheKey],
        files: files,
        offset: offset,
        startOffset: startOffset,
        hasMore: hasMore,
        filterCategory: oldCat,
        sortBy: oldSortBy,
        sortOrder: oldSortOrder,
        activeFolderPath: oldActiveFolderPath,
        virtualFolderId: oldVirtualFolderId
      };
    }

    if (isNewPreserved) {
      const newCacheKey = `${newPage}_${newView}_${newCat}`;
      const ctx = viewContexts.current[newCacheKey];

      // If only sorting changed within the exact same view and category, it is an explicit sort click.
      // In this case, we MUST invalidate the cache to force a reload from page 0.
      const isExplicitSortChange = 
        oldCat === newCat && 
        oldPage === newPage && 
        oldView === newView && 
        oldActiveFolderPath === newActiveFolderPath && 
        oldVirtualFolderId === newVirtualFolderId && 
        (oldSortBy !== newSortBy || oldSortOrder !== newSortOrder);

      // Check if the cached parameters match our current view parameters (ignoring sorting, as we restore it below)
      const isCacheValid = ctx && 
        ctx.filterCategory === filterCategory &&
        ctx.activeFolderPath === activeFolderPath &&
        ctx.virtualFolderId === virtualFolderId &&
        !isExplicitSortChange;

      // Tree-view files are folder-specific. Cached files may belong to a different
      // folder than the one currently active, and the cached startOffset may be
      // non-zero (from a previous pagination session in that folder). Always force a
      // fresh load so that startOffset is reset to 0 and the correct folder is shown.
      const isTreeSwitch = newPage === 'explorer' && newView === 'tree';

      if (isCacheValid && !isTreeSwitch) {
        setFiles(ctx.files);
        setOffset(ctx.offset);
        setStartOffset(ctx.startOffset);
        setHasMore(ctx.hasMore);

        // Restore the category-specific sorting parameters if they differ from the global state
        if (ctx.sortBy !== sortBy) setSortBy(ctx.sortBy);
        if (ctx.sortOrder !== sortOrder) setSortOrder(ctx.sortOrder);

        prevPage.current = newPage;
        prevViewType.current = newView;
        prevFilterCategory.current = newCat;
        prevSortBy.current = ctx.sortBy;
        prevSortOrder.current = ctx.sortOrder;
        prevActiveFolderPath.current = newActiveFolderPath;
        prevVirtualFolderId.current = newVirtualFolderId;
      } else if (isExplicitSortChange) {
        // Explicit sort order/field change: preserve loaded files in memory and update prev refs
        prevPage.current = newPage;
        prevViewType.current = newView;
        prevFilterCategory.current = newCat;
        prevSortBy.current = newSortBy;
        prevSortOrder.current = newSortOrder;
        prevActiveFolderPath.current = newActiveFolderPath;
        prevVirtualFolderId.current = newVirtualFolderId;
      } else {
        // Cache is stale/invalid or we are switching to Explorer Tree: reset states and force reload
        setFiles([]);
        setOffset(0);
        setStartOffset(0);
        setHasMore(true);
        if (viewContexts.current[newCacheKey]) {
          viewContexts.current[newCacheKey].scrollTop = 0;
        }

        prevPage.current = newPage;
        prevViewType.current = newView;
        prevFilterCategory.current = newCat;
        prevSortBy.current = newSortBy;
        prevSortOrder.current = newSortOrder;
        prevActiveFolderPath.current = newActiveFolderPath;
        prevVirtualFolderId.current = newVirtualFolderId;

        loadFiles(0, false, filterCategory, sortBy, sortOrder, newPage, virtualFolderId, newView, activeFolderPath);
      }
    } else {
      prevPage.current = newPage;
      prevViewType.current = newView;
      prevFilterCategory.current = newCat;
      prevSortBy.current = newSortBy;
      prevSortOrder.current = newSortOrder;
      prevActiveFolderPath.current = newActiveFolderPath;
      prevVirtualFolderId.current = newVirtualFolderId;
    }
  }, [viewType, virtualFolderViewType, page, filterCategory, sortBy, sortOrder, activeFolderPath, virtualFolderId]);

  // Robust Content Pane Scroll Restorer:
  // Fires when files/directories update and render in the DOM to ensure stable height.
  useEffect(() => {
    const container = document.querySelector('.content');
    if (container && !pendingLocatePath) {
      const activeView = page === 'virtual_folder' ? virtualFolderViewType : viewType;
      const cacheKey = `${page}_${activeView}_${filterCategory}`;
      const ctx = viewContexts.current[cacheKey];
      if (ctx && typeof ctx.scrollTop === 'number') {
        isRestoringScroll.current = true;
        container.scrollTop = ctx.scrollTop;
        lastScrollTopRef.current = ctx.scrollTop;
        setTimeout(() => {
          isRestoringScroll.current = false;
        }, 50);
      }
    }
  }, [page, viewType, virtualFolderViewType, filterCategory, activeFolderPath, virtualFolderId]);

  useEffect(() => {
    // Clear all explorer_tree caches when folder path changes
    Object.keys(viewContexts.current).forEach(key => {
      if (key.startsWith('explorer_tree')) {
        viewContexts.current[key] = {
          files: [],
          offset: 0,
          startOffset: 0,
          hasMore: true,
          scrollTop: 0
        };
      }
    });
  }, [activeFolderPath]);

  useEffect(() => {
    // Clear all virtual_folder caches when virtual folder ID changes
    Object.keys(viewContexts.current).forEach(key => {
      if (key.startsWith('virtual_folder')) {
        viewContexts.current[key] = {
          files: [],
          offset: 0,
          startOffset: 0,
          hasMore: true,
          scrollTop: 0
        };
      }
    });
  }, [virtualFolderId]);

  const [pendingLocatePath, setPendingLocatePath] = useState(null);
  const [locateFolderOptions, setLocateFolderOptions] = useState(null);
  const [fileToLocate, setFileToLocate] = useState(null);
  const searchTimeout = useRef(null);
  const searchAbortController = useRef(null);
  const loadFilesAbortController = useRef(null);
  const syncDateTimeoutRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(files)) files.forEach(f => globalFileCache.current.set(f.path, f));

    if (pendingLocatePath && files.length > 0) {
      const targetPath = pendingLocatePath;
      const startTime = Date.now();
      
      const tryScroll = () => {
        const normalizedTarget = targetPath.replace(/\\/g, '/').toLowerCase();
        const cards = document.querySelectorAll('[data-path]');
        let el = null;
        for (let i = 0; i < cards.length; i++) {
          const cardPath = cards[i].getAttribute('data-path') || '';
          if (cardPath.replace(/\\/g, '/').toLowerCase() === normalizedTarget) {
            el = cards[i];
            break;
          }
        }
        
        if (el) {
          const container = document.querySelector('.content');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const absoluteTop = elRect.top - containerRect.top + container.scrollTop;
            container.scrollTop = absoluteTop - (container.clientHeight / 2) + (elRect.height / 2);
            
            const activeView = page === 'virtual_folder' ? virtualFolderViewType : viewType;
            const cacheKey = `${page}_${activeView}`;
            if (viewContexts.current[cacheKey]) {
              viewContexts.current[cacheKey].scrollTop = container.scrollTop;
            }
          }
          
          el.style.outline = '2px solid #3b82f6';
          el.style.outlineOffset = '2px';

          setTimeout(() => {
            setPendingLocatePath(null);
          }, 2000);
          
          setTimeout(() => {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }, 2000);
        } else if (Date.now() - startTime < 1500) {
          requestAnimationFrame(tryScroll);
        }
      };
      
      requestAnimationFrame(tryScroll);
    }
  }, [files, pendingLocatePath]);

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

  async function loadFiles(nextOffset = 0, append = false, cat = filterCategory, sBy = sortBy, sOrd = sortOrder, customPage = page, customFolderId = virtualFolderId, customViewType = undefined, customActiveFolder = activeFolderPath) {
    isLoadingRef.current = true;
    if (!append && loadFilesAbortController.current) {
      loadFilesAbortController.current.abort();
      loadFilesAbortController.current = new AbortController();
    } else if (!loadFilesAbortController.current) {
      loadFilesAbortController.current = new AbortController();
    }
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;

    // Resolve active view type context-based
    const activeView = customViewType !== undefined 
      ? customViewType 
      : (customPage === 'virtual_folder' ? virtualFolderViewType : viewType);

    try {
      let url = `${API}/files?category=${cat}&offset=${nextOffset}&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`;
      if (customPage === 'virtual_folder' && customFolderId) {
        const isRec = activeView === 'flat';
        url = `${API}/virtual-folders/${customFolderId}/files?category=${cat}&offset=${nextOffset}&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}&recursive=${isRec}`;
      } else if (activeView === 'tree' && customPage !== 'virtual_folder') {
        const folderParam = customActiveFolder ? encodeURIComponent(customActiveFolder) : 'root';
        url = `${API}/files?category=${cat}&offset=${nextOffset}&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}&folder=${folderParam}`;
      }
      const r = await axios.get(url, {
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
        lastScrollTopRef.current = 0;
      }
      setOffset(nextOffset + r.data.length);
      setHasMore(r.data.length > 0 && r.data.length === limit);
      if(!append){
        setSearchCache([]);
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn('Load files failed', err);
        setHasMore(false);
      }
    } finally {
      isLoadingRef.current = false;
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  // Debounces search query key inputs and initiates search transitions.
  function doSearch(value, cat = filterCategory, sBy = sortBy, sOrd = sortOrder, forceFolderId = undefined) {
    setQuery(value);
  
    if(searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
  
    searchTimeout.current = setTimeout(async () => {
      const folderIdToUse = forceFolderId !== undefined ? forceFolderId : virtualFolderId;
      if(!value){
        setSelected(null);
        setCheckedFiles(new Set());
        if (folderIdToUse) {
          setPage('virtual_folder');
          await loadFiles(0, false, cat, sBy, sOrd, 'virtual_folder', folderIdToUse);
        } else {
          setPage('explorer');
          await loadFiles(0, false, cat, sBy, sOrd, 'explorer');
        }
        return;
      }
  
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      searchAbortController.current = new AbortController();
  
      const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
      const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
      setLoadingMore(true);
      isLoadingRef.current = true;
      setSelected(null);
      setCheckedFiles(new Set());
      try {
        let url = `${API}/search?query=${encodeURIComponent(value)}&category=${cat}&offset=0&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`;
        if (folderIdToUse) {
          url += `&virtual_folder_id=${folderIdToUse}`;
        }
        const r = await axios.get(url, {
          signal: searchAbortController.current.signal
        });
        setSearchCache(r.data);
        setFiles(r.data);
        setOffset(r.data.length);
        setStartOffset(0);
        setHasMore(r.data.length === limit);
        setPage('search');
        setLoadingMore(false);
      } catch (err) {
        if (!axios.isCancel(err)) {
          setLoadingMore(false);
          console.warn('Search failed', err);
          setHasMore(false);
        }
      } finally {
        isLoadingRef.current = false;
      }
    }, 600);
  }

  async function goToSearch(cat = filterCategory, sBy = sortBy, sOrd = sortOrder, forceFolderId = undefined) {
    setSelected(null);
    setCheckedFiles(new Set());
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    const folderIdToUse = forceFolderId !== undefined ? forceFolderId : virtualFolderId;
    if(query){
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      searchAbortController.current = new AbortController();
  
      setLoadingMore(true);
      isLoadingRef.current = true;
      try {
        let url = `${API}/search?query=${encodeURIComponent(query)}&category=${cat}&offset=0&limit=${limit}&sort_by=${sBy}&sort_order=${sOrd}`;
        if (folderIdToUse) {
          url += `&virtual_folder_id=${folderIdToUse}`;
        }
        const r = await axios.get(url, {
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
      } finally {
        isLoadingRef.current = false;
      }
      setPage('search');
    } else {
      if (folderIdToUse) {
        setPage('virtual_folder');
        await loadFiles(0, false, cat, sBy, sOrd, 'virtual_folder', folderIdToUse);
      } else {
        setPage('explorer');
        await loadFiles(0, false, cat, sBy, sOrd, 'explorer');
      }
    }
  }

  async function loadMore() {
    if(loadingMore || loadingMoreRef.current || !hasMore || files.length === 0 || isLoadingRef.current) return;
  
    setLoadingMore(true);
    loadingMoreRef.current = true;
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    if(page === 'explorer' || page === 'virtual_folder'){
      await loadFiles(offset, true, filterCategory, sortBy, sortOrder, page, virtualFolderId, viewType, activeFolderPath);
    } else if(page === 'search'){
      if (searchAbortController.current) searchAbortController.current.abort();
      searchAbortController.current = new AbortController();
  
      try {
        let url = `${API}/search?query=${encodeURIComponent(query)}&category=${filterCategory}&offset=${offset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        if (virtualFolderId) {
          url += `&virtual_folder_id=${virtualFolderId}`;
        }
        const r = await axios.get(url, {
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
    if(loadingPrevious || loadingPreviousRef.current || startOffset <= 0 || isLoadingRef.current) return;
  
    setLoadingPrevious(true);
    loadingPreviousRef.current = true;
    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
    const fetchLimit = Math.min(limit, startOffset);
    const nextStartOffset = startOffset - fetchLimit;
  
    try {
      let r;
      if(page === 'explorer' || page === 'virtual_folder'){
        let url = `${API}/files?category=${filterCategory}&offset=${nextStartOffset}&limit=${fetchLimit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        if (page === 'virtual_folder' && virtualFolderId) {
          const isRec = viewType === 'flat';
          url = `${API}/virtual-folders/${virtualFolderId}/files?category=${filterCategory}&offset=${nextStartOffset}&limit=${fetchLimit}&sort_by=${sortBy}&sort_order=${sortOrder}&recursive=${isRec}`;
        } else if (viewType === 'tree') {
          const folderParam = activeFolderPath ? encodeURIComponent(activeFolderPath) : 'root';
          url += `&folder=${folderParam}`;
        }
        r = await axios.get(url);
      } else if(page === 'search'){
        let url = `${API}/search?query=${encodeURIComponent(query)}&category=${filterCategory}&offset=${nextStartOffset}&limit=${fetchLimit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        if (virtualFolderId) {
          url += `&virtual_folder_id=${virtualFolderId}`;
        }
        r = await axios.get(url);
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
            isRestoringScroll.current = true;
            const newScrollTop = oldScrollTop + (contentEl.scrollHeight - oldScrollHeight);
            contentEl.scrollTop = newScrollTop;
            lastScrollTopRef.current = newScrollTop;
            setTimeout(() => {
              isRestoringScroll.current = false;
            }, 50);
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
    if (isRestoringScroll.current) return;
    const {scrollTop, scrollHeight, clientHeight} = e.currentTarget;

    lastScrollTopRef.current = scrollTop;

    if (scrollHeight - scrollTop - clientHeight < 400) {
      loadMore();
    }
    if (scrollTop < 400 && startOffset > 0) {
      loadPrevious();
    }
    syncActiveDate(e.currentTarget);

    if (page === 'explorer' || page === 'virtual_folder') {
      const activeView = page === 'virtual_folder' ? virtualFolderViewType : viewType;
      const cacheKey = `${page}_${activeView}_${filterCategory}`;
      if (viewContexts.current[cacheKey]) {
        viewContexts.current[cacheKey].scrollTop = scrollTop;
      }
    }
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

    if (item.is_folder) {
      setVirtualFolderId(item.id);
      setCurrentVirtualFolder(item);
      setPage('virtual_folder');
      setFilterCategory('all');
      setQuery('');
      return;
    }

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
      if (checkedFiles.size > 0) {
        const next = new Set(checkedFiles);
        if (next.has(item.path)) next.delete(item.path);
        else next.add(item.path);
        setCheckedFiles(next);
      }
      lastCheckedPath.current = item.path;
    }
  };

  // ── Ancestry helper ────────────────────────────────────────────────────────
  // Returns true if childId is a descendant of parentId in the virtual folder tree.
  const isVirtualFolderChild = (childId, parentId) => {
    let cur = (virtualFolders || []).find(f => f.id === childId);
    while (cur && cur.parent_id) {
      if (cur.parent_id === parentId) return true;
      cur = (virtualFolders || []).find(f => f.id === cur.parent_id);
    }
    return false;
  };

  // ── Core implicit-coverage detector ───────────────────────────────────────
  // Given a path (string) or virtual folder id (number), returns the entry in
  // `fromSet` that implicitly covers it — or null if nothing does.
  // Works identically for normal indexed files AND virtual folders.
  const findImplicitCoverage = (pathOrId, isVirtualSubfolder, fromSet) => {
    const pool = fromSet || checkedFiles;

    if (isVirtualSubfolder) {
      // Virtual subfolder: covered if an ancestor VF is in pool
      const childId = typeof pathOrId === 'number' ? pathOrId : parseInt(pathOrId);
      return Array.from(pool).find(p => {
        if (!p.startsWith('virtual_folder:')) return false;
        const pid = parseInt(p.split(':')[1]);
        if (pid === childId) return false;            // same VF — already explicit
        return isVirtualFolderChild(childId, pid);
      }) || null;
    }

    // Physical file or folder path
    if (typeof pathOrId === 'string') {
      const norm = pathOrId.replace(/\\/g, '/').toLowerCase();

      // (a) Covered by a selected physical ancestor folder
      const physCover = Array.from(pool).find(p => {
        if (p === pathOrId || p.startsWith('virtual_folder:')) return false;
        const np = p.replace(/\\/g, '/').toLowerCase();
        return norm.startsWith(np + '/');
      });
      if (physCover) return physCover;

      // (b) Covered by a selected virtual folder — applies when the user is
      //     browsing INSIDE a virtual folder that is (or whose ancestor is) checked
      if (page === 'virtual_folder' && virtualFolderId) {
        const vfCover = Array.from(pool).find(p => {
          if (!p.startsWith('virtual_folder:')) return false;
          const vid = parseInt(p.split(':')[1]);
          return vid === virtualFolderId || isVirtualFolderChild(virtualFolderId, vid);
        });
        if (vfCover) return vfCover;
      }
    }

    return null;
  };

  // ── Public helper consumed by DateGroup / Explorer subfolder cards ─────────
  const getImplicitSelection = (pathOrId, isVirtualSubfolder = false) =>
    !!findImplicitCoverage(pathOrId, isVirtualSubfolder);

  // ── Unified toggleCheck ────────────────────────────────────────────────────
  const toggleCheck = (e, path) => {
    e.stopPropagation();
    lastCheckedPath.current = path;
    const next = new Set(checkedFiles);

    if (next.has(path)) {
      // Explicitly checked → uncheck directly
      next.delete(path);
      setCheckedFiles(next);
      return;
    }

    const isVirtualPath = path.startsWith('virtual_folder:');
    const lookupKey    = isVirtualPath ? parseInt(path.split(':')[1]) : path;
    const coveringEntry = findImplicitCoverage(lookupKey, isVirtualPath, next);

    if (coveringEntry) {
      // ── Expand-and-exclude ──────────────────────────────────────────────
      // The user clicked on an item that is implicitly covered by a parent.
      // Instead of wiping the entire parent selection, we:
      //   1. Remove the covering parent token.
      //   2. Re-add every OTHER member/sibling as an explicit individual entry.
      //   3. Leave out only the one item the user clicked (deselecting it alone).
      next.delete(coveringEntry);

      if (coveringEntry.startsWith('virtual_folder:')) {
        // Virtual-folder parent: siblings = all currently-loaded files
        // that are NOT the item being deselected.
        const filesSiblings = (files || []).filter(f => !f.is_folder && f.path !== path);
        filesSiblings.forEach(f => next.add(f.path));

        // Re-add any child VF subfolder cards visible in the current view
        // (excluding the clicked item if it was a VF token).
        const childVFCards = (files || []).filter(f => f.is_folder);
        childVFCards.forEach(f => {
          const token = `virtual_folder:${f.id}`;
          if (token !== path) next.add(token);
        });
      } else {
        // Physical-folder parent: siblings = all files whose path falls under
        // the covering folder, minus the clicked item.
        const norm = coveringEntry.replace(/\\/g, '/').toLowerCase();
        const siblings = (files || []).filter(f => {
          if (f.path === path) return false;
          const fp = f.path.replace(/\\/g, '/').toLowerCase();
          return fp.startsWith(norm + '/') || fp === norm;
        });
        // If files[] doesn't contain them (different folder loaded), try cache.
        if (siblings.length === 0) {
          for (const [p] of globalFileCache.current) {
            if (p === path) continue;
            const fp = p.replace(/\\/g, '/').toLowerCase();
            if (fp.startsWith(norm + '/')) next.add(p);
          }
        } else {
          siblings.forEach(f => next.add(f.path));
        }
      }

      setCheckedFiles(next);
      return;
    }

    // Not implicitly covered → check it
    if (!isVirtualPath) {
      const norm = path.replace(/\\/g, '/').toLowerCase();

      // Guard: would this path itself be covered by something already in `next`?
      // (Handles the case where the pool changed due to removals above — keep for safety)
      const conflict = findImplicitCoverage(path, false, next);
      if (conflict) {
        const name = conflict.replace(/\\/g, '/').split('/').pop();
        showToastMessage(`Already included in selected folder "${name}". Deselect that folder first to select individual items.`);
        return;
      }

      // If selecting a FOLDER, deduplicate — remove any more-specific children
      Array.from(next).forEach(p => {
        if (p.startsWith('virtual_folder:')) return;
        const np = p.replace(/\\/g, '/').toLowerCase();
        if (np.startsWith(norm + '/')) next.delete(p);
      });
    }

    next.add(path);
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

  // Deletes currently selected files from disk and DB index. Includes unverified SHA-256 safeguards for duplicates.
  async function deleteSelected() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))) {
      alert("Cannot delete files while a background task or data operation is running. Please stop it first.");
      return;
    }
    window.wabs_action_in_progress = true;

    if (filterCategory === 'duplicates') {
      const filesToDelete = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)).filter(Boolean);
      
      if (!(settings.allow_unverified_deletion ?? settings.ui_preferences?.allow_unverified_deletion)) {
        const hasUnverified = filesToDelete.some(f => !f.metadata?.sha256);
        if (hasUnverified) {
          alert('Deletion Blocked: One or more selected files lack a verified SHA-256 sum.\n\nBecause your cold storage backup might be offline, we cannot guarantee these are true duplicates yet. You can override this protection in the Settings menu.');
          window.wabs_action_in_progress = false;
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
          window.wabs_action_in_progress = false;
          return;
        }
      }
    }
  
    if(!window.confirm(`Are you sure you want to permanently delete ${checkedFiles.size} items from your disk and database? This action cannot be undone.`)) {
      window.wabs_action_in_progress = false;
      return;
    }
    setActionInProgress(true);
    try {
      const checkedPaths = Array.from(checkedFiles);
      await axios.post(`${API}/delete-files`, { paths: checkedPaths });
      invalidateViewCache();
      setFiles(prev => prev.filter(f => {
        if (checkedFiles.has(f.path)) return false;
        const isDescendant = checkedPaths.some(p => {
          if (p.startsWith('virtual_folder:')) return false;
          const normParent = p.replace(/\\/g, '/').toLowerCase();
          const normFile = f.path.replace(/\\/g, '/').toLowerCase();
          return normFile.startsWith(normParent + '/');
        });
        return !isDescendant;
      }));
      if (selected) {
        const isDeleted = checkedFiles.has(selected.path) || checkedPaths.some(p => {
          if (p.startsWith('virtual_folder:')) return false;
          const normParent = p.replace(/\\/g, '/').toLowerCase();
          const normFile = selected.path.replace(/\\/g, '/').toLowerCase();
          return normFile.startsWith(normParent + '/');
        });
        if (isDeleted) {
          setSelected(null);
        }
      }
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error deleting files: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
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
    if (window.wabs_action_in_progress) return;
    window.wabs_action_in_progress = true;
    try {
      const dest = await axios.get(`${API}/choose-path?mode=directory`);
      if (!dest.data || !dest.data.path) {
        window.wabs_action_in_progress = false;
        return;
      }
      setActionInProgress(true);
      const res = await axios.post(`${API}/copy-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
      invalidateViewCache();
      
      const copied = res.data.copied || 0;
      const failed = res.data.failed || 0;
      if (copied > 0 && failed > 0) {
        alert(`Successfully copied ${copied} file(s). ${failed} file(s) failed to copy (external drive disconnected or file not found).`);
      } else if (copied === 0 && failed > 0) {
        alert(`Failed to copy: none of the selected files could be found. Please check if your external drive is connected.`);
      } else {
        alert(`Successfully copied ${copied} files.`);
      }
      
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error copying files: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  // Moves checked files to a chosen destination directory, updating the index metadata paths.
  async function moveSelected() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))) {
      alert("Cannot move files while a background task or data operation is running. Please stop it first.");
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
      const res = await axios.post(`${API}/move-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
      invalidateViewCache();
      const updates = res.data.updates || {};
      setFiles(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
      setSearchCache(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
      
      const moved = res.data.moved || 0;
      const failed = res.data.failed || 0;
      if (moved > 0 && failed > 0) {
        alert(`Successfully moved ${moved} file(s). ${failed} file(s) failed to move (external drive disconnected or file not found).`);
      } else if (moved === 0 && failed > 0) {
        alert(`Failed to move: none of the selected files could be found. Please check if your external drive is connected.`);
      } else {
        alert(`Successfully moved ${moved} files.`);
      }
      
      setCheckedFiles(new Set());
    } catch(err) {
      alert('Error moving files: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  async function locateSelectedFile(type) {
    if (checkedFiles.size !== 1) return;
    const path = Array.from(checkedFiles)[0];
    let file = globalFileCache.current.get(path);
    if (!file) return;

    setFilterCategory('all');
    setSelected(file);
    setCheckedFiles(new Set([file.path]));

    const normalized = file.path.replace(/\\/g, '/');
    const lastSlash = normalized.lastIndexOf('/');
    let parentFolder = null;
    if (lastSlash !== -1) {
      parentFolder = normalized.substring(0, lastSlash);
    }

    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;

    if (type === 'tree') {
      let offsetVal = 0;
      try {
        const folderParam = parentFolder ? encodeURIComponent(parentFolder) : 'root';
        const offsetRes = await axios.get(`${API}/files/${file.id}/offset?category=all&sort_by=${sortBy}&sort_order=${sortOrder}&folder=${folderParam}`);
        offsetVal = offsetRes.data.offset || 0;
      } catch (err) {
        console.warn("Failed to fetch file offset in folder", err);
      }
      const targetStartOffset = Math.max(0, Math.floor(offsetVal / limit) * limit);

      try {
        const folderParam = parentFolder ? encodeURIComponent(parentFolder) : 'root';
        const url = `${API}/files?category=all&offset=${targetStartOffset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}&folder=${folderParam}`;
        const r = await axios.get(url);
        viewContexts.current.explorer_tree = {
          files: r.data,
          startOffset: targetStartOffset,
          offset: targetStartOffset + r.data.length,
          hasMore: r.data.length === limit,
          scrollTop: 0,
          filterCategory: 'all',
          sortBy: sortBy,
          sortOrder: sortOrder,
          activeFolderPath: parentFolder,
          virtualFolderId: null
        };

        setPendingLocatePath(file.path);
        setFiles(r.data);
        setOffset(targetStartOffset + r.data.length);
        setStartOffset(targetStartOffset);
        setHasMore(r.data.length === limit);
        suppressNextAutoLoad.current = true;
        setTimeout(() => {
          suppressNextAutoLoad.current = false;
        }, 100);
      } catch (err) {
        console.warn("Failed to pre-load tree files", err);
      }

      setPage('explorer');
      setViewType('tree');
      navigateToPhys(parentFolder);
    } else if (type === 'flat') {
      let offsetVal = 0;
      try {
        const offsetRes = await axios.get(`${API}/files/${file.id}/offset?category=all&sort_by=${sortBy}&sort_order=${sortOrder}`);
        offsetVal = offsetRes.data.offset || 0;
      } catch (err) {
        console.warn("Failed to fetch file offset", err);
      }
      const targetStartOffset = Math.max(0, Math.floor(offsetVal / limit) * limit);

      try {
        const url = `${API}/files?category=all&offset=${targetStartOffset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`;
        const r = await axios.get(url);
        viewContexts.current.explorer_flat = {
          files: r.data,
          startOffset: targetStartOffset,
          offset: targetStartOffset + r.data.length,
          hasMore: r.data.length === limit,
          scrollTop: 0,
          filterCategory: 'all',
          sortBy: sortBy,
          sortOrder: sortOrder,
          activeFolderPath: null,
          virtualFolderId: null
        };
        
        setPendingLocatePath(file.path);
        setFiles(r.data);
        setOffset(targetStartOffset + r.data.length);
        setStartOffset(targetStartOffset);
        setHasMore(r.data.length === limit);
        suppressNextAutoLoad.current = true;
        setTimeout(() => {
          suppressNextAutoLoad.current = false;
        }, 100);
      } catch (err) {
        console.warn("Failed to pre-load flat files", err);
      }

      setPage('explorer');
      setViewType('flat');
    } else if (type === 'virtual_folder') {
      try {
        const res = await axios.get(`${API}/files/${file.id}/virtual-folders`);
        const matchedFolders = res.data || [];
        if (matchedFolders.length === 0) {
          showToastMessage("File is not in any virtual folder.", null, 'error');
          return;
        }
        if (matchedFolders.length === 1) {
          await performLocateInFolder(matchedFolders[0], file);
        } else {
          setFileToLocate(file);
          setLocateFolderOptions(matchedFolders);
        }
      } catch (err) {
        console.warn("Failed to locate in virtual folder", err);
      }
    }
  }

  async function performLocateInFolder(targetFolder, fileObj = null) {
    const activeFile = fileObj || fileToLocate || selected;
    if (!activeFile) return;

    const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
    const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;

    let offsetVal = 0;
    const isRec = viewType === 'flat';
    try {
      const offsetRes = await axios.get(`${API}/files/${activeFile.id}/offset?category=all&sort_by=${sortBy}&sort_order=${sortOrder}&virtual_folder_id=${targetFolder.id}&recursive=${isRec}`);
      offsetVal = offsetRes.data.offset || 0;
    } catch (err) {
      console.warn("Failed to fetch virtual folder file offset", err);
    }
    const targetStartOffset = Math.max(0, Math.floor(offsetVal / limit) * limit);

    try {
      const url = `${API}/virtual-folders/${targetFolder.id}/files?category=all&offset=${targetStartOffset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}&recursive=${isRec}`;
      const r = await axios.get(url);
      const cacheKey = `virtual_folder_${viewType}`;
      viewContexts.current[cacheKey] = {
        files: r.data,
        startOffset: targetStartOffset,
        offset: targetStartOffset + r.data.length,
        hasMore: r.data.length === limit,
        scrollTop: 0,
        filterCategory: 'all',
        sortBy: sortBy,
        sortOrder: sortOrder,
        activeFolderPath: activeFolderPath,
        virtualFolderId: targetFolder.id
      };
      
      setFiles(r.data);
      setOffset(targetStartOffset + r.data.length);
      setStartOffset(targetStartOffset);
      setHasMore(r.data.length === limit);
      suppressNextAutoLoad.current = true;
      setTimeout(() => {
        suppressNextAutoLoad.current = false;
      }, 100);
    } catch (err) {
      console.warn("Failed to pre-load virtual folder files", err);
    }

    setPage('virtual_folder');
    setVirtualFolderId(targetFolder.id);
    setCurrentVirtualFolder(targetFolder);
    showToastMessage(`Located in virtual folder: ${targetFolder.name}`);
    setPendingLocatePath(activeFile.path);
    setLocateFolderOptions(null);
    setFileToLocate(null);
  }

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setShowSelectedOnly(false);
    setCheckedFiles(new Set());
    setSelected(null);

    if (val.startsWith('virtual_folder_')) {
      const vfId = parseInt(val.replace('virtual_folder_', ''), 10);
      const folder = (virtualFolders || []).find(f => f.id === vfId);
      setPage('virtual_folder');
      setVirtualFolderId(vfId);
      setCurrentVirtualFolder(folder);
    } else {
      setFilterCategory(val);
      
      if (val === 'duplicates') {
        setSortBy('size');
        setSortOrder('desc');
      }

      if (page === 'virtual_folder' && virtualFolderId) {
        // Keep in current virtual folder, page/virtualFolderId remains same
      } else {
        // Go to explorer/search
        setVirtualFolderId(null);
        setCurrentVirtualFolder(null);
        setPage('explorer');
      }
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

  async function exportVirtualFolders() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before exporting virtual folders to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    setActionInProgress(true);
    showToastMessage('Exporting virtual folders...');
    try {
      const r = await axios.get(`${API}/system/export-folders`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `wabs_virtual_folders_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
      URL.revokeObjectURL(url);
      showToastMessage('Virtual folders exported successfully.');
    } catch(err) {
      alert('Error exporting virtual folders: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  function importVirtualFolders() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before importing virtual folders to prevent database conflicts.");
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
        showToastMessage('Importing virtual folders...');
        try {
          const payload = JSON.parse(event.target.result);
          if (!Array.isArray(payload)) throw new Error("Invalid JSON format");
          await axios.post(`${API}/system/import-folders`, payload);
          showToastMessage('Virtual folders imported successfully.');
          loadVirtualFolders();
        } catch (err) {
          alert('Error importing virtual folders: ' + (err?.response?.data?.detail || err.message));
        } finally {
          window.wabs_action_in_progress = false;
          setActionInProgress(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  async function exportAllWabs() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before exporting WABS data to ensure data consistency.");
      return;
    }
    window.wabs_action_in_progress = true;
    setActionInProgress(true);
    showToastMessage('Exporting all WABS data...');
    try {
      const r = await axios.get(`${API}/system/export-all`);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `wabs_full_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();
      dlAnchorElem.remove();
      URL.revokeObjectURL(url);
      showToastMessage('All WABS data exported successfully.');
    } catch(err) {
      alert('Error exporting WABS data: ' + (err?.response?.data?.detail || err.message));
    } finally {
      window.wabs_action_in_progress = false;
      setActionInProgress(false);
    }
  }

  function importAllWabs() {
    if (window.wabs_action_in_progress) return;
    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
      alert("Please stop all background tasks before importing WABS data to prevent database conflicts.");
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
        showToastMessage('Importing all WABS data...');
        try {
          const payload = JSON.parse(event.target.result);
          if (typeof payload !== 'object' || Array.isArray(payload)) throw new Error("Invalid WABS backup JSON format");
          const r = await axios.post(`${API}/system/import-all`, payload);
          showToastMessage(`Successfully imported: ${r.data.imported_people} profiles, ${r.data.imported_faces} faces, ${r.data.imported_folders} folders, ${r.data.imported_tags} file tags${r.data.config_imported ? ', and configuration settings' : ''}.`);
          loadVirtualFolders();
          if (window.loadPeople) window.loadPeople();
          if (r.data.config_imported) {
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } catch (err) {
          alert('Error importing WABS data: ' + (err?.response?.data?.detail || err.message));
        } finally {
          window.wabs_action_in_progress = false;
          setActionInProgress(false);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  useEffect(() => {
    syncActiveDate(document.querySelector('.content'));
  }, [groupedFiles, page]);

  return {
    files, setFiles, directories, setDirs, loadDirectories, selected, setSelected, searchCache, setSearchCache, offset, setOffset,
    startOffset, setStartOffset, hasMore, setHasMore, loadingMore, setLoadingMore,
    loadingPrevious, setLoadingPrevious, sortBy, setSortBy, sortOrder, setSortOrder,
    filterCategory, setFilterCategory, viewMode, setViewMode, checkedFiles, setCheckedFiles,
    globalFileCache, pendingLocatePath, setPendingLocatePath, showSelectedOnly, setShowSelectedOnly, activeDate, setActiveDate,
    checkFileReadOnly, isSelectionReadOnly, loadFiles, doSearch, goToSearch, loadMore,
    loadPrevious, syncActiveDate, handleScroll, openFile, openContainingFolder, handleItemClick,
    toggleCheck, selectAll, selectVerifiedDuplicates, deleteSelected, openSelected,
    copySelected, moveSelected, locateSelectedFile, handleFilterChange,
    handleCategoryClick, sortedFiles, groupedFiles, getImplicitSelection,

    // Physical Navigation
    activeFolderPath, setActiveFolderPath, physHistory, setPhysHistory, physHistoryIdx, setPhysHistoryIdx,
    navigateToPhys, goBackPhys, goForwardPhys, goUpPhys,
    isPhys, canGoBack, canGoForward, canGoUp, handleBack, handleForward, handleUp,
    
    // Virtual Folder exports
    virtualFolderId, setVirtualFolderId, currentVirtualFolder, setCurrentVirtualFolder,
    virtualFolders, setVirtualFolders, loadVirtualFolders, createVirtualFolder,
    deleteVirtualFolder, renameVirtualFolder, updateVirtualFolderQuery,
    addFilesToVirtualFolder, removeFilesFromVirtualFolder, handleOpenFolder,
    virtualFolderCounts, fetchFolderCount,
    virtualFolderViewType, setVirtualFolderViewType,
    folderTreeScrollTopRef, timelineScrollTopRef, invalidateViewCache,
    loadAllFolderCounts, loadingAllCounts,
    locateFolderOptions, setLocateFolderOptions,
    fileToLocate, setFileToLocate,
    performLocateInFolder,
    
    // Data Management
    exportVirtualFolders, importVirtualFolders, exportAllWabs, importAllWabs
  };
}