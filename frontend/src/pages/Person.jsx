import React from 'react';
import axios from 'axios';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import FaceIcon from '@mui/icons-material/Face';
import ImageIcon from '@mui/icons-material/Image';
import PlaceIcon from '@mui/icons-material/Place';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { ActionButton } from '../components/ui/ActionButton';
import { TimelineItem } from '../components/ui/TimelineItem';
import { DateGroup } from '../components/ui/DateGroup';
import { PersonThumb } from '../components/ui/PersonThumb';
import { API, formatSize } from '../States';

export default function Person(props) {
  const { 
    page, setPage, showTimeline, timelineWidth, timelineItems, activeDate, settings,
    fullTimelineData, setLoadingMore, currentPerson, setPersonFiles, setOffset,
    setStartOffset, setHasMore, isResizing, setIsResizing, setCheckedFiles,
    setSelected, setSimilarUnknowns, loadPeople, autoSuggestThumbnail,
    isFindingSimilar, stopFindSimilarUnknowns, showSimilarPanel, similarUnknowns,
    setShowSimilarPanel, setSimilarUnknownsPage, setCheckedSimilar, similarityThreshold,
    setSimilarityThreshold, findSimilarUnknowns, visibleSimilar, similarUnknownsPage,
    checkedSimilar, getPersonThumbUrl, indexer, showToastMessage, openPersonPhotos,
    checkedFiles, globalFileCache, setPersonThumbnail, locateSelectedFileInExplorer,
    actionInProgress, isTaggingPerson, setIsTaggingPerson, movePhotosToPerson,
    sortedNamedPeopleDropdown, removePersonPhotosBulk, startOffset, loadingPrevious,
    personFiles, viewMode, groupedPersonFiles, toggleCheck, handleItemClick,
    openContainingFolder, openFile, renderThumb, checkFileReadOnly, hasMore,
    loadingMore, showDetails, detailsWidth, selected, personPreviewPhotos,
    renderMetadata, handleScroll, dataOpProgress
  } = props;

  const isTaskActive = indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running || actionInProgress || !!dataOpProgress;

  return (
    <>
        {
        page==='person_files' &&
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
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
                } else {
                const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
                if (showFull) {
                    const tData = fullTimelineData.find(t => t.key === dateKey);
                    if (tData) {
                        const targetOffset = tData.offsetDesc;
                        const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
                        const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
                        
                        setLoadingMore(true);
                        axios.get(`${API}/people/${currentPerson.id}/photos?offset=${targetOffset}&limit=${limit}`).then(res => {
                            setPersonFiles(res.data);
                            setOffset(targetOffset + res.data.length);
                            setStartOffset(targetOffset);
                            setHasMore(res.data.length === limit);
                            setLoadingMore(false);
                            setTimeout(() => document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 100);
                        }).catch(() => setLoadingMore(false));
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
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0}}>
        <div style={{padding: '18px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '16px'}}>
            <ActionButton className="btn btn-secondary" onClick={() => { 
            setPage('people'); 
            setCheckedFiles(new Set()); 
            setSelected(null);
            setSimilarUnknowns(null); 
            loadPeople(); 
            setTimeout(() => {
                const el = document.getElementById(`person-card-${currentPerson?.id}`);
                if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            }}>&larr; Back to People</ActionButton>
            <h2 style={{margin: 0}}>{currentPerson?.name}'s Photos</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ActionButton 
                    className="btn btn-secondary" 
                    disabled={isTaskActive}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', borderColor: '#059669' }}
                    onClick={() => autoSuggestThumbnail(currentPerson.id)}
                    title="Automatically analyze photos to pick the clearest and largest face for the cover."
                >
                    <ImageIcon fontSize="small" /> Auto-Pick Cover
                </ActionButton>
                {!currentPerson?.name?.startsWith('Unknown Person') && (
                    isFindingSimilar ? (
                        <ActionButton 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#b91c1c' }}
                            onClick={stopFindSimilarUnknowns}
                        >
                            <CloseIcon fontSize="small" /> Stop Searching
                        </ActionButton>
                    ) : (
                        showSimilarPanel || similarUnknowns ? (
                        <ActionButton 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#b91c1c' }}
                            onClick={() => {
                            setShowSimilarPanel(false);
                            setSimilarUnknowns(null);
                            setSimilarUnknownsPage(1);
                            setCheckedSimilar(new Set());
                            if (selected?.is_person) setSelected(null);
                            }}
                        >
                            <CloseIcon fontSize="small" /> Close Panel
                        </ActionButton>
                        ) : (
                        <ActionButton 
                            className="btn btn-secondary" 
                            disabled={isTaskActive}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', borderColor: '#3b82f6' }}
                            onClick={() => setShowSimilarPanel(true)}
                        >
                            <FaceIcon fontSize="small" /> Find Similar Unknowns
                        </ActionButton>
                        )
                    )
                )}
            </div>
        </div>

        {(showSimilarPanel || similarUnknowns) && (
        <div style={{ padding: '18px', borderBottom: '1px solid #1f2937', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>
                {similarUnknowns ? `Similar Unknown Profiles (${similarUnknowns.length})` : 'Find Similar Unknowns'}
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Similarity Threshold:</span>
                <input 
                type="range" 
                min="0.35" max="0.85" step="0.01" 
                    disabled={isFindingSimilar || isTaskActive}
                value={similarityThreshold} 
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))} 
                />
                <span style={{ color: '#38bdf8', fontSize: '14px', minWidth: '40px' }}>{Math.round(similarityThreshold * 100)}%</span>
                <ActionButton disabled={isFindingSimilar || isTaskActive} className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={() => findSimilarUnknowns(currentPerson.id, similarityThreshold)}>
                {similarUnknowns ? 'Update Search' : 'Start Search'}
                </ActionButton>
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => { setSimilarUnknowns(null); setSimilarUnknownsPage(1); setShowSimilarPanel(false); setCheckedSimilar(new Set()); if (selected?.is_person) setSelected(null); }}>Close</ActionButton>
            </div>
            </div>
            
            {isFindingSimilar ? (
            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#38bdf8' }}>
                <HourglassEmptyIcon style={{ fontSize: '32px', marginBottom: '8px', animation: 'spin 2s linear infinite' }} />
                <p style={{ margin: 0 }}>Searching for similar unknown profiles...</p>
            </div>
            ) : similarUnknowns ? (
            visibleSimilar.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No similar unknown profiles found at this threshold. Try lowering the slider.</p>
            ) : (
            <>
                {visibleSimilar.length > 500 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Page {similarUnknownsPage} of {Math.ceil(visibleSimilar.length / 500)} ({visibleSimilar.length} total)</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                    <ActionButton disabled={similarUnknownsPage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setSimilarUnknownsPage(prev => Math.max(1, prev - 1))}>Previous</ActionButton>
                    <ActionButton disabled={similarUnknownsPage >= Math.ceil(visibleSimilar.length / 500)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setSimilarUnknownsPage(prev => prev + 1)}>Next</ActionButton>
                    </div>
                </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                {visibleSimilar.slice((similarUnknownsPage - 1) * 500, similarUnknownsPage * 500).map(p => (
                    <div key={p.id} style={{background:'#111827', padding:'10px', borderRadius:'12px', border: checkedSimilar.has(p.id) ? '2px solid #3b82f6' : '1px solid #24324a', cursor:'pointer', position: 'relative'}} onClick={() => {
                        const next = new Set(checkedSimilar);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        setCheckedSimilar(next);
                        setSelected({ is_person: true, ...p });
                    }}>
                    <input 
                        type="checkbox" 
                        checked={checkedSimilar.has(p.id)}
                        onChange={() => {}}
                        style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, cursor: 'pointer' }}
                    />
                    <div style={{width:'100%', height:'100px', background:'#1e293b', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden', marginBottom: '8px'}}>
                        <PersonThumb url={getPersonThumbUrl(p)} size={40} />
                    </div>
                    <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>{Math.round(p.similarity * 100)}% Match</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{p.face_count} photo{p.face_count !== 1 ? 's' : ''}</div>
                    {p.context_score > 0 && !p.inSamePhoto && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>★ Context Match</div>}
                    {p.inSamePhoto && <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', marginTop: '2px' }} title="This person appears in the exact same photo as the named person. They are likely a different person.">⚠️ Group Photo</div>}
                    </div>
                ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <ActionButton disabled={checkedSimilar.size === 0 || isTaskActive} className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={async () => {
                    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) {
                        alert("Please stop all background tasks before merging profiles to prevent database conflicts.");
                        return;
                    }
                    if (!window.confirm(`Merge ${checkedSimilar.size} unknown profile(s) into ${currentPerson.name}?`)) return;
                    try {
                        await axios.post(`${API}/people/merge`, { person_ids: [currentPerson.id, ...Array.from(checkedSimilar)] });
                        showToastMessage(`Merged ${checkedSimilar.size} profiles successfully.`);
                        setSimilarUnknowns(null);
                        setSimilarUnknownsPage(1);
                        setShowSimilarPanel(false);
                        setCheckedSimilar(new Set());
                        if (selected?.is_person) setSelected(null);
                        openPersonPhotos(currentPerson);
                        loadPeople();
                    } catch(err) {
                        alert('Error merging: ' + (err?.response?.data?.detail || err.message));
                    }
                }}>
                    Merge {checkedSimilar.size} Selected
                </ActionButton>
                <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => {
                    const hidden = settings.hidden_people || [];
                    const visibleSimilar = similarUnknowns.filter(p => !hidden.includes(p.id) && !(p.name && hidden.includes(p.name)));
                    if (checkedSimilar.size === visibleSimilar.length && visibleSimilar.length > 0) setCheckedSimilar(new Set());
                    else setCheckedSimilar(new Set(visibleSimilar.map(p => p.id)));
                }}>
                    {checkedSimilar.size === visibleSimilar.length && visibleSimilar.length > 0 ? 'Deselect All' : 'Select All'}
                </ActionButton>
                </div>
            </>
            )) : (
            <p style={{ color: '#94a3b8' }}>Adjust the similarity threshold and click "Start Search" to find potential matches.</p>
            )}
        </div>
        )}

        {checkedFiles.size > 0 && (
        <div style={{ padding: '10px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto', whiteSpace: 'nowrap' }}>{checkedFiles.size} photo(s) selected</span>
            {checkedFiles.size === 1 && (
            <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => {
                const fileId = globalFileCache.current.get(Array.from(checkedFiles)[0])?.id;
                if (fileId) setPersonThumbnail(currentPerson.id, fileId);
            }}>Set as Cover Photo</ActionButton>
            )}
            {checkedFiles.size === 1 && (
                <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={locateSelectedFileInExplorer}>
                    <PlaceIcon fontSize="small" /> Locate in Explorer
                </ActionButton>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
            <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingPerson ? '#334155' : undefined, whiteSpace: 'nowrap' }} onClick={() => { setIsTaggingPerson(!isTaggingPerson); loadPeople(); }}>Move to Person</ActionButton>
            {isTaggingPerson && Array.isArray(people) && (
                <select 
                onChange={(e) => movePhotosToPerson(e.target.value, Array.from(checkedFiles))} 
                style={{ padding: '6px 12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none' }}
                value=""
                >
                <option value="" disabled>Select person...</option>
                {sortedNamedPeopleDropdown.filter(p => p.id !== currentPerson?.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            )}
            </div>
            <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', whiteSpace: 'nowrap' }} onClick={() => {
                const fileIds = Array.from(checkedFiles).map(path => globalFileCache.current.get(path)?.id).filter(id => id);
                removePersonPhotosBulk(currentPerson.id, fileIds);
            }}>Remove from Person</ActionButton>
            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</ActionButton>
        </div>
        )}

        <div className="content" onScroll={handleScroll} style={{paddingTop: '18px', paddingLeft: '18px', paddingRight: '18px', overflowY: 'auto'}}>

        {startOffset > 0 && (
        <div style={{ textAlign: 'center', paddingTop: '150px', paddingBottom: '20px', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '200px', boxSizing: 'border-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingPrevious ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading previous photos...</> : 'Scroll up to load previous photos...'}
            </div>
        </div>
        )}

            {Array.isArray(personFiles) && personFiles.length === 0 ? (
                <div className={viewMode === 'grid' ? 'grid' : 'list'}>
                    <p>No photos found for this person.</p>
                </div>
            ) : null}
            {Array.from(groupedPersonFiles.entries()).map(([dateKey, filesGroup]) => (
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
                filterCategory="all"
                indexer={indexer}
                checkFileReadOnly={checkFileReadOnly}
                />
            ))}
        {hasMore && (
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '24px', boxSizing: 'content-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingMore ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading more photos...</> : 'Scroll down to load more photos...'}
            </div>
        </div>
        )}
        {!hasMore && personFiles.length > 0 && (
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

        </div>
        }
    </>
  );
}