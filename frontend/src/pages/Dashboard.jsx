import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ImageIcon from '@mui/icons-material/Image';
import MovieIcon from '@mui/icons-material/Movie';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CodeIcon from '@mui/icons-material/Code';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import StorageIcon from '@mui/icons-material/Storage';
import ArchiveIcon from '@mui/icons-material/Archive';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import MemoryIcon from '@mui/icons-material/Memory';
import CategoryIcon from '@mui/icons-material/Category';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import FaceIcon from '@mui/icons-material/Face';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications';

import { ActionButton } from '../components/ui/ActionButton';
import { StatCard } from '../components/ui/StatCard';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function Dashboard(props) {
  const { 
    page, setPage, stats, indexer, objectTags, setSelected, 
    setUnknownPeoplePage, setNamedPeoplePage, setNamedPersonSearchQuery, 
    loadPeople, setTagsPage, setTagSearchQuery, handleCategoryClick,
    actionInProgress, combinedOptions, setCombinedOptions,
    indexerAction, stopVerifyDuplicates, verifyDuplicates,
    stopFaceScan, startFaceScan, stopObjectScan, startObjectScan,
    stopDocumentScan, startDocumentScan, dataOpProgress
  } = props;

  const isTaskActive = actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation);

  return (
    <>
        {
        page==='dashboard' &&
        <div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><DashboardIcon fontSize="large" style={{ color: '#3b82f6' }} /> Dashboard</h1>
        <p>Archive overview, statistics, and indexing controls.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px',marginTop:'20px'}}>
        <StatCard title="Total Files" value={stats.total} icon={<LibraryBooksIcon />} color="#3b82f6" onClick={() => handleCategoryClick('all')} />
        <StatCard title="Photos" value={stats.photos} icon={<ImageIcon />} color="#10b981" onClick={() => handleCategoryClick('photo')} />
        <StatCard title="Videos" value={stats.videos} icon={<MovieIcon />} color="#ef4444" onClick={() => handleCategoryClick('video')} />
        <StatCard title="Audio" value={stats.audio} icon={<AudiotrackIcon />} color="#f59e0b" onClick={() => handleCategoryClick('audio')} />
        <StatCard title="Documents" value={stats.documents} icon={<DescriptionIcon />} color="#8b5cf6" onClick={() => handleCategoryClick('document')} />
        <StatCard title="eBooks" value={stats.ebooks} icon={<MenuBookIcon />} color="#ec4899" onClick={() => handleCategoryClick('ebook')} />
        <StatCard title="Code" value={stats.code} icon={<CodeIcon />} color="#06b6d4" onClick={() => handleCategoryClick('code')} />
        <StatCard title="Fonts" value={stats.fonts} icon={<FontDownloadIcon />} color="#f43f5e" onClick={() => handleCategoryClick('font')} />
        <StatCard title="Databases" value={stats.databases} icon={<StorageIcon />} color="#eab308" onClick={() => handleCategoryClick('database')} />
        <StatCard title="Compressed" value={stats.compressed} icon={<ArchiveIcon />} color="#6366f1" onClick={() => handleCategoryClick('compressed')} />
        <StatCard title="Installers" value={stats.installers} icon={<SystemUpdateIcon />} color="#14b8a6" onClick={() => handleCategoryClick('installer')} />
        <StatCard title="Binaries" value={stats.binaries} icon={<MemoryIcon />} color="#64748b" onClick={() => handleCategoryClick('binary')} />
        <StatCard title="Others" value={stats.others} icon={<CategoryIcon />} color="#94a3b8" onClick={() => handleCategoryClick('other')} />
        </div>

        <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Maintenance & Analysis</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
        <StatCard title="Duplicates" value={stats.duplicates || 0} icon={<FileCopyIcon />} color="#f43f5e" onClick={() => handleCategoryClick('duplicates')} />
        <StatCard title="Known People" value={stats.known_faces || 0} icon={<FaceIcon />} color="#10b981" onClick={() => { setPage('people'); setSelected(null); setUnknownPeoplePage(1); setNamedPeoplePage(1); setNamedPersonSearchQuery(''); loadPeople(); }} />
        <StatCard title="Unknown People" value={stats.unknown_faces || 0} icon={<FaceIcon />} color="#94a3b8" onClick={() => { setPage('people'); setSelected(null); setUnknownPeoplePage(1); setNamedPersonSearchQuery(''); loadPeople(); setTimeout(() => document.getElementById('unknown-people-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }} />
        <StatCard title="Object Tags" value={objectTags.length || 0} icon={<CategoryIcon />} color="#38bdf8" onClick={() => { setPage('tags'); setSelected(null); setTagsPage(1); setTagSearchQuery(''); }} />
        <StatCard title="Untagged Media" value={stats.untagged_media || 0} icon={<ImageIcon />} color="#f59e0b" onClick={() => handleCategoryClick('untagged')} />
        <StatCard title="Searchable Docs" value={stats.searchable_documents || 0} icon={<DescriptionIcon />} color="#ec4899" onClick={() => handleCategoryClick('searchable_documents')} />
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:'18px',marginTop:'24px'}}>
        <div style={{background:'#111827',padding:'18px',borderRadius:'16px',border:'1px solid #24324a', minWidth: 0}}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><AnalyticsIcon style={{ color: '#3b82f6' }} /> Indexing Status</h2>
        <p><b>Status:</b> {indexer.status}</p>
        <p><b>Running:</b> {(indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) ? 'Yes' : 'No'}</p>
        <p><b>Paused:</b> {indexer.paused ? 'Yes' : 'No'}</p>
        <p><b>Indexed:</b> {stats.total}</p>
        {(indexer.running || indexer.combined_scanner_running) && (
        <>
            <p><b>Progress:</b> {indexer.current} / {indexer.total}</p>
            <ProgressBar current={indexer.current} total={indexer.total} color="#3b82f6" />
            <div style={{marginTop: '12px', display: 'flex', gap: '6px', alignItems: 'center'}}>
            <b style={{whiteSpace: 'nowrap'}}>Current File:</b>
            <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left', flex: 1, minWidth: 0, color: '#94a3b8', fontSize: '13px'}}>{indexer.current_file || '—'}</span>
            </div>
        </>
        )}
        </div>
        <div style={{background:'#111827',padding:'18px',borderRadius:'16px',border:'1px solid #24324a', minWidth: 0}}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><SettingsApplicationsIcon style={{ color: '#3b82f6' }} /> Indexer Controls</h2>

        <h3 style={{ margin: '16px 0 10px 0', fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Core Database</h3>

        <div style={{display:'flex', gap:'16px', marginBottom:'16px', flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:'8px', color: isTaskActive ? '#64748b' : '#f8fafc', fontSize:'13px', cursor: isTaskActive ? 'not-allowed' : 'pointer'}}>
            <input type='checkbox' disabled={isTaskActive} checked={combinedOptions.tag} onChange={(e) => { const next = {...combinedOptions, tag: e.target.checked}; setCombinedOptions(next); axios.post(`${API}/indexer/set-options`, next).catch(err => console.warn('Failed to save options', err)); }} /> Classify Objects & Scenes
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'8px', color: isTaskActive ? '#64748b' : '#f8fafc', fontSize:'13px', cursor: isTaskActive ? 'not-allowed' : 'pointer'}}>
            <input type='checkbox' disabled={isTaskActive} checked={combinedOptions.face} onChange={(e) => { const next = {...combinedOptions, face: e.target.checked}; setCombinedOptions(next); axios.post(`${API}/indexer/set-options`, next).catch(err => console.warn('Failed to save options', err)); }} /> Scan for Faces
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'8px', color: isTaskActive ? '#64748b' : '#f8fafc', fontSize:'13px', cursor: isTaskActive ? 'not-allowed' : 'pointer'}}>
            <input type='checkbox' disabled={isTaskActive} checked={combinedOptions.document} onChange={(e) => { const next = {...combinedOptions, document: e.target.checked}; setCombinedOptions(next); axios.post(`${API}/indexer/set-options`, next).catch(err => console.warn('Failed to save options', err)); }} /> Extract Text
        </label>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))',gap:'8px'}}>
        <ActionButton disabled={isTaskActive} onClick={()=>indexerAction('start')}>
        Start
        </ActionButton>
        <ActionButton disabled={isTaskActive} onClick={()=>indexerAction('update')}>
        Update
        </ActionButton>
        <ActionButton disabled={isTaskActive} onClick={()=>indexerAction('reindex')} style={{ color: isTaskActive ? undefined : '#f59e0b' }}>
        Re-index
        </ActionButton>
        <ActionButton disabled={actionInProgress || (!indexer.running && !indexer.combined_scanner_running) || indexer.paused || (indexer.running && indexer.stopped) || (indexer.combined_scanner_running && indexer.combined_scanner_stopped)} onClick={()=>indexerAction('pause')}>
        Pause
        </ActionButton>
        <ActionButton disabled={actionInProgress || (!indexer.running && !indexer.combined_scanner_running) || !indexer.paused || (indexer.running && indexer.stopped) || (indexer.combined_scanner_running && indexer.combined_scanner_stopped)} onClick={()=>indexerAction('resume')}>
        Resume
        </ActionButton>
        <ActionButton disabled={actionInProgress || (!indexer.running && !indexer.combined_scanner_running) || (indexer.running && indexer.stopped) || (indexer.combined_scanner_running && indexer.combined_scanner_stopped)} onClick={()=>indexerAction('stop')} style={{ color: ((!indexer.running && !indexer.combined_scanner_running) || (indexer.running && indexer.stopped) || (indexer.combined_scanner_running && indexer.combined_scanner_stopped)) ? undefined : '#ef4444' }}>
        Stop
        </ActionButton>
        </div>

        <h3 style={{ margin: '20px 0 10px 0', fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Background Analysis</h3>
        <div style={{display:'grid',gap:'8px'}}>
        <div style={{display:'flex', flexDirection:'column', minWidth: 0}}>
        {indexer.hasher_running ? (
        <>
        <ActionButton disabled={actionInProgress || indexer.hasher_stopped} onClick={stopVerifyDuplicates} style={{ width: '100%', color: '#ef4444' }}>
        {indexer.hasher_stopped ? 'Stopping Hash Verification...' : 'Stop Hash Verification'}
        </ActionButton>
        <ProgressBar current={indexer.hasher_current} total={indexer.hasher_total} color="#10b981" />
        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left', marginTop: '4px' }}>{indexer.hasher_current_file || ''}</div>
        </>
        ) : (
        <ActionButton disabled={isTaskActive} onClick={verifyDuplicates} style={{ width: '100%' }}>
        Verify Hashes (Duplicates)
        </ActionButton>
        )}
        </div>
        <div style={{display:'flex', flexDirection:'column', minWidth: 0}}>
        {indexer.face_scanner_running ? (
        <>
        <ActionButton disabled={actionInProgress || indexer.face_scanner_stopped} onClick={stopFaceScan} style={{ width: '100%', color: '#ef4444' }}>
        {indexer.face_scanner_stopped ? 'Stopping Face Scan...' : 'Stop Face Scan'}
        </ActionButton>
        <ProgressBar current={indexer.face_scanner_current} total={indexer.face_scanner_total} color="#8b5cf6" />
        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left', marginTop: '4px' }}>{indexer.face_scanner_current_file || ''}</div>
        </>
        ) : (
        <ActionButton disabled={isTaskActive} onClick={startFaceScan} style={{ width: '100%' }}>
        Scan for Faces (People)
        </ActionButton>
        )}
        </div>
        <div style={{display:'flex', flexDirection:'column', minWidth: 0}}>
        {indexer.object_scanner_running ? (
        <>
        <ActionButton disabled={actionInProgress || indexer.object_scanner_stopped} onClick={stopObjectScan} style={{ width: '100%', color: '#ef4444' }}>
        {indexer.object_scanner_stopped ? 'Stopping Object Scan...' : 'Stop Object Scan'}
        </ActionButton>
        <ProgressBar current={indexer.object_scanner_current} total={indexer.object_scanner_total} color="#f59e0b" />
        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left', marginTop: '4px' }}>{indexer.object_scanner_current_file || ''}</div>
        </>
        ) : (
        <ActionButton disabled={isTaskActive} onClick={startObjectScan} style={{ width: '100%' }}>
        Classify Objects & Scenes
        </ActionButton>
        )}
        </div>
        <div style={{display:'flex', flexDirection:'column', minWidth: 0}}>
        {indexer.document_scanner_running ? (
        <>
        <ActionButton disabled={actionInProgress || indexer.document_scanner_stopped} onClick={stopDocumentScan} style={{ width: '100%', color: '#ef4444' }}>
        {indexer.document_scanner_stopped ? 'Stopping Text Extraction...' : 'Stop Text Extraction'}
        </ActionButton>
        <ProgressBar current={indexer.document_scanner_current} total={indexer.document_scanner_total} color="#ec4899" />
        <div style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left', marginTop: '4px' }}>{indexer.document_scanner_current_file || ''}</div>
        </>
        ) : (
        <ActionButton disabled={isTaskActive} onClick={startDocumentScan} style={{ width: '100%' }} title="Extract content from PDFs, documents, and photos so they appear in search results">
        Extract Text
        </ActionButton>
        )}
        </div>

        </div>
        </div>
        </div>
        </div>
        }
    </>
  );
}