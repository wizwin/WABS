import React, { useState } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { getFolderStyleAndIcon, ICON_MAP } from '../../pages/VirtualFolders';

import { ActionButton } from './ActionButton';
import { validateFolderName } from '../../States';

function FolderTreeNode({ folder, allFolders, onSelect, onCreateSubfolder, expandedFolders, toggleExpand }) {
  const children = allFolders.filter(f => f.parent_id === folder.id);
  const isExpanded = !!expandedFolders[folder.id];
  const hasChildren = children.length > 0;
  const [isCreatingSubfolder, setIsCreatingSubfolder] = useState(false);
  const [subfolderInput, setSubfolderInput] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: folder.parent_id ? '16px' : '0' }}>
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: 'transparent',
          color: '#cbd5e1',
          userSelect: 'none'
        }}
        className="folder-node-hover"
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            toggleExpand(folder.id);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <span 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '18px', 
              height: '18px', 
              cursor: 'pointer', 
              color: '#64748b', 
              fontSize: '10px',
              transform: isExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease'
            }}
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation();
                toggleExpand(folder.id);
              }
            }}
          >
            {hasChildren ? '▶' : '•'}
          </span>

          {(() => {
            const { color, iconKey } = getFolderStyleAndIcon(folder);
            const FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
            return <FolderIconComponent style={{ fontSize: '18px', color: color, flexShrink: 0 }} />;
          })()}
          
          <span style={{ fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={folder.name}>
            {folder.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCreatingSubfolder(true);
              setSubfolderInput('');
            }}
            title="Create Subfolder & Add Files"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#38bdf8',
              borderRadius: '4px',
              padding: '3px 6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            + Subfolder
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(folder);
            }}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            Select
          </button>
        </div>
      </div>

      {isCreatingSubfolder && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '4px 8px 4px 24px', 
            background: '#1e293b', 
            borderRadius: '6px', 
            marginTop: '2px', 
            marginBottom: '4px' 
          }}
        >
          <input
            type="text"
            placeholder="Subfolder name..."
            value={subfolderInput}
            onChange={(e) => setSubfolderInput(e.target.value)}
            autoFocus
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                if (subfolderInput.trim()) {
                  await onCreateSubfolder(subfolderInput.trim(), folder.id);
                  setIsCreatingSubfolder(false);
                  setSubfolderInput('');
                }
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                setIsCreatingSubfolder(false);
                setSubfolderInput('');
              }
            }}
            onBlur={() => {
              // Wait slightly in case user clicked "Create" button or cancel
              setTimeout(() => {
                setIsCreatingSubfolder(false);
                setSubfolderInput('');
              }, 200);
            }}
            style={{
              flex: 1,
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid #3b82f6',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <button
            onMouseDown={async (e) => {
              e.preventDefault();
              if (subfolderInput.trim()) {
                await onCreateSubfolder(subfolderInput.trim(), folder.id);
                setIsCreatingSubfolder(false);
                setSubfolderInput('');
              }
            }}
            style={{
              background: '#10b981',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              padding: '3px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            Create
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setIsCreatingSubfolder(false);
              setSubfolderInput('');
            }}
            style={{
              background: 'transparent',
              border: '1px solid #475569',
              color: '#94a3b8',
              borderRadius: '4px',
              padding: '2px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 'bold'
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px dashed #334155', marginLeft: '8px', paddingLeft: '4px' }}>
          {children.map(child => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              onSelect={onSelect}
              onCreateSubfolder={onCreateSubfolder}
              expandedFolders={expandedFolders}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddToFolderModal({
  isOpen,
  onClose,
  selectedFiles,
  virtualFolders,
  createVirtualFolder,
  addFilesToVirtualFolder,
  globalFileCache,
  isMoveMode = false,
  sourceVirtualFolder = null,
  removeFilesFromVirtualFolder = null,
  loadVirtualFolders = null
}) {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [creatingSubfolderForId, setCreatingSubfolderForId] = useState(null);
  const [subfolderInputVal, setSubfolderInputVal] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  React.useEffect(() => {
    if (isOpen && loadVirtualFolders) {
      loadVirtualFolders();
    }
  }, [isOpen, loadVirtualFolders]);

  const toggleExpand = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Show all folders since all support manual file grouping
  const staticFolders = virtualFolders || [];

  // Filter folders by search query
  const filteredFolders = staticFolders.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const executeFolderMove = async (targetFolder) => {
    try {
      const fileIds = selectedFiles.map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
      const subfolderPaths = selectedFiles.filter(path => path.startsWith('virtual_folder:'));
      const subfolderIds = subfolderPaths.map(path => parseInt(path.split(':')[1], 10));

      // --- VALIDATE FIRST ---
      if (subfolderIds.length > 0) {
        for (const subId of subfolderIds) {
          if (subId === targetFolder.id) {
            setError("Cannot move a folder into itself.");
            return;
          }
          // Check descendants to prevent cycles
          const isDescendant = (parentId, childId) => {
            let current = staticFolders.find(f => f.id === childId);
            while (current && current.parent_id) {
              if (current.parent_id === parentId) return true;
              current = staticFolders.find(f => f.id === current.parent_id);
            }
            return false;
          };
          if (isDescendant(subId, targetFolder.id)) {
            setError("Cannot move a folder into one of its subfolders.");
            return;
          }
        }
      }

      let movedSomething = false;

      // 1. Move files
      if (fileIds.length > 0) {
        const filePaths = selectedFiles.filter(path => !path.startsWith('virtual_folder:'));
        // Add to target folder
        await addFilesToVirtualFolder(targetFolder.id, fileIds, filePaths);
        // Remove from source folder non-recursively to preserve new subfolder location
        if (sourceVirtualFolder && removeFilesFromVirtualFolder) {
          await removeFilesFromVirtualFolder(sourceVirtualFolder.id, fileIds, filePaths, false);
        }
        movedSomething = true;
      }

      // 2. Move subfolders
      if (subfolderIds.length > 0) {
        for (const subId of subfolderIds) {
          await axios.put(`${API}/virtual-folders/${subId}`, { parent_id: targetFolder.id });
        }
        movedSomething = true;
      }

      if (movedSomething) {
        if (loadVirtualFolders) {
          await loadVirtualFolders();
        }
      }
      onClose();
    } catch (err) {
      setError('Failed to move items: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleSelectFolder = async (folder) => {
    if (isMoveMode) {
      await executeFolderMove(folder);
      return;
    }

    // Translate file paths to database IDs
    const fileIds = selectedFiles.map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
    if (fileIds.length === 0 && selectedFiles.length === 0) {
      setError("No valid selection found.");
      return;
    }
    
    await addFilesToVirtualFolder(folder.id, fileIds, selectedFiles);
    onClose();
  };

  const handleCreateAndAdd = async () => {
    const validationError = validateFolderName(newFolderName);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    const fileIds = selectedFiles.map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
    if (fileIds.length === 0 && selectedFiles.length === 0) {
      setError("No valid selection found.");
      return;
    }

    // Create a static virtual folder
    const folder = await createVirtualFolder(newFolderName.trim(), null, false, null);
    if (folder && folder.id) {
      if (isMoveMode) {
        await executeFolderMove(folder);
      } else {
        await addFilesToVirtualFolder(folder.id, fileIds, selectedFiles);
        setNewFolderName('');
        onClose();
      }
    }
  };

  const handleCreateSubfolderAndAdd = async (subfolderName, parentFolderId) => {
    const validationError = validateFolderName(subfolderName);
    if (validationError) {
      setError(validationError);
      return;
    }

    const fileIds = selectedFiles.map(path => globalFileCache.current?.get(path)?.id).filter(id => id);
    if (fileIds.length === 0 && selectedFiles.length === 0) {
      setError("No valid selection found.");
      return;
    }

    try {
      const folder = await createVirtualFolder(subfolderName, parentFolderId, false, null);
      if (folder && folder.id) {
        if (isMoveMode) {
          await executeFolderMove(folder);
        } else {
          await addFilesToVirtualFolder(folder.id, fileIds, selectedFiles);
          onClose();
        }
      }
    } catch (err) {
      setError('Failed to create subfolder: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#111827',
        border: '1px solid #24324a',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid #1f2937'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: '600' }}>
            {isMoveMode ? 'Move to Virtual Folder' : 'Add to Virtual Folder'}
          </h3>
          <ActionButton onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px' }}>
            <CloseIcon fontSize="small" />
          </ActionButton>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            {isMoveMode ? 'Moving' : 'Adding'} <b>{selectedFiles.length}</b> item(s) to a folder.
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: '#ef4444', background: '#ef44441a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ef44443a' }}>
              {error}
            </div>
          )}

          {/* Quick Create Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Create & {isMoveMode ? 'Move' : 'Add'} to New Folder</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Folder name (e.g. Favorite Songs)..."
                value={newFolderName}
                onChange={(e) => { setNewFolderName(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
              <button 
                onClick={handleCreateAndAdd}
                style={{
                  background: '#3b82f6',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <AddIcon style={{ fontSize: '16px' }} /> Create
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1f2937', margin: '8px 0' }} />

          {/* Search Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Select Existing Folder</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Filter folders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#f8fafc',
                  outline: 'none',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <SearchIcon style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#475569' }} />
            </div>
          </div>

          {/* Folder List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #1f2937',
            borderRadius: '8px',
            padding: '8px',
            background: '#0f172a'
          }}>
            <style>
              {`
                .folder-node-hover:hover {
                  background-color: #1e293b !important;
                  color: #38bdf8 !important;
                }
              `}
            </style>
            {search.trim() ? (
              filteredFolders.length > 0 ? (
                filteredFolders.map(folder => (
                  <div
                    key={folder.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: '100%',
                      background: 'transparent',
                      borderRadius: '6px',
                      marginBottom: '4px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        color: '#cbd5e1',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                      }}
                      className="folder-node-hover"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        {(() => {
                          const { color, iconKey } = getFolderStyleAndIcon(folder);
                          const FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
                          return <FolderIconComponent style={{ fontSize: '18px', color: color, flexShrink: 0 }} />;
                        })()}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={folder.name}>
                          {folder.name}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreatingSubfolderForId(folder.id);
                            setSubfolderInputVal('');
                          }}
                          title="Create Subfolder & Add Files"
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#38bdf8',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          + Subfolder
                        </button>
                        
                        <button
                          onClick={() => handleSelectFolder(folder)}
                          style={{
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            border: 'none',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Select
                        </button>
                      </div>
                    </div>

                    {creatingSubfolderForId === folder.id && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '4px 8px 4px 24px', 
                          background: '#1e293b', 
                          borderRadius: '6px', 
                          marginTop: '2px', 
                          marginBottom: '4px' 
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Subfolder name..."
                          value={subfolderInputVal}
                          onChange={(e) => setSubfolderInputVal(e.target.value)}
                          autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              if (subfolderInputVal.trim()) {
                                await handleCreateSubfolderAndAdd(subfolderInputVal.trim(), folder.id);
                                setCreatingSubfolderForId(null);
                                setSubfolderInputVal('');
                              }
                            } else if (e.key === 'Escape') {
                              e.stopPropagation();
                              setCreatingSubfolderForId(null);
                              setSubfolderInputVal('');
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setCreatingSubfolderForId(null);
                              setSubfolderInputVal('');
                            }, 200);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #3b82f6',
                            background: '#0f172a',
                            color: '#f8fafc',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        />
                        <button
                          onMouseDown={async (e) => {
                            e.preventDefault();
                            if (subfolderInputVal.trim()) {
                              await handleCreateSubfolderAndAdd(subfolderInputVal.trim(), folder.id);
                              setCreatingSubfolderForId(null);
                              setSubfolderInputVal('');
                            }
                          }}
                          style={{
                            background: '#10b981',
                            border: 'none',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Create
                        </button>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCreatingSubfolderForId(null);
                            setSubfolderInputVal('');
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #475569',
                            color: '#94a3b8',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                  No folders match search.
                </div>
              )
            ) : (
              staticFolders.filter(f => !f.parent_id).length > 0 ? (
                staticFolders.filter(f => !f.parent_id).map(rootFolder => (
                  <FolderTreeNode
                    key={rootFolder.id}
                    folder={rootFolder}
                    allFolders={staticFolders}
                    onSelect={handleSelectFolder}
                    onCreateSubfolder={handleCreateSubfolderAndAdd}
                    expandedFolders={expandedFolders}
                    toggleExpand={toggleExpand}
                  />
                ))
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                  No virtual folders created yet.
                </div>
              )
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px 20px',
          borderTop: '1px solid #1f2937',
          background: '#0f172a',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px'
        }}>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
