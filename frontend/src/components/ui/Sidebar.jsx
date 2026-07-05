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
import { VERSION } from '../../States';

export function Sidebar({
  showSidebar, sidebarWidth, isResizing, setIsResizing,
  setPage, explorer, peopleState, tagsState, loadDashboard,
  handleShutdown, query, setQuery, page
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
              <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>v{VERSION}</div>
            </div>
          </div>

          <ActionButton className="" style={{ color: page === 'dashboard' ? '#38bdf8' : undefined }} onClick={() => {
            setPage('dashboard');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
            loadDashboard();
          }}>
            <DashboardIcon fontSize="small" /> Dashboard
          </ActionButton>
 
          <ActionButton className="" style={{ color: page === 'explorer' ? '#38bdf8' : undefined }} onClick={() => {
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
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
            explorer.loadFiles(0, false, cat, explorer.sortBy, explorer.sortOrder, 'explorer', null);
          }}>
            <FolderIcon fontSize="small" /> Explorer
          </ActionButton>
 
          <ActionButton className="" style={{ color: page === 'search' ? '#38bdf8' : undefined }} onClick={() => {
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
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
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
 
          <ActionButton className="" style={{ color: (page === 'people' || page === 'person_files') ? '#38bdf8' : undefined }} onClick={() => {
            setPage('people');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
            peopleState.setCheckedPeople(new Set());
            peopleState.setUnknownPeoplePage(1);
            peopleState.setNamedPeoplePage(1);
            peopleState.setNamedPersonSearchQuery('');
            peopleState.loadPeople();
          }}>
            <FaceIcon fontSize="small" /> People
          </ActionButton>
 
          <ActionButton className="" style={{ color: page === 'tags' ? '#38bdf8' : undefined }} onClick={() => {
            setPage('tags');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
            tagsState.setTagsPage(1);
            tagsState.setTagSearchQuery('');
          }}>
            <CategoryIcon fontSize="small" /> Tags
          </ActionButton>
 
          <ActionButton className="" style={{ color: (page === 'virtual_folders' || page === 'virtual_folder') ? '#38bdf8' : undefined }} onClick={() => {
            setPage('virtual_folders');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
          }}>
            <FolderIcon fontSize="small" /> Virtual Folders
          </ActionButton>
 
 
 
          <ActionButton className="" style={{ color: page === 'settings' ? '#38bdf8' : undefined }} onClick={() => {
            setPage('settings');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
          }}>
            <SettingsIcon fontSize="small" /> Settings
          </ActionButton>
 
          <ActionButton className="" style={{ color: page === 'about' ? '#38bdf8' : undefined }} onClick={() => {
            setPage('about');
            explorer.setSelected(null);
            explorer.setVirtualFolderId(null);
            explorer.setCurrentVirtualFolder(null);
          }}>
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