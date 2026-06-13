import React from 'react';
import axios from 'axios';
import CategoryIcon from '@mui/icons-material/Category';
import CloseIcon from '@mui/icons-material/Close';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import DescriptionIcon from '@mui/icons-material/Description';

import { ActionButton } from '../components/ui/ActionButton';
import { ProgressBar } from '../components/ui/ProgressBar';
import { API } from '../States';

export default function Tags(props) {
  const { 
    page, clearAllObjectTags, actionInProgress, indexer, stopObjectScan, startObjectScan,
    tagSearchQuery, setTagSearchQuery, setTagsPage, filteredTags, tagsPage, setFilterCategory,
    doSearch, deleteTagGlobally, objectTags, stopDocumentScan, startDocumentScan, showToastMessage,
    loadDashboard, dataOpProgress
  } = props;

  return (
    <>
        {
        page==='tags' &&
        <div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px' }}><CategoryIcon fontSize="large" style={{ color: '#3b82f6' }} /> AI Enrichment &amp; Tags</h1>
        <p style={{ margin: '0 0 24px 0', color: '#cbd5e1' }}>Manage automatically detected objects and extracted document text.</p>

        <div style={{background:'#111827', padding:'24px', borderRadius:'16px', border:'1px solid #24324a', marginBottom: '24px'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px', color: '#f8fafc', fontSize: '20px' }}><CategoryIcon fontSize="medium" style={{ color: '#3b82f6' }} /> Detected Objects &amp; Scenes</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Explore automatically classified objects and scenes found in your indexed photos.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ActionButton 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', flexShrink: 0, whiteSpace: 'nowrap' }} 
                onClick={clearAllObjectTags}
                disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)}
                title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to clear tags" : "Permanently remove all 'object:' tags from the entire database."}
            >
            Clear All Tags
            </ActionButton>
            {indexer.object_scanner_running ? (
            <ActionButton disabled={actionInProgress || indexer.object_scanner_stopped} className="btn btn-secondary" style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={stopObjectScan}>
                <CloseIcon fontSize="small" /> {indexer.object_scanner_stopped ? 'Stopping...' : 'Stop Scanning'}
            </ActionButton>
            ) : (
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startObjectScan}>
                <PlayCircleIcon fontSize="small" /> Classify Objects & Scenes
            </ActionButton>
            )}
        </div>
        </div>

        {indexer.object_scanner_running && (
        <div style={{ marginBottom: '20px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Object Scanner Progress</span>
            <ProgressBar current={indexer.object_scanner_current} total={indexer.object_scanner_total} color="#f59e0b" />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.object_scanner_current_file || ''}</div>
        </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <input
            type="text"
            placeholder="Search tags..."
            value={tagSearchQuery}
            onChange={(e) => { setTagSearchQuery(e.target.value); setTagsPage(1); }}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', width: '100%', maxWidth: '300px', outline: 'none' }}
        />
        
        {filteredTags.length > 100 && (
            <div style={{ display: 'flex', gap: '16px' }}>
            <ActionButton disabled={tagsPage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setTagsPage(prev => Math.max(1, prev - 1))}>
                Previous
            </ActionButton>
            <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {tagsPage} of {Math.ceil(filteredTags.length / 100)}</span>
            <ActionButton disabled={tagsPage >= Math.ceil(filteredTags.length / 100)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setTagsPage(prev => prev + 1)}>
                Next
            </ActionButton>
            </div>
        )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
        {filteredTags.slice((tagsPage - 1) * 100, tagsPage * 100).map(tag => {
            const tagName = tag.replace('object:', '').replace(/_/g, ' ');
            return (
            <div key={tag} style={{ position: 'relative', display: 'inline-block' }}>
                <ActionButton className="btn btn-secondary" style={{ padding: '8px 16px', background: '#1e293b', color: '#38bdf8', borderColor: '#3b82f6', fontSize: '14px', paddingRight: '32px' }} onClick={() => { setFilterCategory('all'); doSearch(tag, 'all'); }}>
                {tagName}
                </ActionButton>
                <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} style={{ position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)', background: 'transparent', color: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, minWidth: 0 }} onClick={() => deleteTagGlobally(tag)} title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to delete tag" : `Delete tag "${tagName}" globally`}>
                <CloseIcon fontSize="small" />
                </ActionButton>
            </div>
            );
        })}
        {filteredTags.length === 0 && tagSearchQuery && <p style={{ color: '#94a3b8', margin: 0 }}>No tags match your search.</p>}
        {objectTags.length === 0 && !tagSearchQuery && <p style={{ color: '#94a3b8', margin: 0 }}>No objects classified yet. Run the Object Scanner to populate this list.</p>}
        </div>

        {filteredTags.length > 100 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', marginBottom: '24px' }}>
            <ActionButton disabled={tagsPage === 1} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setTagsPage(prev => Math.max(1, prev - 1))}>
            Previous
            </ActionButton>
            <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {tagsPage} of {Math.ceil(filteredTags.length / 100)}</span>
            <ActionButton disabled={tagsPage >= Math.ceil(filteredTags.length / 100)} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setTagsPage(prev => prev + 1)}>
            Next
            </ActionButton>
        </div>
        )}
        </div>

        <div style={{background:'#111827', padding:'24px', borderRadius:'16px', border:'1px solid #24324a', marginBottom: '24px'}}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px', color: '#f8fafc', fontSize: '20px' }}><DescriptionIcon fontSize="medium" style={{ color: '#ec4899' }} /> Document Text Extraction</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>Automatically extract text from PDFs, Documents, and Spreadsheets to make them searchable.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <ActionButton 
            className="btn btn-secondary" 
            style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', flexShrink: 0, whiteSpace: 'nowrap' }} 
            onClick={async () => {
                if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
                    alert("Please stop all background tasks before modifying data to prevent database conflicts.");
                    return;
                }
                if (!window.confirm("Are you sure you want to clear all extracted text from the database? This cannot be undone.")) return;
                try {
                    await axios.post(`${API}/reset-document-scanner-progress`);
                    showToastMessage("All extracted text has been cleared.");
                    loadDashboard();
                } catch(err) {
                    alert('Error clearing text: ' + (err?.response?.data?.detail || err.message));
                }
            }}
            disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)}
            title={(actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) ? "Stop all background tasks to clear extracted text" : "Permanently remove all extracted text from the entire database."}
        >
            Clear Extracted Text
        </ActionButton>

        {indexer.document_scanner_running ? (
            <ActionButton disabled={actionInProgress || indexer.document_scanner_stopped} className="btn btn-secondary" style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={stopDocumentScan}>
            <CloseIcon fontSize="small" /> {indexer.document_scanner_stopped ? 'Stopping...' : 'Stop Extraction'}
            </ActionButton>
        ) : (
            <ActionButton disabled={actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)} className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startDocumentScan} title="Extract content from PDFs and Documents so they appear in search results">
            <PlayCircleIcon fontSize="small" /> Extract Document Text
            </ActionButton>
        )}
        </div>
        </div>

        {indexer.document_scanner_running && (
        <div style={{ marginBottom: '20px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Text Extractor Progress</span>
            <ProgressBar current={indexer.document_scanner_current} total={indexer.document_scanner_total} color="#ec4899" />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.document_scanner_current_file || ''}</div>
        </div>
        )}

        </div>
        </div>
        }
    </>
  );
}