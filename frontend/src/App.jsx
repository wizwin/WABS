import {useState,useEffect,useRef,useMemo} from 'react'
import axios from 'axios'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'

import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import People from './pages/People';
import Person from './pages/Person';
import Tags from './pages/Tags';
import Settings from './pages/Settings';
import About from './pages/About';

import { API, dateFormatter, placeholderCache, SettingsContext } from './States';
import { ActionButton } from './components/ui/ActionButton';
import { PersonThumb } from './components/ui/PersonThumb';
import { Sidebar } from './components/ui/Sidebar';
import { Topbar } from './components/ui/Topbar';
import { useTags } from './hooks/useTags';
import { usePeople } from './hooks/usePeople';
import { useExplorer } from './hooks/useExplorer';
import { useScanners } from './hooks/useScanners';
import { useSystemOps } from './hooks/useSystemOps';

export function useAppState() {
const [page,setPage]=useState('dashboard')
const [query,setQuery]=useState('')
const [settings,setSettings]=useState({})
const [stats,setStats]=useState({total:0,photos:0,videos:0,audio:0,documents:0,ebooks:0,code:0,fonts:0,databases:0,compressed:0,installers:0,binaries:0,others:0,duplicates:0,searchable_documents:0,tagged_objects:0,untagged_media:0})
const [indexer,setIndexer]=useState({running:false,paused:false,stopped:false,current:0,total:0,current_file:'',status:'Idle',indexed:0,face_scanner_running:false,object_scanner_running:false,document_scanner_running:false,hasher_running:false,hasher_current:0,hasher_total:0,face_scanner_current:0,face_scanner_total:0,object_scanner_current:0,object_scanner_total:0,document_scanner_current:0,document_scanner_total:0})
const [showSidebar, setShowSidebar] = useState(true)
const [showTimeline, setShowTimeline] = useState(true)
const [showDetails, setShowDetails] = useState(true)
const [sidebarWidth, setSidebarWidth] = useState(240)
const [timelineWidth, setTimelineWidth] = useState(150)
const [detailsWidth, setDetailsWidth] = useState(260)
const [isResizing, setIsResizing] = useState(null)
const [showSearchHelp, setShowSearchHelp] = useState(false)
const [isShutdown, setIsShutdown] = useState(false)
const [isShuttingDown, setIsShuttingDown] = useState(false)
const [toastMessage, setToastMessage] = useState('');
const [showToast, setShowToast] = useState(false);
const [toastAction, setToastAction] = useState(null);
const toastTimeoutRef = useRef(null);
const wasRunningRef = useRef(false);
const [suggestionsData, setSuggestionsData] = useState({ type: 'none', suggestions: [], lastWord: '' });
const suggestionTimeout = useRef(null);
const searchContainerRef = useRef(null);
const suggestionAbortController = useRef(null);
const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
const [dbFilename, setDbFilename] = useState('archive.db');
const [actionInProgress, setActionInProgress] = useState(false);
const [dataOpProgress, setDataOpProgress] = useState(null);
const [combinedOptions, setCombinedOptions] = useState(() => {
  try {
    const saved = localStorage.getItem('wabs_combined_options');
    return saved ? JSON.parse(saved) : { tag: false, face: false, document: false };
  } catch (e) {
    return { tag: false, face: false, document: false };
  }
});
const [settingsTab, setSettingsTab] = useState('general');
const [fullTimelineData, setFullTimelineData] = useState([]);
const [timelineUpdateTick, setTimelineUpdateTick] = useState(0);
const [testingAI, setTestingAI] = useState(false);
const [aiSearchPrompt, setAiSearchPrompt] = useState('');
const [generatingSearch, setGeneratingSearch] = useState(false);

const showToastMessage = (message, action = null) => {
  setToastMessage(message);
  setToastAction(action);
  setShowToast(true);
  if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  toastTimeoutRef.current = setTimeout(() => {
    setShowToast(false);
    setToastMessage('');
    setToastAction(null);
  }, action ? 6000 : 3000);
};

const sharedState = useRef({});

const explorer = useExplorer({
  settings, page, setPage, query, setQuery, showToastMessage, sharedState, indexer, actionInProgress, dataOpProgress, setActionInProgress
});

const tagsState = useTags({
  indexer, setIndexer, checkedFiles: explorer.checkedFiles, setCheckedFiles: explorer.setCheckedFiles, globalFileCache: explorer.globalFileCache, page, filterCategory: explorer.filterCategory,
  loadFiles: explorer.loadFiles, goToSearch: explorer.goToSearch, selected: explorer.selected, setSelected: explorer.setSelected, loadDashboard, showToastMessage, setActionInProgress, setDataOpProgress, actionInProgress, dataOpProgress
});

const peopleState = usePeople({
  indexer, setIndexer, settings, page, setPage, selected: explorer.selected, setSelected: explorer.setSelected, checkedFiles: explorer.checkedFiles, setCheckedFiles: explorer.setCheckedFiles, globalFileCache: explorer.globalFileCache, filterCategory: explorer.filterCategory, loadFiles: explorer.loadFiles, goToSearch: explorer.goToSearch, loadDashboard, showToastMessage, setActionInProgress, setDataOpProgress, setOffset: explorer.setOffset, setStartOffset: explorer.setStartOffset, setHasMore: explorer.setHasMore, actionInProgress, dataOpProgress
});

sharedState.current.people = peopleState;

const scannerState = useScanners({
  indexer, setIndexer, setStats, setActionInProgress, setDataOpProgress,
  showToastMessage, loadDashboard, combinedOptions, explorer, tagsState, peopleState, page, actionInProgress, dataOpProgress
});

const systemOpsState = useSystemOps({
  indexer, setIndexer, setStats, setActionInProgress, setDataOpProgress,
  showToastMessage, loadDashboard, combinedOptions, explorer, tagsState, peopleState, page, actionInProgress, dataOpProgress
});

useEffect(() => {
  localStorage.setItem('wabs_combined_options', JSON.stringify(combinedOptions));
  setSettings(prev => ({
    ...prev,
    run_face_scan: combinedOptions.face,
    run_object_scan: combinedOptions.tag,
    run_document_scan: combinedOptions.document
  }));
}, [combinedOptions]);

const handleSearchChange = (e) => {
  const value = e.target.value;
  explorer.doSearch(value);
  setShowSearchHelp(false);
  setFocusedSuggestionIndex(-1);

  if (suggestionTimeout.current) clearTimeout(suggestionTimeout.current);
  suggestionTimeout.current = setTimeout(async () => {
    if (!value.trim()) {
      setSuggestionsData({ type: 'none', suggestions: [], lastWord: '' });
      return;
    }

    if (suggestionAbortController.current) {
      suggestionAbortController.current.abort();
    }
    suggestionAbortController.current = new AbortController();

    const words = value.trimStart().split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    const isAndPrefix = lastWord.startsWith('+');
    const isNotPrefix = lastWord.startsWith('-');
    const cleanWord = (isAndPrefix || isNotPrefix) ? lastWord.substring(1) : lastWord;

    if (cleanWord.startsWith('object:')) {
      const suggestions = (tagsState.objectTags || [])
        .filter(t => t.toLowerCase().startsWith(cleanWord))
        .slice(0, 8);
      if (suggestions.length > 0) {
        setSuggestionsData({ type: 'tag', suggestions: suggestions.map(s => isAndPrefix ? '+' + s : isNotPrefix ? '-' + s : s), lastWord });
        return;
      }
    } else if (cleanWord.startsWith('person:')) {
      const searchName = cleanWord.replace('person:', '').replace(/_/g, ' ');
      const suggestions = (Array.isArray(peopleState.people) ? peopleState.people : [])
        .filter(p => p.name && !p.name.startsWith('Unknown Person') && p.name.toLowerCase().includes(searchName) && !(settings.hidden_people || []).includes(p.id))
        .map(p => isAndPrefix ? `+person:"${p.name}"` : isNotPrefix ? `-person:"${p.name}"` : `person:"${p.name}"`)
        .slice(0, 8);
      if (suggestions.length > 0) {
        setSuggestionsData({ type: 'tag', suggestions, lastWord });
        return;
      }
    }

    try {
      const safeQuery = value.replace(/,/g, ' ');
      const r = await axios.get(`${API}/search/suggestions?q=${encodeURIComponent(safeQuery)}&limit=5`, {
        signal: suggestionAbortController.current.signal
      });
      setSuggestionsData(r.data);
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn('Suggestions failed', err);
      }
    }
  }, 300);
};

