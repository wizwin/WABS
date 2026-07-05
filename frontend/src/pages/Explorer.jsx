import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import AddToFolderModal from '../components/ui/AddToFolderModal';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import PlaceIcon from '@mui/icons-material/Place';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import AddIcon from '@mui/icons-material/Add';
import { FOLDER_COLORS, FOLDER_ICONS, ICON_MAP, getFolderStyleAndIcon } from './VirtualFolders';

import { ActionButton } from '../components/ui/ActionButton';
import { TimelineItem } from '../components/ui/TimelineItem';
import { ProgressBar } from '../components/ui/ProgressBar';
import { DateGroup } from '../components/ui/DateGroup';

import { API, formatSize, parseFileDate, dateFormatter } from '../States';

export default function Explorer(props) {
  const { 
    page, showTimeline, timelineWidth, timelineItems, activeDate, settings,
    fullTimelineData, sortOrder, filterCategory, setFilterCategory, sortBy, setFiles, setOffset,
    setStartOffset, setHasMore, query, setSearchCache, isResizing, setIsResizing,
    checkedFiles, sortedFiles, selectAll, selectVerifiedDuplicates, handleFilterChange,
    setSortBy, loadFiles, doSearch, setSortOrder, indexer, actionInProgress,
    stopVerifyDuplicates, verifyDuplicates, setViewMode, viewMode, showSelectedOnly,
    setShowSelectedOnly, openSelected, locateSelectedFileInExplorer, copySelected,
    isSelectionReadOnly, moveSelected, deleteSelected, isTaggingPerson, setIsTaggingPerson,
    isTaggingObject, setIsTaggingObject, loadPeople, people, setPersonTagInput, personTagInput,
    sortedNamedPeopleDropdown, assignPhotosToPerson, removePersonPhotosBulk,
    globalFileCache, objectTags, tagInput, setTagInput, addTagsToSelected,
    removeTagsFromSelected, setCheckedFiles, startOffset, loadingPrevious, groupedFiles,
    toggleCheck, handleItemClick, openContainingFolder, setSelected, openFile,
    renderThumb, checkFileReadOnly, hasMore, loadingMore, showDetails, detailsWidth,
    selected, getPersonThumbUrl, currentPerson, personPreviewPhotos, renderMetadata,
    setLoadingMore, handleScroll, dataOpProgress, showToastMessage,
    
    // Virtual Folder props
    virtualFolderId, currentVirtualFolder, virtualFolders, createVirtualFolder,
    deleteVirtualFolder, renameVirtualFolder, updateVirtualFolderQuery,
    addFilesToVirtualFolder, removeFilesFromVirtualFolder,
    setVirtualFolderId, setCurrentVirtualFolder, setPage
  } = props;

  const [isAddToFolderOpen, setIsAddToFolderOpen] = useState(false);
  const [queryInput, setQueryInput] = useState('');
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    initialValue: '',
    placeholder: 'Folder Name',
    onConfirm: null
  });
  const [modalInputValue, setModalInputValue] = useState('');
  const [modalError, setModalError] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [selectedIcon, setSelectedIcon] = useState('folder');

  const handleModalConfirm = () => {
    const val = modalInputValue.trim();
    if (!val) {
      setModalError('Folder name cannot be empty.');
      return;
    }
    modalConfig.onConfirm(val, selectedColor, selectedIcon);
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    if (currentVirtualFolder) {
      setQueryInput(currentVirtualFolder.query || '');
    }
  }, [currentVirtualFolder?.id]);

  const getBreadcrumbs = () => {
    if (!currentVirtualFolder || !virtualFolders) return [];
    const trail = [currentVirtualFolder];
    let current = currentVirtualFolder;
    while (current.parent_id) {
      const parent = (virtualFolders || []).find(f => f.id === current.parent_id);
      if (parent) {
        trail.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    return trail;
  };

  const handleOpenFolder = (folder) => {
    setVirtualFolderId(folder.id);
    setCurrentVirtualFolder(folder);
    setFilterCategory('all');
    loadFiles(0, false, 'all', sortBy, sortOrder, 'virtual_folder', folder.id);
  };

  const loadFilesAbortController = useRef(null);
  const searchAbortController = useRef(null);
  const loadingMoreRef = useRef(false);

  const lastDuplicatesUpdateRef = useRef(indexer?.duplicates_status_changed_at);

  // Monitor the backend indexer state for changes to duplicate mappings
  useEffect(() => {
    const currentUpdate = indexer?.duplicates_status_changed_at;
    if (currentUpdate && currentUpdate !== lastDuplicatesUpdateRef.current) {
      lastDuplicatesUpdateRef.current = currentUpdate;
      
      // Refresh the duplicates list automatically if we are currently viewing duplicates
      if (filterCategory === 'duplicates' && loadFiles) {
        loadFiles(0, false, filterCategory, sortBy, sortOrder);
      }
    }
  }, [indexer?.duplicates_status_changed_at, filterCategory, sortBy, sortOrder, loadFiles]);

  return (
    <>
        {
        (page==='explorer' || page==='search' || page==='virtual_folder') &&
        <div className='explorer'>

        {showTimeline && (
        <>
        <div className='timeline' style={{ width: timelineWidth, position: 'relative' }}>
        {timelineItems.length > 0 && (
            <ActionButton
            className="btn btn-secondary"
            onClick={() => {
                document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' });
                document.querySelector('.timeline')?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ margin: '8px auto', padding: '4px 12px', width: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid #334155', color: '#94a3b8', position: 'sticky', top: '8px', zIndex: 10, borderRadius: '16px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}
            title="Jump to Top"
            >
            <ArrowUpwardIcon style={{ fontSize: '16px' }} /> Top
            </ActionButton>
        )}
        {timelineItems.map(dateKey => (
            <TimelineItem
            key={dateKey}
            dateKey={dateKey}
            isActiveDate={activeDate === dateKey}
            onClick={() => {
                const el = document.getElementById(`date-group-${dateKey}`);
                if (el) {
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
                } else {
                const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
                if (showFull) {
                    const tData = fullTimelineData.find(t => t.key === dateKey);
                    if (tData) {
                        if (page === 'explorer') {
                            const targetOffset = sortOrder === 'asc' ? tData.offsetAsc : tData.offsetDesc;
                            const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
                            const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
                            
                            if (loadFilesAbortController.current) loadFilesAbortController.current.abort();
                            loadFilesAbortController.current = new AbortController();
                            
                            setLoadingMore(true);
                            loadingMoreRef.current = true;
                            axios.get(`${API}/files?category=${filterCategory}&offset=${targetOffset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`, {
                            signal: loadFilesAbortController.current.signal
                            }).then(res => {
                            setFiles(res.data);
                            setOffset(targetOffset + res.data.length);
                            setStartOffset(targetOffset);
                            setHasMore(res.data.length === limit);
                            setLoadingMore(false);
                            loadingMoreRef.current = false;
                            setTimeout(() => document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 100);
                            }).catch(err => {
                            if (!axios.isCancel(err)) {
                                setLoadingMore(false);
                                loadingMoreRef.current = false;
                            }
                            });
                        } else if (page === 'search') {
                            const targetOffset = sortOrder === 'asc' ? tData.offsetAsc : tData.offsetDesc;
                            const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
                            const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
                            
                            if (searchAbortController.current) searchAbortController.current.abort();
                            searchAbortController.current = new AbortController();
                            setLoadingMore(true);
                            loadingMoreRef.current = true;
                            const safeQuery = query.replace(/,/g, ' ');
                            axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${filterCategory}&offset=${targetOffset}&limit=${limit}&sort_by=${sortBy}&sort_order=${sortOrder}`, {
                            signal: searchAbortController.current.signal
                            }).then(res => {
                            setFiles(res.data);
                            setSearchCache(res.data);
                            setOffset(targetOffset + res.data.length);
                            setStartOffset(targetOffset);
                            setHasMore(res.data.length === limit);
                            setLoadingMore(false);
                            loadingMoreRef.current = false;
                            setTimeout(() => document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 100);
                            }).catch(err => {
                            if (!axios.isCancel(err)) {
                                setLoadingMore(false);
                                loadingMoreRef.current = false;
                            }
                            });
                        }
                    }
                }
                }
            }}
            />
        ))}
        {timelineItems.length > 0 && (
            <ActionButton
            className="btn btn-secondary"
            onClick={() => {
                const content = document.querySelector('.content');
                content?.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
                const timeline = document.querySelector('.timeline');
                timeline?.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
            }}
            style={{ margin: '8px auto', padding: '4px 12px', width: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid #334155', color: '#94a3b8', position: 'sticky', bottom: '8px', zIndex: 10, borderRadius: '16px', fontSize: '12px', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.2)' }}
            title="Jump to Bottom"
            >
            <ArrowDownwardIcon style={{ fontSize: '16px' }} /> Bottom
            </ActionButton>
        )}
        </div>
        <div className={`resizer ${isResizing === 'timeline' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('timeline'); }} />
        </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
        {page === 'virtual_folder' && currentVirtualFolder && (
          <div style={{ padding: '18px 18px 0 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span 
                style={{ cursor: 'pointer', color: '#38bdf8', fontWeight: 'bold' }} 
                onClick={() => setPage('virtual_folders')}
              >
                Virtual Folders
              </span>
              <span style={{ color: '#475569', fontWeight: 'bold' }}>/</span>
              {getBreadcrumbs().map((b, index, arr) => {
                const isLast = index === arr.length - 1;
                return (
                  <React.Fragment key={b.id}>
                    <span 
                      style={{ 
                        color: isLast ? '#f8fafc' : '#94a3b8', 
                        fontWeight: isLast ? 'bold' : 'normal',
                        cursor: isLast ? 'default' : 'pointer',
                        textDecoration: isLast ? 'none' : 'underline'
                      }}
                      onClick={() => { if (!isLast) handleOpenFolder(b); }}
                    >
                      {b.name}
                    </span>
                    {!isLast && <span style={{ color: '#475569', fontWeight: 'bold' }}>/</span>}
                  </React.Fragment>
                );
              })}
            </div>
            {(() => {
              const { color, iconKey } = getFolderStyleAndIcon(currentVirtualFolder);
              const FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <FolderIconComponent style={{ color: color, fontSize: '28px' }} />
                  <h2 style={{ margin: 0, fontSize: '22px', color: '#f8fafc', fontWeight: '600' }}>
                    {currentVirtualFolder.name}
                  </h2>
                  <span style={{ 
                    fontSize: '12px', 
                    background: `${color}1a`, 
                    color: color, 
                    padding: '4px 10px', 
                    borderRadius: '12px',
                    border: `1px solid ${color}4a`,
                    fontWeight: '600'
                  }}>
                    Virtual Folder
                  </span>
                </div>
              );
            })()}

              <div style={{ display: 'flex', gap: '6px' }}>
                <ActionButton 
                  className="btn btn-secondary" 
                  disabled={indexer && indexer.export_running}
                  style={{ padding: '4px 10px', fontSize: '13px' }} 
                  onClick={() => {
                    const { color, iconKey } = getFolderStyleAndIcon(currentVirtualFolder);
                    setSelectedColor(color);
                    setSelectedIcon(iconKey);
                    setModalConfig({
                      isOpen: true,
                      title: `Edit "${currentVirtualFolder.name}"`,
                      initialValue: currentVirtualFolder.name,
                      placeholder: 'New Name',
                      onConfirm: (name, colorVal, iconVal) => {
                        const meta = JSON.stringify({ color: colorVal, icon: iconVal });
                        renameVirtualFolder(currentVirtualFolder.id, name, meta);
                      }
                    });
                    setModalInputValue(currentVirtualFolder.name);
                    setModalError('');
                  }}
                >
                  Rename
                </ActionButton>
                <ActionButton 
                  className="btn btn-secondary" 
                  disabled={indexer && indexer.export_running}
                  style={{ padding: '4px 10px', fontSize: '13px', background: '#ef44442a', borderColor: '#ef44443a', color: '#f87171' }} 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this virtual folder? This deletes the folder but does NOT delete files on disk.")) {
                      deleteVirtualFolder(currentVirtualFolder.id);
                    }
                  }}
                >
                  Delete
                </ActionButton>
                <ActionButton 
                  className="btn btn-secondary" 
                  disabled={indexer && indexer.export_running}
                  style={{ padding: '4px 10px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white' }} 
                  onClick={async () => {
                    try {
                      const chooseRes = await axios.get(`${API}/choose-path?mode=directory`);
                      const targetPath = chooseRes.data?.path;
                      if (!targetPath) return; // User cancelled
                      
                      showToastMessage("Exporting folder...");
                      const r = await axios.post(`${API}/virtual-folders/${currentVirtualFolder.id}/export`, { target_path: targetPath.trim() });
                      showToastMessage(r.data.message || "Folder exported successfully!");
                    } catch (err) {
                      alert("Export failed: " + (err.response?.data?.detail || err.message));
                      showToastMessage("Export failed.");
                    }
                  }}
                >
                  Export to Drive
                </ActionButton>
              </div>

              {indexer && indexer.export_running && indexer.export_folder_id === currentVirtualFolder.id && (
                <div style={{ margin: '12px 0', padding: '12px 16px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#f8fafc', fontWeight: 'bold', marginBottom: '6px' }}>
                    <span>Exporting Virtual Folder...</span>
                    <span style={{ color: '#94a3b8' }}>{indexer.export_current_file || ''}</span>
                  </div>
                  <ProgressBar current={indexer.export_current} total={indexer.export_total} color="#10b981" />
                </div>
              )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#1e293b', padding: '12px', borderRadius: '12px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Rules / Query:</span>
                <input 
                  type="text" 
                  value={queryInput} 
                  onChange={(e) => setQueryInput(e.target.value)}
                  onBlur={() => {
                    if (queryInput !== (currentVirtualFolder.query || '')) {
                      updateVirtualFolderQuery(currentVirtualFolder.id, queryInput);
                      setTimeout(() => loadFiles(0, false, filterCategory), 100);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Enter automatic filter rules (e.g. type:photo camera:iPhone object:car), or leave blank for manual-only."
                  style={{ 
                    flex: 1, 
                    background: '#0f172a', 
                    border: '1px solid #334155', 
                    color: '#f8fafc', 
                    padding: '6px 10px', 
                    borderRadius: '6px', 
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', paddingLeft: '94px' }}>
                Files matching these rules will automatically appear here. You can also manually link/unlink files via the bulk actions.
              </div>
            </div>
          </div>
        )}
        <div className='sort-options' style={{ padding: '18px 18px 10px 18px', margin: 0, borderBottom: checkedFiles.size > 0 ? 'none' : '1px solid #1f2937' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '10px', cursor: 'pointer', fontWeight: '500' }}>
            <input 
            type="checkbox" 
            checked={checkedFiles.size > 0 && sortedFiles.length > 0 && sortedFiles.every(f => checkedFiles.has(f.path))} 
            onChange={selectAll} 
            />
            Select All
        </label>

        {filterCategory === 'duplicates' && (
            <ActionButton
            className="btn btn-secondary"
            style={{ marginRight: '10px', padding: '4px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={selectVerifiedDuplicates}
            >
            <CheckCircleIcon fontSize="small" style={{ color: '#3b82f6' }} />
            Select Verified Copies
            </ActionButton>
        )}

        <label>Filter:</label>
        <select value={page === 'virtual_folder' && virtualFolderId ? `virtual_folder_${virtualFolderId}` : filterCategory} onChange={handleFilterChange}>
            <option value='all'>All Files</option>
            <option value='photo'>Photos</option>
            <option value='video'>Videos</option>
            <option value='audio'>Audio</option>
            <option value='document'>Documents</option>
            <option value='ebook'>eBooks</option>
            <option value='code'>Code / Scripts</option>
            <option value='font'>Fonts</option>
            <option value='database'>Databases</option>
            <option value='compressed'>Compressed</option>
            <option value='installer'>Installers</option>
            <option value='binary'>Binary Files</option>
            <option value='other'>Others</option>
            <option value='duplicates'>Duplicates</option>
            <option value='searchable_documents'>Searchable Docs</option>
            <option value='untagged'>Untagged Media</option>
            {virtualFolders && virtualFolders.filter(vf => !vf.parent_id).length > 0 && (
              <>
                <option disabled>── Virtual Folders ──</option>
                {virtualFolders.filter(vf => !vf.parent_id).map(vf => (
                  <option key={vf.id} value={`virtual_folder_${vf.id}`}>
                    📁 {vf.name}
                  </option>
                ))}
              </>
            )}
        </select>

        <label style={{marginLeft:'10px'}}>Sort by:</label>
        <select value={sortBy} onChange={(e)=>{
            setSortBy(e.target.value);
            if(page === 'explorer' || page === 'virtual_folder') loadFiles(0, false, filterCategory, e.target.value, sortOrder);
            else if(page === 'search') doSearch(query, filterCategory, e.target.value, sortOrder);
        }}>
            <option value='date'>Date</option>
            <option value='size'>Size</option>
            <option value='filename'>Filename</option>
            <option value='extension'>Extension</option>
        </select>
        <ActionButton className="" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={()=>{
            const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
            setSortOrder(newOrder);
            if(page === 'explorer' || page === 'virtual_folder') loadFiles(0, false, filterCategory, sortBy, newOrder);
            else if(page === 'search') doSearch(query, filterCategory, sortBy, newOrder);
        }}>
            {sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </ActionButton>

        {filterCategory === 'duplicates' && (
            indexer.hasher_running ? (
            <ActionButton disabled={actionInProgress || indexer.hasher_stopped} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', justifyContent: 'center' }} onClick={stopVerifyDuplicates}>
                <CloseIcon fontSize="small" />
                {indexer.hasher_stopped ? 'Stopping...' : 'Stop Verification'}
            </ActionButton>
            ) : (
            <ActionButton disabled={actionInProgress || !!dataOpProgress} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={verifyDuplicates}>
                <CheckCircleIcon fontSize="small" style={{ color: '#10b981' }} />
                Verify Hashes
            </ActionButton>
            )
        )}

        <div style={{ flex: 1 }}></div>

        <div style={{ display: 'flex', gap: '4px', background: '#111827', padding: '4px', borderRadius: '8px' }}>
            <ActionButton 
            className=""
            onClick={() => setViewMode('grid')} 
            style={{ padding: '6px', background: viewMode === 'grid' ? '#3b82f6' : 'transparent', color: viewMode === 'grid' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
            >
            <GridViewIcon fontSize="small" />
            </ActionButton>
            <ActionButton 
            className=""
            onClick={() => setViewMode('list')} 
            style={{ padding: '6px', background: viewMode === 'list' ? '#3b82f6' : 'transparent', color: viewMode === 'list' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
            >
            <ViewListIcon fontSize="small" />
            </ActionButton>
        </div>
        </div>

        {filterCategory === 'duplicates' && indexer.hasher_running && (
        <div style={{ margin: '10px 18px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Duplicate Verification Progress</span>
            <ProgressBar current={indexer.hasher_current} total={indexer.hasher_total} color="#10b981" />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.hasher_current_file || ''}</div>
        </div>
        )}

        {checkedFiles.size > 0 && (
        <div style={{ padding: '10px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto', whiteSpace: 'nowrap' }}>{showSelectedOnly ? `Showing ${checkedFiles.size} selected file(s)` : `${checkedFiles.size} file(s) selected`}</span>
            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', borderColor: showSelectedOnly ? '#3b82f6' : undefined, color: showSelectedOnly ? '#38bdf8' : undefined }} onClick={() => setShowSelectedOnly(!showSelectedOnly)}>{showSelectedOnly ? 'Show All Files' : 'Show Selected Only'}</ActionButton>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={openSelected}>Open</ActionButton>
            {checkedFiles.size === 1 && (
                <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={locateSelectedFileInExplorer}>
                <PlaceIcon fontSize="small" /> Locate in Explorer
                </ActionButton>
            )}
            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={copySelected}>Copy</ActionButton>
            {!isSelectionReadOnly && (
                <>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={moveSelected}>Move</ActionButton>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }} onClick={deleteSelected}>Delete</ActionButton>
                </>
            )}
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
              <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setIsAddToFolderOpen(true)}>Add to Folder</ActionButton>
              {page === 'virtual_folder' && currentVirtualFolder && (
                <ActionButton 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', background: '#ef44442a', borderColor: '#ef44443a', color: '#f87171' }} 
                  onClick={() => {
                    const fileIds = Array.from(checkedFiles).map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
                    if (fileIds.length > 0) {
                      removeFilesFromVirtualFolder(currentVirtualFolder.id, fileIds);
                    }
                  }}
                >
                  Remove from Folder
                </ActionButton>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingPerson ? '#334155' : undefined }} onClick={() => { setIsTaggingPerson(!isTaggingPerson); setIsTaggingObject(false); loadPeople(); }}>Tag Person</ActionButton>
            {isTaggingPerson && Array.isArray(people) && (
                <div style={{ display: 'flex', gap: '4px' }}>
                <select 
                    onChange={(e) => setPersonTagInput(e.target.value)} 
                    style={{ padding: '6px 12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none' }}
                    value={personTagInput}
                >
                    <option value="" disabled>Select person...</option>
                    {sortedNamedPeopleDropdown.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#10b981' }} onClick={() => personTagInput && assignPhotosToPerson(personTagInput, Array.from(checkedFiles))}>Add</ActionButton>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => {
                    if (!personTagInput) return;
                    const fileIds = Array.from(checkedFiles).map(path => globalFileCache.current.get(path)?.id).filter(id => id);
                    removePersonPhotosBulk(personTagInput, fileIds);
                }}>Remove</ActionButton>
                </div>
            )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingObject ? '#334155' : undefined }} onClick={() => { setIsTaggingObject(!isTaggingObject); setIsTaggingPerson(false); }} title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to manage tags" : ""}>Manage Tags</ActionButton>
            {isTaggingObject && (
                <div style={{ display: 'flex', gap: '4px' }}>
                <input 
                    type="text" 
                    list="existing-tags"
                    placeholder="tag1, tag2..." 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    style={{ padding: '6px 12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none', width: '150px' }}
                    onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        addTagsToSelected(tagInput);
                    }
                    }}
                />
                <datalist id="existing-tags">
                    {objectTags.map(tag => (
                    <option key={tag} value={tag.replace('object:', '')} />
                    ))}
                </datalist>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#10b981' }} onClick={() => addTagsToSelected(tagInput)}>Add</ActionButton>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || (indexer && (indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)))} className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => removeTagsFromSelected(tagInput)}>Remove</ActionButton>
                </div>
            )}
            </div>

            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</ActionButton>
        </div>
        )}

            {page === 'search' && virtualFolderId && currentVirtualFolder && (
              <div style={{ padding: '12px 18px', background: '#3b82f61a', borderBottom: '1px solid #3b82f63b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', color: '#38bdf8', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FolderIcon style={{ color: currentVirtualFolder.metadata?.color || '#3b82f6', fontSize: '18px' }} />
                  Search restricted to: <strong>{currentVirtualFolder.name}</strong>
                </span>
                <ActionButton 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '13px', borderColor: '#3b82f6', color: '#38bdf8' }}
                  onClick={() => {
                    setVirtualFolderId(null);
                    setCurrentVirtualFolder(null);
                    doSearch(query, filterCategory, sortBy, sortOrder, null);
                  }}
                >
                  Search Everywhere
                </ActionButton>
              </div>
            )}

            {page === 'search' && (
            <div style={{ padding: '10px 18px', background: '#0f172a', borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <h3 style={{ marginTop: '8px', marginBottom: '16px', fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Smart Searches</h3>
                <style>
                {`
                    .smart-search-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                    .smart-search-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
                    .smart-search-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
                    .smart-search-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
                `}
                </style>
                        <div className="smart-search-scrollbar" style={{display:'flex', gap:'10px', padding: '4px 4px 8px 4px', overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent', width: '100%', boxSizing: 'border-box'}}>
                {(settings.smart_searches || []).map(search => (
                    <ActionButton key={search.id} className="btn btn-secondary" style={{ padding: '6px 12px', background: '#1e293b', color: '#38bdf8', borderColor: '#3b82f6', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => doSearch(search.query)}>
                    {search.name}
                    </ActionButton>
                ))}
                {(!settings.smart_searches || settings.smart_searches.length === 0) && (
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px', whiteSpace: 'nowrap' }}>No smart searches configured. Add some in the Settings page!</p>
                )}
                </div>
            </div>
            )}

        <div className='content' onScroll={handleScroll} style={{ paddingTop: '18px' }}>
        {(() => {
          const currentSubfolders = (virtualFolders || []).filter(f => f.parent_id === virtualFolderId);
          if (page === 'virtual_folder') {
            return (
              <div style={{ padding: '0 20px', marginBottom: '24px' }}>
                <style>
                  {`
                    .subfolder-card-hover {
                      transition: all 0.2s ease-in-out;
                    }
                    .subfolder-card-hover:hover {
                      border-color: #3b82f6 !important;
                      background-color: #1e293b !important;
                      transform: translateY(-2px);
                    }
                  `}
                </style>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold' }}>Subfolders</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {currentSubfolders.map(sub => (
                    <div 
                      key={sub.id} 
                      onClick={() => handleOpenFolder(sub)}
                      style={{
                        background: '#111827',
                        border: '1px solid #24324a',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                      className="subfolder-card-hover"
                    >
                      <FolderIcon style={{ color: sub.query ? '#a855f7' : '#3b82f6', fontSize: '20px' }} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }} title={sub.name}>{sub.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{sub.file_count || 0} file{sub.file_count !== 1 ? 's' : ''}</span>
                          {sub.query && (
                            <>
                              <span style={{ color: '#475569' }}>•</span>
                              <span style={{ color: '#c084fc', fontWeight: 'bold' }}>Dynamic</span>
                            </>
                          )}
                        </div>
                        {sub.query && (
                          <div style={{ fontSize: '10.5px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' }} title={`Rules: ${sub.query}`}>
                            Rules: {sub.query}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* + New Subfolder button */}
                  <div 
                    onClick={() => {
                      setModalConfig({
                        isOpen: true,
                        title: `Create Subfolder under "${currentVirtualFolder?.name}"`,
                        initialValue: '',
                        placeholder: 'Subfolder Name',
                        onConfirm: (name) => createVirtualFolder(name, virtualFolderId, false, null)
                      });
                      setModalInputValue('');
                      setModalError('');
                    }}
                    style={{
                      background: 'transparent',
                      border: '2px dashed #24324a',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      justifyContent: 'center',
                      color: '#38bdf8',
                      fontWeight: 'bold',
                      fontSize: '13px'
                    }}
                    className="subfolder-card-hover"
                  >
                    <AddIcon style={{ fontSize: '18px' }} />
                    New Subfolder
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {startOffset > 0 && (
        <div style={{ textAlign: 'center', paddingTop: '150px', paddingBottom: '20px', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '200px', boxSizing: 'border-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingPrevious ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading previous files...</> : 'Scroll up to load previous files...'}
            </div>
        </div>
        )}

        {
        Array.from(groupedFiles.entries()).map(([dateKey, filesGroup]) => (
        <DateGroup
        key={dateKey}
        dateKey={dateKey}
        filesGroup={filesGroup}
        viewMode={viewMode}
        checkedFiles={checkedFiles}
        toggleCheck={toggleCheck}
        handleItemClick={handleItemClick}
        openContainingFolder={openContainingFolder}
        setSelected={setSelected}
        openFile={openFile}
        renderThumb={renderThumb}
        filterCategory={filterCategory}
        indexer={indexer}
        checkFileReadOnly={checkFileReadOnly}
        />
        ))
        }
        {hasMore && !showSelectedOnly && (
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '24px', boxSizing: 'content-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingMore ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading more files...</> : 'Scroll down to load more files...'}
            </div>
        </div>
        )}
        {(!hasMore || showSelectedOnly) && sortedFiles.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', color: '#475569' }}>
            — End of results —
        </div>
        )}
        </div>
        </div>

        {showDetails && (
        <>
        <div className={`resizer ${isResizing === 'details' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('details'); }} />
        <div className='details' style={{ width: detailsWidth, overflowY: 'auto', maxHeight: '100%', display: 'flex', flexDirection: 'column'}}>

        <h3>Details</h3>

        {
        selected ?
        selected.is_person ? (
        <div>
        <img
        src={getPersonThumbUrl(selected)}
        style={{ width:'100%', borderRadius:'12px', marginBottom: '12px' }}
        key={`person-${selected.id}`}
        />
        <h2 style={{ wordBreak: 'break-word', marginTop: 0 }}>{selected.name}</h2>
        <p><b>Profile ID:</b> {selected.id}</p>
        {selected.similarity !== undefined && <p><b>Similarity:</b> {Math.round(selected.similarity * 100)}% Match</p>}
        <p><b>Face Count:</b> {selected.face_count} photos</p>
        <p style={{color: '#94a3b8', fontSize: '13px', marginTop: '16px', lineHeight: '1.5'}}>
        Merging will combine all {selected.face_count} photos from this profile into <b>{currentPerson?.name}</b>.
        </p>
        {personPreviewPhotos.length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f8fafc' }}><b>Sample Photos</b></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {personPreviewPhotos.map(photo => (
                <img 
                key={photo.path} 
                src={renderThumb(photo)} 
                        onError={(e) => { e.target.onerror = null; e.target.src = renderThumb({ ...photo, thumbnail: null }) }}
                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid #334155' }} 
                onClick={() => openFile(photo.path)}
                title={photo.filename}
                />
            ))}
            </div>
        </div>
        )}
        </div>
        ) : (
        <div>

        <img
        src={renderThumb(selected)}
        style={{
        width:'100%',
        borderRadius:'12px',
        cursor:'pointer'
        }}
        key={selected.path}
        onClick={()=>openFile(selected.path)}
                onError={(e) => { e.target.onerror = null; e.target.src = renderThumb({ ...selected, thumbnail: null }) }}
        />

        <h2>{selected.filename}</h2>

        <p><b>Path:</b> {selected.path}</p>

        <p><b>Category:</b> {selected.category}</p>

        <p><b>Extension:</b> {selected.extension || 'unknown'}</p>

        <p><b>Size:</b> {formatSize(selected.size)}</p>

        <p><b>Modified:</b> {selected.modified}</p>

        {selected.metadata?.gps && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <b>Location:</b>
            <ActionButton 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#3b82f6', color: '#3b82f6' }}
            onClick={() => window.open(`https://www.google.com/maps?q=${selected.metadata.gps.latitude},${selected.metadata.gps.longitude}`, '_blank')}
            >
            <PlaceIcon fontSize="small" /> View on Map
            </ActionButton>
        </div>
        )}

        {selected.tags && (
        <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Detected Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selected.tags.split(',').filter(t => t.trim()).map(tag => {
                const isObj = tag.startsWith('object:');
                const isPerson = tag.startsWith('person:');
                const color = isObj ? '#38bdf8' : isPerson ? '#10b981' : '#cbd5e1';
                const bg = isObj ? '#3b82f64a' : isPerson ? '#10b9814a' : '#334155';
                const border = isObj ? '#3b82f6' : isPerson ? '#10b981' : '#475569';
                const label = tag.replace('object:', '').replace('person:', '').replace(/_/g, ' ');
                return (
                <span key={tag} style={{ background: bg, color: color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', border: `1px solid ${border}`, fontWeight: '500' }}>
                    {label}
                </span>
                );
            })}
            </div>
        </div>
        )}

        <h3>Metadata</h3>

        <p><b>File ID:</b> {selected.id}</p>
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'16px'}}>
        <ActionButton className="btn btn-secondary" onClick={()=>openFile(selected.path)}>Open File</ActionButton>
        <ActionButton className="btn btn-secondary" onClick={()=>openContainingFolder(selected.path)}>Open Containing Folder</ActionButton>
        </div>
        {renderMetadata(selected.metadata)}

        </div>
        ) : (
        <p>Select file or profile to preview.</p>
        )
        }

        </div>
        </>
        )}

        <AddToFolderModal
          isOpen={isAddToFolderOpen}
          onClose={() => setIsAddToFolderOpen(false)}
          selectedFiles={Array.from(checkedFiles)}
          virtualFolders={virtualFolders}
          createVirtualFolder={createVirtualFolder}
          addFilesToVirtualFolder={addFilesToVirtualFolder}
          globalFileCache={globalFileCache}
        />

        {modalConfig.isOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#f8fafc', fontWeight: 'bold' }}>
                {modalConfig.title}
              </h3>

              <input
                type="text"
                autoFocus
                placeholder={modalConfig.placeholder}
                value={modalInputValue}
                onChange={(e) => {
                  setModalInputValue(e.target.value);
                  if (e.target.value.trim()) setModalError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleModalConfirm();
                  } else if (e.key === 'Escape') {
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '16px'
                }}
              />

              {/* Custom Color Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>Folder Color</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {FOLDER_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: c,
                        border: selectedColor === c ? '2px solid #f8fafc' : '2px solid transparent',
                        cursor: 'pointer',
                        outline: 'none',
                        padding: 0,
                        boxShadow: selectedColor === c ? '0 0 8px ' + c : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Icon Selector */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}>Folder Icon</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {FOLDER_ICONS.map(i => {
                    const Icon = ICON_MAP[i.key] || FolderIcon;
                    const isSel = selectedIcon === i.key;
                    return (
                      <button
                        key={i.key}
                        type="button"
                        onClick={() => setSelectedIcon(i.key)}
                        title={i.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '6px',
                          borderRadius: '6px',
                          background: isSel ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                          border: isSel ? '1px solid #3b82f6' : '1px solid #334155',
                          color: isSel ? '#3b82f6' : '#94a3b8',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Icon style={{ fontSize: '16px' }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {modalError && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px', fontWeight: '500' }}>
                  {modalError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <ActionButton
                  className="btn btn-secondary"
                  onClick={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  className="btn btn-primary"
                  onClick={handleModalConfirm}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none' }}
                >
                  Save
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        </div>
        }
    </>
  );
}