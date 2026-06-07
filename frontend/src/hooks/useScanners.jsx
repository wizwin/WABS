import axios from 'axios';
import { API } from '../States';

export function useScanners({
  indexer, setIndexer, setStats, setActionInProgress, setDataOpProgress,
  showToastMessage, loadDashboard, combinedOptions, explorer, tagsState, peopleState, page
}) {
  async function startFaceScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, face_scanner_running: true, face_scanner_stopped: false }));
      await axios.post(`${API}/scan-faces`);
      showToastMessage('Face scanning started in background...');
      await loadDashboard();
    } catch(err) {
      setIndexer(prev => ({ ...prev, face_scanner_running: false }));
      alert('Error starting face scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  async function stopFaceScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, face_scanner_stopped: true }));
      await axios.post(`${API}/stop-scan-faces`);
      showToastMessage('Stopping face scan...');
      await loadDashboard();
    } catch(err) {
      alert('Error stopping face scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  async function startObjectScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, object_scanner_running: true, object_scanner_stopped: false }));
      await axios.post(`${API}/scan-objects`);
      showToastMessage('Object classification started in background...');
      await loadDashboard(); 
    } catch(err) {
      setIndexer(prev => ({ ...prev, object_scanner_running: false }));
      alert('Error starting object scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  async function stopObjectScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, object_scanner_stopped: true }));
      await axios.post(`${API}/stop-scan-objects`);
      showToastMessage('Stopping object scan...');
      await loadDashboard(); 
    } catch(err) {
      alert('Error stopping object scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  async function startDocumentScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, document_scanner_running: true, document_scanner_stopped: false }));
      await axios.post(`${API}/scan-documents`);
      showToastMessage('Document text extraction started in background...');
      await loadDashboard(); 
    } catch(err) {
      setIndexer(prev => ({ ...prev, document_scanner_running: false }));
      alert('Error starting document scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  async function stopDocumentScan() {
    setActionInProgress(true);
    try {
      setIndexer(prev => ({ ...prev, document_scanner_stopped: true }));
      await axios.post(`${API}/stop-scan-documents`);
      showToastMessage('Stopping document text extraction...');
      await loadDashboard(); 
    } catch(err) {
      alert('Error stopping document scan: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setActionInProgress(false);
    }
  }

  return {
    startFaceScan, stopFaceScan, startObjectScan, stopObjectScan,
    startDocumentScan, stopDocumentScan
  };
}