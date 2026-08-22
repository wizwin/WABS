import React, { useState, useMemo } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';
import GroupIcon from '@mui/icons-material/Group';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FaceIcon from '@mui/icons-material/Face';
import WorkIcon from '@mui/icons-material/Work';
import StarIcon from '@mui/icons-material/Star';
import SchoolIcon from '@mui/icons-material/School';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import FolderIcon from '@mui/icons-material/Folder';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PrintIcon from '@mui/icons-material/Print';

import { PersonThumb } from './PersonThumb';
import { API } from '../../States';

export const RELATION_ICON_MAP = {
  me: PersonPinIcon,
  home: HomeIcon,
  group: GroupIcon,
  category: CategoryIcon,
  favorite: FavoriteIcon,
  parent: GroupIcon,
  sibling: PeopleIcon,
  child: FaceIcon,
  extended: GroupIcon,
  work: WorkIcon,
  star: StarIcon,
  school: SchoolIcon,
  handshake: GroupIcon,
  folder: FolderIcon
};

export const RELATIONSHIP_SUBCATEGORIES = {
  Family: [
    { value: 'Spouse', label: 'Spouse / Partner' },
    { value: 'Parent', label: 'Parent (Father / Mother)' },
    { value: 'Child', label: 'Child (Son / Daughter)' },
    { value: 'Sibling', label: 'Sibling (Brother / Sister)' },
    { value: 'In-law', label: 'In-law (Parents / Siblings / Extended In-laws)' },
    { value: "Spouse's Family", label: "Spouse's Extended Family (Aunts / Uncles / Cousins)" },
    { value: 'Grandparent', label: 'Grandparent (Maternal / Paternal)' },
    { value: 'Grandchild', label: 'Grandchild (Grandson / Granddaughter)' },
    { value: 'Great-Grandparent', label: 'Great-Grandparent / Ancestor' },
    { value: 'Aunt / Uncle', label: "Aunt / Uncle (Parents' Siblings)" },
    { value: 'Great-Aunt / Uncle', label: "Great-Aunt / Great-Uncle (Grandparents' Siblings)" },
    { value: 'Cousin (1st)', label: "Cousin (1st - Parents' Siblings' Children)" },
    { value: 'Cousin (Once Removed)', label: "Cousin (Once Removed - Parents' / Grandparents' Cousins)" },
    { value: 'Cousin (2nd / Distant)', label: 'Cousin (2nd / 3rd / Distant)' },
    { value: 'Niece / Nephew', label: "Niece / Nephew (Siblings' Children)" },
    { value: 'Other Family', label: 'Other Family / Relative' }
  ],
  Friends: [
    { value: 'Close Friend', label: 'Close Friend' },
    { value: 'Colleague', label: 'Colleague / Work' },
    { value: 'Classmate', label: 'Classmate / School' },
    { value: 'Acquaintance', label: 'Acquaintance' },
    { value: 'Other Friend', label: 'Other Friend' }
  ],
  Others: [
    { value: 'Neighbor', label: 'Neighbor' },
    { value: 'Service Contact', label: 'Service Contact' },
    { value: 'Unknown', label: 'Other' }
  ]
};

export const DEFAULT_SUBCATEGORIES = {
  Family: 'Spouse',
  Friends: 'Close Friend',
  Others: 'Neighbor'
};

