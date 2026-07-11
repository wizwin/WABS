import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API } from '../States';
import { SettingsContext } from '../States';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ImageIcon from '@mui/icons-material/Image';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import MovieIcon from '@mui/icons-material/Movie';
import DescriptionIcon from '@mui/icons-material/Description';
import StarIcon from '@mui/icons-material/Star';
import FavoriteIcon from '@mui/icons-material/Favorite';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ActionButton } from '../components/ui/ActionButton';
import { ProgressBar } from '../components/ui/ProgressBar';

export const ICON_MAP = {
  folder: FolderIcon,
  image: ImageIcon,
  audio: AudiotrackIcon,
  video: MovieIcon,
  document: DescriptionIcon,
  star: StarIcon,
  favorite: FavoriteIcon,
  bookmark: BookmarkIcon,
  work: WorkIcon,
  person: PersonIcon,
  home: HomeIcon
};

export const FOLDER_COLORS = [
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#64748b', // Gray
  '#14b8a6'  // Teal
];

export const FOLDER_ICONS = [
  { key: 'folder', label: 'Default Folder' },
  { key: 'image', label: 'Photos' },
  { key: 'audio', label: 'Audio/Music' },
  { key: 'video', label: 'Videos' },
  { key: 'document', label: 'Documents' },
  { key: 'star', label: 'Starred' },
  { key: 'favorite', label: 'Heart' },
  { key: 'bookmark', label: 'Tag' },
  { key: 'work', label: 'Work' },
  { key: 'person', label: 'Person' },
  { key: 'home', label: 'Home' }
];

export function getFolderStyleAndIcon(folder) {
  let color = '#3b82f6';
  let iconKey = 'folder';
  
  if (folder && folder.metadata_json) {
    try {
      const meta = JSON.parse(folder.metadata_json);
      if (meta.color) color = meta.color;
      if (meta.icon) iconKey = meta.icon;
    } catch (e) {}
  }
  
  return { color, iconKey };
}

