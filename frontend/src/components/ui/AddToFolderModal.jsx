import React, { useState } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { getFolderStyleAndIcon, ICON_MAP } from '../../pages/VirtualFolders';

import { ActionButton } from './ActionButton';

function FolderTreeNode({ folder, allFolders, onSelect, expandedFolders, toggleExpand }) {
  const children = allFolders.filter(f => f.parent_id === folder.id);
  const isExpanded = !!expandedFolders[folder.id];
  const hasChildren = children.length > 0;

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
            fontWeight: 'bold',
            marginLeft: '8px',
            flexShrink: 0
          }}
        >
          Select
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px dashed #334155', marginLeft: '8px', paddingLeft: '4px' }}>
          {children.map(child => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              allFolders={allFolders}
              onSelect={onSelect}
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
  globalFileCache
}) {
  if (!isOpen) return null;

  const [search, setSearch] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});

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

  const handleSelectFolder = async (folder) => {
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
    if (!newFolderName.trim()) {
      setError("Folder name cannot be empty.");
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
      await addFilesToVirtualFolder(folder.id, fileIds, selectedFiles);
      setNewFolderName('');
      onClose();
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
            Add to Virtual Folder
          </h3>
          <ActionButton onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px' }}>
            <CloseIcon fontSize="small" />
          </ActionButton>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            Adding <b>{selectedFiles.length}</b> file(s) to a folder.
          </div>

          {error && (
            <div style={{ fontSize: '13px', color: '#ef4444', background: '#ef44441a', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ef44443a' }}>
              {error}
            </div>
          )}

          {/* Quick Create Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Create & Add to New Folder</label>
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
                  <button
                    key={folder.id}
                    onClick={() => handleSelectFolder(folder)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      marginBottom: 0
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#38bdf8'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#cbd5e1'; }}
                  >
                    {(() => {
                      const { color, iconKey } = getFolderStyleAndIcon(folder);
                      const FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
                      return <FolderIconComponent style={{ fontSize: '18px', color: color }} />;
                    })()}
                    {folder.name}
                  </button>
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
