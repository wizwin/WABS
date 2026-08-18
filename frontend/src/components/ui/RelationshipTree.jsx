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

export function RelationshipTree({ treeData, openPersonPhotos, getPersonThumbUrl }) {
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleExportGedcom = (personId = null, personName = null) => {
    const url = personId ? `${API}/people/${personId}/export/gedcom` : `${API}/people/export/gedcom`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', personName ? `wabs_family_tree_${personName.toLowerCase().replace(/\s+/g, '_')}.ged` : 'wabs_family_tree.ged');
    document.body.appendChild(link);
    link.click();
    link.remove();
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', flexWrap: 'nowrap' }}>
            <span style={{ color: node.isMe ? '#93c5fd' : '#f8fafc', fontSize: '13.5px', fontWeight: (node.isMe || hasChildren) ? '600' : '400', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {node.name}
            </span>
            {node.isMe && (
              <span style={{ fontSize: '11px', background: '#3b82f6', color: '#0f172a', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' }}>
                You
              </span>
            )}
            {node.label && (
              <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                • {node.label}
              </span>
            )}
            {node.connections && node.connections.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px', flexWrap: 'nowrap' }}>
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
                      onClick={(e) => {
                        e.stopPropagation();
                        openPersonPhotos({ id: c.related_ai_person_id || c.related_person_id, name: c.related_name });
                      }}
                      style={{
                        fontSize: '11px',
                        background: 'rgba(30, 41, 59, 0.9)',
                        color: badgeColor,
                        border: `1px solid ${badgeColor}55`,
                        borderRadius: '10px',
                        padding: '1px 7px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      title={`Open photos of ${label}: ${c.related_name}`}
                    >
                      <span>{icon}</span> {c.related_name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasChildren && !node.isMe && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (node.isPerson) {
                      handleExportGedcom(node.id, node.name);
                    } else {
                      handleExportGedcom();
                    }
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    padding: '2px 6px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  title={`Export GEDCOM for ${node.name} branch`}
                >
                  <DownloadIcon style={{ fontSize: '11px' }} /> GEDCOM
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    printTreeGraph(node);
                  }}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    padding: '2px 6px',
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                  title={`Print / PDF view for ${node.name} branch`}
                >
                  <PrintIcon style={{ fontSize: '11px' }} /> PDF
                </button>
              </div>
            )}

            {node.count !== undefined && (
              <span style={{ color: '#64748b', fontSize: '12px', paddingLeft: '4px', whiteSpace: 'nowrap' }}>
                {node.count} {node.count === 1 ? 'photo' : 'photos'}
              </span>
            )}
          </div>
        </div>

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

          <button
            onClick={() => handleExportGedcom()}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #2563eb',
              background: 'rgba(37, 99, 235, 0.18)',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Export complete family tree as GEDCOM 5.5.1 (.ged) for Gramps, Ancestry, FamilySearch, etc."
          >
            <AccountTreeIcon style={{ fontSize: '15px' }} /> Export GEDCOM
          </button>

          <button
            onClick={() => printTreeGraph()}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #059669',
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#34d399',
              cursor: 'pointer',
              fontSize: '12.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
            title="Export / Print clean PDF view of the entire tree"
          >
            <PictureAsPdfIcon style={{ fontSize: '15px' }} /> Export PDF
          </button>
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
    </div>
  );
}