const applySuggestion = (suggestion) => {
  const words = query.trim().split(' ');
  words.pop();
  words.push(suggestion);
  const newQuery = words.join(' ') + ' ';
  setQuery(newQuery);
  setSuggestionsData({ type: 'none', suggestions: [], lastWord: '' });
  setFocusedSuggestionIndex(-1);
  explorer.doSearch(newQuery);
};

const handleKeyDown = (e) => {
  if (suggestionsData.suggestions.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => prev < suggestionsData.suggestions.length - 1 ? prev + 1 : prev);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && focusedSuggestionIndex >= 0) {
      e.preventDefault();
      applySuggestion(suggestionsData.suggestions[focusedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setSuggestionsData({ type: 'none', suggestions: [], lastWord: '' });
      setFocusedSuggestionIndex(-1);
    }
  }
};

async function loadSettings(){
 const r=await axios.get(`${API}/settings`)
 let data = r.data;
 if (data.database_path && typeof data.database_path === 'string' && data.database_path.endsWith('.db')) {
   const lastSlash = Math.max(data.database_path.lastIndexOf('/'), data.database_path.lastIndexOf('\\'));
   if (lastSlash !== -1) {
     setDbFilename(data.database_path.substring(lastSlash + 1));
     data.database_path = data.database_path.substring(0, lastSlash);
   } else {
     setDbFilename(data.database_path);
     data.database_path = '';
   }
 }
 if (!data.backup_configs || data.backup_configs.length === 0) {
   data.backup_configs = [{
     id: 'default',
     name: 'Default Backup Location',
     backup_path: data.backup_path || '',
     mapped_backup_path: data.mapped_backup_path || '',
     path_mapping_enabled: data.path_mapping_enabled || false,
     read_only_mode: data.read_only_mode !== false
   }];
 }
 setSettings(data)
 if(data.show_sidebar !== undefined) setShowSidebar(data.show_sidebar)
 if(r.data.show_timeline !== undefined) setShowTimeline(r.data.show_timeline)
 if(r.data.show_details !== undefined) setShowDetails(r.data.show_details)
 if(r.data.sidebar_width) setSidebarWidth(r.data.sidebar_width)
 if(r.data.timeline_width) setTimelineWidth(r.data.timeline_width)
 if(r.data.details_width) setDetailsWidth(r.data.details_width)

 // Sync the saved AI scanning options directly from the backend configuration
 if (data.run_face_scan !== undefined || data.run_object_scan !== undefined || data.run_document_scan !== undefined) {
   setCombinedOptions(prev => ({
     face: data.run_face_scan ?? prev.face,
     tag: data.run_object_scan ?? prev.tag,
     document: data.run_document_scan ?? prev.document
   }));
 }
}

