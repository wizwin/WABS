import React, { useRef, useEffect } from 'react';
import axios from 'axios';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import PlaceIcon from '@mui/icons-material/Place';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { ActionButton } from '../components/ui/ActionButton';
import { TimelineItem } from '../components/ui/TimelineItem';
import { ProgressBar } from '../components/ui/ProgressBar';
import { DateGroup } from '../components/ui/DateGroup';

import { API, formatSize, parseFileDate, dateFormatter } from '../States';

export default function Explorer(props) {
  const { 
    page, showTimeline, timelineWidth, timelineItems, activeDate, settings,
    fullTimelineData, sortOrder, filterCategory, sortBy, setFiles, setOffset,
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
    setLoadingMore, handleScroll
  } = props;

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
        (page==='explorer' || page==='search') &&
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
        <select value={filterCategory} onChange={handleFilterChange}>
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
        </select>

        <label style={{marginLeft:'10px'}}>Sort by:</label>
        <select value={sortBy} onChange={(e)=>{
            setSortBy(e.target.value);
            if(page === 'explorer') loadFiles(0, false, filterCategory, e.target.value, sortOrder);
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
            if(page === 'explorer') loadFiles(0, false, filterCategory, sortBy, newOrder);
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
            <ActionButton disabled={actionInProgress} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={verifyDuplicates}>
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
                <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={moveSelected}>Move</ActionButton>
                <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }} onClick={deleteSelected}>Delete</ActionButton>
                </>
            )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingPerson ? '#334155' : undefined }} onClick={() => { setIsTaggingPerson(!isTaggingPerson); setIsTaggingObject(false); loadPeople(); }}>Tag Person</ActionButton>
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
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#10b981' }} onClick={() => personTagInput && assignPhotosToPerson(personTagInput, Array.from(checkedFiles))}>Add</ActionButton>
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => {
                    if (!personTagInput) return;
                    const fileIds = Array.from(checkedFiles).map(path => globalFileCache.current.get(path)?.id).filter(id => id);
                    removePersonPhotosBulk(personTagInput, fileIds);
                }}>Remove</ActionButton>
                </div>
            )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton disabled={actionInProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running} className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingObject ? '#334155' : undefined }} onClick={() => { setIsTaggingObject(!isTaggingObject); setIsTaggingPerson(false); }} title={(actionInProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) ? "Stop all background tasks to manage tags" : ""}>Manage Tags</ActionButton>
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
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#10b981' }} onClick={() => addTagsToSelected(tagInput)}>Add</ActionButton>
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => removeTagsFromSelected(tagInput)}>Remove</ActionButton>
                </div>
            )}
            </div>

            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</ActionButton>
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
            {selected.tags.split(' ').filter(t => t.trim()).map(tag => {
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

        </div>
        }
    </>
  );
}