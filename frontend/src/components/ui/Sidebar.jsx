import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import FaceIcon from '@mui/icons-material/Face';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

import { AppIcon } from './AppIcon';
import { ActionButton } from './ActionButton';

export function Sidebar({
  showSidebar, sidebarWidth, isResizing, setIsResizing,
  setPage, explorer, peopleState, tagsState, loadDashboard,
  handleShutdown, query, setQuery
}) {
  if (!showSidebar) return null;

  return (
    <>
      <div className='sidebar' style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '8px 0' }}>
            <AppIcon size={40} />
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>WABS</h2>
              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>v1.0.0-beta.8</div>
            </div>
          </div>

          <ActionButton className="" onClick={() => { setPage('dashboard'); explorer.setSelected(null); loadDashboard(); }}>
            <DashboardIcon fontSize="small" /> Dashboard
          </ActionButton>

          <ActionButton className="" onClick={() => {
            let cat = explorer.filterCategory;
            if (cat === 'duplicates') {
              cat = 'all';
              explorer.setFilterCategory('all');
              setQuery('');
              explorer.setSearchCache([]);
            }
            setPage('explorer');
            explorer.setSelected(null);
            explorer.setShowSelectedOnly(false);
            explorer.setCheckedFiles(new Set());
            explorer.loadFiles(0, false, cat);
          }}>
            <FolderIcon fontSize="small" /> Explorer
          </ActionButton>

          <ActionButton className="" onClick={() => {
            let cat = explorer.filterCategory;
            if (cat === 'duplicates') {
              cat = 'all';
              explorer.setFilterCategory('all');
              setQuery('');
              explorer.setSearchCache([]);
            }
            setPage('search');
            explorer.setSelected(null);
            explorer.setShowSelectedOnly(false);
            explorer.setCheckedFiles(new Set());
            if (query && explorer.searchCache.length > 0) {
              explorer.setFiles(explorer.searchCache);
              explorer.setOffset(explorer.searchCache.length);
              explorer.setHasMore(explorer.searchCache.length > 0 && explorer.searchCache.length % 50 === 0);
            } else {
              explorer.goToSearch(cat);
            }
          }}>
            <SearchIcon fontSize="small" /> Search
          </ActionButton>

          <ActionButton className="" onClick={() => { setPage('people'); explorer.setSelected(null); peopleState.setCheckedPeople(new Set()); peopleState.setUnknownPeoplePage(1); peopleState.setNamedPeoplePage(1); peopleState.setNamedPersonSearchQuery(''); peopleState.loadPeople(); }}>
            <FaceIcon fontSize="small" /> People
          </ActionButton>

          <ActionButton className="" onClick={() => { setPage('tags'); explorer.setSelected(null); tagsState.setTagsPage(1); tagsState.setTagSearchQuery(''); }}>
            <CategoryIcon fontSize="small" /> Tags
          </ActionButton>

          <ActionButton className="" onClick={() => { setPage('settings'); explorer.setSelected(null); }}>
            <SettingsIcon fontSize="small" /> Settings
          </ActionButton>

          <ActionButton className="" onClick={() => { setPage('about'); explorer.setSelected(null); }}>
            <InfoIcon fontSize="small" /> About
          </ActionButton>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <ActionButton className="" onClick={handleShutdown} style={{ background: '#ef44442a', color: '#ef4444', width: '100%' }}>
            <PowerSettingsNewIcon fontSize="small" /> Shutdown
          </ActionButton>
        </div>
      </div>
      <div className={`resizer ${isResizing === 'sidebar' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('sidebar'); }} />
    </>
  );
}