async function saveSettings(){
 if (window.wabs_action_in_progress) return;
 if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
   alert("Please stop all background tasks before saving settings to prevent database or path conflicts.");
   return;
 }
 window.wabs_action_in_progress = true;
 const payload = { ...settings };
 if (payload.database_path && typeof payload.database_path === 'string' && !payload.database_path.endsWith('.db')) {
   const separator = payload.database_path.includes('\\') ? '\\' : '/';
   const cleanPath = payload.database_path.replace(/[/\\]$/, '');
   payload.database_path = cleanPath ? (cleanPath + separator + dbFilename) : dbFilename;
 }
 await axios.post(`${API}/settings`, payload)
 showToastMessage('Settings Saved');
 await loadDashboard();
 // After saving settings, reload content if on explorer or search page
 if (page === 'explorer') {
   await explorer.loadFiles(0, false, explorer.filterCategory);
 } else if (page === 'search') {
   await explorer.goToSearch(explorer.filterCategory);
 }
 window.wabs_action_in_progress = false;
}

async function choosePath(field, mode){
 try {
   const r = await axios.get(`${API}/choose-path?mode=${mode}`)
   if(r.data && r.data.path){
     setSettings(prev => ({...prev,[field]:r.data.path}))
   }
 } catch(err){
   console.warn('Path chooser failed', err)
   alert('Unable to open native path chooser. Please enter the path manually.')
 }
}

async function choosePathForConfig(configId, field, mode){
 try {
   const r = await axios.get(`${API}/choose-path?mode=${mode}`)
   if(r.data && r.data.path){
     setSettings(prev => ({
       ...prev,
       backup_configs: prev.backup_configs.map(c => c.id === configId ? { ...c, [field]: r.data.path } : c)
     }))
   }
 } catch(err){
   console.warn('Path chooser failed', err)
   alert('Unable to open native path chooser. Please enter the path manually.')
 }
}

async function testAIConnection() {
  setTestingAI(true);
  try {
    const payload = {
      ai_provider: settings.ai_provider,
      ai_model: settings.ai_model,
      ai_api_key: settings.ai_api_key
    };
    const r = await axios.post(`${API}/system/test-ai`, payload);
    showToastMessage(`Success! Model replied: ${r.data.reply}`);
  } catch (err) {
    alert(`Connection failed: ${err?.response?.data?.detail || err.message}`);
  } finally {
    setTestingAI(false);
  }
}

