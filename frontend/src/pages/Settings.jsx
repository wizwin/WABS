import React from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import axios from 'axios';

import { ActionButton } from '../components/ui/ActionButton';
import { API } from '../States';

export default function Settings(props) {
  const { 
    page, settings, setSettings, saveSettings, settingsTab, setSettingsTab,
    choosePath, updateUIPreferences, actionInProgress, indexer, setIndexer, cleanupDatabase,
    dataOpProgress, backupDatabase, exportKnownPeople, importKnownPeople,
    exportTags, importTags, clearCache, showSidebar, toggleSidebar, showTimeline, toggleTimeline,
    showDetails, toggleDetails, aiSearchPrompt, setAiSearchPrompt, generateSearchWithAI,
    generatingSearch, testingAI, testAIConnection, globalPeopleMap, choosePathForConfig,
    abortPeopleDataOpRef, abortTagsDataOpRef, cancelAiAction
  } = props;

  return (
    <>
        {
        page==='settings' &&
        <div style={{padding:'20px', overflow:'auto', height:'100%'}}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>Settings</h1>
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={saveSettings} title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to save settings" : ""}>
                <SettingsIcon fontSize="small" />
                Save Settings
            </ActionButton>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {['general', 'data', 'ui', 'ai', 'locations', 'search'].map(tab => (
                <button 
                key={tab}
                onClick={() => setSettingsTab(tab)}
                style={{ 
                    padding: '8px 16px', 
                    background: settingsTab === tab ? '#38bdf8' : 'transparent',
                    color: settingsTab === tab ? '#0f172a' : '#94a3b8',
                    border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                }}
                >
                {tab === 'general' ? 'General' : 
                tab === 'data' ? 'Data Management' : 
                tab === 'ui' ? 'UI Preferences' : 
                tab === 'ai' ? 'AI & Vision' : 
                tab === 'locations' ? 'Backups' : 'Smart Searches'}
                </button>
            ))}
            </div>

            {settingsTab === 'general' && (
            <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>System Paths</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Database Path</p>
                <div style={{display:'flex',gap:'10px', marginBottom: '14px'}}>
                <input
                    className='setting'
                    style={{ marginBottom: 0 }}
                    value={settings.database_path || ''}
                    onChange={(e)=>setSettings({
                    ...settings,
                    database_path:e.target.value
                    })}
                />
                <ActionButton className="btn btn-secondary" onClick={()=>choosePath('database_path','directory')}>Select</ActionButton>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Thumbnail Path</p>
                <div style={{display:'flex',gap:'10px', marginBottom: '0'}}>
                <input
                    className='setting'
                    style={{ marginBottom: 0 }}
                    value={settings.thumbnail_path || ''}
                    onChange={(e)=>setSettings({
                    ...settings,
                    thumbnail_path:e.target.value
                    })}
                />
                <ActionButton className="btn btn-secondary" onClick={()=>choosePath('thumbnail_path','directory')}>Select</ActionButton>
                </div>

                <p style={{ margin: '14px 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Global Excluded Folders (comma-separated, applies to all backups)</p>
                <div style={{display:'flex',gap:'10px', marginBottom: '0'}}>
                <input
                    className='setting'
                    style={{ marginBottom: 0 }}
                    value={settings.global_excluded_paths || ''}
                    onChange={(e)=>setSettings(prev => ({...prev, global_excluded_paths: e.target.value}))}
                    placeholder="node_modules, .git, venv, __pycache__"
                />
                </div>

                <h3 style={{ margin: '32px 0 16px 0' }}>Data Safety</h3>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px', color:'#38bdf8'}}>
                <input type='checkbox' checked={settings.read_only_mode !== false} onChange={(e)=>updateUIPreferences({ read_only_mode: e.target.checked })} /> Enable Global Read-Only Mode (Overrides individual backup settings if enabled)
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0', color:'#ef4444'}}>
                <input type='checkbox' checked={(settings.allow_unverified_deletion ?? settings.ui_preferences?.allow_unverified_deletion) || false} onChange={(e)=>updateUIPreferences({ allow_unverified_deletion: e.target.checked })} /> Allow deleting unverified duplicates (Dangerous)
                </label>

                <h3 style={{ margin: '32px 0 16px 0' }}>Startup</h3>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px', color:'#cbd5e1'}}>
                <input 
                    type="checkbox" 
                    checked={settings.auto_run_on_startup || false} 
                    onChange={(e) => setSettings(prev => ({ ...prev, auto_run_on_startup: e.target.checked }))} 
                />
                Start WABS automatically on user login (runs in background)
                </label>

                <h3 style={{ margin: '32px 0 16px 0' }}>Memory Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#cbd5e1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0' }}>
                    <input 
                        type="checkbox" 
                        checked={settings.idle_unload_timeout_seconds !== 0} 
                        onChange={(e) => setSettings(prev => ({ 
                            ...prev, 
                            idle_unload_timeout_seconds: e.target.checked ? 1800 : 0 
                        }))} 
                    />
                    Automatically release memory and unload background libraries when idle (reclaims ~500MB+ RAM)
                    </label>
                    {settings.idle_unload_timeout_seconds > 0 && (
                        <div style={{ paddingLeft: '26px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0' }}>
                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>Unload after idle for:</span>
                            <select 
                                value={settings.idle_unload_timeout_seconds} 
                                onChange={(e) => setSettings(prev => ({ 
                                    ...prev, 
                                    idle_unload_timeout_seconds: parseInt(e.target.value) 
                                }))}
                                style={{ 
                                    background: '#0f172a', 
                                    color: '#cbd5e1', 
                                    border: '1px solid #334155', 
                                    borderRadius: '4px', 
                                    padding: '4px 8px',
                                    outline: 'none'
                                }}
                            >
                                <option value={300}>5 minutes</option>
                                <option value={600}>10 minutes</option>
                                <option value={900}>15 minutes</option>
                                <option value={1800}>30 minutes</option>
                                <option value={3600}>1 hour</option>
                                <option value={7200}>2 hours</option>
                            </select>
                        </div>
                    )}
                </div>

                <h3 style={{ margin: '32px 0 16px 0' }}>Diagnostics</h3>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0', color:'#cbd5e1'}}>
                <input 
                    type="checkbox" 
                    checked={settings.enable_logging || false} 
                    onChange={(e) => setSettings(prev => ({ ...prev, enable_logging: e.target.checked }))} 
                />
                Enable Background Logging (wabs.log)
                </label>
            </div>
            )}

            {settingsTab === 'data' && (
            <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Data Management</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Database Cleanup &amp; Optimization</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Scan for missing files, clear orphaned data, and vacuum databases to reclaim space.</p>
                    </div>
                    <ActionButton 
                    disabled={(dataOpProgress && dataOpProgress.id === 'cleanup') ? indexer.cancel_data_operation : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation))} 
                    className="btn btn-secondary" 
                    onClick={() => {
                        if (dataOpProgress && dataOpProgress.id === 'cleanup') {
                            cancelAiAction();
                        } else {
                            cleanupDatabase();
                        }
                    }}
                    title={(dataOpProgress && dataOpProgress.id === 'cleanup') ? "" : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to run cleanup" : ""}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                    {dataOpProgress && dataOpProgress.id === 'cleanup' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Cancel Cleanup</>
                    ) : 'Run Cleanup'}
                    </ActionButton>
                </div>
                <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Full Database Backup</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Create a safe, portable copy of your archive.db, ai_metadata.db, and config.yaml.</p>
                    </div>
                    <ActionButton 
                    disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} 
                    className="btn btn-secondary" 
                    onClick={backupDatabase}
                    title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to backup the database" : ""}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                    {dataOpProgress && dataOpProgress.id === 'backup' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Backing up...</>
                    ) : 'Export / Backup Data'}
                    </ActionButton>
                </div>
                <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                    <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Known People (Faces)</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Export or import named people and their face embeddings as a portable JSON file.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <ActionButton 
                        disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} 
                        className="btn btn-secondary" 
                        onClick={exportKnownPeople}
                        title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to export data" : ""}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {dataOpProgress && dataOpProgress.id === 'people' && dataOpProgress.action === 'export' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Exporting...</>
                        ) : 'Export JSON'}
                    </ActionButton>
                    <ActionButton 
                        disabled={(dataOpProgress && dataOpProgress.id === 'people' && dataOpProgress.action === 'import') ? indexer.cancel_data_operation : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation))} 
                        className="btn btn-secondary" 
                        onClick={() => {
                        if (dataOpProgress && dataOpProgress.id === 'people' && dataOpProgress.action === 'import') {
                            if (abortPeopleDataOpRef) abortPeopleDataOpRef.current = true;
                            cancelAiAction();
                        } else {
                            importKnownPeople();
                        }
                        }}
                        title={(dataOpProgress && dataOpProgress.id === 'people' && dataOpProgress.action === 'import') ? "" : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to import data" : ""}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {dataOpProgress && dataOpProgress.id === 'people' && dataOpProgress.action === 'import' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Cancel Import</>
                        ) : 'Import JSON'}
                    </ActionButton>
                    </div>
                </div>
                <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                    <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Object &amp; Custom Tags</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Export or import all applied tags mapped to file paths as a portable JSON file.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                    <ActionButton 
                        disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} 
                        className="btn btn-secondary" 
                        onClick={exportTags}
                        title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to export data" : ""}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {dataOpProgress && dataOpProgress.id === 'tags' && dataOpProgress.action === 'export' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Exporting...</>
                        ) : 'Export JSON'}
                    </ActionButton>
                    <ActionButton 
                        disabled={(dataOpProgress && dataOpProgress.id === 'tags' && dataOpProgress.action === 'import') ? indexer.cancel_data_operation : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation))} 
                        className="btn btn-secondary" 
                        onClick={() => {
                        if (dataOpProgress && dataOpProgress.id === 'tags' && dataOpProgress.action === 'import') {
                            if (abortTagsDataOpRef) abortTagsDataOpRef.current = true;
                            cancelAiAction();
                        } else {
                            importTags();
                        }
                        }}
                        title={(dataOpProgress && dataOpProgress.id === 'tags' && dataOpProgress.action === 'import') ? "" : (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to import data" : ""}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {dataOpProgress && dataOpProgress.id === 'tags' && dataOpProgress.action === 'import' ? (
                        <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Cancel Import</>
                        ) : 'Import JSON'}
                    </ActionButton>
                    </div>
                </div>
                <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                    <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Clear Thumbnail Cache</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Delete all cached preview images. They will be regenerated automatically as needed.</p>
                    </div>
                    <ActionButton 
                    disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} 
                    className="btn btn-secondary" 
                    onClick={clearCache}
                    title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to clear cache" : ""}
                    >
                    Clear Cache
                    </ActionButton>
                </div>
                </div>
            </div>
            )}

            {settingsTab === 'ui' && (
            <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Theme</h3>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px', cursor:'pointer'}}>
                <input type='radio' name="theme" checked={(settings.theme || 'dark') === 'dark'} onChange={()=>updateUIPreferences({ theme: 'dark' })} /> Dark Mode
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'24px', cursor:'pointer'}}>
                <input type='radio' name="theme" checked={settings.theme === 'light'} onChange={()=>updateUIPreferences({ theme: 'light' })} /> Light Mode
                </label>
                <h3 style={{ margin: '0 0 16px 0' }}>View Preferences</h3>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <input type='checkbox' checked={showSidebar} onChange={toggleSidebar} /> Show Sidebar
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <input type='checkbox' checked={showTimeline} onChange={toggleTimeline} /> Show Timeline
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <input type='checkbox' checked={showDetails} onChange={toggleDetails} /> Show Details
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <input type='checkbox' checked={settings.show_full_timeline || settings.ui_preferences?.show_full_timeline || false} onChange={(e)=>updateUIPreferences({ show_full_timeline: e.target.checked })} /> Show Full Archive Timeline
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                <input type='checkbox' checked={(settings.animations_enabled ?? settings.ui_preferences?.animations_enabled) !== false} onChange={(e)=>updateUIPreferences({ animations_enabled: e.target.checked })} /> Enable UI Animations
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom: '10px', color:'#38bdf8'}}>
                <input type='checkbox' checked={settings.enable_photo_thumbnail_cache || settings.ui_preferences?.enable_photo_thumbnail_cache || false} onChange={(e)=>updateUIPreferences({ enable_photo_thumbnail_cache: e.target.checked })} /> Enable Photo Thumbnail Caching (Improves load times for large images)
                </label>
                {(settings.enable_photo_thumbnail_cache || settings.ui_preferences?.enable_photo_thumbnail_cache) && (
                <div style={{display:'flex',gap:'10px', marginBottom: '10px', alignItems: 'center'}}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Cache photos larger than (MB):</span>
                    <input
                    className='setting'
                    type='number'
                    min='0.1'
                    step='0.1'
                    style={{ marginBottom: 0, width: '80px', padding: '4px 8px', fontSize: '14px' }}
                    value={settings.photo_thumbnail_size_limit_mb !== undefined ? settings.photo_thumbnail_size_limit_mb : (settings.ui_preferences?.photo_thumbnail_size_limit_mb !== undefined ? settings.ui_preferences.photo_thumbnail_size_limit_mb : 5)}
                    onChange={(e)=>updateUIPreferences({ photo_thumbnail_size_limit_mb: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                    onBlur={(e) => {
                        let parsed = parseFloat(e.target.value);
                        if (isNaN(parsed) || parsed < 0.1) {
                            parsed = 0.1;
                        }
                        updateUIPreferences({ photo_thumbnail_size_limit_mb: parsed });
                    }}
                    />
                </div>
                )}
                <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px', color:'#ef4444'}}>
                <input type='checkbox' checked={settings.disable_lazy_loading || settings.ui_preferences?.disable_lazy_loading || false} onChange={(e)=>updateUIPreferences({ disable_lazy_loading: e.target.checked })} /> Load all files at once (High memory usage)
                </label>
                {!(settings.disable_lazy_loading || settings.ui_preferences?.disable_lazy_loading) && (
                <div style={{display:'flex',gap:'10px', marginBottom: '10px', alignItems: 'center'}}>
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>Files to load per scroll:</span>
                    <input
                    className='setting'
                    type='number'
                    min='10'
                    max='1000'
                    style={{ marginBottom: 0, width: '80px', padding: '4px 8px', fontSize: '14px' }}
                    value={settings.lazy_load_chunk_size !== undefined ? settings.lazy_load_chunk_size : (settings.ui_preferences?.lazy_load_chunk_size !== undefined ? settings.ui_preferences.lazy_load_chunk_size : 50)}
                    onChange={(e)=>updateUIPreferences({ lazy_load_chunk_size: e.target.value === '' ? '' : parseInt(e.target.value) })}
                    />
                </div>
                )}
            </div>
            )}

            {settingsTab === 'search' && (
            <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Smart Searches</h3>
                <ActionButton className="btn btn-primary" onClick={() => {
                    const newId = `smartsearch_${Date.now()}`;
                    setSettings(prev => ({
                    ...prev,
                    smart_searches: [...(prev.smart_searches || []), { id: newId, name: `New Search`, query: '' }]
                    }));
                }}>+ Add Smart Search</ActionButton>
                </div>

                {settings.ai_enabled && (
                    <div style={{ marginBottom: '24px', padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #3b82f64a' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#38bdf8' }}>✨ AI Search Assistant</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#94a3b8' }}>Describe what you want to find in plain English, and the AI will build the search query for you.</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            className="setting" 
                            style={{ margin: 0, flex: 1 }} 
                            placeholder="e.g., Find John's photos at the beach from 2022"
                            value={aiSearchPrompt}
                            onChange={e => setAiSearchPrompt(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') generateSearchWithAI(); }}
                        />
                        <ActionButton disabled={generatingSearch || !aiSearchPrompt.trim()} className="btn btn-secondary" style={{ color: '#38bdf8', borderColor: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} onClick={generateSearchWithAI}>
                            {generatingSearch ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Generating...</> : 'Generate Query'}
                        </ActionButton>
                    </div>
                    </div>
                )}

                {(settings.smart_searches || []).map((search, index) => (
                <div key={search.id} style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', marginBottom: '16px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <input
                        className='setting'
                        style={{ margin: 0, fontWeight: 'bold', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '16px', padding: '0 4px', width: '100%', maxWidth: '300px' }}
                        value={search.name !== undefined ? search.name : `Search ${index + 1}`}
                        onChange={(e) => setSettings(prev => ({ ...prev, smart_searches: prev.smart_searches.map(s => s.id === search.id ? { ...s, name: e.target.value } : s) }))}
                        placeholder="Name your search"
                    />
                    <ActionButton className="btn btn-secondary" style={{ background: '#ef4444', borderColor: '#b91c1c', color: 'white', padding: '4px 8px' }} onClick={() => {
                        if (window.confirm(`Are you sure you want to remove "${search.name || `Search ${index + 1}`}"?`)) {
                        setSettings(prev => ({ ...prev, smart_searches: prev.smart_searches.filter(s => s.id !== search.id) }));
                        }
                    }}>Remove</ActionButton>
                    </div>
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Search Query</p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '0' }}>
                    <input className='setting' style={{ marginBottom: 0 }} value={search.query || ''} onChange={(e) => setSettings(prev => ({ ...prev, smart_searches: prev.smart_searches.map(s => s.id === search.id ? { ...s, query: e.target.value } : s) }))} />
                    </div>
                </div>
                ))}
            </div>
            )}

            {settingsTab === 'locations' && (
            <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Storage & Backup Locations</h3>
                <ActionButton className="btn btn-primary" onClick={() => {
                    const newId = `backup_${Date.now()}`;
                    setSettings(prev => ({
                    ...prev,
                    backup_configs: [...(prev.backup_configs || []), { id: newId, name: `Backup Location ${(prev.backup_configs?.length || 0) + 1}`, backup_path: '', mapped_backup_path: '', path_mapping_enabled: false, read_only_mode: true, excluded_paths: '' }]
                    }));
                }}>+ Add Backup Location</ActionButton>
                </div>

                {(settings.backup_configs || []).map((config, index) => (
                <div key={config.id} style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', marginBottom: '16px', border: '1px solid #334155' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <input
                        className='setting'
                        style={{ margin: 0, fontWeight: 'bold', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '16px', padding: '0 4px', width: '100%', maxWidth: '300px' }}
                        value={config.name !== undefined ? config.name : `Backup Location ${index + 1}`}
                        onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, name: e.target.value } : c) }))}
                        placeholder="Name your backup location"
                    />
                    {(settings.backup_configs || []).length > 1 && (
                        <ActionButton className="btn btn-secondary" style={{ background: '#ef4444', borderColor: '#b91c1c', color: 'white', padding: '4px 8px' }} onClick={() => {
                        if (window.confirm(`Are you sure you want to remove "${config.name || `Backup Location ${index + 1}`}"?`)) {
                            setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.filter(c => c.id !== config.id) }));
                        }
                        }}>Remove Location</ActionButton>
                    )}
                    </div>
                    
                    <p>Backup Path (Indexed Location)</p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <input className='setting' style={{ marginBottom: 0 }} value={config.backup_path || ''} onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, backup_path: e.target.value } : c) }))} />
                    <ActionButton className="btn btn-secondary" onClick={()=>choosePathForConfig(config.id, 'backup_path', 'directory')}>Select</ActionButton>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: '#38bdf8' }}>
                    <input type='checkbox' checked={config.path_mapping_enabled || false} onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, path_mapping_enabled: e.target.checked } : c) }))} />
                    Enable path remapping (Use if drive letter or path changed)
                    </label>

                    {config.path_mapping_enabled && (
                    <>
                        <p>Mapped Backup Path (New Location)</p>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                        <input className='setting' style={{ marginBottom: 0 }} value={config.mapped_backup_path || ''} onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, mapped_backup_path: e.target.value } : c) }))} />
                        <ActionButton className="btn btn-secondary" onClick={()=>choosePathForConfig(config.id, 'mapped_backup_path', 'directory')}>Select</ActionButton>
                        </div>
                    </>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8' }}>
                    <input type='checkbox' checked={config.read_only_mode !== false} onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, read_only_mode: e.target.checked } : c) }))} />
                    Enable Read-Only Mode (Hide destructive Move/Delete options for this backup)
                    </label>

                    <p style={{ margin: '14px 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Excluded Folders (comma-separated, e.g. node_modules, .git)</p>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                    <input className='setting' style={{ marginBottom: 0 }} value={config.excluded_paths || ''} onChange={(e) => setSettings(prev => ({ ...prev, backup_configs: prev.backup_configs.map(c => c.id === config.id ? { ...c, excluded_paths: e.target.value } : c) }))} placeholder="System Volume Information, $RECYCLE.BIN, node_modules" />
                    </div>
                </div>
                ))}
            </div>
            )}

            {settingsTab === 'ai' && (
            <>
                <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>AI / LLM</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <input
                    type='checkbox'
                    checked={settings.ai_enabled || false}
                    onChange={(e)=>setSettings({
                    ...settings,
                    ai_enabled:e.target.checked
                    })}
                    />
                    Enable AI Classification
                </label>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>AI Provider Base URL (Leave empty for OpenAI)</p>
                <input
                    className='setting'
                    style={{ marginBottom: '16px' }}
                    value={settings.ai_provider || ''}
                    onChange={(e)=>setSettings({
                    ...settings,
                    ai_provider:e.target.value
                    })}
                />
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>AI Model</p>
                <input
                    className='setting'
                    style={{ marginBottom: '16px' }}
                    value={settings.ai_model || ''}
                    onChange={(e)=>setSettings({
                    ...settings,
                    ai_model:e.target.value
                    })}
                />
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>AI API Key</p>
                <input
                    type='password'
                    className='setting'
                    style={{ marginBottom: '0' }}
                    value={settings.ai_api_key || ''}
                    onChange={(e)=>setSettings({
                    ...settings,
                    ai_api_key:e.target.value
                    })}
                />
                <ActionButton disabled={testingAI || actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running} className="btn btn-secondary" onClick={testAIConnection} style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running) ? "Stop all background tasks to test connection" : ""}>
                    {testingAI ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Testing Connection...</> : 'Test AI Connection'}
                </ActionButton>
                </div>

                <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Detection Sensitivity</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Face Detection</p>
                <select
                    className='setting'
                    style={{ marginBottom: '16px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.face_sensitivity || 'medium'}
                    onChange={(e)=>setSettings({...settings, face_sensitivity: e.target.value})}
                >
                    <option value='high'>Detect more faces (Less accurate)</option>
                    <option value='medium'>Balanced (Recommended)</option>
                    <option value='low'>Detect fewer faces (More accurate)</option>
                </select>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Face Clustering Strictness</p>
                <select
                    className='setting'
                    style={{ marginBottom: '16px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.face_clustering_sensitivity || 'medium'}
                    onChange={(e)=>setSettings({...settings, face_clustering_sensitivity: e.target.value})}
                >
                    <option value='high'>Strict (More accurate, creates more profiles)</option>
                    <option value='medium'>Balanced (Recommended)</option>
                    <option value='low'>Loose (Groups more aggressively, may mix people)</option>
                </select>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Minimum Photos for Unknown Persons</p>
                <input
                    type='number'
                    min='1'
                    className='setting'
                    style={{ marginBottom: '16px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.min_unknown_photos !== undefined ? settings.min_unknown_photos : 1}
                    onChange={(e)=>setSettings({...settings, min_unknown_photos: e.target.value === '' ? '' : parseInt(e.target.value)})}
                />

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Object & Scene Detection</p>
                <select
                    className='setting'
                    style={{ marginBottom: '16px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.object_sensitivity || 'medium'}
                    onChange={(e)=>setSettings({...settings, object_sensitivity: e.target.value})}
                >
                    <option value='high'>Detect more tags (Less accurate)</option>
                    <option value='medium'>Balanced (Recommended)</option>
                    <option value='low'>Detect fewer tags (More accurate)</option>
                </select>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Document Text Extraction Word Limit</p>
                <input
                    type='number'
                    min='10'
                    max='10000'
                    className='setting'
                    style={{ marginBottom: '8px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.text_extraction_limit !== undefined ? settings.text_extraction_limit : 300}
                    onChange={(e)=>{
                    let val = e.target.value === '' ? '' : parseInt(e.target.value);
                    if (val > 10000) val = 10000;
                    setSettings({...settings, text_extraction_limit: val});
                    }}
                />
                <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#f59e0b' }}>Tip: Increasing this limit can bloat the database size. (Max: 10,000 words)</p>

                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Document Scanning Depth</p>
                <select
                    className='setting'
                    style={{ marginBottom: '16px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
                    value={settings.document_scan_depth || 'low'}
                    onChange={(e)=>setSettings({...settings, document_scan_depth: e.target.value})}
                >
                    <option value='low'>Low (Fast &amp; Lightweight - Recommended)</option>
                    <option value='medium'>Medium (Balanced scanning depth)</option>
                    <option value='high'>High (Deep &amp; Thorough - May take longer)</option>
                </select>

                <div style={{ height: '1px', background: '#334155', margin: '16px 0' }}></div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer' }}>
                    <input
                        type='checkbox'
                        checked={settings.ocr_enabled || false}
                        onChange={(e)=>setSettings({
                            ...settings,
                            ocr_enabled: e.target.checked
                        })}
                    />
                    Enable OCR (Optical Character Recognition)
                </label>

                {settings.ocr_enabled && (
                    <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer', marginLeft: '20px' }}>
                            <input
                                type='checkbox'
                                checked={settings.ocr_only_no_ai_tags !== undefined ? settings.ocr_only_no_ai_tags : true}
                                onChange={(e)=>setSettings({
                                    ...settings,
                                    ocr_only_no_ai_tags: e.target.checked
                                })}
                            />
                            Only run OCR on photos without faces/objects
                        </label>

                        <div style={{ marginLeft: '20px', marginBottom: '0' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>OCR Maximum Pages per Document</p>
                            <input
                                type='number'
                                min='1'
                                max='100'
                                className='setting'
                                style={{ marginBottom: '8px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                value={settings.ocr_max_pages !== undefined ? settings.ocr_max_pages : 3}
                                onChange={(e)=>setSettings({
                                    ...settings,
                                    ocr_max_pages: e.target.value === '' ? '' : parseInt(e.target.value)
                                })}
                            />
                            <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Limits text recognition on multi-page image-only PDFs.</p>
                        </div>
                    </>
                )}
                </div>

                <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Advanced Performance Tuning (Optional)</h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                    <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#94a3b8' }}>AI &amp; Media CPU Threads</p>
                        <input
                            type='number'
                            min='0'
                            max='32'
                            className='setting'
                            style={{ marginBottom: '4px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                            value={settings.opencv_cpu_threads !== undefined ? settings.opencv_cpu_threads : 4}
                            onChange={(e)=>setSettings({
                                ...settings,
                                opencv_cpu_threads: e.target.value === '' ? '' : parseInt(e.target.value)
                            })}
                        />
                        <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Limits the CPU cores used by Face &amp; Object detection and video frame extraction to prevent WABS from running too hot. (Default: 4, 0 for unlimited)</p>
                    </div>

                    {settings.ocr_enabled && (
                        <>
                            <div style={{ height: '1px', background: '#334155', margin: '8px 0' }}></div>

                            <div>
                                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#94a3b8' }}>OCR CPU Threads</p>
                                <input
                                    type='number'
                                    min='0'
                                    max='32'
                                    className='setting'
                                    style={{ marginBottom: '4px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                    value={settings.ocr_cpu_threads !== undefined ? settings.ocr_cpu_threads : 4}
                                    onChange={(e)=>setSettings({
                                        ...settings,
                                        ocr_cpu_threads: e.target.value === '' ? '' : parseInt(e.target.value)
                                    })}
                                />
                                <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Limits the CPU cores used by text recognition. Set to 2 or 4 to keep your computer responsive during scanning. (Default: 4, 0 for unlimited)</p>
                            </div>

                            <div>
                                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#94a3b8' }}>OCR Image Scan Limit (in pixels)</p>
                                <input
                                    type='number'
                                    min='32'
                                    max='4096'
                                    className='setting'
                                    style={{ marginBottom: '4px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                    value={settings.ocr_det_limit_side_len !== undefined ? settings.ocr_det_limit_side_len : 736}
                                    onChange={(e)=>setSettings({
                                        ...settings,
                                        ocr_det_limit_side_len: e.target.value === '' ? '' : parseInt(e.target.value)
                                    })}
                                />
                                <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Resizes large photos during the text-locating stage. Smaller values run faster, while larger values detect smaller text. (Default: 736)</p>
                            </div>

                            <div>
                                <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#94a3b8' }}>OCR Downscaling Mode</p>
                                <select
                                    className='setting'
                                    style={{ marginBottom: '4px', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none', boxSizing: 'border-box' }}
                                    value={settings.ocr_det_limit_type || 'min'}
                                    onChange={(e)=>setSettings({
                                        ...settings,
                                        ocr_det_limit_type: e.target.value
                                    })}
                                >
                                    <option value='min'>Minimum Side (Keeps resolution high for accuracy)</option>
                                    <option value='max'>Maximum Side (Downscales aggressively for maximum scanning speed)</option>
                                </select>
                                <p style={{ margin: '0', fontSize: '12px', color: '#94a3b8' }}>Choosing 'Maximum Side' is highly recommended for very fast scanning of large camera photos.</p>
                            </div>
                        </>
                    )}
                </div>
                </div>

                <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>Hidden People</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>People hidden from the UI (kept in the database to prevent rescanning).</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(!settings.hidden_people || settings.hidden_people.length === 0) && (
                    <span style={{ color: '#64748b', fontSize: '13px' }}>No hidden people.</span>
                    )}
                    {(settings.hidden_people || []).map(item => {
                    let p = null;
                    if (typeof item === 'number') {
                        p = globalPeopleMap.get(item);
                    } else if (typeof item === 'string') {
                        p = Array.from(globalPeopleMap.values()).find(x => x.name === item);
                    }
                    const name = p ? p.name : (typeof item === 'string' ? item : `Person #${item}`);
                    const key = typeof item === 'string' ? `name-${item}` : `id-${item}`;
                    return (
                        <div key={key} style={{ background: '#0f172a', border: '1px solid #334155', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
                        {name}
                        <ActionButton className="btn btn-secondary" style={{ padding: '2px 6px', background: 'transparent', border: 'none', color: '#ef4444' }} onClick={() => {
                            const next = (settings.hidden_people || []).filter(x => x !== item);
                            updateUIPreferences({ hidden_people: next });
                        }}>Unhide</ActionButton>
                        </div>
                    )
                    })}
                </div>
                </div>
            </>
            )}

        </div>
        </div>
        }
    </>
  );
}