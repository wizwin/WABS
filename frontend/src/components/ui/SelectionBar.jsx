import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { ActionButton } from './ActionButton';
import { LocateButton } from './LocateButton';
import { API } from '../../States';

export function SelectionBar({ props, context, openAddToFolder }) {
  const {
    checkedFiles, setCheckedFiles,
    showSelectedOnly, setShowSelectedOnly,
    virtualFolders, globalFileCache, currentVirtualFolder,
    openSelected, locateSelectedFile, copySelected, moveSelected, deleteSelected,
    actionInProgress, dataOpProgress, indexer,
    isTaggingPerson, setIsTaggingPerson, isTaggingObject, setIsTaggingObject,
    people, loadPeople, sortedNamedPeopleDropdown,
    removePersonPhotosBulk, currentPerson, setPersonThumbnail,
    isSelectionReadOnly,
    // tagsState values
    personTagInput, setPersonTagInput, assignPhotosToPerson,
    tagInput, setTagInput, objectTags, addTagsToSelected, removeTagsFromSelected,
    // peopleState values for Person page
    movePhotosToPerson,
    showToastMessage,
    loadVirtualFolders,
    removeFilesFromVirtualFolder,
  } = props;

  const [isSelectionListOpen, setIsSelectionListOpen] = useState(false);
  const [isMovingToPerson, setIsMovingToPerson] = useState(false);
  const selectionListRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (selectionListRef.current && !selectionListRef.current.contains(e.target)) {
        setIsSelectionListOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!checkedFiles || checkedFiles.size === 0) return null;

  const selectedPaths = Array.from(checkedFiles);
  const hasVirtualFolderSelected = selectedPaths.some(p => p.startsWith('virtual_folder:'));
  const hasPhysicalFileSelected = selectedPaths.some(p => !p.startsWith('virtual_folder:'));
  const isTaskActive = indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running || actionInProgress || !!dataOpProgress;

  return (
    <div style={{ padding: '12px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Top row: selection info and Show Selected Only */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
            {showSelectedOnly ? `Showing ${checkedFiles.size} selected item(s)` : `${checkedFiles.size} item(s) selected`}
          </span>
          <div ref={selectionListRef} style={{ position: 'relative' }}>
            <ActionButton
              className="btn btn-secondary"
              style={{ padding: '5px 12px', fontSize: '13.5px', borderColor: isSelectionListOpen ? '#3b82f6' : undefined, color: isSelectionListOpen ? '#38bdf8' : undefined }}
              onClick={() => setIsSelectionListOpen(v => !v)}
            >
              View Selection ▾
            </ActionButton>
            {isSelectionListOpen && (
              <div style={{
                position: 'absolute',
                top: '34px',
                left: 0,
                zIndex: 9999,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                width: '380px',
                maxHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f8fafc' }}>Selected Items ({checkedFiles.size})</span>
                  <span style={{ fontSize: '11px', color: '#64748b', cursor: 'pointer', userSelect: 'none' }} onClick={() => setIsSelectionListOpen(false)}>✕ Close</span>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {selectedPaths.map(path => {
                    const isVirtual = path.startsWith('virtual_folder:');
                    let label, sublabel, icon;
                    if (isVirtual) {
                      const vfId = parseInt(path.split(':')[1]);
                      const vf = (virtualFolders || []).find(f => f.id === vfId);
                      label = vf ? vf.name : `Virtual Folder #${vfId}`;
                      sublabel = 'Virtual Folder';
                      icon = '📁';
                    } else {
                      const file = globalFileCache.current?.get(path);
                      const parts = path.replace(/\\/g, '/').split('/');
                      label = file ? file.filename : parts[parts.length - 1];
                      sublabel = file ? file.category : (parts.length > 1 ? parts.slice(0, -1).join('/') : path);
                      icon = file ? (file.category === 'photo' ? '🖼' : file.category === 'video' ? '🎬' : file.category === 'audio' ? '🎵' : file.category === 'document' ? '📄' : '📦') : '📂';
                    }
                    return (
                      <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderBottom: '1px solid #1f2937', cursor: 'pointer' }}
                        onClick={() => {
                          const next = new Set(checkedFiles);
                          next.delete(path);
                          setCheckedFiles(next);
                        }}
                        title="Click to deselect"
                      >
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sublabel}</div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#ef4444', flexShrink: 0 }}>✕</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ActionButton className="btn btn-secondary" style={{ padding: '5px 12px', borderColor: showSelectedOnly ? '#3b82f6' : undefined, color: showSelectedOnly ? '#38bdf8' : undefined, fontSize: '13.5px' }} onClick={() => setShowSelectedOnly(!showSelectedOnly)}>{showSelectedOnly ? 'Show All Files' : 'Show Selected Only'}</ActionButton>
          <ActionButton className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: '13.5px' }} onClick={() => { setCheckedFiles(new Set()); setIsSelectionListOpen(false); }}>Clear Selection</ActionButton>
        </div>
      </div>

      {/* Bottom row: all buttons grouped together */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
          {hasVirtualFolderSelected && checkedFiles.size === 1 ? (
            <ActionButton
              className="btn btn-primary"
              style={{ padding: '5px 10px', fontSize: '13px' }}
              onClick={() => {
                const path = selectedPaths[0];
                const vfId = parseInt(path.split(':')[1], 10);
                const vf = (virtualFolders || []).find(f => f.id === vfId);
                if (vf) {
                  props.handleOpenFolder(vf);
                  setCheckedFiles(new Set());
                }
              }}
            >
              Open
            </ActionButton>
          ) : !hasVirtualFolderSelected && hasPhysicalFileSelected ? (
            <ActionButton className="btn btn-primary" style={{ padding: '5px 10px', fontSize: '13px' }} onClick={openSelected}>Open</ActionButton>
          ) : null}

          {context === 'person_files' && checkedFiles.size === 1 && (
            <ActionButton
              disabled={isTaskActive}
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '13px' }}
              onClick={() => {
                const fileId = globalFileCache.current.get(selectedPaths[0])?.id;
                if (fileId && currentPerson) setPersonThumbnail(currentPerson.id, fileId);
              }}
            >
              Set as Cover Photo
            </ActionButton>
          )}

          {!hasVirtualFolderSelected && checkedFiles.size === 1 && (
            <LocateButton locateSelectedFile={locateSelectedFile} style={{ padding: '5px 10px', fontSize: '13px' }} />
          )}

          {!hasVirtualFolderSelected && (
            <ActionButton className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px' }} onClick={copySelected}>Copy</ActionButton>
          )}

          {!isSelectionReadOnly && !hasVirtualFolderSelected && (
            <>
              <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px' }} onClick={moveSelected}>Move</ActionButton>
              {context !== 'virtual_folder' && (
                <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }} onClick={deleteSelected}>Delete</ActionButton>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
          <ActionButton className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px' }} onClick={() => openAddToFolder(false)}>Add to Folder</ActionButton>
          {context === 'virtual_folder' && (
            <ActionButton className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px' }} onClick={() => openAddToFolder(true)}>Move to Folder</ActionButton>
          )}
          
          {context === 'virtual_folder' && currentVirtualFolder && (
            <ActionButton
              className="btn btn-secondary"
              style={{ padding: '5px 10px', fontSize: '13px', background: '#ef44442a', borderColor: '#ef44443a', color: '#f87171' }}
              onClick={async () => {
                const fileIds = selectedPaths.map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
                const subfolderPaths = selectedPaths.filter(path => path.startsWith('virtual_folder:'));
                const subfolderIds = subfolderPaths.map(path => parseInt(path.split(':')[1], 10));

                let removedSomething = false;
                if (fileIds.length > 0) {
                  await removeFilesFromVirtualFolder(currentVirtualFolder.id, fileIds);
                  removedSomething = true;
                }
                if (subfolderIds.length > 0) {
                  try {
                    for (const subId of subfolderIds) {
                      await axios.put(`${API}/virtual-folders/${subId}`, { parent_id: null });
                    }
                    showToastMessage(`Removed subfolder(s) from parent folder.`);
                    await loadVirtualFolders();
                    setCheckedFiles(new Set());
                    removedSomething = true;
                  } catch (err) {
                    alert('Failed to remove subfolders: ' + (err.response?.data?.detail || err.message));
                  }
                }
                if (removedSomething && props.loadDashboard) {
                  await props.loadDashboard();
                }
              }}
            >
              Remove from Folder
            </ActionButton>
          )}

          {context === 'person_files' && currentPerson && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
                <ActionButton
                  disabled={isTaskActive}
                  className="btn btn-secondary"
                  style={{ padding: '5px 10px', fontSize: '13px', background: isMovingToPerson ? '#334155' : undefined }}
                  onClick={() => { setIsMovingToPerson(!isMovingToPerson); loadPeople(); }}
                >
                  Move to Person
                </ActionButton>
                {isMovingToPerson && Array.isArray(people) && (
                  <select
                    onChange={(e) => {
                      movePhotosToPerson(e.target.value, selectedPaths);
                      setIsMovingToPerson(false);
                    }}
                    style={{ padding: '4px 8px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none', fontSize: '12px' }}
                    value=""
                  >
                    <option value="" disabled>Select person...</option>
                    {sortedNamedPeopleDropdown.filter(p => p.id !== currentPerson?.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <ActionButton
                disabled={isTaskActive}
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '13px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }}
                onClick={() => {
                  const fileIds = selectedPaths.map(path => globalFileCache.current.get(path)?.id).filter(id => id);
                  removePersonPhotosBulk(currentPerson.id, fileIds);
                }}
              >
                Remove from Person
              </ActionButton>
            </>
          )}
        </div>

        {!hasVirtualFolderSelected && context !== 'person_files' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
              <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px', background: isTaggingPerson ? '#334155' : undefined }} onClick={() => { setIsTaggingPerson(!isTaggingPerson); setIsTaggingObject(false); loadPeople(); }}>Tag Person</ActionButton>
              {isTaggingPerson && Array.isArray(people) && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select
                    onChange={(e) => setPersonTagInput(e.target.value)}
                    style={{ padding: '4px 8px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none', fontSize: '12px' }}
                    value={personTagInput}
                  >
                    <option value="" disabled>Select...</option>
                    {sortedNamedPeopleDropdown.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '3px 6px', fontSize: '12px', color: '#10b981' }} onClick={() => personTagInput && assignPhotosToPerson(personTagInput, selectedPaths)}>Add</ActionButton>
                  <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '3px 6px', fontSize: '12px', color: '#ef4444' }} onClick={() => {
                    if (!personTagInput) return;
                    const fileIds = selectedPaths.map(path => globalFileCache.current.get(path)?.id).filter(id => id);
                    removePersonPhotosBulk(personTagInput, fileIds);
                  }}>Remove</ActionButton>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0f172a', padding: '3px', borderRadius: '8px', border: '1px solid #334155' }}>
              <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '13px', background: isTaggingObject ? '#334155' : undefined }} onClick={() => { setIsTaggingObject(!isTaggingObject); setIsTaggingPerson(false); }} title={isTaskActive ? "Stop all background tasks to manage tags" : ""}>Manage Tags</ActionButton>
              {isTaggingObject && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="text"
                    list="existing-tags"
                    placeholder="tag1, tag2..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    style={{ padding: '4px 8px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none', width: '110px', fontSize: '12px' }}
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
                  <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '3px 6px', fontSize: '12px', color: '#10b981' }} onClick={() => addTagsToSelected(tagInput)}>Add</ActionButton>
                  <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '3px 6px', fontSize: '12px', color: '#ef4444' }} onClick={() => removeTagsFromSelected(tagInput)}>Remove</ActionButton>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