async function generateSearchWithAI() {
  if (!aiSearchPrompt.trim()) return;
  setGeneratingSearch(true);
  try {
    const payload = {
      prompt: aiSearchPrompt,
      ai_provider: settings.ai_provider,
      ai_model: settings.ai_model,
      ai_api_key: settings.ai_api_key
    };
    const r = await axios.post(`${API}/system/generate-search`, payload);
    const generatedQuery = r.data.query;
    
    const newId = `smartsearch_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      smart_searches: [...(prev.smart_searches || []), { id: newId, name: aiSearchPrompt.slice(0, 30) + (aiSearchPrompt.length > 30 ? '...' : ''), query: generatedQuery }]
    }));
    setAiSearchPrompt('');
    showToastMessage('Smart Search generated successfully!');
  } catch (err) {
    alert('Failed to generate search: ' + (err?.response?.data?.detail || err.message));
  } finally {
    setGeneratingSearch(false);
  }
}

async function clearCache() {
  if (window.wabs_action_in_progress) return;
  if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || (indexer.data_operation_running && !indexer.cancel_data_operation)) {
    alert("Please stop all background tasks before clearing the thumbnail cache to prevent database and file access conflicts.");
    return;
  }
  if (!window.confirm('Are you sure you want to clear the thumbnail cache? The cached images will be permanently deleted and automatically regenerated as needed.')) return;
  window.wabs_action_in_progress = true;
  setActionInProgress(true);
  try {
    await axios.post(`${API}/clear-cache`);
    showToastMessage('Thumbnail cache cleared successfully.');
  } catch(err) {
    alert('Error clearing cache: ' + (err?.response?.data?.detail || err.message));
  } finally {
    window.wabs_action_in_progress = false;
    setActionInProgress(false);
  }
}

async function loadDashboard(){
 const timestamp = Date.now();
 const [statsRes, indexerRes] = await Promise.all([
   axios.get(`${API}/stats?t=${timestamp}`),
   axios.get(`${API}/indexer/status?t=${timestamp}`)
 ])
 setStats(prev => ({...prev, ...statsRes.data}))
   const indexerData = indexerRes.data;
   if (indexerData) {
     if (indexerData.cancel_data_operation) indexerData.data_operation_running = false;
   }
   setIndexer(indexerData)
}

async function handleShutdown() {
  if (window.confirm('Are you sure you want to shut down the WABS server?')) {
    setIsShuttingDown(true);
    try {
      const isAnyScannerRunning = indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running;
      
      if (isAnyScannerRunning) {
        if (indexer.data_operation_running) {
          try { await axios.post(`${API}/system/cancel-data-operation`); } catch(e) {}
        }
        if (indexer.running || indexer.combined_scanner_running) {
          try { await axios.post(`${API}/indexer/stop`); } catch(e) {}
        }
        if (indexer.face_scanner_running) {
          try { await axios.post(`${API}/stop-scan-faces`); } catch(e) {}
        }
        if (indexer.object_scanner_running) {
          try { await axios.post(`${API}/stop-scan-objects`); } catch(e) {}
        }
        if (indexer.document_scanner_running) {
          try { await axios.post(`${API}/stop-scan-documents`); } catch(e) {}
        }
        if (indexer.hasher_running) {
          try { await axios.post(`${API}/stop-verify-duplicates`); } catch(e) {}
        }

        // Wait for scanners to completely stop
        for (let i = 0; i < 30; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const r = await axios.get(`${API}/indexer/status?t=${Date.now()}`);
            const status = r.data;
            if (!status.running && !status.combined_scanner_running && !status.face_scanner_running && !status.object_scanner_running && !status.document_scanner_running && !status.hasher_running && !status.data_operation_running) {
              break;
            }
          } catch(e) {
            break; // Stop polling if server unreachable
          }
        }
      }

      await axios.post(`${API}/shutdown`)
      if (!window.wabsForceShutdown) {
        setIsShuttingDown(false);
        setIsShutdown(true)
      }
    } catch (err) {
      if (!window.wabsForceShutdown) {
        setIsShuttingDown(false);
        alert('Failed to send shutdown signal. Please close the application manually via Task Manager.');
      }
    }
  }
}

async function handleForceShutdown() {
  window.wabsForceShutdown = true;
  try {
    try { await axios.post(`${API}/system/cancel-data-operation`); } catch(e) {}
    await axios.post(`${API}/shutdown`);
    setIsShuttingDown(false);
    setIsShutdown(true);
  } catch (err) {
    setIsShuttingDown(false);
    alert('Failed to send force shutdown signal. Please close the application manually via Task Manager.');
  }
}

const updateUIPreferences = (updates) => {
  setSettings(prev => {
    const next = { ...prev, ...updates };
    const payload = { ...next };
    if (payload.database_path && typeof payload.database_path === 'string' && !payload.database_path.endsWith('.db')) {
      const separator = payload.database_path.includes('\\') ? '\\' : '/';
      const cleanPath = payload.database_path.replace(/[/\\]$/, '');
      payload.database_path = cleanPath ? (cleanPath + separator + dbFilename) : dbFilename;
    }
    axios.post(`${API}/settings`, payload).catch(e => console.warn(e));
    return next;
  });
};

const toggleSidebar = () => {
  const val = !showSidebar;
  setShowSidebar(val);
  updateUIPreferences({ show_sidebar: val });
};

const toggleTimeline = () => {
  const val = !showTimeline;
  setShowTimeline(val);
  updateUIPreferences({ show_timeline: val });
};

const toggleDetails = () => {
  const val = !showDetails;
  setShowDetails(val);
  updateUIPreferences({ show_details: val });
};

const togglePinPerson = (e, id) => {
  e.stopPropagation();
  const currentPinned = settings.pinned_people || [];
  let next;
  if (currentPinned.includes(id)) {
      next = currentPinned.filter(x => x !== id);
      showToastMessage(`Profile removed from favorites.`);
  } else {
      next = [...currentPinned, id];
      showToastMessage(`Profile pinned to favorites.`);
  }
  updateUIPreferences({ pinned_people: next });
};

const widthsRef = useRef({ sidebar: 240, timeline: 150, details: 260 });
widthsRef.current = { sidebar: sidebarWidth, timeline: timelineWidth, details: detailsWidth };

useEffect(() => {
  if (!isResizing) {
    document.body.style.userSelect = '';
    return;
  }
  document.body.style.userSelect = 'none';
  const handleMouseMove = (e) => {
    if (isResizing === 'sidebar') setSidebarWidth(Math.max(100, Math.min(e.clientX, window.innerWidth - 300)));
    else if (isResizing === 'timeline') {
      const el = document.querySelector('.timeline');
      if(el) setTimelineWidth(Math.max(100, Math.min(e.clientX - el.getBoundingClientRect().left, window.innerWidth - 300)));
    } else if (isResizing === 'details') {
      const el = document.querySelector('.details');
      if(el) setDetailsWidth(Math.max(150, Math.min(el.getBoundingClientRect().right - e.clientX, window.innerWidth - 300)));
    }
  };
  const handleMouseUp = () => {
    setIsResizing(null);
    updateUIPreferences({ sidebar_width: widthsRef.current.sidebar, timeline_width: widthsRef.current.timeline, details_width: widthsRef.current.details });
  };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  return () => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}, [isResizing]);

useEffect(() => {
  const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
  if (showFull) {
    axios.get(`${API}/timeline?category=${explorer.filterCategory}`).then(r => {
      const groups = new Map();
      r.data.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const key = dateFormatter.format(d);
          if (!groups.has(key)) {
            groups.set(key, { 
              key, 
              yearMonth: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
              timestamp: d.getTime(),
              count: 0
            });
          }
          groups.get(key).count += (item.count || 0);
        }
      });
      const sorted = Array.from(groups.values()).sort((a, b) => b.timestamp - a.timestamp);
      
      let currentOffsetDesc = 0;
      for (let i = 0; i < sorted.length; i++) {
        sorted[i].offsetDesc = currentOffsetDesc;
        currentOffsetDesc += sorted[i].count;
      }
      
      let currentOffsetAsc = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        sorted[i].offsetAsc = currentOffsetAsc;
        currentOffsetAsc += sorted[i].count;
      }

      setFullTimelineData(sorted);
    }).catch(e => console.warn('Failed to load full timeline', e));
  }
}, [settings.show_full_timeline, settings.ui_preferences?.show_full_timeline, explorer.filterCategory, indexer.running, timelineUpdateTick]);

const timelineItems = useMemo(() => {
  const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
  if (showFull && fullTimelineData.length > 0) {
    let items = [...fullTimelineData];
    if (explorer.sortBy === 'date' && explorer.sortOrder === 'asc') items.reverse();
    return items.map(t => t.key);
  }
  return page === 'person_files' ? Array.from(peopleState.groupedPersonFiles.keys()) : Array.from(explorer.groupedFiles.keys());
}, [settings.show_full_timeline, settings.ui_preferences?.show_full_timeline, fullTimelineData, explorer.groupedFiles, peopleState.groupedPersonFiles, explorer.sortBy, explorer.sortOrder, page]);

useEffect(() => {
  const handleClickOutside = (event) => {
    if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
      setSuggestionsData({ type: 'none', suggestions: [], lastWord: '' });
      setFocusedSuggestionIndex(-1);
      setShowSearchHelp(false);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

useEffect(()=>{
 explorer.loadFiles()
 loadSettings()
 loadDashboard()
 peopleState.loadPeople()
 tagsState.loadTags()
},[])

useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash;
    if (hash === '#settings') {
      setPage('settings');
      setSettingsTab('general');
    } else if (hash === '#dashboard' || hash === '') {
      setPage('dashboard');
    }
  };
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
  return () => window.removeEventListener('hashchange', handleHashChange);
}, []);

useEffect(() => {
  let isMounted = true;
  let timeoutId;
  let errorRetries = 0;
  let pollCount = 0;

  const poll = async () => {
    if (!isMounted) return;
    try {
      await loadDashboard();
      if (page === 'people') await peopleState.loadPeople();
      
      pollCount++;
      // Refresh tags every 3 seconds while scanning to update the UI without causing heavy DB locks
      if (pollCount % 3 === 0) {
        await tagsState.loadTags();
          setTimelineUpdateTick(prev => prev + 1);
      }

      errorRetries = 0; // Reset counter on successful poll
    } catch (e) {
      console.warn("Polling error:", e);
      errorRetries++;
      if (errorRetries >= 5) {
        console.error("Max polling retries reached. Assuming backend is offline.");
        setIndexer(prev => ({
          ...prev,
          running: false,
          hasher_running: false,
          face_scanner_running: false,
          object_scanner_running: false,
          document_scanner_running: false,
          combined_scanner_running: false,
          data_operation_running: false
        }));
        showToastMessage("Connection lost. Stopped monitoring background tasks.");
        return; // Stop polling and gracefully unlock UI
      }
    }
    // Exponential backoff for retries: 1s, 2s, 4s, 8s...
    const delay = errorRetries > 0 ? 1000 * Math.pow(2, errorRetries - 1) : 1000;
    if (isMounted) timeoutId = setTimeout(poll, delay);
  };

  if ((indexer.running || indexer.hasher_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.combined_scanner_running || indexer.data_operation_running) && !indexer.paused) {
    wasRunningRef.current = true;
    timeoutId = setTimeout(poll, 1000);
  } else {
    // Perform one final fetch when scanners stop to ensure all UI counters are fully up to date
    if (wasRunningRef.current) {
      wasRunningRef.current = false;
      loadDashboard();
      if (page === 'people') peopleState.loadPeople();
      tagsState.loadTags();
      setTimelineUpdateTick(prev => prev + 1);
    }
  }
  return () => { isMounted = false; clearTimeout(timeoutId); };
}, [indexer.running, indexer.hasher_running, indexer.face_scanner_running, indexer.object_scanner_running, indexer.document_scanner_running, indexer.combined_scanner_running, indexer.data_operation_running, indexer.paused, page]);

function getOfflinePlaceholder(text, bgColor, textColor) {
  const key = `${text}-${bgColor}-${textColor}`;
  if (placeholderCache.has(key)) return placeholderCache.get(key);
  const safeText = String(text).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bgColor}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="24">${safeText}</text></svg>`;
  const result = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  placeholderCache.set(key, result);
  return result;
}

function renderThumb(item){
 const currentTheme = settings?.theme || 'dark';
 if(item.thumbnail){
   let url = item.thumbnail.startsWith('http') ? item.thumbnail : `${API}${item.thumbnail}`
   url += (url.includes('?') ? '&' : '?') + `theme=${currentTheme}`
   return url
 }

 const label = item.filename ? (String(item.filename).length > 28 ? String(item.filename).slice(0, 25) + '...' : String(item.filename)) : 'Unknown';

 if(item.category==='photo'){
   return getOfflinePlaceholder('PHOTO', currentTheme === 'light' ? '#f1f5f9' : '#1e293b', currentTheme === 'light' ? '#64748b' : '#94a3b8');
 }

 if(item.category==='video'){
   return getOfflinePlaceholder(label, currentTheme === 'light' ? '#e2e8f0' : '#111827', currentTheme === 'light' ? '#334155' : '#ffffff');
 }

 if(item.category==='document'){
   return getOfflinePlaceholder(label, currentTheme === 'light' ? '#f8fafc' : '#172033', currentTheme === 'light' ? '#0f172a' : '#ffffff');
 }

 return getOfflinePlaceholder(label, currentTheme === 'light' ? '#f1f5f9' : '#1e293b', currentTheme === 'light' ? '#0f172a' : '#cbd5e1');
}

function renderMetadata(meta){
 if(!meta || Object.keys(meta).length===0){
   return <p>No detailed metadata available.</p>
 }
 return (
   <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px', lineHeight:'1.5', color:'#cbd5e1'}}>
     <tbody>
       {Object.entries(meta).map(([key,value])=>{
         if(value === null || value === undefined) return null
         return (
           <tr key={key}>
             <td style={{border:'1px solid #374151', padding:'6px', fontWeight:'bold', background:'#1e293b'}}>{key}</td>
             <td style={{border:'1px solid #374151', padding:'6px', background:'#0f172a'}}>{renderValue(value)}</td>
           </tr>
         )
       })}
     </tbody>
   </table>
 )
}

function renderValue(value){
 if(typeof value === 'object' && value !== null){
   if(Array.isArray(value)){
     return value.map((v,i) => <div key={i}>{renderValue(v)}</div>)
   } else {
     return (
       <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
         <tbody>
           {Object.entries(value).map(([k,v]) => (
             <tr key={k}>
               <td style={{border:'1px solid #374151', padding:'4px', fontWeight:'bold', background:'#1e293b'}}>{k}</td>
               <td style={{border:'1px solid #374151', padding:'4px', background:'#0f172a'}}>{renderValue(v)}</td>
             </tr>
           ))}
         </tbody>
       </table>
     )
   }
 }
 return String(value)
}

  const appState = {
    page, setPage, query, setQuery, settings, setSettings, stats, setStats, indexer, setIndexer,
    showSidebar, setShowSidebar, showTimeline, setShowTimeline, showDetails, setShowDetails,
    sidebarWidth, setSidebarWidth, timelineWidth, setTimelineWidth, detailsWidth, setDetailsWidth,
    isResizing, setIsResizing,
    showSearchHelp, setShowSearchHelp, toastMessage, setToastMessage, showToast, setShowToast,
    suggestionsData, setSuggestionsData, focusedSuggestionIndex, setFocusedSuggestionIndex,
    combinedOptions, setCombinedOptions, settingsTab, setSettingsTab, testingAI, setTestingAI, aiSearchPrompt, setAiSearchPrompt,
    generatingSearch, setGeneratingSearch, actionInProgress, setActionInProgress, dataOpProgress, setDataOpProgress,
    dbFilename, setDbFilename, saveSettings, choosePath, choosePathForConfig, testAIConnection, generateSearchWithAI, clearCache, loadDashboard,
    updateUIPreferences, togglePinPerson,
    fullTimelineData, setFullTimelineData, timelineUpdateTick, setTimelineUpdateTick, applySuggestion, getOfflinePlaceholder, renderThumb, renderMetadata, renderValue,
    showToastMessage, toggleSidebar, toggleTimeline, toggleDetails,
    
    ...explorer,
    ...tagsState,
    ...peopleState,
    ...scannerState,
    ...systemOpsState,
    timelineItems
  };

  return {
    appState,
    isShutdown, isShuttingDown, handleShutdown, handleForceShutdown,
    toggleSidebar, toggleTimeline, toggleDetails, isResizing, setIsResizing,
    searchContainerRef, handleSearchChange, handleKeyDown, toastTimeoutRef,
    toastAction, getPersonThumbUrl: peopleState.getPersonThumbUrl,
    explorer, tagsState, peopleState, scannerState, systemOpsState
  };
}

