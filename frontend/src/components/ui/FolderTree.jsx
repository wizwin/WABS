import React, { useState, useEffect, useMemo, useRef } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { ICON_MAP, getFolderStyleAndIcon } from '../../pages/VirtualFolders';

export function FolderTree({
  page,
  sortedFiles,
  directories,
  virtualFolders,
  virtualFolderId,
  currentVirtualFolder,
  handleOpenFolder,
  activeFolderPath,
  setActiveFolderPath,
  query,
  settings,
  setPendingLocatePath
}) {
  const isPhys = page !== 'virtual_folder';
  const isSearchActive = page === 'search' || !!query;

  // State for expanded nodes
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (nodeId) => {
    if (!nodeId) return;
    const key = String(nodeId).replace(/\\/g, '/').toLowerCase();
    setExpanded(prev => ({
      ...prev,
      [nodeId]: !prev[key],
      [key]: !prev[key]
    }));
  };

  // 1. Build physical folders tree (only folders!)
  const backups = useMemo(() => {
    const list = settings?.backup_configs || [];
    const valid = list.filter(b => b.backup_path && b.backup_path.trim() !== '');
    if (valid.length > 0) {
      return valid;
    }
    if (settings?.backup_path && settings.backup_path.trim() !== '') {
      return [{
        id: 'default',
        name: 'Default Backup Location',
        backup_path: settings.backup_path
      }];
    }
    return [];
  }, [settings]);

  // 1. Build physical folders tree (only folders!) with backup locations as roots
  const physicalFolderTree = useMemo(() => {
    // Create a tree node for each configured backup location
    const backupsList = backups.map(b => {
      let pathKey = String(b.backup_path || '').replace(/\\/g, '/').toLowerCase();
      if (pathKey.endsWith('/') && pathKey.length > 1) {
        pathKey = pathKey.slice(0, -1);
      }
      let displayPath = String(b.backup_path || '').replace(/\\/g, '/');
      if (displayPath.endsWith('/') && displayPath.length > 1) {
        displayPath = displayPath.slice(0, -1);
      }
      return {
        name: b.name || 'Backup Location',
        path: displayPath,
        type: 'folder',
        isBackupRoot: true,
        backupPathKey: pathKey,
        children: {}
      };
    });

    const fallbackRoots = {};

    (directories || []).forEach(dirPath => {
      if (!dirPath) return;
      let normalized = dirPath.replace(/\\/g, '/');
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }
      const normalizedLower = normalized.toLowerCase();

      // Check if this directory path is a parent/ancestor of any configured backup path
      const dirParts = normalizedLower.split('/').filter(Boolean);
      const isAncestorOfBackup = backupsList.some(rootNode => {
        if (!rootNode.backupPathKey) return false;
        const backupParts = rootNode.backupPathKey.split('/').filter(Boolean);
        if (dirParts.length >= backupParts.length) return false;
        return dirParts.every((part, idx) => part === backupParts[idx]);
      });
      if (isAncestorOfBackup) return;

      // Find the longest matching backup path prefix
      let matchedRoot = null;
      let matchedPathKey = '';
      let longestMatchLen = -1;

      backupsList.forEach(rootNode => {
        if (rootNode.backupPathKey && (normalizedLower.startsWith(rootNode.backupPathKey + '/') || normalizedLower === rootNode.backupPathKey)) {
          if (rootNode.backupPathKey.length > longestMatchLen) {
            longestMatchLen = rootNode.backupPathKey.length;
            matchedRoot = rootNode;
            matchedPathKey = rootNode.backupPathKey;
          }
        }
      });

      if (matchedRoot) {
        // Compute path relative to backup root
        let relativePath = normalized;
        if (matchedPathKey) {
          relativePath = normalized.substring(matchedPathKey.length);
          if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
          }
        }

        const parts = relativePath.split('/').filter(Boolean);
        let current = matchedRoot;
        let accumulatedPath = matchedRoot.path === 'root' ? '' : matchedRoot.path;

        parts.forEach(part => {
          if (accumulatedPath) {
            accumulatedPath += '/' + part;
          } else {
            accumulatedPath = part;
          }

          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: accumulatedPath,
              type: 'folder',
              children: {}
            };
          }
          current = current.children[part];
        });
      } else {
        // Fallback: Group under drive letter / root directory (e.g. C:, D:, /)
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return;

        const driveName = normalized.startsWith('/') ? '/' + parts[0] : parts[0];
        const driveKey = driveName.toLowerCase();

        if (!fallbackRoots[driveKey]) {
          fallbackRoots[driveKey] = {
            name: driveName,
            path: driveName,
            type: 'folder',
            isDriveRoot: true,
            children: {}
          };
        }

        let current = fallbackRoots[driveKey];
        let accumulatedPath = driveName;

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          accumulatedPath += '/' + part;
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              path: accumulatedPath,
              type: 'folder',
              children: {}
            };
          }
          current = current.children[part];
        }
      }
    });

    const activeRoots = [
      ...backupsList,
      ...Object.values(fallbackRoots).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    ];

    return activeRoots;
  }, [directories, backups]);

  // 2. Build virtual folders tree (only folders!)
  const virtualFolderTree = useMemo(() => {
    const root = {
      name: 'Virtual Folders',
      id: 'vf_root',
      type: 'folder',
      children: []
    };

    const folderMap = {};
    (virtualFolders || []).forEach(vf => {
      folderMap[vf.id] = {
        id: vf.id,
        name: vf.name,
        type: 'folder',
        isVirtual: true,
        virtualFolder: vf,
        children: []
      };
    });

    const roots = [];
    (virtualFolders || []).forEach(vf => {
      const node = folderMap[vf.id];
      if (vf.parent_id === null || vf.parent_id === undefined) {
        roots.push(node);
      } else {
        const parentNode = folderMap[vf.parent_id];
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    // Sort virtual subfolders alphabetically
    const sortChildren = (node) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      node.children.forEach(child => sortChildren(child));
    };

    roots.forEach(r => sortChildren(r));
    roots.sort((a, b) => a.name.localeCompare(b.name));

    root.children = roots;
    return root;
  }, [virtualFolders]);

  // 3. Auto-expand folder tree during searches
  useEffect(() => {
    if (isSearchActive && sortedFiles && sortedFiles.length > 0) {
      const newExpanded = {};
      sortedFiles.forEach(file => {
        if (!file || !file.path) return;
        const normalized = file.path.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        let acc = '';
        // Expand all parents of matching files
        for (let i = 0; i < parts.length - 1; i++) {
          acc = i === 0 ? parts[i] : acc + '/' + parts[i];
          newExpanded[acc] = true;
          newExpanded[acc.toLowerCase()] = true;
        }
      });
      setExpanded(newExpanded);
    }
  }, [isSearchActive, sortedFiles]);

  // 4. Auto-expand tree to show the active physical folder path
  useEffect(() => {
    if (isPhys && activeFolderPath) {
      const normalized = activeFolderPath.replace(/\\/g, '/');
      const parts = normalized.split('/').filter(Boolean);
      setExpanded(prev => {
        const next = { ...prev };
        let acc = '';
        for (let i = 0; i < parts.length; i++) {
          acc = i === 0 ? (activeFolderPath.startsWith('/') ? '/' + parts[0] : parts[0]) : acc + '/' + parts[i];
          next[acc] = true;
          next[acc.toLowerCase()] = true;
        }
        return next;
      });
    }
  }, [activeFolderPath, isPhys]);

  // 5. Auto-expand tree to show the active virtual folder
  useEffect(() => {
    if (!isPhys && virtualFolderId && virtualFolders) {
      setExpanded(prev => {
        const next = { ...prev };
        let currentId = virtualFolderId;
        while (currentId) {
          next[currentId] = true;
          next[String(currentId).toLowerCase()] = true;
          const folder = (virtualFolders || []).find(f => f.id === currentId);
          currentId = folder ? folder.parent_id : null;
        }
        return next;
      });
    }
  }, [virtualFolderId, virtualFolders, isPhys]);

  // Recursive folder node renderer
  const renderFolderNode = (node, depth = 0) => {
    const nodeId = node.path || node.id;
    const nodeKey = nodeId ? String(nodeId).replace(/\\/g, '/').toLowerCase() : '';
    const isExpanded = !!expanded[nodeId] || !!expanded[nodeKey];
    
    // Check if node has subfolders
    let childrenList = [];
    if (node.children) {
      if (Array.isArray(node.children)) {
        childrenList = node.children;
      } else {
        childrenList = Object.values(node.children).sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );
      }
    }

    const hasSubfolders = childrenList.length > 0;

    let customColor = '#3b82f6';
    let FolderIconComponent = FolderIcon;
    if (node.isVirtual && node.virtualFolder) {
      const { color, iconKey } = getFolderStyleAndIcon(node.virtualFolder);
      customColor = color;
      FolderIconComponent = ICON_MAP[iconKey] || FolderIcon;
    }

    const isActiveVirtual = page === 'virtual_folder' && node.isVirtual && (node.id === virtualFolderId || String(node.id) === String(virtualFolderId));
    const isCleanActive = isPhys ? (
      (activeFolderPath === null && (node.path === 'root' || (node.isBackupRoot && !activeFolderPath))) ||
      (activeFolderPath !== null && activeFolderPath.replace(/\\/g, '/').toLowerCase() === (node.path || '').replace(/\\/g, '/').toLowerCase())
    ) : isActiveVirtual;

    return (
      <div key={nodeId} style={{ display: 'flex', flexDirection: 'column' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px 8px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: isCleanActive ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
            border: isCleanActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
            color: isCleanActive ? '#38bdf8' : '#cbd5e1',
            gap: '6px',
            paddingLeft: `${depth * 14 + 6}px`,
            transition: 'background 0.2s',
          }}
          className="folder-tree-row-hover"
          onClick={(e) => {
            e.stopPropagation();
            if (node.isVirtual && node.virtualFolder) {
              handleOpenFolder(node.virtualFolder);
            } else if (isPhys) {
              setActiveFolderPath(node.path === 'root' ? null : node.path);
              
              if (page === 'search' && setPendingLocatePath && sortedFiles && sortedFiles.length > 0) {
                const normalizePath = (p) => {
                  if (!p) return '';
                  let norm = p.replace(/\\/g, '/').toLowerCase();
                  if (norm.endsWith('/') && norm.length > 1) {
                    norm = norm.slice(0, -1);
                  }
                  return norm;
                };

                const folderNorm = normalizePath(node.path);
                
                // Find first direct child file
                let targetFile = sortedFiles.find(file => {
                  if (!file || !file.path) return false;
                  const fileNorm = normalizePath(file.path);
                  const lastSlashIdx = fileNorm.lastIndexOf('/');
                  const fileDir = lastSlashIdx === -1 ? '' : fileNorm.substring(0, lastSlashIdx);
                  return fileDir === folderNorm;
                });

                // If not found, find first descendant file
                if (!targetFile) {
                  targetFile = sortedFiles.find(file => {
                    if (!file || !file.path) return false;
                    const fileNorm = normalizePath(file.path);
                    return fileNorm.startsWith(folderNorm + '/');
                  });
                }

                if (targetFile) {
                  setPendingLocatePath(targetFile.path);
                }
              }
            }
          }}
        >
          {/* Caret click expands/collapses */}
          <span 
            style={{ display: 'flex', alignItems: 'center', width: '16px', height: '16px', color: '#64748b' }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(nodeId);
            }}
          >
            {hasSubfolders ? (
              isExpanded ? <ExpandMoreIcon style={{ fontSize: '16px' }} /> : <ChevronRightIcon style={{ fontSize: '16px' }} />
            ) : null}
          </span>

          <FolderIconComponent style={{ color: customColor, fontSize: '18px', flexShrink: 0 }} />

          <span 
            style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={node.name}
          >
            {node.name}
          </span>
        </div>

        {isExpanded && childrenList.map(child => renderFolderNode(child, depth + 1))}
      </div>
    );
  };

  const topLevelNodes = useMemo(() => {
    if (isPhys) {
      return physicalFolderTree;
    } else {
      return virtualFolderTree.children;
    }
  }, [isPhys, physicalFolderTree, virtualFolderTree]);

  // 6. Auto-expand root nodes on initial load so the user sees the folder tree
  const initializedRootsRef = useRef(false);
  useEffect(() => {
    if (topLevelNodes && topLevelNodes.length > 0 && !initializedRootsRef.current) {
      initializedRootsRef.current = true;
      setExpanded(prev => {
        const next = { ...prev };
        topLevelNodes.forEach(node => {
          const id = node.path || node.id;
          if (id) {
            next[id] = true;
            next[String(id).replace(/\\/g, '/').toLowerCase()] = true;
          }
        });
        return next;
      });
    }
  }, [topLevelNodes]);

  const getAllNodeIds = (nodes) => {
    const ids = [];
    const traverse = (node) => {
      const nodeId = node.path || node.id;
      if (nodeId) {
        ids.push(nodeId);
      }
      let childrenList = [];
      if (node.children) {
        if (Array.isArray(node.children)) {
          childrenList = node.children;
        } else {
          childrenList = Object.values(node.children);
        }
      }
      childrenList.forEach(traverse);
    };
    nodes.forEach(traverse);
    return ids;
  };

  const expandAll = () => {
    const ids = getAllNodeIds(topLevelNodes);
    const newExpanded = {};
    ids.forEach(id => {
      newExpanded[id] = true;
      newExpanded[String(id).replace(/\\/g, '/').toLowerCase()] = true;
    });
    setExpanded(newExpanded);
  };

  const collapseAll = () => {
    setExpanded({});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>
        {`
          .folder-tree-row-hover:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
          }
          .folder-tree-header-btn {
            background: none;
            border: none;
            color: #64748b;
            cursor: pointer;
            font-family: monospace;
            font-size: 14px;
            font-weight: bold;
            padding: 0 4px;
            display: flex;
            align-items: center;
            transition: color 0.15s, transform 0.1s;
            user-select: none;
          }
          .folder-tree-header-btn:hover {
            color: #38bdf8;
          }
          .folder-tree-header-btn:active {
            transform: scale(0.9);
          }
        `}
      </style>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #1f2937',
        fontSize: '12px',
        color: '#94a3b8',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <span>Folders Tree</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button 
            onClick={expandAll} 
            className="folder-tree-header-btn" 
            title="Expand All"
          >
            [+]
          </button>
          <button 
            onClick={collapseAll} 
            className="folder-tree-header-btn" 
            title="Collapse All"
          >
            [-]
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 6px' }}>
        {topLevelNodes.map(node => renderFolderNode(node, 0))}
      </div>
    </div>
  );
}
