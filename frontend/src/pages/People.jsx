import React from 'react';
import FaceIcon from '@mui/icons-material/Face';
import CloseIcon from '@mui/icons-material/Close';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import { ActionButton } from '../components/ui/ActionButton';
import { ProgressBar } from '../components/ui/ProgressBar';
import { PersonThumb } from '../components/ui/PersonThumb';

export default function People(props) {
  const { 
    page, sortedNamedPeopleDropdown, indexer, actionInProgress, stopFaceScan, startFaceScan,
    checkedPeople, hasUnknownSelected, showSelectedUnknownsActions, setShowSelectedUnknownsActions,
    similarityThreshold, setSimilarityThreshold, dataOpProgress, cancelAiAction, clusterSelectedUnknowns,
    reclassifySelectedUnknowns, mergeSelectedPeople, setCheckedPeople, people, peopleSortBy, setPeopleSortBy,
    setUnknownPeoplePage, setNamedPeoplePage, namedPeopleBase, namedPersonSearchQuery, setNamedPersonSearchQuery,
    filteredNamedPeople, namedPeoplePage, sortedNamedPeopleForUI, openPersonPhotos, deletePerson, settings,
    updateUIPreferences, showToastMessage, togglePinPerson, getPersonThumbUrl, editingNames, setEditingNames,
    savePersonName, updatePersonNameLocal, filteredUnknownPeople, showUnknownsActions, setShowUnknownsActions,
    clusterAllUnknowns, reclassifyAllUnknowns, purgeThreshold, setPurgeThreshold, purgeSmallUnknowns,
    unknownPeoplePage, sortedUnknownPeopleForUI
  } = props;

  const isClusterSelectedActive = dataOpProgress?.id === 'clusterSelected';
  const isReclassifySelectedActive = dataOpProgress?.id === 'reclassifySelected';
  const isClusterAllActive = dataOpProgress?.id === 'clusterAll';
  const isReclassifyAllActive = dataOpProgress?.id === 'reclassifyAll';
  const isPurgeActive = dataOpProgress?.id === 'purge';

  const isAnyDataOpPending = actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation);
  const selectedClusterDisabled = isClusterSelectedActive ? !!indexer.cancel_data_operation : isAnyDataOpPending;
  const selectedReclassifyDisabled = isReclassifySelectedActive ? !!indexer.cancel_data_operation : isAnyDataOpPending;
  const bulkClusterDisabled = isClusterAllActive ? !!indexer.cancel_data_operation : isAnyDataOpPending;
  const bulkReclassifyDisabled = isReclassifyAllActive ? !!indexer.cancel_data_operation : isAnyDataOpPending;
  const purgeDisabled = isPurgeActive ? !!indexer.cancel_data_operation : isAnyDataOpPending;

  return (
    <>
        {
        page==='people' &&
        <div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
        <datalist id="known-people-list">
        {sortedNamedPeopleDropdown.map(p => (
            <option key={p.id} value={p.name} />
        ))}
        </datalist>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px' }}><FaceIcon fontSize="large" style={{ color: '#3b82f6' }} /> People (Face Recognition)</h1>
            <p style={{ margin: 0, color: '#cbd5e1' }}>Automatically clustered groups of people found in your indexed photos.</p>
        </div>
        <div>
            {indexer.face_scanner_running ? (
            <ActionButton disabled={actionInProgress || indexer.face_scanner_stopped} className="btn btn-secondary" style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={stopFaceScan}>
                <CloseIcon fontSize="small" /> {indexer.face_scanner_stopped ? 'Stopping...' : 'Stop Scanning'}
            </ActionButton>
            ) : (
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startFaceScan}>
                <PlayCircleIcon fontSize="small" /> Scan Archive for Faces
            </ActionButton>
            )}
        </div>
        </div>

        {indexer.face_scanner_running && (
        <div style={{ marginBottom: '20px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Face Scanner Progress</span>
            <ProgressBar current={indexer.face_scanner_current} total={indexer.face_scanner_total} color="#8b5cf6" />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.face_scanner_current_file || ''}</div>
        </div>
        )}

        {checkedPeople.size > 0 && (
        <div className="floating-panel" style={{ position: 'sticky', bottom: '20px', zIndex: 50, padding: '10px 18px', background: '#1e293b', border: '1px solid #334155', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '16px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
            <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto' }}>{checkedPeople.size} person(s) selected</span>
            
            {hasUnknownSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
                <ActionButton disabled={actionInProgress} className="btn btn-secondary" style={{ padding: '6px 12px', background: (showSelectedUnknownsActions || (dataOpProgress && ['clusterSelected', 'reclassifySelected'].includes(dataOpProgress.id))) ? '#334155' : undefined }} onClick={() => setShowSelectedUnknownsActions(!showSelectedUnknownsActions)}>
                    <SettingsApplicationsIcon fontSize="small" style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline-flex' }} /> AI Actions
                </ActionButton>
                {(showSelectedUnknownsActions || (dataOpProgress && ['clusterSelected', 'reclassifySelected'].includes(dataOpProgress.id))) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '0 8px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Threshold:</span>
                        <input 
                            type="range" 
                            min="0.35" max="0.85" step="0.01" 
                            disabled={actionInProgress}
                            value={similarityThreshold} 
                            onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))} 
                            style={{ width: '60px', accentColor: '#10b981' }}
                        />
                        <span style={{ color: '#10b981', fontSize: '13px', minWidth: '35px', fontWeight: 'bold' }}>{Math.round(similarityThreshold * 100)}%</span>
                        </div>
                        <ActionButton disabled={selectedClusterDisabled} className="btn btn-secondary" style={{ padding: '6px 12px', color: isClusterSelectedActive ? '#ef4444' : '#10b981', borderColor: isClusterSelectedActive ? '#b91c1c' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={isClusterSelectedActive ? cancelAiAction : clusterSelectedUnknowns} title="Compare selected unknown people against other unknowns and merge matches automatically.">
                        {isClusterSelectedActive ? 
                            <><CloseIcon fontSize="small" /> Cancel</> : 
                            <><FaceIcon fontSize="small" /> Cluster Selected</>}
                        </ActionButton>
                        <ActionButton disabled={selectedReclassifyDisabled} className="btn btn-secondary" style={{ padding: '6px 12px', color: isReclassifySelectedActive ? '#ef4444' : '#f59e0b', borderColor: isReclassifySelectedActive ? '#b91c1c' : '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={isReclassifySelectedActive ? cancelAiAction : reclassifySelectedUnknowns} title="Break apart selected profiles and re-evaluate each face against all knowns and unknowns.">
                        {isReclassifySelectedActive ? 
                            <><CloseIcon fontSize="small" /> Cancel</> : 
                            <><FaceIcon fontSize="small" /> Reclassify Selected</>}
                        </ActionButton>
                        {(isClusterSelectedActive || isReclassifySelectedActive) && dataOpProgress?.total > 0 && (
                        <div style={{ width: '100%', flexBasis: '100%', marginTop: '8px', padding: '0 8px' }}>
                            <ProgressBar current={dataOpProgress.current} total={dataOpProgress.total} color={isClusterSelectedActive ? '#10b981' : '#f59e0b'} />
                        </div>
                        )}
                    </div>
                )}
            </div>
            )}

            {checkedPeople.size > 1 && (
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={mergeSelectedPeople} title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to merge profiles" : ""}>Merge Selected</ActionButton>
            )}
            <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedPeople(new Set())}>Clear Selection</ActionButton>
        </div>
        )}

        {people === null ? <p style={{color: '#ef4444', marginTop: '20px'}}>Error: Failed to fetch faces. This usually means the API route in main.py is blocked, or the catch-all route is returning HTML. Check your browser console!</p> : null}
        {Array.isArray(people) && people.length === 0 ? <p style={{color: '#94a3b8', marginTop: '20px'}}>No faces scanned or clustered yet. The background worker will populate this automatically.</p> : null}

        {Array.isArray(people) && people.length > 0 && (
        <>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' }}>
            <label>Sort by:</label>
            <select value={peopleSortBy} onChange={(e) => { setPeopleSortBy(e.target.value); setUnknownPeoplePage(1); setNamedPeoplePage(1); }}>
                <option value="name">Name</option>
                <option value="count">Face Count</option>
            </select>
            </div>

            {namedPeopleBase.length > 0 && (
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>Named People</h2>
                    <input
                    type="text"
                    placeholder="Search by name..."
                    value={namedPersonSearchQuery}
                    onChange={(e) => { setNamedPersonSearchQuery(e.target.value); setNamedPeoplePage(1); }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', width: '100%', maxWidth: '250px', outline: 'none' }}
                    />
                </div>
                {filteredNamedPeople.length > 50 && (
                    <div style={{ display: 'flex', gap: '16px' }}>
                    <ActionButton disabled={namedPeoplePage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setNamedPeoplePage(prev => Math.max(1, prev - 1))}>
                        Previous
                    </ActionButton>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {namedPeoplePage} of {Math.ceil(filteredNamedPeople.length / 50)}</span>
                    <ActionButton disabled={namedPeoplePage >= Math.ceil(filteredNamedPeople.length / 50)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setNamedPeoplePage(prev => prev + 1)}>
                        Next
                    </ActionButton>
                    </div>
                )}
                </div>
                
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
                {sortedNamedPeopleForUI.slice((namedPeoplePage - 1) * 50, namedPeoplePage * 50).map(p => (
                <div key={p.id} id={`person-card-${p.id}`} style={{background:'#111827', padding:'16px', borderRadius:'16px', border:'1px solid #24324a', cursor:'pointer', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative'}} onClick={() => openPersonPhotos(p)}>
                    <input 
                    type="checkbox" 
                    checked={checkedPeople.has(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const next = new Set(checkedPeople);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        setCheckedPeople(next);
                    }}
                    style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                    <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
                            alert("Please stop all background tasks before modifying profiles.");
                            return;
                        }
                        deletePerson(e, p.id, p.name);
                    }}
                    style={{position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
                    title="Revert to Unknown Person"
                    >
                    ✕
                    </div>
                    <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        const identifier = (p.name && !p.name.startsWith('Unknown Person')) ? p.name : p.id;
                        const next = [...(settings.hidden_people || []), identifier];
                        updateUIPreferences({ hidden_people: next });
                        showToastMessage(`${p.name || 'Person'} hidden from UI.`);
                    }}
                    style={{position: 'absolute', top: '8px', right: '42px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
                    title="Hide Person (Keep faces to prevent rescanning)"
                    >
                    <VisibilityOffIcon style={{ fontSize: '15px' }} />
                    </div>
                    <div 
                    onClick={(e) => togglePinPerson(e, p)}
                    style={{position: 'absolute', top: '8px', right: '76px', background: ((settings.pinned_people || []).includes(p.id) || (p.name && (settings.pinned_people || []).includes(p.name))) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)', color: ((settings.pinned_people || []).includes(p.id) || (p.name && (settings.pinned_people || []).includes(p.name))) ? '#f59e0b' : '#94a3b8', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
                    title={((settings.pinned_people || []).includes(p.id) || (p.name && (settings.pinned_people || []).includes(p.name))) ? "Unpin Person" : "Pin Person"}
                    >
                    {((settings.pinned_people || []).includes(p.id) || (p.name && (settings.pinned_people || []).includes(p.name))) ? <StarIcon style={{ fontSize: '15px' }} /> : <StarBorderIcon style={{ fontSize: '15px' }} />}
                    </div>
                    <div style={{width:'100%', height:'150px', background:'#1e293b', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden'}}>
                        <PersonThumb url={getPersonThumbUrl(p)} size={60} />
                    </div>
                    <div style={{display:'flex', alignItems:'center'}}>
                        <input 
                            list="known-people-list"
                            value={editingNames[p.id] !== undefined ? editingNames[p.id] : (p.name || '')} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingNames(prev => ({ ...prev, [p.id]: e.target.value }))}
                            disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                            onBlur={e => {
                                let newName = e.target.value.trim();
                                if (!newName) newName = `Unknown Person #${p.id}`;
                                if (newName !== p.name) {
                                    savePersonName(p.id, newName);
                                    updatePersonNameLocal(p.id, newName);
                                }
                                setEditingNames(prev => { const next = {...prev}; delete next[p.id]; return next; });
                            }}
                            style={{background:'transparent', border:'none', color:'#f8fafc', fontSize:'16px', fontWeight:'bold', width:'100%', outline: 'none', borderBottom: '1px solid transparent'}}
                            onFocus={e => { e.target.style.borderBottom = '1px solid #3b82f6'; e.target.select(); }}
                            onBlurCapture={e => e.target.style.borderBottom = '1px solid transparent'}
                        />
                    </div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '-4px' }}>
                        {p.face_count} photo{p.face_count !== 1 ? 's' : ''}
                    </div>
                </div>
                ))}
                </div>

                {filteredNamedPeople.length === 0 && namedPersonSearchQuery && (
                <p style={{ color: '#94a3b8', marginTop: '16px' }}>No named people match your search.</p>
                )}
                
                {filteredNamedPeople.length > 50 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', marginBottom: '24px' }}>
                    <ActionButton disabled={namedPeoplePage === 1} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setNamedPeoplePage(prev => Math.max(1, prev - 1))}>
                    Previous
                    </ActionButton>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {namedPeoplePage} of {Math.ceil(filteredNamedPeople.length / 50)}</span>
                    <ActionButton disabled={namedPeoplePage >= Math.ceil(filteredNamedPeople.length / 50)} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setNamedPeoplePage(prev => prev + 1)}>
                    Next
                    </ActionButton>
                </div>
                )}
                
            </>
            )}

            {filteredUnknownPeople.length > 0 && (
            <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <h2 id="unknown-people-section" style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>Unknown People</h2>
                    <ActionButton 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px', color: (showUnknownsActions || (dataOpProgress && ['clusterAll', 'reclassifyAll', 'purge'].includes(dataOpProgress.id))) ? '#38bdf8' : '#94a3b8', borderColor: (showUnknownsActions || (dataOpProgress && ['clusterAll', 'reclassifyAll', 'purge'].includes(dataOpProgress.id))) ? '#3b82f6' : '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: (showUnknownsActions || (dataOpProgress && ['clusterAll', 'reclassifyAll', 'purge'].includes(dataOpProgress.id))) ? '#0f172a' : undefined }} 
                    onClick={() => setShowUnknownsActions(!showUnknownsActions)}
                    >
                    <SettingsApplicationsIcon fontSize="small" /> AI Actions
                    </ActionButton>
                </div>
                {filteredUnknownPeople.length > 50 && (
                    <div style={{ display: 'flex', gap: '16px' }}>
                    <ActionButton disabled={unknownPeoplePage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setUnknownPeoplePage(prev => Math.max(1, prev - 1))}>
                        Previous
                    </ActionButton>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {unknownPeoplePage} of {Math.ceil(filteredUnknownPeople.length / 50)}</span>
                    <ActionButton disabled={unknownPeoplePage >= Math.ceil(filteredUnknownPeople.length / 50)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setUnknownPeoplePage(prev => prev + 1)}>
                        Next
                    </ActionButton>
                    </div>
                )}
                </div>
                
                {(showUnknownsActions || (dataOpProgress && ['clusterAll', 'reclassifyAll', 'purge'].includes(dataOpProgress.id))) && (
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '24px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}><SettingsApplicationsIcon fontSize="small" style={{ color: '#3b82f6' }} /> Bulk AI Operations</h3>
                    
                    <div style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b', marginBottom: '16px' }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>Select how strict the AI should be when comparing faces. Lower percentages will aggressively group faces together, while higher percentages ensure fewer false-positives.</p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#1e293b', padding: '6px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Similarity Threshold:</span>
                            <input 
                                type="range" 
                                min="0.35" max="0.85" step="0.01" 
                                disabled={actionInProgress}
                                value={similarityThreshold} 
                                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))} 
                                style={{ width: '120px', accentColor: '#10b981' }}
                            />
                            <span style={{ color: '#10b981', fontSize: '14px', minWidth: '40px', fontWeight: 'bold' }}>{Math.round(similarityThreshold * 100)}%</span>
                            </div>
                        <ActionButton disabled={bulkClusterDisabled} className="btn btn-secondary" style={{ padding: '8px 16px', color: isClusterAllActive ? '#ef4444' : '#10b981', borderColor: isClusterAllActive ? '#b91c1c' : '#059669', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={isClusterAllActive ? cancelAiAction : clusterAllUnknowns} title="Compare ALL unknown people against each other and merge matches automatically.">
                            {isClusterAllActive ? 
                            <><CloseIcon fontSize="small" /> Cancel Clustering</> : 
                                <><FaceIcon fontSize="small" /> Cluster All Unknowns</>}
                            </ActionButton>
                        <ActionButton disabled={bulkReclassifyDisabled} className="btn btn-secondary" style={{ padding: '8px 16px', color: isReclassifyAllActive ? '#ef4444' : '#f59e0b', borderColor: isReclassifyAllActive ? '#b91c1c' : '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={isReclassifyAllActive ? cancelAiAction : reclassifyAllUnknowns} title="Break apart all unknown profiles and re-evaluate each face against all knowns and unknowns.">
                            {isReclassifyAllActive ? 
                            <><CloseIcon fontSize="small" /> Cancel Reclassifying</> : 
                                <><FaceIcon fontSize="small" /> Reclassify All Unknowns</>}
                            </ActionButton>
                        </div>
                        {(isClusterAllActive || isReclassifyAllActive) && dataOpProgress?.total > 0 && (
                        <div style={{ marginTop: '16px' }}>
                            <ProgressBar current={dataOpProgress.current} total={dataOpProgress.total} color={isClusterAllActive ? '#10b981' : '#f59e0b'} />
                        </div>
                        )}
                    </div>

                    <div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>Permanently delete unknown profiles that have fewer than the specified number of photos. This frees up database space and removes noisy blurry faces.</p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#1e293b', padding: '6px 16px', borderRadius: '8px', border: '1px solid #334155' }}>
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Photos &lt;</span>
                                <input 
                                type="number" 
                                min="1" 
                                value={purgeThreshold} 
                                onChange={(e) => setPurgeThreshold(e.target.value === '' ? '' : parseInt(e.target.value))}
                                style={{ width: '60px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#f8fafc', outline: 'none' }}
                                />
                            </div>
                            <ActionButton 
                            disabled={purgeDisabled} 
                            className="btn btn-secondary" 
                            onClick={dataOpProgress?.id === 'purge' ? cancelAiAction : purgeSmallUnknowns}
                            title={(dataOpProgress && dataOpProgress.id === 'purge') ? "" : purgeDisabled ? "Stop all background tasks to purge" : ""}
                            style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                            {dataOpProgress && dataOpProgress.id === 'purge' ? (
                                <><CloseIcon fontSize="small" /> Cancel Purging</>
                            ) : 'Purge Small Profiles'}
                            </ActionButton>
                        </div>
                    </div>
                </div>
                )}

                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
                {sortedUnknownPeopleForUI.slice((unknownPeoplePage - 1) * 50, unknownPeoplePage * 50).map(p => (
                <div key={p.id} id={`person-card-${p.id}`} style={{background:'#111827', padding:'16px', borderRadius:'16px', border:'1px solid #24324a', cursor:'pointer', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative'}} onClick={() => openPersonPhotos(p)}>
                    <input 
                    type="checkbox" 
                    checked={checkedPeople.has(p.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                        const next = new Set(checkedPeople);
                        if (e.target.checked) next.add(p.id);
                        else next.delete(p.id);
                        setCheckedPeople(next);
                    }}
                    style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                    <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
                            alert("Please stop all background tasks before modifying profiles.");
                            return;
                        }
                        deletePerson(e, p.id, p.name);
                    }}
                    style={{position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
                    title="Delete / Ignore Person"
                    >
                    ✕
                    </div>
                    <div 
                    onClick={(e) => { e.stopPropagation(); const next = [...(settings.hidden_people || []), p.id]; updateUIPreferences({ hidden_people: next }); showToastMessage(`Unknown Person #${p.id} hidden from UI.`); }}
                    style={{position: 'absolute', top: '8px', right: '42px', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
                    title="Hide Person (Keep faces to prevent rescanning)"
                    >
                    <VisibilityOffIcon style={{ fontSize: '15px' }} />
                    </div>
                    <div style={{width:'100%', height:'150px', background:'#1e293b', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden'}}>
                        <PersonThumb url={getPersonThumbUrl(p)} size={60} />
                    </div>
                    <div style={{display:'flex', alignItems:'center'}}>
                        <input 
                            list="known-people-list"
                            value={editingNames[p.id] !== undefined ? editingNames[p.id] : (p.name || '')} 
                            onClick={e => e.stopPropagation()}
                            onChange={e => setEditingNames(prev => ({ ...prev, [p.id]: e.target.value }))}
                            disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                            onBlur={e => {
                                let newName = e.target.value.trim();
                                if (!newName) newName = `Unknown Person #${p.id}`;
                                if (newName !== p.name) {
                                    savePersonName(p.id, newName);
                                    updatePersonNameLocal(p.id, newName);
                                }
                                setEditingNames(prev => { const next = {...prev}; delete next[p.id]; return next; });
                            }}
                            style={{background:'transparent', border:'none', color:'#f8fafc', fontSize:'16px', fontWeight:'bold', width:'100%', outline: 'none', borderBottom: '1px solid transparent'}}
                            onFocus={e => { e.target.style.borderBottom = '1px solid #3b82f6'; e.target.select(); }}
                            onBlurCapture={e => e.target.style.borderBottom = '1px solid transparent'}
                        />
                    </div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '-4px' }}>
                        {p.face_count} photo{p.face_count !== 1 ? 's' : ''}
                    </div>
                </div>
                ))}
                </div>

                {filteredUnknownPeople.length > 50 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', marginBottom: '24px' }}>
                    <ActionButton disabled={unknownPeoplePage === 1} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setUnknownPeoplePage(prev => Math.max(1, prev - 1))}>
                    Previous
                    </ActionButton>
                    <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {unknownPeoplePage} of {Math.ceil(filteredUnknownPeople.length / 50)}</span>
                    <ActionButton disabled={unknownPeoplePage >= Math.ceil(filteredUnknownPeople.length / 50)} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setUnknownPeoplePage(prev => prev + 1)}>
                    Next
                    </ActionButton>
                </div>
                )}
                
            </>
            )}
        </>
        )}
        </div>
        }
    </>
  );
}