export default function VirtualFolders(props) {
  const {
    page,
    setPage,
    virtualFolders,
    setVirtualFolderId,
    setCurrentVirtualFolder,
    createVirtualFolder,
    deleteVirtualFolder,
    renameVirtualFolder,
    loadVirtualFolders,
    loadFiles,
    filterCategory,
    setFilterCategory,
    sortBy,
    sortOrder,
    indexer,
    virtualFolderCounts,
    fetchFolderCount,
    loadAllFolderCounts,
    loadingAllCounts
  } = props;

  const { animationsEnabled } = useContext(SettingsContext);
  const [hoveredFolder, setHoveredFolder] = useState(null);
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

  useEffect(() => {
    if (page === 'virtual_folders' && loadVirtualFolders) {
      loadVirtualFolders();
    }
  }, [page]);

  if (page !== 'virtual_folders') return null;

  const rootFolders = (virtualFolders || []).filter(f => !f.parent_id);

  const getSubfoldersCount = (folderId) => {
    return (virtualFolders || []).filter(f => f.parent_id === folderId).length;
  };

  const handleOpenFolder = (folder) => {
    if (indexer && indexer.export_running) return;
    setVirtualFolderId(folder.id);
    setCurrentVirtualFolder(folder);
    setPage('virtual_folder');
    setFilterCategory('all');
    loadFiles(0, false, 'all', sortBy, sortOrder, 'virtual_folder', folder.id);
  };

  const handleConfirm = () => {
    const val = modalInputValue.trim();
    if (!val) {
      setModalError('Folder name cannot be empty.');
      return;
    }
    modalConfig.onConfirm(val, selectedColor, selectedIcon);
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  const handleCreateRoot = () => {
    setSelectedColor('#3b82f6');
    setSelectedIcon('folder');
    setModalConfig({
      isOpen: true,
      title: 'Create Folder',
      initialValue: '',
      placeholder: 'e.g. Family Trip, Workout Music',
      onConfirm: (name, color, icon) => {
        const meta = JSON.stringify({ color, icon });
        createVirtualFolder(name, null, false, null, meta);
      }
    });
    setModalInputValue('');
    setModalError('');
  };

  const handleCreateSub = (parent) => {
    setSelectedColor('#3b82f6');
    setSelectedIcon('folder');
    setModalConfig({
      isOpen: true,
      title: `Create Subfolder under "${parent.name}"`,
      initialValue: '',
      placeholder: 'Subfolder Name',
      onConfirm: (name, color, icon) => {
        const meta = JSON.stringify({ color, icon });
        createVirtualFolder(name, parent.id, false, null, meta);
      }
    });
    setModalInputValue('');
    setModalError('');
  };

  const handleRename = (folder) => {
    const { color, iconKey } = getFolderStyleAndIcon(folder);
    setSelectedColor(color);
    setSelectedIcon(iconKey);
    setModalConfig({
      isOpen: true,
      title: `Edit "${folder.name}"`,
      initialValue: folder.name,
      placeholder: 'New Name',
      onConfirm: (name, colorVal, iconVal) => {
        const meta = JSON.stringify({ color: colorVal, icon: iconVal });
        renameVirtualFolder(folder.id, name, meta);
      }
    });
    setModalInputValue(folder.name);
    setModalError('');
  };

  const handleDelete = (folder) => {
    if (confirm(`Are you sure you want to delete "${folder.name}"? This deletes the folder and all its subfolders, but does NOT delete files on disk.`)) {
      deleteVirtualFolder(folder.id);
    }
  };

  const renderFolderSection = (parentId = null) => {
    const folders = (virtualFolders || []).filter(f => f.parent_id === parentId);
    if (folders.length === 0) return null;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '12px' }}>
        {folders.map(folder => {
          const subCount = getSubfoldersCount(folder.id);
          const isHovered = hoveredFolder === folder.id;
          const hasRules = !!(folder.query || '').strip?.() || !!folder.query;

          return (
            <div 
              key={folder.id}
              onMouseEnter={() => setHoveredFolder(folder.id)}
              onMouseLeave={() => setHoveredFolder(null)}
              style={{
                background: '#111827',
                border: '1px solid #24324a',
                borderRadius: '16px',
                padding: '18px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: animationsEnabled ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                transform: animationsEnabled && isHovered ? 'translateY(-4px) scale(1.02)' : 'none',
                boxShadow: animationsEnabled && isHovered ? '0 10px 20px -10px rgba(139, 92, 246, 0.3)' : 'none',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => handleOpenFolder(folder)}
            >
              {/* Highlight top bar if it has automatic rules */}
              {hasRules && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #a855f7, #6366f1)' }} />
              )}

              {indexer && indexer.export_running && indexer.export_folder_id === folder.id && (
                <div style={{ 
                  marginBottom: '14px', 
                  padding: '12px', 
                  background: 'rgba(30, 41, 59, 0.8)', 
                  borderRadius: '10px', 
                  border: '1px solid #334155' 
                }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: '600' }}>Exporting...</span>
                    <button 
                      style={{ 
                        background: 'rgba(239, 68, 68, 0.1)', 
                        color: '#ef4444', 
                        border: '1px solid rgba(239, 68, 68, 0.2)', 
                        borderRadius: '4px', 
                        padding: '2px 8px', 
                        fontSize: '10px', 
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to cancel the export?")) {
                          try {
                            await axios.post(`${API}/system/cancel-data-operation`);
                          } catch(err) {
                            console.error(err);
                          }
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  <ProgressBar current={indexer.export_current} total={indexer.export_total} color="#10b981" />
                  {indexer.export_current_file && (
                    <div style={{ 
                      marginTop: '6px', 
                      fontSize: '10px', 
                      color: '#94a3b8', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }}>
                      {indexer.export_current_file}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {(() => {
                    const { color, iconKey } = getFolderStyleAndIcon(folder);
                    const FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
                    return <FolderIconComponent style={{ color: color, fontSize: '24px' }} />;
                  })()}
                </div>

                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#f8fafc', fontWeight: '600', wordBreak: 'break-word' }}>
                  {folder.name}
                </h3>

                <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(() => {
                    const count = virtualFolderCounts[folder.id];
                    if (count === 'loading') {
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                          <RefreshIcon 
                            style={{ 
                              fontSize: '14px', 
                              color: '#38bdf8', 
                              animation: 'spin 1s linear infinite' 
                            }} 
                          />
                          loading...
                        </span>
                      );
                    }
                    if (count === undefined || count === null) {
                      return (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchFolderCount(folder.id);
                          }}
                          title="Click to load file count"
                          style={{ 
                            cursor: 'pointer', 
                            color: '#38bdf8', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '2px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          <RefreshIcon style={{ fontSize: '12px' }} /> Load Count
                        </span>
                      );
                    }
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{count}</span>
                        <span>file{count !== 1 ? 's' : ''}</span>
                        <RefreshIcon 
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchFolderCount(folder.id);
                          }}
                          title="Refresh count"
                          style={{ 
                            fontSize: '12px', 
                            color: '#64748b', 
                            cursor: 'pointer',
                            marginLeft: '2px'
                          }} 
                        />
                      </span>
                    );
                  })()}
                  <span style={{ color: '#64748b' }}>•</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{subCount}</span> subfolder{subCount !== 1 ? 's' : ''}
                </p>
                {hasRules && (
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`Rules: ${folder.query}`}>
                    Rules: {folder.query}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1f2937', paddingTop: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  Browse Files <ArrowForwardIosIcon style={{ fontSize: '10px' }} />
                </span>

                <div 
                  style={{ 
                    display: 'flex', 
                    gap: '4px',
                    opacity: isHovered ? 1 : 0.4,
                    transition: 'opacity 0.2s ease'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ActionButton 
                    className="btn btn-secondary" 
                    disabled={indexer && indexer.export_running}
                    onClick={() => handleCreateSub(folder)}
                    style={{ padding: '6px', minWidth: 0, borderRadius: '8px' }}
                    title="Add Subfolder"
                  >
                    <AddIcon style={{ fontSize: '16px' }} />
                  </ActionButton>
                  <ActionButton 
                    className="btn btn-secondary" 
                    disabled={indexer && indexer.export_running}
                    onClick={() => handleRename(folder)}
                    style={{ padding: '6px', minWidth: 0, borderRadius: '8px' }}
                    title="Rename"
                  >
                    <EditIcon style={{ fontSize: '16px' }} />
                  </ActionButton>
                  <ActionButton 
                    className="btn btn-secondary" 
                    disabled={indexer && indexer.export_running}
                    onClick={() => handleDelete(folder)}
                    style={{ padding: '6px', minWidth: 0, borderRadius: '8px', color: '#f87171', borderColor: '#ef44443a' }}
                    title="Delete"
                  >
                    <DeleteIcon style={{ fontSize: '16px' }} />
                  </ActionButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 0, marginBottom: '8px', fontSize: '28px', color: '#f8fafc', fontWeight: '700' }}>
            <LibraryBooksIcon fontSize="large" style={{ color: '#a855f7' }} /> Virtual Folders
          </h1>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '15px' }}>
            Manage your custom albums, device collections, and smart query folders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={loadAllFolderCounts}
            disabled={(indexer && indexer.export_running) || loadingAllCounts}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#38bdf8',
              borderRadius: '10px',
              padding: '10px 16px',
              cursor: ((indexer && indexer.export_running) || loadingAllCounts) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: ((indexer && indexer.export_running) || loadingAllCounts) ? 0.5 : 1
            }}
          >
            <RefreshIcon 
              style={{ 
                fontSize: '18px', 
                animation: loadingAllCounts ? 'spin 1s linear infinite' : 'none' 
              }} 
            /> 
            {loadingAllCounts ? 'Loading Counts...' : 'Load All Counts'}
          </button>

          <button 
            onClick={handleCreateRoot}
            disabled={indexer && indexer.export_running}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              color: 'white',
              borderRadius: '10px',
              padding: '10px 20px',
              cursor: indexer && indexer.export_running ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.4)',
              opacity: indexer && indexer.export_running ? 0.5 : 1
            }}
          >
            <AddIcon style={{ fontSize: '20px' }} /> New Folder
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
         {rootFolders.length > 0 ? (
          <div>
            {renderFolderSection(null)}
          </div>
        ) : null}

        {virtualFolders.length === 0 && (
          <div style={{
            padding: '48px 20px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '15px'
          }}>
            No virtual folders created. Click the "New Folder" button above to get started.
          </div>
        )}


      </div>

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
                  handleConfirm();
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
                onClick={handleConfirm}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '14px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none' }}
              >
                Save
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