export function RelationshipTree({ treeData, openPersonPhotos, getPersonThumbUrl, namedPeopleDropdown, addPersonConnection, doSearch, setQuery, setPage }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [connectSourceNode, setConnectSourceNode] = useState(null);
  const [newConnType, setNewConnType] = useState('spouse');
  const [newConnTargetId, setNewConnTargetId] = useState('');
  const [expanded, setExpanded] = useState({
    root_me: true,
    cat_family: true,
    cat_friends: true,
    cat_others: true,
    sub_spouse: true,
    sub_parents: true,
    sub_siblings: true,
    sub_children: true,
    sub_grandparents: true,
    sub_extended: true,
    sub_cousins1: true,
    sub_cousins1r: true,
    sub_cousins2: true,
    sub_auntuncle: true,
    sub_greatauntuncle: true,
    sub_niecenephew: true,
    sub_inlaws: true,
    sub_otherfam: true,
    sub_close: true,
    sub_colleagues: true,
    sub_classmates: true,
    sub_acquaintances: true,
    sub_otherfriends: true,
    sub_neighbor: true,
    sub_service: true,
    sub_other: true
  });

  if (!treeData) return null;

  const toggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const allExpanded = {};
    const traverse = (node) => {
      if (!node) return;
      const k = node.nodeId || node.id;
      if (k) allExpanded[k] = true;
      if (Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    traverse(treeData);
    setExpanded(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpanded({});
  };

  // Filter tree nodes if searching
  const filterNode = (node, query) => {
    if (!query) return node;
    const q = query.toLowerCase();
    
    if (node.isPerson) {
      const match = (node.name && node.name.toLowerCase().includes(q)) ||
                    (node.label && node.label.toLowerCase().includes(q)) ||
                    (node.subcategory && node.subcategory.toLowerCase().includes(q));
      return match ? node : null;
    }

    if (Array.isArray(node.children)) {
      const matchedChildren = node.children
        .map(child => filterNode(child, query))
        .filter(Boolean);
      
      const selfMatch = (node.name && node.name.toLowerCase().includes(q));
      if (matchedChildren.length > 0 || selfMatch) {
        return { ...node, children: matchedChildren };
      }
    }
    return null;
  };

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    return filterNode(treeData, searchQuery.trim()) || { ...treeData, children: [] };
  }, [treeData, searchQuery]);

  const categories = filteredTree?.children || [];

  const countPersons = (node) => {
    if (!node) return 0;
    if (node.isPerson) return 1;
    if (Array.isArray(node.children)) {
      return node.children.reduce((acc, c) => acc + countPersons(c), 0);
    }
    return 0;
  };

  const handleExportGedcom = (personId = null, personName = null, category = null) => {
    let url = personId ? `${API}/people/${personId}/export/gedcom` : `${API}/people/export/gedcom`;
    if (category) {
      url += `?category=${encodeURIComponent(category)}`;
    }
    const link = document.createElement('a');
    link.href = url;
    let defaultName = 'wabs_relationship_graph.ged';
    if (personName) defaultName = `wabs_tree_${personName.toLowerCase().replace(/\s+/g, '_')}.ged`;
    else if (category) defaultName = `wabs_${category.toLowerCase()}_tree.ged`;
    link.setAttribute('download', defaultName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setShowExportMenu(false);
  };

  const printTreeCategory = (categoryKey, categoryTitle) => {
    if (!treeData) return;
    const targetCategory = treeData.children?.find(c => c.id === categoryKey || c.nodeId === categoryKey);
    if (!targetCategory) {
      alert(`No ${categoryTitle} data found to export.`);
      return;
    }
    const customRoot = {
      ...treeData,
      name: `${treeData.name} - ${categoryTitle}`,
      children: [targetCategory]
    };
    printTreeGraph(customRoot);
    setShowExportMenu(false);
  };

  const printTreeGraph = (targetNode = null) => {
    const root = targetNode || treeData;
    if (!root) return;

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      alert('Please allow popups to export the PDF / Print view.');
      return;
    }

    const renderHtmlNode = (n, depth = 0) => {
      if (!n) return '';
      const isPerson = n.isPerson;
      const conns = n.connections || [];
      let connsHtml = '';
      if (conns.length > 0) {
        connsHtml = conns.map(c => {
          let label = c.relation_type;
          let color = '#ec4899';
          if (c.relation_type === 'parent') color = '#0284c7';
          else if (c.relation_type === 'child') color = '#d97706';
          else if (c.relation_type === 'sibling') color = '#4f46e5';
          return `<span style="display:inline-block; margin-left:6px; padding:2px 8px; border-radius:12px; background:#f8fafc; border:1px solid ${color}44; font-size:11px; color:${color}; font-weight:500;">${label}: <strong>${c.related_name}</strong></span>`;
        }).join(' ');
      }

      let childrenHtml = '';
      if (Array.isArray(n.children) && n.children.length > 0) {
        childrenHtml = `<div style="border-left: 2px solid #cbd5e1; margin-left: ${depth * 18 + 12}px; padding-left: 12px; margin-top: 4px;">
          ${n.children.map(child => renderHtmlNode(child, depth + 1)).join('')}
        </div>`;
      }

      const titleStyle = isPerson ? 'font-weight:600; color:#0f172a; font-size:13.5px;' : 'font-weight:bold; color:#1e40af; font-size:14px;';
      const tag = n.label ? `<span style="color:#64748b; font-size:12px; margin-left:6px; font-style:italic;">(${n.label})</span>` : '';
      const count = n.count !== undefined ? `<span style="color:#94a3b8; font-size:11px; margin-left:auto; padding-left:12px;">${n.count} photos</span>` : '';

      return `
        <div style="margin: 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="display:flex; align-items:center; padding: 4px 0;">
            <span style="${titleStyle}">${n.name}</span>
            ${n.isMe ? '<span style="background:#2563eb; color:#fff; font-size:10px; padding:1px 6px; border-radius:8px; margin-left:6px; font-weight:bold;">ME</span>' : ''}
            ${tag}
            ${connsHtml}
            ${count}
          </div>
          ${childrenHtml}
        </div>
      `;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Family Tree & Graph - ${root.name}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 0; }
              .no-print { display: none !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
            h1 { margin: 0 0 4px 0; font-size: 20px; color: #0f172a; }
            .subtitle { color: #64748b; font-size: 12.5px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
            .tree-container { background: #ffffff; padding: 4px; }
            .btn-print { background: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
            .btn-print:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <span style="font-size: 13px; color: #64748b;">Tip: Select <strong>"Save as PDF"</strong> in your browser's print destination to export a PDF document.</span>
          </div>
          <h1>WABS Family & Relationship Graph</h1>
          <div class="subtitle">Root Anchor: <strong>${root.name}</strong> &bull; Exported on ${new Date().toLocaleDateString()}</div>
          <div class="tree-container">
            ${renderHtmlNode(root)}
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const nodeKey = node.nodeId || node.id;
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpanded = searchQuery.trim() ? true : !!expanded[nodeKey];
    const IconComp = (node.icon && RELATION_ICON_MAP[node.icon]) ? RELATION_ICON_MAP[node.icon] : FolderIcon;

    return (
      <div key={nodeKey} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => {
            if (node.isPerson) {
              openPersonPhotos(node);
            } else if (hasChildren) {
              toggle(nodeKey);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '7px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            paddingLeft: `${depth * 16 + 8}px`,
            gap: '8px',
            background: node.isMe ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
            border: node.isMe ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
            marginBottom: '3px',
            transition: 'background 0.15s'
          }}
          className="tree-node-hover"
          title={node.isPerson ? `View photos of ${node.name}` : undefined}
        >
          {hasChildren ? (
            <span 
              onClick={(e) => { e.stopPropagation(); toggle(nodeKey); }}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', cursor: 'pointer' }}
            >
              {isExpanded ? (
                <ExpandMoreIcon fontSize="small" style={{ color: '#94a3b8' }} />
              ) : (
                <ChevronRightIcon fontSize="small" style={{ color: '#94a3b8' }} />
              )}
            </span>
          ) : (
            <span style={{ width: '20px', display: 'inline-block' }} />
          )}

          {node.isPerson ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', background: '#1e293b', flexShrink: 0 }}>
              <PersonThumb url={getPersonThumbUrl ? getPersonThumbUrl(node) : ''} size={28} />
            </div>
          ) : (
            <IconComp fontSize="small" style={{ color: node.color || '#38bdf8', flexShrink: 0 }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', flex: 1 }}>
            <span style={{ color: node.isMe ? '#93c5fd' : '#f8fafc', fontSize: '13.5px', fontWeight: (node.isMe || hasChildren) ? '600' : '400', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {node.name}
            </span>
            {node.isMe && (
              <span style={{ fontSize: '11px', background: '#3b82f6', color: '#0f172a', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold', flexShrink: 0 }}>
                You
              </span>
            )}
            {node.label && (
              <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                • {node.label}
              </span>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {node.isPerson && addPersonConnection && !node.isMe && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConnectSourceNode(node);
                  setNewConnType('spouse');
                  setNewConnTargetId('');
                }}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  padding: '2px 7px',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
                title={`Quick-link family relationship for ${node.name}`}
              >
                + Link
              </button>
            )}
            {node.count !== undefined && (
              <span style={{ color: '#64748b', fontSize: '12px', paddingLeft: '2px', whiteSpace: 'nowrap' }}>
                {node.count} {node.count === 1 ? 'photo' : 'photos'}
              </span>
            )}
          </div>
        </div>

        {/* Dedicated Connection Badges Row - Clean wrapping, no truncation */}
        {node.connections && node.connections.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginLeft: `${depth * 16 + 56}px`,
            marginTop: '2px',
            marginBottom: '4px',
            paddingRight: '8px'
          }}>
            {node.connections.map(c => {
              let badgeColor = '#ec4899';
              let icon = '💍';
              let label = 'Spouse';
              if (c.relation_type === 'parent') { badgeColor = '#38bdf8'; icon = '👨‍👩‍👦'; label = 'Parent'; }
              else if (c.relation_type === 'child') { badgeColor = '#f59e0b'; icon = '👶'; label = 'Child'; }
              else if (c.relation_type === 'sibling') { badgeColor = '#818cf8'; icon = '👫'; label = 'Sibling'; }
              else if (c.relation_type === 'partner') { badgeColor = '#ec4899'; icon = '❤️'; label = 'Partner'; }

              return (
                <span
                  key={`${c.related_person_id || c.related_name}_${c.relation_type}`}
                  style={{
                    fontSize: '11px',
                    background: 'rgba(30, 41, 59, 0.9)',
                    color: badgeColor,
                    border: `1px solid ${badgeColor}55`,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openPersonPhotos({ id: c.related_ai_person_id || c.related_person_id, name: c.related_name });
                    }}
                    style={{ cursor: 'pointer' }}
                    title={`Open photos of ${label}: ${c.related_name}`}
                  >
                    <span>{icon}</span> {c.related_name}
                  </span>
                  {doSearch && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const q = `+person:"${node.name}" +person:"${c.related_name}"`;
                        if (setQuery) setQuery(q);
                        doSearch(q, 'all');
                        if (setPage) setPage('search');
                      }}
                      style={{
                        cursor: 'pointer',
                        opacity: 0.75,
                        fontSize: '10px',
                        padding: '0 2px'
                      }}
                      title={`Search photos of ${node.name} & ${c.related_name} together`}
                    >
                      👥
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '1px solid #334155', marginLeft: `${depth * 16 + 17}px` }}>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Anchor Profile Header & Tree Actions */}
      <div style={{
        background: '#111827',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #24324a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
          }}>
            <PersonPinIcon fontSize="medium" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>
                {treeData.name}
              </span>
              <span style={{ fontSize: '11px', background: '#3b82f6', color: '#0f172a', padding: '1px 7px', borderRadius: '10px', fontWeight: 'bold' }}>
                Anchor User (Me)
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              All family, friends, and social groups are organized relative to you.
            </div>
          </div>
        </div>

        {/* Action Controls, Search & Exports */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <SearchIcon style={{ position: 'absolute', left: '10px', fontSize: '18px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search tree..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px 6px 34px',
                borderRadius: '8px',
                border: '1px solid #334155',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none',
                width: '160px'
              }}
            />
          </div>

          <button
            onClick={handleExpandAll}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Expand all branches"
          >
            <UnfoldMoreIcon style={{ fontSize: '15px' }} /> Expand
          </button>

          <button
            onClick={handleCollapseAll}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Collapse all branches"
          >
            <UnfoldLessIcon style={{ fontSize: '15px' }} /> Collapse
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowExportMenu(prev => !prev)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #3b82f6',
                background: showExportMenu ? '#2563eb' : 'rgba(37, 99, 235, 0.18)',
                color: showExportMenu ? '#ffffff' : '#60a5fa',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
              title="Export Family Tree, Friends Network, or Full Graph"
            >
              <DownloadIcon style={{ fontSize: '15px' }} /> Export Tree <ExpandMoreIcon style={{ fontSize: '16px', transform: showExportMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {showExportMenu && (
              <>
                <div
                  onClick={() => setShowExportMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                />
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: '320px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                  padding: '12px',
                  zIndex: 999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {/* Category 1: Family Tree */}
                  <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px 12px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px' }}>👨‍👩‍👧‍👦</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>Family Tree</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>Kinship & Relatives</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleExportGedcom(null, null, 'family')}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.2)',
                          border: '1px solid #3b82f6',
                          color: '#93c5fd',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Export Family Tree as GEDCOM 5.5.1 (.ged) for Gramps, Ancestry, FamilySearch"
                      >
                        <AccountTreeIcon style={{ fontSize: '14px' }} /> GEDCOM
                      </button>
                      <button
                        onClick={() => printTreeCategory('cat_family', 'Family Tree')}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Print / Save PDF of Family Tree only"
                      >
                        <PictureAsPdfIcon style={{ fontSize: '14px' }} /> PDF / Print
                      </button>
                    </div>
                  </div>

                  {/* Category 2: Friends & Contacts */}
                  <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px 12px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px' }}>🤝</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>Friends & Contacts</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>Social Circles</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => printTreeCategory('cat_friends', 'Friends & Contacts')}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Print / Save PDF of Friends & Contacts only"
                      >
                        <PictureAsPdfIcon style={{ fontSize: '14px' }} /> PDF / Print
                      </button>
                      <button
                        onClick={() => handleExportGedcom(null, null, 'friends')}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(37, 99, 235, 0.2)',
                          border: '1px solid #3b82f6',
                          color: '#93c5fd',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Export Friends Network as GEDCOM (.ged)"
                      >
                        <AccountTreeIcon style={{ fontSize: '14px' }} /> GEDCOM
                      </button>
                    </div>
                  </div>

                  {/* Category 3: Complete Network (All) */}
                  <div style={{ background: '#1e293b', borderRadius: '8px', padding: '10px 12px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px' }}>🌐</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>Complete Graph (All)</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>All Categories</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleExportGedcom()}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.2)',
                          border: '1px solid #6366f1',
                          color: '#a5b4fc',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Export Complete Social Network as GEDCOM 5.5.1 (.ged)"
                      >
                        <AccountTreeIcon style={{ fontSize: '14px' }} /> Full GEDCOM
                      </button>
                      <button
                        onClick={() => { printTreeGraph(); setShowExportMenu(false); }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid #10b981',
                          color: '#6ee7b7',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                        title="Print / Save PDF of complete relationship tree"
                      >
                        <PictureAsPdfIcon style={{ fontSize: '14px' }} /> Full PDF
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Column Category Cards Layout */}
      {categories.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', background: '#111827', borderRadius: '12px', border: '1px solid #24324a' }}>
          {searchQuery ? 'No matching people or categories found in the tree.' : 'No categorized relationships found. Open any person profile in People tab to assign them to Family, Friends, or Others.'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          alignItems: 'start'
        }}>
          {categories.map(categoryNode => {
            const totalCount = countPersons(categoryNode);
            const HeaderIcon = (categoryNode.icon && RELATION_ICON_MAP[categoryNode.icon]) ? RELATION_ICON_MAP[categoryNode.icon] : FolderIcon;
            
            return (
              <div
                key={categoryNode.id}
                style={{
                  background: '#111827',
                  borderRadius: '12px',
                  border: '1px solid #24324a',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}
              >
                {/* Category Card Header */}
                <div style={{
                  padding: '12px 16px',
                  background: '#1e293b',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HeaderIcon style={{ color: categoryNode.color || '#38bdf8', fontSize: '20px' }} />
                    <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#f8fafc' }}>
                      {categoryNode.name}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: categoryNode.color || '#38bdf8',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}>
                    {totalCount} {totalCount === 1 ? 'person' : 'people'}
                  </span>
                </div>

                {/* Branches Container */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {categoryNode.children && categoryNode.children.map(branch => renderNode(branch, 0))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Direct Tree Quick Link Modal */}
      {connectSourceNode && (
        <div
          onClick={() => setConnectSourceNode(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '16px',
              padding: '20px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonThumb url={getPersonThumbUrl ? getPersonThumbUrl(connectSourceNode) : ''} size={36} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#f8fafc' }}>
                    Link Family Member
                  </h3>
                  <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: '500' }}>
                    {connectSourceNode.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setConnectSourceNode(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Relationship Type:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {[
                    { type: 'spouse', label: '💍 Spouse / Partner' },
                    { type: 'parent', label: '👨‍👩‍👦 Parent of' },
                    { type: 'child', label: '👶 Child of' },
                    { type: 'sibling', label: '👫 Sibling of' }
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewConnType(type)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: newConnType === type ? '#2563eb' : '#1e293b',
                        color: newConnType === type ? '#ffffff' : '#cbd5e1',
                        border: newConnType === type ? '1px solid #3b82f6' : '1px solid #334155',
                        fontSize: '12.5px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  Select Person to Connect:
                </label>
                <select
                  value={newConnTargetId}
                  onChange={(e) => setNewConnTargetId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    color: '#f8fafc',
                    border: '1px solid #334155',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                >
                  <option value="">— Select a Person —</option>
                  {(namedPeopleDropdown || [])
                    .filter(p => p.id !== connectSourceNode.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.category ? `(${p.subcategory || p.category})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setConnectSourceNode(null)}
                  style={{ background: '#334155', border: 'none', color: '#cbd5e1', padding: '6px 14px', borderRadius: '8px', fontSize: '12.5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newConnTargetId}
                  onClick={() => {
                    if (newConnTargetId && addPersonConnection) {
                      addPersonConnection(connectSourceNode.id, parseInt(newConnTargetId, 10), newConnType);
                      setConnectSourceNode(null);
                    }
                  }}
                  style={{
                    background: newConnTargetId ? '#2563eb' : '#1e293b',
                    color: newConnTargetId ? '#ffffff' : '#64748b',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: newConnTargetId ? 'pointer' : 'not-allowed'
                  }}
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