export default function App() {
  const {
    appState,
    isShutdown, isShuttingDown, handleShutdown, handleForceShutdown,
    toggleSidebar, toggleTimeline, toggleDetails, isResizing, setIsResizing,
    searchContainerRef, handleSearchChange, handleKeyDown, toastTimeoutRef,
    toastAction, getPersonThumbUrl,
    explorer, tagsState, peopleState, scannerState, systemOpsState
  } = useAppState();

  const {
    page, setPage, query, setQuery, settings, setSettings, stats, setStats, indexer, setIndexer,
    showSidebar, setShowSidebar, showTimeline, setShowTimeline, showDetails, setShowDetails,
    sidebarWidth, setSidebarWidth, timelineWidth, setTimelineWidth, detailsWidth, setDetailsWidth,
    showSearchHelp, setShowSearchHelp, toastMessage, setToastMessage, showToast, setShowToast,
    suggestionsData, setSuggestionsData, focusedSuggestionIndex, setFocusedSuggestionIndex,
    combinedOptions, setCombinedOptions, settingsTab, setSettingsTab, testingAI, setTestingAI, aiSearchPrompt, setAiSearchPrompt,
    generatingSearch, setGeneratingSearch, isFindingSimilar, setIsFindingSimilar, actionInProgress, setActionInProgress, dataOpProgress, setDataOpProgress,
    dbFilename, setDbFilename, saveSettings, choosePath, choosePathForConfig, testAIConnection, generateSearchWithAI, clearCache, loadDashboard,
    updateUIPreferences, togglePinPerson,
    fullTimelineData, setFullTimelineData, timelineUpdateTick, setTimelineUpdateTick, applySuggestion, getOfflinePlaceholder, renderThumb, renderMetadata, renderValue,
    timelineItems, mergeConflictData
  } = appState;

  const isTaskRunning = indexer.running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.combined_scanner_running || indexer.data_operation_running || actionInProgress || dataOpProgress;
  let taskText = "Tasks Running...";
  let ledColor = "#10b981"; // Emerald
  if (indexer.running || indexer.combined_scanner_running) { taskText = "Indexing Files..."; ledColor = "#3b82f6"; } // Blue
  else if (indexer.face_scanner_running) { taskText = "Scanning Faces..."; ledColor = "#8b5cf6"; } // Purple
  else if (indexer.object_scanner_running) { taskText = "Scanning Objects..."; ledColor = "#f59e0b"; } // Amber
  else if (indexer.document_scanner_running) { taskText = "Extracting Text..."; ledColor = "#06b6d4"; } // Cyan
  else if (indexer.hasher_running) { taskText = "Finding Duplicates..."; ledColor = "#ec4899"; } // Pink
  else if (dataOpProgress) {
    if (dataOpProgress.id?.includes('cluster')) { taskText = "Clustering Faces..."; ledColor = "#10b981"; }
    else if (dataOpProgress.id?.includes('reclassify')) { taskText = "Reclassifying Faces..."; ledColor = "#f59e0b"; }
    else if (dataOpProgress.id === 'purge') { taskText = "Purging Profiles..."; ledColor = "#ef4444"; } // Red
    else if (dataOpProgress.id?.includes('cleanup')) { taskText = "Cleaning Database..."; ledColor = "#06b6d4"; } // Cyan
    else { taskText = "Processing System Task..."; ledColor = "#3b82f6"; }
  } else if (isFindingSimilar) { taskText = "Searching Faces..."; ledColor = "#38bdf8"; } // Sky
  else if (actionInProgress) { taskText = "System Operation..."; ledColor = "#64748b"; } // Slate
  else if (indexer.data_operation_running) { taskText = "Remote Data Operation..."; ledColor = "#3b82f6"; } // Blue

  return(
<SettingsContext.Provider value={{ animationsEnabled: (settings.animations_enabled ?? settings.ui_preferences?.animations_enabled) !== false, theme: settings.theme || 'dark' }}>
<div className='layout' data-theme={settings.theme || 'dark'}>
<style>
  {`
    /* MASTER LIGHT THEME FILTER (100% Invert perfectly mirrors Dark colors to clean Light colors) */
    [data-theme="light"] {
      filter: invert(1) hue-rotate(180deg);
      background-color: #000000; /* Base inverts to pure white #ffffff */
      min-height: 100vh;
    }
    
    /* CORE LAYOUT BACKGROUNDS */
    [data-theme="light"] .workspace {
      background-color: #04060a !important; /* Inverts to soft cool white #f9fbfb */
    }
    [data-theme="light"] .sidebar, 
    [data-theme="light"] .details {
      background-color: #000000 !important; /* Inverts to #ffffff */
      border-color: #111827 !important; /* Inverts to light gray border */
    }

    /* CARDS & LIST ITEMS */
    [data-theme="light"] .card, 
    [data-theme="light"] .list-item, 
    [data-theme="light"] .timeline-item {
      background-color: #000000; /* Let inline blue processing backgrounds win naturally */
      border-color: #111827 !important;
    }
    [data-theme="light"] .card:hover, 
    [data-theme="light"] .list-item:hover, 
    [data-theme="light"] .timeline-item:hover {
      background-color: #060910; /* Soft gray hover */
    }

    /* INPUTS & TEXT AREAS */
    [data-theme="light"] input[type="text"],
    [data-theme="light"] input[type="password"],
    [data-theme="light"] input[type="number"],
    [data-theme="light"] .search,
    [data-theme="light"] .setting {
      background-color: #000000 !important;
      border: 1px solid #1a202c !important; /* Crisp border */
      color: #d1d5db !important; /* Dark text */
    }
    [data-theme="light"] input::placeholder {
      color: #4b5563 !important; /* Light placeholder */
    }

    /* BUTTONS */
    [data-theme="light"] .btn-secondary:not(.preserve-colors) {
      background-color: #000000; /* White button */
      border: 1px solid #111827;
      color: #d1d5db; /* Dark text */
    }
    [data-theme="light"] .btn-secondary:not(.preserve-colors):hover {
      background-color: #0a0d14; /* Light gray hover */
    }

    /* MEDIA PRESERVATION */
    [data-theme="light"] img,
    [data-theme="light"] video,
    [data-theme="light"] canvas {
      filter: invert(1) hue-rotate(180deg) contrast(1.05) brightness(1.02);
    }

    /* SHADOWS & FLOATING PANELS */
    [data-theme="light"] * {
      box-shadow: none !important;
    }
    [data-theme="light"] .floating-panel {
      background-color: #000000 !important;
      border: 1px solid #111827 !important;
      box-shadow: 0 10px 25px -5px rgba(255, 255, 255, 0.15) !important; /* Inverts to dark shadow */
    }

    /* NATIVE CONTROLS */
    [data-theme="light"] input[type="radio"],
    [data-theme="light"] input[type="checkbox"],
    [data-theme="light"] input[type="range"] {
      filter: invert(1) hue-rotate(180deg);
      accent-color: #3b82f6;
    }
    [data-theme="light"] select {
      filter: invert(1) hue-rotate(180deg);
      color-scheme: light;
      background-color: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
    }
    [data-theme="light"] select option {
      background-color: #ffffff !important;
      color: #0f172a !important;
    }

    /* ICONS & COLORFUL BUTTONS */
    [data-theme="light"] svg {
      filter: invert(1) hue-rotate(180deg);
    }
    [data-theme="light"] .preserve-colors {
      filter: invert(1) hue-rotate(180deg);
      box-shadow: 0 4px 6px -1px rgba(255,255,255,0.1) !important; /* Restores button depth */
    }
    [data-theme="light"] .preserve-colors svg {
      filter: none !important;
    }
    [data-theme="light"] button:not(.preserve-colors) svg:not([style*="color"]),
    [data-theme="light"] .overlay svg {
      filter: none;
    }

    /* SCROLLBARS */
    [data-theme="light"] ::-webkit-scrollbar {
      width: 14px;
      height: 14px;
    }
    [data-theme="light"] ::-webkit-scrollbar-track {
      background: #000000;
    }
    [data-theme="light"] ::-webkit-scrollbar-thumb {
      background: #111827;
      border-radius: 8px;
      border: 4px solid #000000;
    }
    [data-theme="light"] ::-webkit-scrollbar-thumb:hover {
      background: #1e293b;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes led-pulse {
      0% { opacity: 1; }
      50% { opacity: 0.35; }
      100% { opacity: 1; }
    }
  `}
</style>
{isShutdown ? (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    color: '#f8fafc',
    textAlign: 'center'
  }}>
    <PowerSettingsNewIcon style={{ fontSize: '80px', color: '#ef4444' }} />
    <h1 style={{ marginTop: '24px', fontSize: '32px' }}>Server has been shut down.</h1>
    <p style={{ color: '#94a3b8', fontSize: '18px', marginTop: '8px' }}>You can now safely close this browser tab.</p>
  </div>
) : isShuttingDown ? (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    color: '#f8fafc',
    textAlign: 'center'
  }}>
    <HourglassEmptyIcon style={{ fontSize: '80px', color: '#38bdf8', animation: 'spin 2s linear infinite' }} />
    <h1 style={{ marginTop: '24px', fontSize: '32px' }}>Shutting Down...</h1>
    <p style={{ color: '#94a3b8', fontSize: '18px', marginTop: '8px' }}>Saving database and stopping background tasks. Please wait.</p>
    <button 
      className="preserve-colors"
      onClick={handleForceShutdown}
      style={{
        marginTop: '32px',
        padding: '12px 24px',
        background: '#ef4444',
        color: '#ffffff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
      }}>
      Force Shutdown
    </button>
  </div>
) : (
<>
<Sidebar 
  showSidebar={showSidebar}
  sidebarWidth={sidebarWidth}
  isResizing={isResizing}
  setIsResizing={setIsResizing}
  setPage={setPage}
  explorer={explorer}
  peopleState={peopleState}
  tagsState={tagsState}
  loadDashboard={loadDashboard}
  handleShutdown={handleShutdown}
  query={query}
  setQuery={setQuery}
/>

<div className='workspace' style={{ minWidth: 0 }}>

<Topbar 
  toggleSidebar={toggleSidebar}
  showSidebar={showSidebar}
  searchContainerRef={searchContainerRef}
  query={query}
  handleSearchChange={handleSearchChange}
  handleKeyDown={handleKeyDown}
  suggestionsData={suggestionsData}
  focusedSuggestionIndex={focusedSuggestionIndex}
  setFocusedSuggestionIndex={setFocusedSuggestionIndex}
  applySuggestion={applySuggestion}
  explorer={explorer}
  showSearchHelp={showSearchHelp}
  setShowSearchHelp={setShowSearchHelp}
  toggleTimeline={toggleTimeline}
  showTimeline={showTimeline}
  toggleDetails={toggleDetails}
  showDetails={showDetails}
  page={page}
/>

{page === 'dashboard' && <Dashboard {...appState} />}

{(page === 'explorer' || page === 'search') && <Explorer {...appState} />}

{page === 'person_files' && <Person {...appState} />}

{page === 'people' && <People {...appState} />}

{page === 'settings' && <Settings {...appState} />}

{page === 'tags' && <Tags {...appState} />}

{page === 'about' && <About page={page} />}

</div>

</>
)}
{showToast && (
  <div className="floating-panel" style={{
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: '#10b981',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'opacity 0.3s ease-in-out'
  }}>
    <span>{toastMessage}</span>
    {toastAction && (
      <button 
        onClick={() => {
          toastAction.onClick();
          setShowToast(false);
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          color: '#ffffff',
          border: 'none',
          padding: '4px 10px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '13px',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
        onMouseLeave={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
        {toastAction.label}
      </button>
    )}
  </div>
)}
{mergeConflictData && (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, backdropFilter: 'blur(4px)'
  }}>
    <div className="floating-panel" style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: '16px',
      padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
    }}>
      <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#f8fafc', fontSize: '20px' }}>Resolve Name Conflict</h2>
      <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
        You are merging profiles with different names. Please select which name you would like to keep as the primary profile:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
        {mergeConflictData.validNames.map(name => {
          const profile = mergeConflictData.profiles.find(p => p.name === name);
          return (
            <ActionButton
              key={name}
              className="btn btn-secondary preserve-colors"
              onClick={() => peopleState.executeMerge(profile.id)}
              style={{
                background: '#0f172a', borderColor: '#3b82f6', color: '#38bdf8',
                padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonThumb url={peopleState.getPersonThumbUrl(profile)} size={20} />
                </div>
                <span style={{ fontWeight: 'bold' }}>{name}</span>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>{profile.face_count} photo(s)</span>
            </ActionButton>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
        <ActionButton className="btn btn-secondary" onClick={() => peopleState.setMergeConflictData(null)}>Cancel</ActionButton>
      </div>
    </div>
  </div>
)}
{isTaskRunning && !isShutdown && !isShuttingDown && (
  <div className="floating-panel preserve-colors" style={{
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '24px',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    zIndex: 9998,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    pointerEvents: 'none'
  }}>
    <div style={{
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: ledColor,
      boxShadow: `0 0 8px ${ledColor}`,
      animation: 'led-pulse 1.5s infinite'
    }} />
    <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 'bold' }}>{taskText}</span>
  </div>
)}
</div>
</SettingsContext.Provider>
)
}