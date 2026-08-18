import React from 'react';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import CloseIcon from '@mui/icons-material/Close';
import HelpIcon from '@mui/icons-material/Help';
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import InfoIcon from '@mui/icons-material/Info';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { ActionButton } from './ActionButton';

export function Topbar({
  toggleSidebar, showSidebar, searchContainerRef, query, handleSearchChange,
  handleKeyDown, suggestionsData, focusedSuggestionIndex, setFocusedSuggestionIndex,
  applySuggestion, explorer, showSearchHelp, setShowSearchHelp, toggleTimeline,
  showTimeline, toggleTreeView, showTreeView, viewType, toggleDetails, showDetails, page,
  onLockApp, pinEnabled
}) {
  return (
    <div className='topbar' style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <ActionButton
        className=""
        onClick={toggleSidebar}
        style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showSidebar ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        title="Toggle Sidebar"
      >
        {showSidebar ? <MenuOpenIcon /> : <MenuIcon />}
      </ActionButton>

      <div ref={searchContainerRef} style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
        <input
          className='search'
          placeholder='Search files, tags, metadata...'
          value={query}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            margin: 0,
            paddingRight: (page === 'explorer' || page === 'search' || page === 'person_files' || page === 'virtual_folder') ? (query ? '100px' : '72px') : (query ? '72px' : '40px')
          }}
        />
        {suggestionsData.type !== 'none' && suggestionsData.suggestions.length > 0 && (
          <div className="floating-panel" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: '70px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', zIndex: 90, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
            {suggestionsData.type === 'did_you_mean' && (
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Did you mean:</div>
            )}
            {suggestionsData.type === 'tag' && (
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Suggested Tags:</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suggestionsData.suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  style={{ background: i === focusedSuggestionIndex ? '#3b82f64a' : '#3b82f62a', border: '1px solid #3b82f6', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setFocusedSuggestionIndex(i)}
                  onMouseLeave={() => setFocusedSuggestionIndex(-1)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {query && (
            <ActionButton
              className=""
              onClick={() => { explorer.doSearch(''); setShowSearchHelp(false); }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              title="Clear search"
            >
              <CloseIcon fontSize="small" />
            </ActionButton>
          )}
          <ActionButton
            className=""
            onClick={() => setShowSearchHelp(!showSearchHelp)}
            style={{ background: 'transparent', border: 'none', color: showSearchHelp ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
            title="Search Help"
          >
            <HelpIcon fontSize="small" />
          </ActionButton>
          {(page === 'explorer' || page === 'search' || page === 'person_files' || page === 'virtual_folder') && (
            <ActionButton
              className=""
              onClick={toggleDetails}
              style={{ background: 'transparent', border: 'none', color: showDetails ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              title="Toggle Details"
            >
              <InfoIcon fontSize="small" />
            </ActionButton>
          )}
        </div>
        {showSearchHelp && (
          <div className="floating-panel" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '0', background: '#1e293b', border: '1px solid #334155', padding: '16px', zIndex: 100, borderRadius: '12px', width: '320px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', color: '#cbd5e1', fontSize: '13px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '14px' }}>Search Patterns Supported</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><b>type:</b>audio <i>(or video, document)</i></li>
              <li><b>object:</b>car <i>(or beach, indoor)</i></li>
              <li><b>person:</b>"john doe"</li>
              <li><b>tag:</b>family_trip <i>(or custom_tag)</i></li>
              <li><b>size:</b>&gt;100MB, &lt;5GB</li>
              <li><b>length:</b>&gt;5m, &lt;1h <i>(duration)</i></li>
              <li><b>date:</b>2020-2022, 2023-10-25</li>
              <li><b>*.mp3</b> or <b>*vacation*</b> (wildcards)</li>
            </ul>
            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Combine with spaces (Match Any). Use <code style={{ color: '#38bdf8' }}>+</code> to require (Match All) or <code style={{ color: '#38bdf8' }}>-</code> to exclude: <br/><code style={{ background: '#0f172a', padding: '2px 4px', borderRadius: '4px', color: '#38bdf8' }}>object:car -tag:blur</code></p>
          </div>
        )}
      </div>

      {(page === 'explorer' || page === 'search' || page === 'person_files' || page === 'virtual_folder') && (() => {
        const activeViewType = page === 'virtual_folder' ? (explorer?.virtualFolderViewType) : viewType;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeViewType === 'tree' ? (
              <ActionButton
                className=""
                onClick={toggleTreeView}
                style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showTreeView ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Toggle Tree View"
              >
                <AccountTreeIcon />
              </ActionButton>
            ) : (
              <ActionButton
                className=""
                onClick={toggleTimeline}
                style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showTimeline ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Toggle Timeline"
              >
                <ViewTimelineIcon />
              </ActionButton>
            )}
          </div>
        );
      })()}

      {pinEnabled && onLockApp && (
        <ActionButton
          className=""
          onClick={onLockApp}
          style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          title="Lock Archive (Session)"
        >
          <LockOutlinedIcon />
        </ActionButton>
      )}
    </div>
  );
}