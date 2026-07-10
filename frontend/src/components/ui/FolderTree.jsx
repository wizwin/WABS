import React, { useState, useEffect, useMemo } from 'react';
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
  settings
}) {
  const isPhys = page !== 'virtual_folder';
  const isSearchActive = page === 'search' || !!query;

  // State for expanded nodes
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (nodeId) => {
    setExpanded(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // 1. Build physical folders tree (only folders!)
  const backups = useMemo(() => {
    return settings?.backup_configs || [{
      id: 'default',
      name: 'Default Backup Location',
      backup_path: settings?.backup_path || ''
    }];
  }, [settings]);

  // 1. Build physical folders tree (only folders!) with backup locations as roots
  const physicalFolderTree = useMemo(() => {
    // Create a tree node for each backup configuration
    const backupsList = backups.map(b => {
      let pathKey = String(b.backup_path || '').replace(/\\/g, '/').toLowerCase();
      if (pathKey.endsWith('/') && pathKey.length > 3) {
        pathKey = pathKey.slice(0, -1);
      }
      let displayPath = b.backup_path ? String(b.backup_path).replace(/\\/g, '/') : 'root';
      if (displayPath.endsWith('/') && displayPath.length > 3) {
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

    (directories || []).forEach(dirPath => {
      if (!dirPath) return;
      let normalized = dirPath.replace(/\\/g, '/');
      if (normalized.endsWith('/') && normalized.length > 3) {
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

      if (!matchedRoot) {
        return;
      }

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
    });

    const activeRoots = [];
    backupsList.forEach(r => {
      if (!r.path || r.path === 'root') {
        if (Object.keys(r.children).length > 0) {
          activeRoots.push(r);
        }
      } else {
        activeRoots.push(r);
      }
    });



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
          acc = i === 0 ? parts[i] : acc + '/' + parts[i];
          next[acc] = true;
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
    const isExpanded = !!expanded[nodeId];
    
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

    const isActiveVirtual = page === 'virtual_folder' && node.isVirtual && node.id === virtualFolderId;
    const isCleanActive = isPhys ? (
      (activeFolderPath === null && node.path === 'root') ||
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>
        {`
          .folder-tree-row-hover:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
          }
        `}
      </style>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #1f2937', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Folders Tree
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 6px' }}>
        {topLevelNodes.map(node => renderFolderNode(node, 0))}
      </div>
    </div>
  );
}
