import {useEffect,useState,useMemo,useRef,createContext,useContext,Fragment} from 'react'
import axios from 'axios'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderIcon from '@mui/icons-material/Folder'
import SearchIcon from '@mui/icons-material/Search'
import SettingsIcon from '@mui/icons-material/Settings'
import InfoIcon from '@mui/icons-material/Info'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import ViewTimelineIcon from '@mui/icons-material/ViewTimeline'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import ImageIcon from '@mui/icons-material/Image'
import MovieIcon from '@mui/icons-material/Movie'
import AudiotrackIcon from '@mui/icons-material/Audiotrack'
import DescriptionIcon from '@mui/icons-material/Description'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import CodeIcon from '@mui/icons-material/Code'
import FontDownloadIcon from '@mui/icons-material/FontDownload'
import StorageIcon from '@mui/icons-material/Storage'
import ArchiveIcon from '@mui/icons-material/Archive'
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate'
import MemoryIcon from '@mui/icons-material/Memory'
import CategoryIcon from '@mui/icons-material/Category'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import SettingsApplicationsIcon from '@mui/icons-material/SettingsApplications'
import GitHubIcon from '@mui/icons-material/GitHub'
import GavelIcon from '@mui/icons-material/Gavel'
import CloseIcon from '@mui/icons-material/Close'
import HelpIcon from '@mui/icons-material/Help'
import PlaceIcon from '@mui/icons-material/Place'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import FileCopyIcon from '@mui/icons-material/FileCopy'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import FaceIcon from '@mui/icons-material/Face'

// Use relative path in production to support network IPs, fallback to localhost for Vite dev server
const API = window.location.port === '5173' ? 'http://127.0.0.1:8000' : ''

const SettingsContext = createContext({ animationsEnabled: true });

function StatCard({ title, value, icon, color, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);
  return (
    <div onClick={onClick} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => { setIsHovered(false); setIsActive(false); }} onMouseDown={() => setIsActive(true)} onMouseUp={() => setIsActive(false)} style={{background: isHovered && onClick ? '#1e293b' : '#111827',padding:'16px',borderRadius:'16px',border:'1px solid #24324a', display:'flex', alignItems:'center', gap:'16px', cursor: onClick ? 'pointer' : 'default', transition: animationsEnabled ? 'all 0.2s ease' : 'none', transform: animationsEnabled && isActive && onClick ? 'scale(0.97)' : animationsEnabled && isHovered && onClick ? 'translateY(-2px)' : 'none', boxShadow: animationsEnabled && isActive && onClick ? '0 5px 10px -3px rgba(0,0,0,0.2)' : animationsEnabled && isHovered && onClick ? '0 10px 15px -3px rgba(0,0,0,0.3)' : 'none'}}>
      <div style={{background:`${color}1a`, padding:'12px', borderRadius:'12px', display:'flex', color:color}}>
        {icon}
      </div>
      <div>
        <h3 style={{margin:0, color:'#94a3b8', fontSize:'14px', fontWeight:'500'}}>{title}</h3>
        <p style={{fontSize:'24px',margin:'4px 0 0 0', fontWeight:'bold', color:'#f8fafc'}}>{value}</p>
      </div>
    </div>
  )
}

function ActionButton({ disabled, onClick, children, className = "btn btn-secondary", style = {} }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);
  return (
    <button 
      className={className} 
      disabled={disabled} 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        ...style,
        transition: animationsEnabled ? 'all 0.2s ease' : 'none', 
        transform: animationsEnabled && isActive && !disabled ? 'scale(0.95)' : animationsEnabled && isHovered && !disabled ? 'translateY(-2px)' : 'none', 
        boxShadow: animationsEnabled && isActive && !disabled ? '0 5px 10px -3px rgba(0,0,0,0.2)' : animationsEnabled && isHovered && !disabled ? '0 10px 15px -3px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      {children}
    </button>
  );
}

function AppIcon({ size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" rx="28" fill="url(#grad)" />
      {/* Stacked Disks / Database */}
      <ellipse cx="60" cy="46" rx="32" ry="12" fill="white" />
      <path d="M28 46V62C28 68.6274 42.3269 74 60 74C77.6731 74 92 68.6274 92 62V46" fill="white" fillOpacity="0.8" />
      <path d="M28 62V78C28 84.6274 42.3269 90 60 90C77.6731 90 92 84.6274 92 78V62" fill="white" fillOpacity="0.5" />
      {/* Magnifying Glass */}
      <circle cx="76" cy="76" r="16" stroke="white" strokeWidth="6" />
      <path d="M88 88L102 102" stroke="white" strokeWidth="8" strokeLinecap="round" />
      {/* Star / Sparkle for WiZarD */}
      <path d="M40 26L42 36L52 38L42 40L40 50L38 40L28 38L38 36L40 26Z" fill="#fcd34d" />
      <path d="M78 30L79 35L84 36L79 37L78 42L77 37L72 36L77 35L78 30Z" fill="#fcd34d" />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ProgressBar({ current = 0, total = 0, color = '#3b82f6' }) {
  const safeTotal = total || 0;
  const percentage = safeTotal > 0 ? Math.min(100, Math.max(0, (current / safeTotal) * 100)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', marginBottom: '4px' }}>
      <div style={{ width: '100%', background: '#1e293b', borderRadius: '4px', overflow: 'hidden', height: '6px' }}>
        <div style={{ width: safeTotal > 0 ? `${percentage}%` : '100%', background: safeTotal > 0 ? color : `${color}40`, height: '100%', transition: 'width 0.3s ease' }}></div>
      </div>
      <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right' }}>
        {safeTotal > 0 ? `${current} / ${safeTotal} (${Math.round(percentage)}%)` : 'Calculating...'}
      </span>
    </div>
  );
}

function formatSize(size) {
  if (!size || size === '0') return '0 B';
  const str = String(size);
  if (/[a-zA-Z]/.test(str)) return str; // Already has a unit
  const bytes = parseFloat(str.replace(/,/g, ''));
  if (isNaN(bytes) || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function FileCard({ item, viewMode, isChecked, onToggleCheck, onClick, onContextMenu, onSelectAndOpen, renderThumb, isAltGroup, showVerified, showUnverified, isReadOnly, isProcessing }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      className={viewMode === 'grid' ? 'card' : 'list-item'}
      data-path={item.path}
      onClick={(e) => onClick(e, item)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.path); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        transition: animationsEnabled ? 'all 0.3s ease' : 'none',
        opacity: animationsEnabled ? (isMounted ? 1 : 0) : 1,
        transform: animationsEnabled ? (isActive ? 'scale(0.97)' : isHovered ? 'translateY(-2px)' : isMounted ? 'none' : 'translateY(10px)') : 'none',
        boxShadow: isProcessing ? '0 0 0 2px #3b82f6, 0 0 15px rgba(59, 130, 246, 0.4)' : animationsEnabled && isActive ? '0 5px 10px -3px rgba(0,0,0,0.2)' : animationsEnabled && isHovered ? '0 10px 15px -3px rgba(0,0,0,0.3)' : 'none',
        backgroundColor: isProcessing ? '#1e3a8a' : isAltGroup ? '#1e293b' : undefined,
        border: isProcessing ? '1px solid #3b82f6' : undefined
      }}
    >
      {viewMode === 'grid' ? (
        <>
          <input type="checkbox" className="select-cb" checked={isChecked} onChange={(e) => onToggleCheck(e, item.path)} onClick={(e) => e.stopPropagation()} />
          <img
            src={renderThumb(item)}
            className='thumb'
            loading='lazy'
            onClick={(e) => { e.stopPropagation(); onSelectAndOpen(item); }}
            onError={(e) => { e.target.src = renderThumb({ ...item, thumbnail: null }) }}
          />
          {item.category === 'video' && (
            <div className='overlay'>
              <PlayCircleIcon style={{ fontSize: 'inherit' }} />
            </div>
          )}
          <div className='info' style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }} title={item.filename}>
              {isProcessing && <HourglassEmptyIcon style={{ color: '#38bdf8', fontSize: '16px', flexShrink: 0 }} title="Processing..." />}
              {showVerified && !isProcessing && <CheckCircleIcon style={{ color: '#10b981', fontSize: '16px', flexShrink: 0 }} title="Verified Duplicate (SHA-256 Match)" />}
              {showUnverified && !isProcessing && <HourglassEmptyIcon style={{ color: '#f59e0b', fontSize: '16px', flexShrink: 0 }} title="Unverified Duplicate (Pending Hash)" />}
              <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.filename}</span>
              {isReadOnly && <span style={{ fontSize: '10px', background: '#334155', color: '#94a3b8', padding: '2px 4px', borderRadius: '4px', flexShrink: 0, fontWeight: 'bold' }} title="Read-Only Location">RO</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
              <span>{item.category}</span>
            <span>{formatSize(item.size)}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <input type="checkbox" className="select-cb list-cb" checked={isChecked} onChange={(e) => onToggleCheck(e, item.path)} onClick={(e) => e.stopPropagation()} />
          <img
            src={renderThumb(item)}
            className='list-thumb'
            loading='lazy'
            onClick={(e) => { e.stopPropagation(); onSelectAndOpen(item); }}
            onError={(e) => { e.target.src = renderThumb({ ...item, thumbnail: null }) }}
          />
          <div className="list-info">
            <p className="list-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isProcessing && <HourglassEmptyIcon style={{ color: '#38bdf8', fontSize: '18px', flexShrink: 0 }} title="Processing..." />}
              {showVerified && !isProcessing && <CheckCircleIcon style={{ color: '#10b981', fontSize: '18px', flexShrink: 0 }} title="Verified Duplicate (SHA-256 Match)" />}
              {showUnverified && !isProcessing && <HourglassEmptyIcon style={{ color: '#f59e0b', fontSize: '18px', flexShrink: 0 }} title="Unverified Duplicate (Pending Hash)" />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.filename}</span>
              {isReadOnly && <span style={{ fontSize: '10px', background: '#334155', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, fontWeight: 'bold' }} title="Read-Only Location">Read-Only</span>}
            </p>
            <p className="list-meta">
              <span>{item.category}</span>
            <span>{formatSize(item.size)}</span>
              <span>{item.modified}</span>
            </p>
          </div>
          {item.category === 'video' && (
            <PlayCircleIcon style={{ color: '#94a3b8', marginRight: '12px' }} />
          )}
        </>
      )}
    </div>
  );
}

function TimelineItem({ dateKey, isActiveDate, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div
      className={`timeline-item ${isActiveDate ? 'active' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        transition: animationsEnabled ? 'all 0.3s ease' : 'none',
        opacity: animationsEnabled ? (isMounted ? 1 : 0) : 1,
        transform: animationsEnabled ? (isActive ? 'scale(0.95)' : isHovered ? 'translateY(-2px)' : isMounted ? 'none' : 'translateY(10px)') : 'none',
        boxShadow: animationsEnabled && isActive ? '0 5px 10px -3px rgba(0,0,0,0.2)' : animationsEnabled && isHovered ? '0 10px 15px -3px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      {dateKey}
    </div>
  );
}

export default function App(){

const [page,setPage]=useState('dashboard')
const [files,setFiles]=useState([])
const [selected,setSelected]=useState(null)
const [query,setQuery]=useState('')
const [settings,setSettings]=useState({})
const [searchCache,setSearchCache]=useState([])
const [offset,setOffset]=useState(0)
const [hasMore,setHasMore]=useState(true)
const [loadingMore,setLoadingMore]=useState(false)
const [stats,setStats]=useState({total:0,photos:0,videos:0,audio:0,documents:0,ebooks:0,code:0,fonts:0,databases:0,compressed:0,installers:0,binaries:0,others:0,duplicates:0})
const [indexer,setIndexer]=useState({running:false,paused:false,stopped:false,current:0,total:0,current_file:'',status:'Idle',indexed:0,face_scanner_running:false,object_scanner_running:false,hasher_running:false,hasher_current:0,hasher_total:0,face_scanner_current:0,face_scanner_total:0,object_scanner_current:0,object_scanner_total:0})
const [sortBy,setSortBy]=useState('date')
const [sortOrder,setSortOrder]=useState('desc')
const [filterCategory, setFilterCategory] = useState('all')
const [viewMode, setViewMode] = useState('grid')
const [checkedFiles, setCheckedFiles] = useState(new Set())
const globalFileCache = useRef(new Map())
const [showSelectedOnly, setShowSelectedOnly] = useState(false)
const lastCheckedPath = useRef(null)
const [activeDate, setActiveDate] = useState('')
const searchTimeout = useRef(null)
const [showSidebar, setShowSidebar] = useState(true)
const [showTimeline, setShowTimeline] = useState(true)
const [showDetails, setShowDetails] = useState(true)
const [sidebarWidth, setSidebarWidth] = useState(240)
const [timelineWidth, setTimelineWidth] = useState(150)
const [detailsWidth, setDetailsWidth] = useState(260)
const [isResizing, setIsResizing] = useState(null)
const [showSearchHelp, setShowSearchHelp] = useState(false)
const [isShutdown, setIsShutdown] = useState(false)
const [toastMessage, setToastMessage] = useState('');
const [showToast, setShowToast] = useState(false);
const [suggestionsData, setSuggestionsData] = useState({ type: 'none', suggestions: [], lastWord: '' });
const suggestionTimeout = useRef(null);
const searchContainerRef = useRef(null);
const suggestionAbortController = useRef(null);
const searchAbortController = useRef(null);
const loadFilesAbortController = useRef(null);
const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
const [people, setPeople] = useState([]);
const [currentPerson, setCurrentPerson] = useState(null);
const [personFiles, setPersonFiles] = useState([]);
const [peopleSortBy, setPeopleSortBy] = useState('name');
const [objectTags, setObjectTags] = useState([]);
const [checkedPeople, setCheckedPeople] = useState(new Set());
const [isTaggingPerson, setIsTaggingPerson] = useState(false);
const [isTaggingObject, setIsTaggingObject] = useState(false);
const [tagInput, setTagInput] = useState('');
const [editingNames, setEditingNames] = useState({});
const [dbFilename, setDbFilename] = useState('archive.db');
const [thumbUpdateTimestamps, setThumbUpdateTimestamps] = useState({});
const [actionInProgress, setActionInProgress] = useState(false);
const [combinedOptions, setCombinedOptions] = useState(() => {
  try {
    const saved = localStorage.getItem('wabs_combined_options');
    return saved ? JSON.parse(saved) : { tag: false, face: false };
  } catch (e) {
    return { tag: false, face: false };
  }
});
const [tagsPage, setTagsPage] = useState(1);
const [tagSearchQuery, setTagSearchQuery] = useState('');
const [unknownPeoplePage, setUnknownPeoplePage] = useState(1);
const [namedPeoplePage, setNamedPeoplePage] = useState(1);
const [namedPersonSearchQuery, setNamedPersonSearchQuery] = useState('');
const [similarUnknowns, setSimilarUnknowns] = useState(null);
const [isFindingSimilar, setIsFindingSimilar] = useState(false);
const [checkedSimilar, setCheckedSimilar] = useState(new Set());
const [similarityThreshold, setSimilarityThreshold] = useState(0.60);
const [settingsTab, setSettingsTab] = useState('general');
const findSimilarAbortController = useRef(null);
const [fullTimelineData, setFullTimelineData] = useState([]);

useEffect(() => {
  localStorage.setItem('wabs_combined_options', JSON.stringify(combinedOptions));
}, [combinedOptions]);

useEffect(() => {
  if (Array.isArray(files)) files.forEach(f => globalFileCache.current.set(f.path, f));
}, [files]);

useEffect(() => {
  if (Array.isArray(personFiles)) personFiles.forEach(f => globalFileCache.current.set(f.path, f));
}, [personFiles]);

useEffect(() => {
  if (Array.isArray(searchCache)) searchCache.forEach(f => globalFileCache.current.set(f.path, f));
}, [searchCache]);

useEffect(() => {
  if (checkedFiles.size === 0 && showSelectedOnly) {
    setShowSelectedOnly(false);
  }
}, [checkedFiles.size, showSelectedOnly]);

const checkFileReadOnly = (filePath) => {
  if (settings.read_only_mode !== false) return true;
  if (!settings.backup_configs) return false;
  
  const normFile = String(filePath).replace(/\\/g, '/').toLowerCase();
  const config = settings.backup_configs.find(c => {
    return c.backup_path && normFile.startsWith(String(c.backup_path).replace(/\\/g, '/').toLowerCase());
  });
  return config ? config.read_only_mode !== false : false;
};

const isSelectionReadOnly = useMemo(() => {
  return Array.from(checkedFiles).some(checkFileReadOnly);
}, [checkedFiles, settings]);

async function loadFiles(nextOffset = 0, append = false, cat = filterCategory){
  if (loadFilesAbortController.current) {
    loadFilesAbortController.current.abort();
  }
  loadFilesAbortController.current = new AbortController();
  try {
    const r = await axios.get(`${API}/files?category=${cat}&offset=${nextOffset}&limit=50`, {
      signal: loadFilesAbortController.current.signal
    })
    if(append){
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.path));
        const additions = r.data.filter(f => !existing.has(f.path));
        return [...prev, ...additions];
      });
    } else {
      setFiles(r.data)
    }
    setOffset(nextOffset + r.data.length)
    setHasMore(r.data.length === 50)
    if(!append){
      setSearchCache([])
    }
  } catch (err) {
    if (!axios.isCancel(err)) {
      console.warn('Load files failed', err);
    }
  }
}

const handleSearchChange = (e) => {
  const value = e.target.value;
  doSearch(value);
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
      const suggestions = (objectTags || [])
        .filter(t => t.toLowerCase().startsWith(cleanWord))
        .slice(0, 8);
      if (suggestions.length > 0) {
        setSuggestionsData({ type: 'tag', suggestions: suggestions.map(s => isAndPrefix ? '+' + s : isNotPrefix ? '-' + s : s), lastWord });
        return;
      }
    } else if (cleanWord.startsWith('person:')) {
      const searchName = cleanWord.replace('person:', '').replace(/_/g, ' ');
      const suggestions = (Array.isArray(people) ? people : [])
        .filter(p => p.name && !p.name.startsWith('Unknown Person') && p.name.toLowerCase().includes(searchName))
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
  doSearch(newQuery);
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

function doSearch(value, cat = filterCategory){
  setQuery(value)

  if(searchTimeout.current){
    clearTimeout(searchTimeout.current)
  }

  searchTimeout.current = setTimeout(async () => {
    if(!value){
      if (page !== 'search') {
        setPage('explorer')
      }
      setSelected(null)
      await loadFiles(0, false, cat)
      return
    }

    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    setLoadingMore(true)
    setSelected(null)
    const safeQuery = value.replace(/,/g, ' ');
    try {
      const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${cat}&offset=0&limit=50`, {
        signal: searchAbortController.current.signal
      })
      setSearchCache(r.data)
      setFiles(r.data)
      setOffset(r.data.length)
      setHasMore(r.data.length === 50)
      setPage('search')
      setLoadingMore(false)
    } catch (err) {
      if (!axios.isCancel(err)) {
        setLoadingMore(false)
        console.warn('Search failed', err);
      }
    }
  }, 600)
}

async function goToSearch(cat = filterCategory){
  setSelected(null)
  if(query){
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    setLoadingMore(true)
    const safeQuery = query.replace(/,/g, ' ');
    try {
      const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${cat}&offset=0&limit=50`, {
        signal: searchAbortController.current.signal
      })
      setSearchCache(r.data)
      setFiles(r.data)
      setOffset(r.data.length)
      setHasMore(r.data.length === 50)
      setLoadingMore(false)
    } catch (err) {
      if (!axios.isCancel(err)) {
        setLoadingMore(false)
        console.warn('Search failed', err);
      }
    }
  } else {
    await loadFiles(0, false, cat)
  }
  setPage('search')
}

async function loadMore(){
  if(loadingMore || !hasMore) return

  setLoadingMore(true)
  if(page === 'explorer'){
    await loadFiles(offset, true, filterCategory)
  } else if(page === 'search'){
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    const safeQuery = query.replace(/,/g, ' ');
    try {
      const r = await axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=${filterCategory}&offset=${offset}&limit=50`, {
        signal: searchAbortController.current.signal
      })
      setFiles(prev => {
        const existing = new Set(prev.map(f => f.path));
        const additions = r.data.filter(f => !existing.has(f.path));
        return [...prev, ...additions];
      });
      setSearchCache(prev => {
        const existing = new Set(prev.map(f => f.path));
        const additions = r.data.filter(f => !existing.has(f.path));
        return [...prev, ...additions];
      });
      setOffset(offset + r.data.length)
      setHasMore(r.data.length === 50)
    } catch (err) {
      if (!axios.isCancel(err)) {
        console.warn('Load more search failed', err);
      }
    }
    } else if(page === 'person_files' && currentPerson) {
      try {
        const r = await axios.get(`${API}/people/${currentPerson.id}/photos?offset=${offset}&limit=50`);
        setPersonFiles(prev => {
          const existing = new Set(prev.map(f => f.path));
          const additions = r.data.filter(f => !existing.has(f.path));
          return [...prev, ...additions];
        });
        setOffset(offset + r.data.length);
        setHasMore(r.data.length === 50);
      } catch (err) {
        console.warn('Load more person photos failed', err);
      }
  }
  setLoadingMore(false)
}

const syncActiveDate = (containerElement) => {
  if (!containerElement) return;
  const containerRect = containerElement.getBoundingClientRect();
  const headers = document.querySelectorAll('.date-header');
  let currentActive = null;
  
  for (let i = 0; i < headers.length; i++) {
    const rect = headers[i].getBoundingClientRect();
    if (rect.top - containerRect.top <= 120) {
      currentActive = headers[i].getAttribute('data-date');
    } else {
      break;
    }
  }
  
  if (!currentActive && headers.length > 0) {
    currentActive = headers[0].getAttribute('data-date');
  }
  
  if (currentActive) {
    setActiveDate(prev => prev !== currentActive ? currentActive : prev);
  }
};

function handleScroll(e){
  const {scrollTop, scrollHeight, clientHeight} = e.currentTarget
  if(scrollHeight - scrollTop - clientHeight < 120){
    loadMore()
  }
  syncActiveDate(e.currentTarget);
}

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
 if (data.run_face_scan !== undefined || data.run_object_scan !== undefined) {
   setCombinedOptions(prev => ({
     face: data.run_face_scan ?? prev.face,
     tag: data.run_object_scan ?? prev.tag
   }));
 }
}

const showToastMessage = (message) => {
  setToastMessage(message);
  setShowToast(true);
  setTimeout(() => {
    setShowToast(false);
    setToastMessage('');
  }, 3000); // Hide after 3 seconds
};

async function saveSettings(){
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
   await loadFiles(0, false, filterCategory);
 } else if (page === 'search') {
   await goToSearch(filterCategory);
 }
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

async function clearCache() {
  if (!window.confirm('Are you sure you want to clear the thumbnail cache? The cached images will be permanently deleted and automatically regenerated as needed.')) return;
  try {
    await axios.post(`${API}/clear-cache`);
    showToastMessage('Thumbnail cache cleared successfully.');
  } catch(err) {
    alert('Error clearing cache: ' + (err?.response?.data?.detail || err.message));
  }
}

async function loadDashboard(){
 const timestamp = Date.now();
 const [statsRes, indexerRes] = await Promise.all([
   axios.get(`${API}/stats?t=${timestamp}`),
   axios.get(`${API}/indexer/status?t=${timestamp}`)
 ])
 setStats(prev => ({...prev, ...statsRes.data}))
 setIndexer(indexerRes.data)
}

async function loadTags() {
  try {
    const tagsRes = await axios.get(`${API}/tags/objects?t=${Date.now()}`);
    if (tagsRes && tagsRes.data) {
      setObjectTags(tagsRes.data);
    }
  } catch (err) {
    console.warn('Failed to load tags', err);
  }
}

async function loadPeople() {
  try {
    const minPhotos = settings.min_unknown_photos !== undefined ? settings.min_unknown_photos : 1;
    const r = await axios.get(`${API}/people?min_unknown_photos=${minPhotos}&t=${Date.now()}`);
    if (Array.isArray(r.data)) {
      setPeople(r.data);
    } else {
      console.warn('API returned non-array:', r.data);
      setPeople(null);
    }
  } catch (err) {
    console.warn('Failed to load people', err);
    setPeople(null);
  }
}

async function openPersonPhotos(person) {
  try {
    const r = await axios.get(`${API}/people/${person.id}/photos?offset=0&limit=50`);
    setPersonFiles(r.data);
    setCurrentPerson(person);
    setOffset(r.data.length);
    setHasMore(r.data.length === 50);
    setPage('person_files');
  } catch (err) {
    console.warn('Failed to load person photos', err);
  }
}

async function findSimilarUnknowns(personId, threshold = similarityThreshold) {
  if (findSimilarAbortController.current) {
    findSimilarAbortController.current.abort();
  }
  const abortCtrl = new AbortController();
  findSimilarAbortController.current = abortCtrl;
  setIsFindingSimilar(true);
  try {
    const r = await axios.get(`${API}/people/${personId}/similar-unknowns?threshold=${threshold}`, {
      signal: abortCtrl.signal
    });
    setSimilarUnknowns(r.data);
    setCheckedSimilar(new Set());
    setIsFindingSimilar(false);
  } catch(err) {
    if (!axios.isCancel(err)) {
      alert('Error finding similar unknowns: ' + (err?.response?.data?.detail || err.message));
      setSimilarUnknowns(null);
      setIsFindingSimilar(false);
    }
  }
}

function stopFindSimilarUnknowns() {
  if (findSimilarAbortController.current) {
    findSimilarAbortController.current.abort();
  }
  setIsFindingSimilar(false);
}

const updatePersonNameLocal = (id, newName) => setPeople(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
const savePersonName = async (id, newName) => { try { await axios.post(`${API}/people/${id}/rename`, { name: newName }); loadPeople(); } catch (err) { console.warn(err); } };
const deletePerson = async (e, id, name) => { 
  e.stopPropagation(); 
  if (indexer.face_scanner_running) {
    alert("Please stop the Face Scanner before modifying profiles to prevent database conflicts.");
    return;
  }
  if (name && !name.startsWith('Unknown Person')) {
    if (window.confirm(`Remove name "${name}"? This will move them back to the Unknown People list.`)) { 
      try { 
        await axios.post(`${API}/people/${id}/rename`, { name: `Unknown Person #${id}` }); 
        loadPeople(); 
      } catch(err) { console.warn(err); } 
    }
  } else {
    if (window.confirm(`Delete "${name}" and ignore their faces?`)) { 
      try { 
        await axios.delete(`${API}/people/${id}`); 
        loadPeople(); 
      } catch(err) { console.warn(err); } 
    } 
  }
};

async function mergeSelectedPeople() {
  if (indexer.face_scanner_running) {
    alert("Please stop the Face Scanner before merging profiles to prevent database conflicts.");
    return;
  }
  if (!window.confirm(`Are you sure you want to merge these ${checkedPeople.size} people into one?`)) return;
  const ids = Array.from(checkedPeople);
  try {
    await axios.post(`${API}/people/merge`, { person_ids: ids });
    showToastMessage('People merged successfully.');
    setCheckedPeople(new Set());
    loadPeople();
  } catch (err) {
    alert('Error merging people: ' + (err?.response?.data?.detail || err.message));
  }
}

async function setPersonThumbnail(personId, fileId) {
  try {
    await axios.post(`${API}/people/${personId}/set-thumbnail`, { file_id: fileId });
    showToastMessage('Cover photo updated successfully.');
    setCheckedFiles(new Set());
    setThumbUpdateTimestamps(prev => ({ ...prev, [personId]: Date.now() }));
    loadPeople();
  } catch(err) {
    alert('Error setting thumbnail: ' + (err?.response?.data?.detail || err.message));
  }
}

async function removePersonPhotosBulk(personId, fileIds) {
  if (indexer.face_scanner_running) {
    alert("Please stop the Face Scanner before modifying profiles to prevent database conflicts.");
    return;
  }
  if (!window.confirm(`Are you sure you want to un-tag ${fileIds.length} photo(s) from this person?`)) return;
  try {
    for (const fileId of fileIds) {
      await axios.post(`${API}/people/${personId}/remove-photo`, { file_id: fileId });
    }
    showToastMessage(`Removed ${fileIds.length} photo(s).`);
    setPersonFiles(prev => prev.filter(f => !fileIds.includes(f.id)));
    setCheckedFiles(new Set());
  } catch(err) {
    alert('Error removing photo(s): ' + (err?.response?.data?.detail || err.message));
  }
}

async function assignPhotosToPerson(personId, filePaths) {
  if (indexer.face_scanner_running) {
    alert("Please stop the Face Scanner before modifying profiles to prevent database conflicts.");
    return;
  }
  if (!personId) return;
  const fileIds = filePaths.map(p => globalFileCache.current.get(p)?.id).filter(id => id);
  try {
    for (const id of fileIds) {
      await axios.post(`${API}/people/${personId}/add-photo`, { file_id: id });
    }
    showToastMessage(`Successfully tagged ${fileIds.length} photo(s).`);
    setIsTaggingPerson(false);
    setCheckedFiles(new Set());
    if (page === 'explorer') loadFiles(0, false, filterCategory);
    else if (page === 'search') doSearch(query, filterCategory);
  } catch(err) {
    alert('Error tagging photo(s): ' + (err?.response?.data?.detail || err.message));
  }
}

function locateSelectedFileInExplorer() {
    if (checkedFiles.size !== 1) return;
    const path = Array.from(checkedFiles)[0];
    let file = globalFileCache.current.get(path);
    if (!file) return;

    // Search for the specific day to provide timeline context
    let q = '';
    const d = new Date(file.modified);
    if (file.modified && !isNaN(d.getTime())) {
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        q = `date:${d.getFullYear()}-${month}-${day}`;
    } else {
        q = `name:"${file.filename}"`;
    }

    setFilterCategory('all');
    setSortBy('date');
    setSortOrder('desc');
    setQuery(q);
    setPage('search');
    setSelected(file);
    setCheckedFiles(new Set([file.path]));
    
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setLoadingMore(true);
    
    if (searchAbortController.current) {
        searchAbortController.current.abort();
    }
    searchAbortController.current = new AbortController();

    const safeQuery = q.replace(/,/g, ' ');
    axios.get(`${API}/search?query=${encodeURIComponent(safeQuery)}&category=all&offset=0&limit=50`, {
        signal: searchAbortController.current.signal
    }).then(r => {
        let newFiles = r.data;
        if (!newFiles.some(f => f.path === file.path)) {
            newFiles = [...newFiles, file];
        }
        setSearchCache(newFiles);
        setFiles(newFiles);
        setOffset(r.data.length);
        setHasMore(r.data.length === 50);
        setLoadingMore(false);
        setTimeout(() => {
            const escapedPath = file.path.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const el = document.querySelector(`[data-path="${escapedPath}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const dateKey = (!isNaN(d.getTime()) && file.modified) ? d.toLocaleDateString('default', { month: 'short', year: 'numeric' }) : 'Unknown Date';
                document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }).catch((err) => {
        if (!axios.isCancel(err)) {
            setLoadingMore(false);
        }
    });
}

async function addTagsToSelected(tagsStr) {
  if (indexer.object_scanner_running) {
    alert("Please stop the Object Scanner before modifying tags to prevent database conflicts.");
    return;
  }
  if (!tagsStr) return;
  const tags = tagsStr.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t);
  if (tags.length === 0) return;
  const fileIds = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)?.id).filter(id => id);
  try {
    await axios.post(`${API}/tags/add`, { file_ids: fileIds, tags });
    showToastMessage(`Added tags to ${fileIds.length} files.`);
    setIsTaggingObject(false);
    setTagInput('');
    setCheckedFiles(new Set());
    if (page === 'explorer') loadFiles(0, false, filterCategory);
    else if (page === 'search') doSearch(query, filterCategory);
    loadDashboard();
    loadTags();
  } catch(err) {
    alert('Error adding tags: ' + (err?.response?.data?.detail || err.message));
  }
}

async function removeTagsFromSelected(tagsStr) {
  if (indexer.object_scanner_running) {
    alert("Please stop the Object Scanner before modifying tags to prevent database conflicts.");
    return;
  }
  if (!tagsStr) return;
  const tags = tagsStr.split(',').map(t => t.trim().replace(/\s+/g, '_').toLowerCase()).filter(t => t);
  if (tags.length === 0) return;
  const fileIds = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)?.id).filter(id => id);
  try {
    await axios.post(`${API}/tags/remove`, { file_ids: fileIds, tags });
    showToastMessage(`Removed tags from ${fileIds.length} files.`);
    setIsTaggingObject(false);
    setTagInput('');
    setCheckedFiles(new Set());
    if (page === 'explorer') loadFiles(0, false, filterCategory);
    else if (page === 'search') doSearch(query, filterCategory);
    loadDashboard();
    loadTags();
  } catch(err) {
    alert('Error removing tags: ' + (err?.response?.data?.detail || err.message));
  }
}

async function deleteTagGlobally(tag) {
  if (indexer.object_scanner_running) {
    alert("Please stop the Object Scanner before modifying tags to prevent database conflicts.");
    return;
  }
  const tagName = tag.replace('object:', '').replace(/_/g, ' ');
  if (!window.confirm(`Are you sure you want to remove the tag "${tagName}" from ALL files? This cannot be undone.`)) return;
  try {
    await axios.delete(`${API}/tags/objects/${encodeURIComponent(tag)}`);
    showToastMessage(`Tag "${tagName}" removed from all files.`);
    loadDashboard(); // This re-fetches object tags
    loadTags();
  } catch(err) {
    alert('Error deleting tag: ' + (err?.response?.data?.detail || err.message));
  }
}

async function clearAllObjectTags() {
  if (indexer.object_scanner_running) {
    alert("Please stop the Object Scanner before modifying tags to prevent database conflicts.");
    return;
  }
  if (!window.confirm(`Are you sure you want to remove ALL automatically detected object tags from EVERY file in the database? This action cannot be undone.`)) return;
  try {
    await axios.delete(`${API}/tags/objects/all`);
    await axios.post(`${API}/reset-object-scanner-progress`);
    showToastMessage(`All object tags have been cleared.`);
    loadDashboard(); // This re-fetches object tags
    loadTags();
  } catch(err) {
    alert('Error clearing all tags: ' + (err?.response?.data?.detail || err.message));
  }
}

async function startFaceScan() {
  setActionInProgress(true);
  try {
    setIndexer(prev => ({ ...prev, face_scanner_running: true, face_scanner_stopped: false }));
    await axios.post(`${API}/scan-faces`);
    showToastMessage('Face scanning started in background...');
    await loadDashboard(); // Refresh status
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
    await loadDashboard(); // Refresh status
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

async function indexerAction(action){
 const isAnyRunning = indexer.running || indexer.combined_scanner_running;
 if ((action === 'start' || action === 'update' || action === 'reindex') && isAnyRunning) {
   return;
 }

 setActionInProgress(true);
 try {
 if(action === 'reindex'){
   if(!window.confirm('Are you sure you want to completely re-index the archive? This will wipe the current database and may take a considerable amount of time for large backups.')) return;
   await axios.post(`${API}/indexer/reindex`, combinedOptions)
   setFiles([])
   setSearchCache([])
   setSelected(null)
   setCheckedFiles(new Set())
   setOffset(0)
   setHasMore(false)
   setStats({total:0,photos:0,videos:0,audio:0,documents:0,ebooks:0,code:0,fonts:0,databases:0,compressed:0,installers:0,binaries:0,others:0,duplicates:0})
   setObjectTags([])
 } else if (action === 'start' || action === 'update') {
   await axios.post(`${API}/indexer/${action}`, combinedOptions)
 } else {
   await axios.post(`${API}/indexer/${action}`)
 }
 await loadDashboard()
 } finally {
   setActionInProgress(false);
 }
}

async function openFile(itemPath){
 try {
   await axios.post(`${API}/open-path`, { path: itemPath })
 } catch(err){
   const message = err?.response?.data?.detail || err.message || 'Unable to open file.'
   alert(message)
 }
}

async function openContainingFolder(itemPath){
 try {
   await axios.post(`${API}/open-folder`, { path: itemPath })
 } catch(err){
   const message = err?.response?.data?.detail || err.message || 'Unable to open folder.'
   alert(message)
 }
}

const handleItemClick = (e, item) => {
  setSelected(item);
  const currentIndex = sortedFiles.findIndex(f => f.path === item.path);
  if (currentIndex === -1) return;

  if (e.shiftKey) {
    document.getSelection()?.removeAllRanges(); // Prevents blue text highlighting on Shift+Click
    let startIdx = currentIndex;
    if (lastCheckedPath.current) {
      const lastIdx = sortedFiles.findIndex(f => f.path === lastCheckedPath.current);
      if (lastIdx !== -1) startIdx = lastIdx;
    }
    
    const start = Math.min(startIdx, currentIndex);
    const end = Math.max(startIdx, currentIndex);
    
    const next = new Set(checkedFiles);
    for (let i = start; i <= end; i++) {
      next.add(sortedFiles[i].path);
    }
    setCheckedFiles(next);
  } else if (e.ctrlKey || e.metaKey) {
    const next = new Set(checkedFiles);
    if (next.has(item.path)) next.delete(item.path);
    else next.add(item.path);
    setCheckedFiles(next);
    lastCheckedPath.current = item.path;
  } else {
    if (checkedFiles.size > 0) setCheckedFiles(new Set([item.path]));
    lastCheckedPath.current = item.path;
  }
};

const toggleCheck = (e, path) => {
  e.stopPropagation();
  lastCheckedPath.current = path;

  const next = new Set(checkedFiles);
  if(next.has(path)) next.delete(path);
  else next.add(path);
  setCheckedFiles(next);
};

const selectAll = () => {
  const visiblePaths = sortedFiles.map(f => f.path);
  const allVisibleChecked = visiblePaths.length > 0 && visiblePaths.every(p => checkedFiles.has(p));
  
  if (allVisibleChecked) {
    const next = new Set(checkedFiles);
    visiblePaths.forEach(p => next.delete(p));
    setCheckedFiles(next);
  } else {
    const next = new Set(checkedFiles);
    visiblePaths.forEach(p => next.add(p));
    setCheckedFiles(next);
  }
};

const selectVerifiedDuplicates = () => {
  const nextChecked = new Set(checkedFiles);
  const hashGroups = {};
  sortedFiles.forEach(f => {
    if (f.metadata?.sha256) {
      if (!hashGroups[f.metadata.sha256]) hashGroups[f.metadata.sha256] = [];
      hashGroups[f.metadata.sha256].push(f);
    }
  });

  let addedCount = 0;
  Object.values(hashGroups).forEach(group => {
    if (group.length > 1) {
      for (let i = 1; i < group.length; i++) {
        if (!nextChecked.has(group[i].path)) {
          nextChecked.add(group[i].path);
          addedCount++;
        }
      }
    }
  });

  if (addedCount === 0) {
    alert("No new verified duplicate copies found to select. Please wait for 'Verify Hashes' to complete.");
  } else {
    setCheckedFiles(nextChecked);
    showToastMessage(`Auto-selected ${addedCount} verified duplicate(s).`);
  }
};

async function deleteSelected() {
  if (filterCategory === 'duplicates' && !settings.allow_unverified_deletion) {
    const filesToDelete = Array.from(checkedFiles).map(p => globalFileCache.current.get(p)).filter(Boolean);
    const hasUnverified = filesToDelete.some(f => !f.metadata?.sha256);
    if (hasUnverified) {
      alert('Deletion Blocked: One or more selected files lack a verified SHA-256 sum.\n\nBecause your cold storage backup might be offline, we cannot guarantee these are true duplicates yet. You can override this protection in the Settings menu.');
      return;
    }
  }

  if(!window.confirm(`Are you sure you want to permanently delete ${checkedFiles.size} files from your disk and database? This action cannot be undone.`)) return;
  try {
    await axios.post(`${API}/delete-files`, { paths: Array.from(checkedFiles) });
    setFiles(prev => prev.filter(f => !checkedFiles.has(f.path)));
    setCheckedFiles(new Set());
    if(selected && checkedFiles.has(selected.path)) setSelected(null);
  } catch(err) {
    alert('Error deleting files: ' + (err?.response?.data?.detail || err.message));
  }
}

async function openSelected() {
  for(const path of checkedFiles) await openFile(path);
}

async function copySelected() {
  try {
    const dest = await axios.get(`${API}/choose-path?mode=directory`);
    if (!dest.data || !dest.data.path) return;
    const res = await axios.post(`${API}/copy-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
    alert(`Successfully copied ${res.data.copied} files.`);
    setCheckedFiles(new Set());
  } catch(err) {
    alert('Error copying files: ' + (err?.response?.data?.detail || err.message));
  }
}

async function moveSelected() {
  try {
    const dest = await axios.get(`${API}/choose-path?mode=directory`);
    if (!dest.data || !dest.data.path) return;
    const res = await axios.post(`${API}/move-files`, { paths: Array.from(checkedFiles), destination: dest.data.path });
    const updates = res.data.updates || {};
    setFiles(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
    setSearchCache(prev => prev.map(f => updates[f.path] ? { ...f, path: updates[f.path] } : f));
    alert(`Successfully moved ${res.data.moved} files.`);
    setCheckedFiles(new Set());
  } catch(err) {
    alert('Error moving files: ' + (err?.response?.data?.detail || err.message));
  }
}

async function backupDatabase() {
  try {
    const dest = await axios.get(`${API}/choose-path?mode=directory`);
    if (!dest.data || !dest.data.path) return;
    
    setActionInProgress(true);
    await axios.post(`${API}/system/backup`, { destination: dest.data.path });
    showToastMessage('Data safely backed up to ' + dest.data.path);
  } catch (err) {
    alert('Error backing up database: ' + (err?.response?.data?.detail || err.message));
  } finally {
    setActionInProgress(false);
  }
}

async function exportKnownPeople() {
  try {
    const r = await axios.get(`${API}/system/export-people`);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(r.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `wabs_known_people_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    showToastMessage('Known people exported successfully.');
  } catch(err) {
    alert('Error exporting people: ' + (err?.response?.data?.detail || err.message));
  }
}

function importKnownPeople() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        if (!Array.isArray(payload)) throw new Error("Invalid JSON format");
        setActionInProgress(true);
        let importedPeople = 0;
        let importedFaces = 0;
        const chunkSize = 50;
        for (let i = 0; i < payload.length; i += chunkSize) {
          showToastMessage(`Importing people... ${Math.round((i / payload.length) * 100)}%`);
          const chunk = payload.slice(i, i + chunkSize);
          const r = await axios.post(`${API}/system/import-people`, chunk);
          importedPeople += r.data.imported_people;
          importedFaces += r.data.imported_faces;
        }
        showToastMessage(`Imported ${importedPeople} people and ${importedFaces} faces.`);
        loadPeople();
      } catch (err) {
        alert('Error importing people: ' + (err?.response?.data?.detail || err.message));
      } finally {
        setActionInProgress(false);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function exportTags() {
  try {
    const r = await axios.get(`${API}/system/export-tags`);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(r.data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `wabs_tags_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
    showToastMessage('Tags exported successfully.');
  } catch(err) {
    alert('Error exporting tags: ' + (err?.response?.data?.detail || err.message));
  }
}

function importTags() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        if (!Array.isArray(payload)) throw new Error("Invalid JSON format");
        setActionInProgress(true);
        let totalImported = 0;
        const chunkSize = 2000;
        for (let i = 0; i < payload.length; i += chunkSize) {
          showToastMessage(`Importing tags... ${Math.round((i / payload.length) * 100)}%`);
          const chunk = payload.slice(i, i + chunkSize);
          const r = await axios.post(`${API}/system/import-tags`, chunk);
          totalImported += r.data.imported_files;
        }
        showToastMessage(`Successfully imported tags for ${totalImported} files.`);
        loadTags();
      } catch (err) {
        alert('Error importing tags: ' + (err?.response?.data?.detail || err.message));
      } finally {
        setActionInProgress(false);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function handleShutdown() {
  if (window.confirm('Are you sure you want to shut down the WABS server?')) {
    try {
      await axios.post(`${API}/shutdown`)
      setIsShutdown(true)
    } catch (err) {
      alert('Failed to send shutdown signal. Please close the application manually via Task Manager.');
    }
  }
}

async function stopVerifyDuplicates() {
  setActionInProgress(true);
  try {
    setIndexer(prev => ({ ...prev, hasher_stopped: true }));
    await axios.post(`${API}/stop-verify-duplicates`)
    showToastMessage('Stopping duplicate verification...')
    await loadDashboard();
  } catch(err) {
    alert('Error stopping verification: ' + (err?.response?.data?.detail || err.message))
  } finally {
    setActionInProgress(false);
  }
}

async function verifyDuplicates() {
  setActionInProgress(true);
  try {
    setIndexer(prev => ({ ...prev, hasher_running: true, hasher_stopped: false }));
    await axios.post(`${API}/verify-duplicates`)
    showToastMessage('Duplicate verification started in background...')
    await loadDashboard();
  } catch(err) {
    setIndexer(prev => ({ ...prev, hasher_running: false }));
    alert('Error starting verification: ' + (err?.response?.data?.detail || err.message))
  } finally {
    setActionInProgress(false);
  }
}

const handleFilterChange = (e) => {
  const newCat = e.target.value;
  setFilterCategory(newCat);
  setShowSelectedOnly(false);
  if (newCat === 'duplicates') {
    setSortBy('size');
    setSortOrder('desc');
  }
  setSelected(null);
  if (page === 'explorer') {
    loadFiles(0, false, newCat);
  } else if (page === 'search') {
    doSearch(query, newCat);
  }
};

const handleCategoryClick = (category) => {
  setFilterCategory(category);
  setPage('explorer');
  setSelected(null);
  setShowSelectedOnly(false);
  if (category === 'duplicates') {
    setSortBy('size');
    setSortOrder('desc');
  }
  loadFiles(0, false, category);
};

const sortedFiles = useMemo(() => {
  let baseFiles = showSelectedOnly ? Array.from(checkedFiles).map(p => globalFileCache.current?.get(p) || files.find(f => f.path === p)).filter(Boolean) : (files || []);

  if (filterCategory === 'duplicates' && !showSelectedOnly) {
    const sizeGroups = {};
    baseFiles.forEach(f => {
      if (!sizeGroups[f.size]) sizeGroups[f.size] = [];
      sizeGroups[f.size].push(f);
    });

    baseFiles = baseFiles.filter(f => {
      const group = sizeGroups[f.size];
      if (f.metadata?.sha256) {
        const sameHashCount = group.filter(g => g.metadata?.sha256 === f.metadata.sha256).length;
        const unhashedCount = group.filter(g => !g.metadata?.sha256).length;
        if (sameHashCount === 1 && unhashedCount === 0) {
          return false; // Proven unique, hide it from duplicates view
        }
      }
      return true;
    });
    
    const newSizeGroups = {};
    baseFiles.forEach(f => {
      if (!newSizeGroups[f.size]) newSizeGroups[f.size] = [];
      newSizeGroups[f.size].push(f);
    });
    baseFiles = baseFiles.filter(f => newSizeGroups[f.size].length > 1);
  }

  const sorted = [...baseFiles].sort((a,b) => {
    let aVal, bVal;
    if(sortBy === 'date'){
      aVal = new Date(a.modified).getTime();
      bVal = new Date(b.modified).getTime();
    } else if(sortBy === 'size'){
      const parseSize = (s) => {
        if (!s) return 0;
        const str = String(s).replace(/,/g, '');
        const match = str.match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i);
        if(!match) return parseFloat(str) || 0;
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const mult = {B:1, KB:1024, MB:1024**2, GB:1024**3, TB:1024**4}[unit];
        return num * mult;
      };
      aVal = parseSize(a.size);
      bVal = parseSize(b.size);
    } else if(sortBy === 'filename'){
      aVal = String(a.filename || '').toLowerCase();
      bVal = String(b.filename || '').toLowerCase();
    }
    if(sortOrder === 'asc'){
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
  return sorted;
}, [files, sortBy, sortOrder, showSelectedOnly, checkedFiles]);

const groupedFiles = useMemo(() => {
  if (filterCategory === 'duplicates') {
    return { 'Duplicate Files': sortedFiles };
  }
  const groups = {};
  sortedFiles.forEach(file => {
    let key = 'Unknown Date';
    if (file.modified) {
      const d = new Date(file.modified);
      if (!isNaN(d.getTime())) {
        key = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
      }
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  });
  return groups;
}, [sortedFiles]);

const groupedPersonFiles = useMemo(() => {
  const groups = {};
  personFiles.forEach(file => {
    let key = 'Unknown Date';
    if (file.modified) {
      const d = new Date(file.modified);
      if (!isNaN(d.getTime())) {
        key = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
      }
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  });
  return groups;
}, [personFiles]);

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
  if (showFull && (page === 'explorer' || page === 'search' || page === 'person_files')) {
    axios.get(`${API}/timeline?category=${filterCategory}`).then(r => {
      const groups = new Map();
      r.data.forEach(item => {
        if (!item.date) return;
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const key = d.toLocaleDateString('default', { month: 'short', year: 'numeric' });
          if (!groups.has(key)) {
            groups.set(key, { 
              key, 
              yearMonth: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` 
            });
          }
        }
      });
      setFullTimelineData(Array.from(groups.values()));
    }).catch(e => console.warn('Failed to load full timeline', e));
  }
}, [settings.show_full_timeline, settings.ui_preferences?.show_full_timeline, filterCategory, page]);

const timelineItems = useMemo(() => {
  const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
  if (showFull && fullTimelineData.length > 0) {
    let items = [...fullTimelineData];
    if (page === 'person_files' || (sortBy === 'date' && sortOrder === 'desc')) items.reverse();
    return items.map(t => t.key);
  }
  return page === 'person_files' ? Object.keys(groupedPersonFiles) : Object.keys(groupedFiles);
}, [settings.show_full_timeline, settings.ui_preferences?.show_full_timeline, fullTimelineData, groupedFiles, groupedPersonFiles, sortBy, sortOrder, page]);

useEffect(() => {
  syncActiveDate(document.querySelector('.content'));
}, [groupedFiles, page]);

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
 loadFiles()
 loadSettings()
 loadDashboard()
 loadPeople()
 loadTags()
},[])

useEffect(() => {
  let isMounted = true;
  let timeoutId;
  let errorRetries = 0;
  let pollCount = 0;

  const poll = async () => {
    if (!isMounted) return;
    try {
      await loadDashboard();
      if (page === 'people') await loadPeople();
      
      pollCount++;
      // Refresh tags every 3 seconds while scanning to update the UI without causing heavy DB locks
      if (pollCount % 3 === 0) {
        await loadTags();
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
          combined_scanner_running: false
        }));
        showToastMessage("Connection lost. Stopped monitoring background tasks.");
        return; // Stop polling and gracefully unlock UI
      }
    }
    // Exponential backoff for retries: 1s, 2s, 4s, 8s...
    const delay = errorRetries > 0 ? 1000 * Math.pow(2, errorRetries - 1) : 1000;
    if (isMounted) timeoutId = setTimeout(poll, delay);
  };

  if (indexer.running || indexer.hasher_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.combined_scanner_running) {
    timeoutId = setTimeout(poll, 1000);
  } else {
    // Perform one final fetch when scanners stop to ensure all UI counters are fully up to date
    loadTags();
  }
  return () => { isMounted = false; clearTimeout(timeoutId); };
}, [indexer.running, indexer.hasher_running, indexer.face_scanner_running, indexer.object_scanner_running, indexer.combined_scanner_running, page]);

function getOfflinePlaceholder(text, bgColor, textColor) {
  const safeText = String(text).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','\'':'&apos;','"':'&quot;'}[c]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bgColor}"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="24">${safeText}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderThumb(item){
 if(item.thumbnail){
   return item.thumbnail.startsWith('http') ? item.thumbnail : `${API}${item.thumbnail}`
 }

 const label = item.filename ? String(item.filename).slice(0, 15) : 'Unknown';

 if(item.category==='photo'){
   return getOfflinePlaceholder('PHOTO', '#1e293b', '#94a3b8');
 }

 if(item.category==='video'){
   return getOfflinePlaceholder(label, '#111827', '#ffffff');
 }

 if(item.category==='document'){
   return getOfflinePlaceholder(label, '#172033', '#ffffff');
 }

 return getOfflinePlaceholder(label, '#1e293b', '#cbd5e1');
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

const getPersonThumbUrl = (p) => {
  if (!p.thumbnail) return '';
  let url = p.thumbnail.startsWith('http') ? p.thumbnail : `${API}${p.thumbnail}`;
  if (thumbUpdateTimestamps[p.id]) {
    url += (url.includes('?') ? '&' : '?') + `cb=${thumbUpdateTimestamps[p.id]}`;
  }
  return url;
};

const filteredTags = useMemo(() => {
  return objectTags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase()));
}, [objectTags, tagSearchQuery]);

return(
<SettingsContext.Provider value={{ animationsEnabled: settings.animations_enabled !== false }}>
<div className='layout'>
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
) : (
<>
{showSidebar && (
<>
<div className='sidebar' style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column' }}>
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '8px 0' }}>
      <AppIcon size={40} />
      <div>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>WABS</h2>
        <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>v1.0.0-beta.5</div>
      </div>
    </div>

    <ActionButton className="" onClick={()=>{ setPage('dashboard'); setSelected(null); loadDashboard(); }}>
    <DashboardIcon fontSize="small" /> Dashboard
    </ActionButton>

    <ActionButton className="" onClick={()=>{ 
      let cat = filterCategory;
      if (cat === 'duplicates') {
        cat = 'all';
        setFilterCategory('all');
        setQuery('');
        setSearchCache([]);
      }
      setPage('explorer');
      setSelected(null);
      setShowSelectedOnly(false);
      loadFiles(0, false, cat);
    }}>
    <FolderIcon fontSize="small" /> Explorer
    </ActionButton>

    <ActionButton className="" onClick={()=>{ 
      let cat = filterCategory;
      if (cat === 'duplicates') {
        cat = 'all';
        setFilterCategory('all');
        setQuery('');
        setSearchCache([]);
      }
      setPage('search');
      setSelected(null);
      setShowSelectedOnly(false);
      if (query && searchCache.length > 0) {
        setFiles(searchCache);
        setOffset(searchCache.length);
        setHasMore(searchCache.length > 0 && searchCache.length % 50 === 0);
      } else {
        goToSearch(cat);
      }
    }}>
    <SearchIcon fontSize="small" /> Search
    </ActionButton>

    <ActionButton className="" onClick={()=>{ setPage('people'); setSelected(null); setCheckedPeople(new Set()); setUnknownPeoplePage(1); setNamedPeoplePage(1); setNamedPersonSearchQuery(''); loadPeople(); }}>
    <FaceIcon fontSize="small" /> People
    </ActionButton>

    <ActionButton className="" onClick={()=>{ setPage('tags'); setSelected(null); setTagsPage(1); setTagSearchQuery(''); }}>
    <CategoryIcon fontSize="small" /> Tags
    </ActionButton>

    <ActionButton className="" onClick={()=>{ setPage('settings'); setSelected(null); }}>
    <SettingsIcon fontSize="small" /> Settings
    </ActionButton>

    <ActionButton className="" onClick={()=>{ setPage('about'); setSelected(null); }}>
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
)}

<div className='workspace' style={{ minWidth: 0 }}>

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
    style={{ flex: 1, margin: 0, paddingRight: '70px' }}
  />
  {suggestionsData.type !== 'none' && suggestionsData.suggestions.length > 0 && (
    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: '70px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', zIndex: 90, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
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
        onClick={() => { doSearch(''); setShowSearchHelp(false); }}
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
  </div>
  {showSearchHelp && (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '0', background: '#1e293b', border: '1px solid #334155', padding: '16px', zIndex: 100, borderRadius: '12px', width: '320px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', color: '#cbd5e1', fontSize: '13px' }}>
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

{(page === 'explorer' || page === 'search' || page === 'person_files') && (
  <div style={{ display: 'flex', gap: '8px' }}>
    <ActionButton
      className=""
      onClick={toggleTimeline}
      style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showTimeline ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      title="Toggle Timeline"
    >
      <ViewTimelineIcon />
    </ActionButton>
    <ActionButton
      className=""
      onClick={toggleDetails}
      style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showDetails ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      title="Toggle Details"
    >
      <InfoIcon />
    </ActionButton>
  </div>
)}
</div>

{
(page==='explorer' || page==='search') &&
<div className='explorer'>

{showTimeline && (
<>
<div className='timeline' style={{ width: timelineWidth }}>
  {timelineItems.map(dateKey => (
    <TimelineItem
      key={dateKey}
      dateKey={dateKey}
      isActiveDate={activeDate === dateKey}
      onClick={() => {
        const el = document.getElementById(`date-group-${dateKey}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
          if (showFull) {
            const tData = fullTimelineData.find(t => t.key === dateKey);
            if (tData) {
              setSortBy('date');
              setSortOrder('desc');
              doSearch(`date:${tData.yearMonth}`);
            }
          }
        }
      }}
    />
  ))}
</div>
<div className={`resizer ${isResizing === 'timeline' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('timeline'); }} />
</>
)}

<div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
<div className='sort-options' style={{ padding: '18px 18px 10px 18px', margin: 0, borderBottom: checkedFiles.size > 0 ? 'none' : '1px solid #1f2937' }}>
  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '10px', cursor: 'pointer', fontWeight: '500' }}>
    <input 
      type="checkbox" 
      checked={checkedFiles.size > 0 && sortedFiles.length > 0 && sortedFiles.every(f => checkedFiles.has(f.path))} 
      onChange={selectAll} 
    />
    Select All
  </label>

  {filterCategory === 'duplicates' && (
    <ActionButton
      className="btn btn-secondary"
      style={{ marginRight: '10px', padding: '4px 10px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
      onClick={selectVerifiedDuplicates}
    >
      <CheckCircleIcon fontSize="small" style={{ color: '#3b82f6' }} />
      Select Verified Copies
    </ActionButton>
  )}

  <label>Filter:</label>
  <select value={filterCategory} onChange={handleFilterChange}>
    <option value='all'>All Files</option>
    <option value='photo'>Photos</option>
    <option value='video'>Videos</option>
    <option value='audio'>Audio</option>
    <option value='document'>Documents</option>
    <option value='ebook'>eBooks</option>
    <option value='code'>Code / Scripts</option>
    <option value='font'>Fonts</option>
    <option value='database'>Databases</option>
    <option value='compressed'>Compressed</option>
    <option value='installer'>Installers</option>
    <option value='binary'>Binary Files</option>
    <option value='other'>Others</option>
    <option value='duplicates'>Duplicates</option>
  </select>

  <label style={{marginLeft:'10px'}}>Sort by:</label>
  <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
    <option value='date'>Date</option>
    <option value='size'>Size</option>
    <option value='filename'>Filename</option>
    <option value='extension'>Extension</option>
  </select>
  <ActionButton className="" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={()=>setSortOrder(sortOrder==='asc'?'desc':'asc')}>
    {sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
  </ActionButton>

  {filterCategory === 'duplicates' && (
    indexer.hasher_running ? (
      <ActionButton disabled={actionInProgress || indexer.hasher_stopped} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', justifyContent: 'center' }} onClick={stopVerifyDuplicates}>
        <CloseIcon fontSize="small" />
        {indexer.hasher_stopped ? 'Stopping...' : 'Stop Verification'}
      </ActionButton>
    ) : (
      <ActionButton disabled={actionInProgress} className="btn btn-secondary" style={{ marginLeft: '10px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={verifyDuplicates}>
        <CheckCircleIcon fontSize="small" style={{ color: '#10b981' }} />
        Verify Hashes
      </ActionButton>
    )
  )}

  <div style={{ flex: 1 }}></div>

  <div style={{ display: 'flex', gap: '4px', background: '#111827', padding: '4px', borderRadius: '8px' }}>
    <ActionButton 
      className=""
      onClick={() => setViewMode('grid')} 
      style={{ padding: '6px', background: viewMode === 'grid' ? '#3b82f6' : 'transparent', color: viewMode === 'grid' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
    >
      <GridViewIcon fontSize="small" />
    </ActionButton>
    <ActionButton 
      className=""
      onClick={() => setViewMode('list')} 
      style={{ padding: '6px', background: viewMode === 'list' ? '#3b82f6' : 'transparent', color: viewMode === 'list' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
    >
      <ViewListIcon fontSize="small" />
    </ActionButton>
  </div>
</div>

{filterCategory === 'duplicates' && indexer.hasher_running && (
  <div style={{ margin: '10px 18px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Duplicate Verification Progress</span>
    <ProgressBar current={indexer.hasher_current} total={indexer.hasher_total} color="#10b981" />
    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.hasher_current_file || ''}</div>
  </div>
)}

{checkedFiles.size > 0 && (
  <div style={{ padding: '10px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto', whiteSpace: 'nowrap' }}>{showSelectedOnly ? `Showing ${checkedFiles.size} selected file(s)` : `${checkedFiles.size} file(s) selected`}</span>
    <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', borderColor: showSelectedOnly ? '#3b82f6' : undefined, color: showSelectedOnly ? '#38bdf8' : undefined }} onClick={() => setShowSelectedOnly(!showSelectedOnly)}>{showSelectedOnly ? 'Show All Files' : 'Show Selected Only'}</ActionButton>

    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
      <ActionButton className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={openSelected}>Open</ActionButton>
      {checkedFiles.size === 1 && (
        <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={locateSelectedFileInExplorer}>
          <PlaceIcon fontSize="small" /> Locate in Explorer
        </ActionButton>
      )}
      <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={copySelected}>Copy</ActionButton>
      {!isSelectionReadOnly && (
        <>
          <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={moveSelected}>Move</ActionButton>
          <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }} onClick={deleteSelected}>Delete</ActionButton>
        </>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
      <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingPerson ? '#334155' : undefined }} onClick={() => { setIsTaggingPerson(!isTaggingPerson); setIsTaggingObject(false); loadPeople(); }}>Tag Person</ActionButton>
      {isTaggingPerson && Array.isArray(people) && (
        <select 
          onChange={(e) => assignPhotosToPerson(e.target.value, Array.from(checkedFiles))} 
          style={{ padding: '6px 12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none' }}
          value=""
        >
          <option value="" disabled>Select person...</option>
          {[...people].sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(p => <option key={p.id} value={p.id}>{p.name || `Unknown Person #${p.id}`}</option>)}
        </select>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0f172a', padding: '4px', borderRadius: '8px', border: '1px solid #334155' }}>
      <ActionButton disabled={indexer.object_scanner_running} className="btn btn-secondary" style={{ padding: '6px 12px', background: isTaggingObject ? '#334155' : undefined }} onClick={() => { setIsTaggingObject(!isTaggingObject); setIsTaggingPerson(false); }} title={indexer.object_scanner_running ? "Stop the Object Scanner to manage tags" : ""}>Manage Tags</ActionButton>
      {isTaggingObject && (
        <div style={{ display: 'flex', gap: '4px' }}>
          <input 
            type="text" 
            list="existing-tags"
            placeholder="tag1, tag2..." 
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            style={{ padding: '6px 12px', background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: '6px', outline: 'none', width: '150px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                addTagsToSelected(tagInput);
              }
            }}
          />
          <datalist id="existing-tags">
            {objectTags.map(tag => (
              <option key={tag} value={tag.replace('object:', '')} />
            ))}
          </datalist>
          <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#10b981' }} onClick={() => addTagsToSelected(tagInput)}>Add</ActionButton>
          <ActionButton className="btn btn-secondary" style={{ padding: '4px 8px', color: '#ef4444' }} onClick={() => removeTagsFromSelected(tagInput)}>Remove</ActionButton>
        </div>
      )}
    </div>

    <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</ActionButton>
  </div>
)}

    {page === 'search' && (
      <div style={{ padding: '10px 18px', background: '#0f172a', borderBottom: '1px solid #1f2937', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <h3 style={{ marginTop: '8px', marginBottom: '16px', fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Smart Searches</h3>
        <style>
          {`
            .smart-search-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
            .smart-search-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }
            .smart-search-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 8px; }
            .smart-search-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }
          `}
        </style>
                <div className="smart-search-scrollbar" style={{display:'flex', gap:'10px', padding: '4px 4px 8px 4px', overflowX: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#475569 transparent', width: '100%', boxSizing: 'border-box'}}>
          {(settings.smart_searches || []).map(search => (
            <ActionButton key={search.id} className="btn btn-secondary" style={{ padding: '6px 12px', background: '#1e293b', color: '#38bdf8', borderColor: '#3b82f6', fontSize: '13px', flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => doSearch(search.query)}>
              {search.name}
            </ActionButton>
          ))}
          {(!settings.smart_searches || settings.smart_searches.length === 0) && (
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px', whiteSpace: 'nowrap' }}>No smart searches configured. Add some in the Settings page!</p>
          )}
        </div>
      </div>
    )}

<div className='content' onScroll={handleScroll} style={{ paddingTop: '18px' }}>

{
Object.entries(groupedFiles).map(([dateKey, filesGroup]) => (
<div key={dateKey} id={`date-group-${dateKey}`}>
<h2 className="date-header" data-date={dateKey}>{dateKey}</h2>
<div className={viewMode === 'grid' ? 'grid' : 'list'}>
{
(() => {
  let isAlternateGroup = false;
  return filesGroup.map((item, index) => {
    const prevItem = index > 0 ? filesGroup[index - 1] : null;
    const isNewDuplicateGroup = filterCategory === 'duplicates' && prevItem && prevItem.size !== item.size;
    if (isNewDuplicateGroup) isAlternateGroup = !isAlternateGroup;
    return (
      <Fragment key={item.path}>
        {isNewDuplicateGroup && (
          <div style={{ gridColumn: '1 / -1', width: '100%', height: '2px', background: '#3b82f6', margin: viewMode === 'grid' ? '8px 0' : '4px 0', opacity: 0.5, borderRadius: '2px' }} />
        )}
        <FileCard
          item={item}
          viewMode={viewMode}
          isChecked={checkedFiles.has(item.path)}
          onToggleCheck={toggleCheck}
          onClick={handleItemClick}
          onContextMenu={openContainingFolder}
          onSelectAndOpen={(i) => { setSelected(i); openFile(i.path); }}
          renderThumb={renderThumb}
          isAltGroup={isAlternateGroup}
          showVerified={filterCategory === 'duplicates' && !!item.metadata?.sha256}
          showUnverified={filterCategory === 'duplicates' && !item.metadata?.sha256}
          isReadOnly={checkFileReadOnly(item.path)}
          isProcessing={filterCategory === 'duplicates' && indexer.hasher_running && indexer.hasher_current_file === item.path}
        />
      </Fragment>
    );
  });
})()
}
</div>
</div>
))
}
</div>
</div>

{showDetails && (
<>
<div className={`resizer ${isResizing === 'details' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('details'); }} />
<div className='details' style={{ width: detailsWidth, overflowY: 'auto', maxHeight: '100%', display: 'flex', flexDirection: 'column'}}>

<h3>Details</h3>

{
selected ?
<div>

<img
src={renderThumb(selected)}
style={{
width:'100%',
borderRadius:'12px',
cursor:'pointer'
}}
key={selected.path}
onClick={()=>openFile(selected.path)}
/>

<h2>{selected.filename}</h2>

<p><b>Path:</b> {selected.path}</p>

<p><b>Category:</b> {selected.category}</p>

<p><b>Extension:</b> {selected.extension || 'unknown'}</p>

<p><b>Size:</b> {formatSize(selected.size)}</p>

<p><b>Modified:</b> {selected.modified}</p>

{selected.metadata?.gps && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <b>Location:</b>
    <ActionButton 
      className="btn btn-secondary" 
      style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#3b82f6', color: '#3b82f6' }}
      onClick={() => window.open(`https://www.google.com/maps?q=${selected.metadata.gps.latitude},${selected.metadata.gps.longitude}`, '_blank')}
    >
      <PlaceIcon fontSize="small" /> View on Map
    </ActionButton>
  </div>
)}

{selected.tags && (
  <div style={{ marginBottom: '16px' }}>
    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Detected Tags</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {selected.tags.split(' ').filter(t => t.trim()).map(tag => {
        const isObj = tag.startsWith('object:');
        const isPerson = tag.startsWith('person:');
        const color = isObj ? '#38bdf8' : isPerson ? '#10b981' : '#cbd5e1';
        const bg = isObj ? '#3b82f64a' : isPerson ? '#10b9814a' : '#334155';
        const border = isObj ? '#3b82f6' : isPerson ? '#10b981' : '#475569';
        const label = tag.replace('object:', '').replace('person:', '').replace(/_/g, ' ');
        return (
          <span key={tag} style={{ background: bg, color: color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', border: `1px solid ${border}`, fontWeight: '500' }}>
            {label}
          </span>
        );
      })}
    </div>
  </div>
)}

<h3>Metadata</h3>

<p><b>File ID:</b> {selected.id}</p>
<div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'16px'}}>
 <ActionButton className="btn btn-secondary" onClick={()=>openFile(selected.path)}>Open File</ActionButton>
 <ActionButton className="btn btn-secondary" onClick={()=>openContainingFolder(selected.path)}>Open Containing Folder</ActionButton>
</div>
{renderMetadata(selected.metadata)}

</div>
:
<p>Select file to preview.</p>
}

</div>
</>
)}

</div>
}

{
page==='people' &&
<div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
  <div>
    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px' }}><FaceIcon fontSize="large" style={{ color: '#3b82f6' }} /> People (Face Recognition)</h1>
    <p style={{ margin: 0, color: '#cbd5e1' }}>Automatically clustered groups of people found in your indexed photos.</p>
  </div>
  <div>
    {indexer.face_scanner_running ? (
      <ActionButton disabled={actionInProgress || indexer.face_scanner_stopped} className="btn btn-secondary" style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={stopFaceScan}>
        <CloseIcon fontSize="small" /> {indexer.face_scanner_stopped ? 'Stopping...' : 'Stop Scanning'}
      </ActionButton>
    ) : (
      <ActionButton disabled={actionInProgress} className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startFaceScan}>
        <PlayCircleIcon fontSize="small" /> Scan Archive for Faces
      </ActionButton>
    )}
  </div>
</div>

{indexer.face_scanner_running && (
  <div style={{ marginBottom: '20px', background: '#1e293b', padding: '12px 16px', borderRadius: '12px', border: '1px solid #334155' }}>
    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#f8fafc' }}>Face Scanner Progress</span>
    <ProgressBar current={indexer.face_scanner_current} total={indexer.face_scanner_total} color="#8b5cf6" />
    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>{indexer.face_scanner_current_file || ''}</div>
  </div>
)}

{checkedPeople.size > 0 && (
  <div style={{ position: 'sticky', bottom: '20px', zIndex: 50, padding: '10px 18px', background: '#1e293b', border: '1px solid #334155', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '16px', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
    <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto' }}>{checkedPeople.size} person(s) selected</span>
    {checkedPeople.size > 1 && (
      <ActionButton disabled={indexer.face_scanner_running} className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={mergeSelectedPeople} title={indexer.face_scanner_running ? "Stop the scanner to merge profiles" : ""}>Merge Selected</ActionButton>
    )}
    <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedPeople(new Set())}>Clear Selection</ActionButton>
  </div>
)}

{people === null ? <p style={{color: '#ef4444', marginTop: '20px'}}>Error: Failed to fetch faces. This usually means the API route in main.py is blocked, or the catch-all route is returning HTML. Check your browser console!</p> : null}
{Array.isArray(people) && people.length === 0 ? <p style={{color: '#94a3b8', marginTop: '20px'}}>No faces scanned or clustered yet. The background worker will populate this automatically.</p> : null}

{Array.isArray(people) && people.length > 0 && (
  <>
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '20px' }}>
      <label>Sort by:</label>
      <select value={peopleSortBy} onChange={(e) => { setPeopleSortBy(e.target.value); setUnknownPeoplePage(1); setNamedPeoplePage(1); }}>
        <option value="name">Name</option>
        <option value="count">Face Count</option>
      </select>
    </div>

    {people.filter(p => !(p.name || '').startsWith('Unknown Person')).length > 0 && (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>Named People</h2>
            <input
              type="text"
              placeholder="Search by name..."
              value={namedPersonSearchQuery}
              onChange={(e) => { setNamedPersonSearchQuery(e.target.value); setNamedPeoplePage(1); }}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', background: '#1e293b', color: '#f8fafc', width: '100%', maxWidth: '250px', outline: 'none' }}
            />
          </div>
          {people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length > 50 && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <ActionButton disabled={namedPeoplePage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setNamedPeoplePage(prev => Math.max(1, prev - 1))}>
                Previous
              </ActionButton>
              <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {namedPeoplePage} of {Math.ceil(people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length / 50)}</span>
              <ActionButton disabled={namedPeoplePage >= Math.ceil(people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length / 50)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setNamedPeoplePage(prev => prev + 1)}>
                Next
              </ActionButton>
            </div>
          )}
        </div>
        
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
        {people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).sort((a, b) => peopleSortBy === 'name' ? (a.name || '').localeCompare(b.name || '') : (b.face_count - a.face_count || (a.name || '').localeCompare(b.name || ''))).slice((namedPeoplePage - 1) * 50, namedPeoplePage * 50).map(p => (
          <div key={p.id} style={{background:'#111827', padding:'16px', borderRadius:'16px', border:'1px solid #24324a', cursor:'pointer', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative'}} onClick={() => openPersonPhotos(p)}>
             <input 
               type="checkbox" 
               checked={checkedPeople.has(p.id)}
               onClick={(e) => e.stopPropagation()}
               onChange={(e) => {
                   const next = new Set(checkedPeople);
                   if (e.target.checked) next.add(p.id);
                   else next.delete(p.id);
                   setCheckedPeople(next);
               }}
               style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, cursor: 'pointer', transform: 'scale(1.2)' }}
             />
             <div 
               onClick={(e) => deletePerson(e, p.id, p.name)}
               style={{position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
               title="Revert to Unknown Person"
             >
               ✕
             </div>
             <div style={{width:'100%', height:'150px', background:'#1e293b', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden'}}>
                 {p.thumbnail && (
                     <img src={getPersonThumbUrl(p)} style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                 )}
                 <FaceIcon style={{fontSize: 60, color:'#94a3b8', display: p.thumbnail ? 'none' : 'block'}} />
             </div>
             <div style={{display:'flex', alignItems:'center'}}>
                 <input 
                    value={editingNames[p.id] !== undefined ? editingNames[p.id] : (p.name || '')} 
                    onClick={e => e.stopPropagation()}
                    onChange={e => setEditingNames(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                    onBlur={e => {
                        let newName = e.target.value.trim();
                        if (!newName) newName = `Unknown Person #${p.id}`;
                        if (newName !== p.name) {
                            savePersonName(p.id, newName);
                            updatePersonNameLocal(p.id, newName);
                        }
                        setEditingNames(prev => { const next = {...prev}; delete next[p.id]; return next; });
                    }}
                    style={{background:'transparent', border:'none', color:'#f8fafc', fontSize:'16px', fontWeight:'bold', width:'100%', outline: 'none', borderBottom: '1px solid transparent'}}
                    onFocus={e => { e.target.style.borderBottom = '1px solid #3b82f6'; e.target.select(); }}
                    onBlurCapture={e => e.target.style.borderBottom = '1px solid transparent'}
                 />
             </div>
             <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '-4px' }}>
                 {p.face_count} photo{p.face_count !== 1 ? 's' : ''}
             </div>
          </div>
        ))}
        </div>

        {people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length === 0 && namedPersonSearchQuery && (
          <p style={{ color: '#94a3b8', marginTop: '16px' }}>No named people match your search.</p>
        )}
        
        {people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length > 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', marginBottom: '24px' }}>
            <ActionButton disabled={namedPeoplePage === 1} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setNamedPeoplePage(prev => Math.max(1, prev - 1))}>
              Previous
            </ActionButton>
            <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {namedPeoplePage} of {Math.ceil(people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length / 50)}</span>
            <ActionButton disabled={namedPeoplePage >= Math.ceil(people.filter(p => !(p.name || '').startsWith('Unknown Person') && (p.name || '').toLowerCase().includes(namedPersonSearchQuery.toLowerCase())).length / 50)} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setNamedPeoplePage(prev => prev + 1)}>
              Next
            </ActionButton>
          </div>
        )}
        
      </>
    )}

    {people.filter(p => (p.name || '').startsWith('Unknown Person')).length > 0 && (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <h2 id="unknown-people-section" style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>Unknown People</h2>
          {people.filter(p => (p.name || '').startsWith('Unknown Person')).length > 50 && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <ActionButton disabled={unknownPeoplePage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setUnknownPeoplePage(prev => Math.max(1, prev - 1))}>
                Previous
              </ActionButton>
              <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {unknownPeoplePage} of {Math.ceil(people.filter(p => (p.name || '').startsWith('Unknown Person')).length / 50)}</span>
              <ActionButton disabled={unknownPeoplePage >= Math.ceil(people.filter(p => (p.name || '').startsWith('Unknown Person')).length / 50)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setUnknownPeoplePage(prev => prev + 1)}>
                Next
              </ActionButton>
            </div>
          )}
        </div>
        
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px'}}>
        {people.filter(p => (p.name || '').startsWith('Unknown Person')).sort((a, b) => peopleSortBy === 'name' ? (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }) : (b.face_count - a.face_count || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))).slice((unknownPeoplePage - 1) * 50, unknownPeoplePage * 50).map(p => (
          <div key={p.id} style={{background:'#111827', padding:'16px', borderRadius:'16px', border:'1px solid #24324a', cursor:'pointer', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative'}} onClick={() => openPersonPhotos(p)}>
             <input 
               type="checkbox" 
               checked={checkedPeople.has(p.id)}
               onClick={(e) => e.stopPropagation()}
               onChange={(e) => {
                   const next = new Set(checkedPeople);
                   if (e.target.checked) next.add(p.id);
                   else next.delete(p.id);
                   setCheckedPeople(next);
               }}
               style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10, cursor: 'pointer', transform: 'scale(1.2)' }}
             />
             <div 
               onClick={(e) => deletePerson(e, p.id, p.name)}
               style={{position: 'absolute', top: '8px', right: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', zIndex: 10}}
               title="Delete / Ignore Person"
             >
               ✕
             </div>
             <div style={{width:'100%', height:'150px', background:'#1e293b', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden'}}>
                 {p.thumbnail && (
                     <img src={getPersonThumbUrl(p)} style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                 )}
                 <FaceIcon style={{fontSize: 60, color:'#94a3b8', display: p.thumbnail ? 'none' : 'block'}} />
             </div>
             <div style={{display:'flex', alignItems:'center'}}>
                 <input 
                    value={editingNames[p.id] !== undefined ? editingNames[p.id] : (p.name || '')} 
                    onClick={e => e.stopPropagation()}
                    onChange={e => setEditingNames(prev => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                    onBlur={e => {
                        let newName = e.target.value.trim();
                        if (!newName) newName = `Unknown Person #${p.id}`;
                        if (newName !== p.name) {
                            savePersonName(p.id, newName);
                            updatePersonNameLocal(p.id, newName);
                        }
                        setEditingNames(prev => { const next = {...prev}; delete next[p.id]; return next; });
                    }}
                    style={{background:'transparent', border:'none', color:'#f8fafc', fontSize:'16px', fontWeight:'bold', width:'100%', outline: 'none', borderBottom: '1px solid transparent'}}
                    onFocus={e => { e.target.style.borderBottom = '1px solid #3b82f6'; e.target.select(); }}
                    onBlurCapture={e => e.target.style.borderBottom = '1px solid transparent'}
                 />
             </div>
             <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '-4px' }}>
                 {p.face_count} photo{p.face_count !== 1 ? 's' : ''}
             </div>
          </div>
        ))}
        </div>

        {people.filter(p => (p.name || '').startsWith('Unknown Person')).length > 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '32px', marginBottom: '24px' }}>
            <ActionButton disabled={unknownPeoplePage === 1} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setUnknownPeoplePage(prev => Math.max(1, prev - 1))}>
              Previous
            </ActionButton>
            <span style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '14px' }}>Page {unknownPeoplePage} of {Math.ceil(people.filter(p => (p.name || '').startsWith('Unknown Person')).length / 50)}</span>
            <ActionButton disabled={unknownPeoplePage >= Math.ceil(people.filter(p => (p.name || '').startsWith('Unknown Person')).length / 50)} className="btn btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setUnknownPeoplePage(prev => prev + 1)}>
              Next
            </ActionButton>
          </div>
        )}
        
      </>
    )}
  </>
)}
</div>
}

{
page==='person_files' &&
<div className='explorer'>
{showTimeline && (
<>
<div className='timeline' style={{ width: timelineWidth }}>
  {timelineItems.map(dateKey => (
    <TimelineItem
      key={dateKey}
      dateKey={dateKey}
      isActiveDate={activeDate === dateKey}
      onClick={() => {
        const el = document.getElementById(`date-group-${dateKey}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
          if (showFull) {
            const tData = fullTimelineData.find(t => t.key === dateKey);
            if (tData) {
              setSortBy('date');
              setSortOrder('desc');
              doSearch(`person:"${currentPerson?.name || ''}" date:${tData.yearMonth}`);
            }
          }
        }
      }}
    />
  ))}
</div>
<div className={`resizer ${isResizing === 'timeline' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('timeline'); }} />
</>
)}
<div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0}}>
<div style={{padding: '18px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '16px'}}>
    <ActionButton className="btn btn-secondary" onClick={() => { setPage('people'); setCheckedFiles(new Set()); setSimilarUnknowns(null); loadPeople(); }}>&larr; Back to People</ActionButton>
    <h2 style={{margin: 0}}>{currentPerson?.name}'s Photos</h2>
    {!currentPerson?.name?.startsWith('Unknown Person') && (
        isFindingSimilar ? (
            <ActionButton 
                className="btn btn-secondary" 
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#b91c1c' }}
                onClick={stopFindSimilarUnknowns}
            >
                <CloseIcon fontSize="small" /> Stop Searching
            </ActionButton>
        ) : (
            <ActionButton 
                className="btn btn-secondary" 
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', borderColor: '#3b82f6' }}
                onClick={() => findSimilarUnknowns(currentPerson.id, similarityThreshold)}
            >
                <FaceIcon fontSize="small" /> Find Similar Unknowns
            </ActionButton>
        )
    )}
</div>

{similarUnknowns && (
  <div style={{ padding: '18px', borderBottom: '1px solid #1f2937', background: '#0f172a' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
      <h3 style={{ margin: 0, color: '#f8fafc' }}>Similar Unknown Profiles ({similarUnknowns.length})</h3>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: '14px' }}>Similarity Threshold:</span>
        <input 
          type="range" 
          min="0.4" max="0.8" step="0.01" 
              disabled={isFindingSimilar}
          value={similarityThreshold} 
          onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))} 
        />
        <span style={{ color: '#38bdf8', fontSize: '14px', minWidth: '40px' }}>{Math.round(similarityThreshold * 100)}%</span>
            <ActionButton disabled={isFindingSimilar} className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={() => findSimilarUnknowns(currentPerson.id, similarityThreshold)}>Apply</ActionButton>
        <ActionButton className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => { setSimilarUnknowns(null); setCheckedSimilar(new Set()); }}>Close</ActionButton>
      </div>
    </div>
    
    {similarUnknowns.length === 0 ? (
      <p style={{ color: '#94a3b8' }}>No similar unknown profiles found at this threshold. Try lowering the slider.</p>
    ) : (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
          {similarUnknowns.map(p => (
             <div key={p.id} style={{background:'#111827', padding:'10px', borderRadius:'12px', border: checkedSimilar.has(p.id) ? '2px solid #3b82f6' : '1px solid #24324a', cursor:'pointer', position: 'relative'}} onClick={() => {
                const next = new Set(checkedSimilar);
                if (next.has(p.id)) next.delete(p.id);
                else next.add(p.id);
                setCheckedSimilar(next);
             }}>
               <input 
                 type="checkbox" 
                 checked={checkedSimilar.has(p.id)}
                 onChange={() => {}}
                 style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, cursor: 'pointer' }}
               />
               <div style={{width:'100%', height:'100px', background:'#1e293b', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden', marginBottom: '8px'}}>
                 {p.thumbnail && (
                     <img src={getPersonThumbUrl(p)} style={{width: '100%', height: '100%', objectFit: 'cover'}} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                 )}
                 <FaceIcon style={{fontSize: 40, color:'#94a3b8', display: p.thumbnail ? 'none' : 'block'}} />
               </div>
               <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
               <div style={{ fontSize: '12px', color: '#38bdf8' }}>{Math.round(p.similarity * 100)}% Match</div>
               <div style={{ fontSize: '12px', color: '#94a3b8' }}>{p.face_count} photo{p.face_count !== 1 ? 's' : ''}</div>
             </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
           <ActionButton disabled={checkedSimilar.size === 0 || indexer.face_scanner_running} className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={async () => {
              if (indexer.face_scanner_running) {
                 alert("Please stop the Face Scanner before merging profiles to prevent database conflicts.");
                 return;
              }
              if (!window.confirm(`Merge ${checkedSimilar.size} unknown profile(s) into ${currentPerson.name}?`)) return;
              try {
                await axios.post(`${API}/people/merge`, { person_ids: [currentPerson.id, ...Array.from(checkedSimilar)] });
                showToastMessage(`Merged ${checkedSimilar.size} profiles successfully.`);
                setSimilarUnknowns(null);
                setCheckedSimilar(new Set());
                openPersonPhotos(currentPerson);
                loadPeople();
              } catch(err) {
                alert('Error merging: ' + (err?.response?.data?.detail || err.message));
              }
           }}>
             Merge {checkedSimilar.size} Selected
           </ActionButton>
           <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => {
              if (checkedSimilar.size === similarUnknowns.length) setCheckedSimilar(new Set());
              else setCheckedSimilar(new Set(similarUnknowns.map(p => p.id)));
           }}>
              {checkedSimilar.size === similarUnknowns.length ? 'Deselect All' : 'Select All'}
           </ActionButton>
        </div>
      </>
    )}
  </div>
)}

{checkedFiles.size > 0 && (
  <div style={{ padding: '10px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto', whiteSpace: 'nowrap' }}>{checkedFiles.size} photo(s) selected</span>
    {checkedFiles.size === 1 && (
      <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => {
         const fileId = globalFileCache.current.get(Array.from(checkedFiles)[0])?.id;
         if (fileId) setPersonThumbnail(currentPerson.id, fileId);
      }}>Set as Cover Photo</ActionButton>
    )}
    {checkedFiles.size === 1 && (
        <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={locateSelectedFileInExplorer}>
            <PlaceIcon fontSize="small" /> Locate in Explorer
        </ActionButton>
    )}
    <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', whiteSpace: 'nowrap' }} onClick={() => {
         const fileIds = Array.from(checkedFiles).map(path => globalFileCache.current.get(path)?.id).filter(id => id);
         removePersonPhotosBulk(currentPerson.id, fileIds);
    }}>Remove from Person</ActionButton>
    <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</ActionButton>
  </div>
)}

<div className="content" onScroll={handleScroll} style={{paddingTop: '18px', paddingLeft: '18px', paddingRight: '18px', overflowY: 'auto'}}>
    {Array.isArray(personFiles) && personFiles.length === 0 ? (
        <div className={viewMode === 'grid' ? 'grid' : 'list'}>
            <p>No photos found for this person.</p>
        </div>
    ) : null}
    {Object.entries(groupedPersonFiles).map(([dateKey, filesGroup]) => (
        <div key={dateKey} id={`date-group-${dateKey}`}>
            <h2 className="date-header" data-date={dateKey}>{dateKey}</h2>
            <div className={viewMode === 'grid' ? 'grid' : 'list'}>
                {filesGroup.map(item => (
                    <FileCard
                      key={item.path}
                      item={item}
                      viewMode={viewMode}
                      isChecked={checkedFiles.has(item.path)}
                      onToggleCheck={toggleCheck}
                      onClick={handleItemClick}
                      onContextMenu={openContainingFolder}
                      onSelectAndOpen={(i) => { setSelected(i); openFile(i.path); }}
                      renderThumb={renderThumb}
                      isAltGroup={false}
                      showVerified={false}
                      showUnverified={false}
                      isReadOnly={checkFileReadOnly(item.path)}
                    />
                ))}
            </div>
        </div>
    ))}
</div>
</div>
</div>
}

{
page==='tags' &&
<div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
  <div>
    <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0, marginBottom: '8px' }}><CategoryIcon fontSize="large" style={{ color: '#3b82f6' }} /> Detected Objects &amp; Scenes</h1>
    <p style={{ margin: 0, color: '#cbd5e1' }}>Explore automatically classified objects and scenes found in your indexed photos.</p>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <ActionButton 
        className="btn btn-secondary" 
        style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', flexShrink: 0, whiteSpace: 'nowrap' }} 
        onClick={clearAllObjectTags}
        disabled={actionInProgress || indexer.object_scanner_running}
        title="Permanently remove all 'object:' tags from the entire database."
    >
      Clear All Tags
    </ActionButton>
    {indexer.object_scanner_running ? (
      <ActionButton disabled={actionInProgress || indexer.object_scanner_stopped} className="btn btn-secondary" style={{ padding: '8px 16px', background: '#ef4444', borderColor: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={stopObjectScan}>
        <CloseIcon fontSize="small" /> {indexer.object_scanner_stopped ? 'Stopping...' : 'Stop Scanning'}
      </ActionButton>
    ) : (
      <ActionButton disabled={actionInProgress} className="btn btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startObjectScan}>
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
        <ActionButton disabled={indexer.object_scanner_running} style={{ position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)', background: 'transparent', color: '#ef4444', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, minWidth: 0 }} onClick={() => deleteTagGlobally(tag)} title={`Delete tag "${tagName}" globally`}>
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
}

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
</div>

<div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:'18px',marginTop:'24px'}}>
<div style={{background:'#111827',padding:'18px',borderRadius:'16px',border:'1px solid #24324a', minWidth: 0}}>
<h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><AnalyticsIcon style={{ color: '#3b82f6' }} /> Indexing Status</h2>
<p><b>Status:</b> {indexer.status}</p>
<p><b>Running:</b> {indexer.running || indexer.combined_scanner_running ? 'Yes' : 'No'}</p>
<p><b>Paused:</b> {indexer.paused ? 'Yes' : 'No'}</p>
<p><b>Indexed:</b> {indexer.indexed}</p>
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
  <label style={{display:'flex',alignItems:'center',gap:'8px', color:'#f8fafc', fontSize:'13px'}}>
    <input type='checkbox' checked={combinedOptions.tag} onChange={(e) => { const next = {...combinedOptions, tag: e.target.checked}; setCombinedOptions(next); axios.post(`${API}/indexer/set-options`, next).catch(err => console.warn('Failed to save options', err)); }} /> Classify Objects & Scenes
  </label>
  <label style={{display:'flex',alignItems:'center',gap:'8px', color:'#f8fafc', fontSize:'13px'}}>
    <input type='checkbox' checked={combinedOptions.face} onChange={(e) => { const next = {...combinedOptions, face: e.target.checked}; setCombinedOptions(next); axios.post(`${API}/indexer/set-options`, next).catch(err => console.warn('Failed to save options', err)); }} /> Scan for Faces
  </label>
</div>

<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(90px, 1fr))',gap:'8px'}}>
<ActionButton disabled={actionInProgress || indexer.running || indexer.combined_scanner_running} onClick={()=>indexerAction('start')}>
Start
</ActionButton>
<ActionButton disabled={actionInProgress || indexer.running || indexer.combined_scanner_running} onClick={()=>indexerAction('update')}>
Update
</ActionButton>
<ActionButton disabled={actionInProgress || indexer.running || indexer.combined_scanner_running} onClick={()=>indexerAction('reindex')} style={{ color: (indexer.running || indexer.combined_scanner_running) ? undefined : '#f59e0b' }}>
Re-index
</ActionButton>
<ActionButton disabled={actionInProgress || (!indexer.running && !indexer.combined_scanner_running) || indexer.paused || indexer.stopped || indexer.combined_scanner_stopped} onClick={()=>indexerAction('pause')}>
Pause
</ActionButton>
<ActionButton disabled={actionInProgress || ((indexer.running || indexer.combined_scanner_running) && !indexer.paused) || indexer.stopped || indexer.combined_scanner_stopped} onClick={()=>indexerAction('resume')}>
Resume
</ActionButton>
<ActionButton disabled={actionInProgress || (!indexer.running && !indexer.combined_scanner_running) || indexer.stopped || indexer.combined_scanner_stopped} onClick={()=>indexerAction('stop')} style={{ color: ((!indexer.running && !indexer.combined_scanner_running) || indexer.stopped || indexer.combined_scanner_stopped) ? undefined : '#ef4444' }}>
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
<ActionButton disabled={actionInProgress} onClick={verifyDuplicates} style={{ width: '100%' }}>
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
<ActionButton disabled={actionInProgress} onClick={startFaceScan} style={{ width: '100%' }}>
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
<ActionButton disabled={actionInProgress} onClick={startObjectScan} style={{ width: '100%' }}>
Classify Objects & Scenes
</ActionButton>
)}
</div>

</div>
</div>
</div>
</div>
}

{
page==='settings' &&
<div style={{padding:'20px', overflow:'auto', height:'100%'}}>
  <div style={{ maxWidth: '900px', margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h1 style={{ margin: 0 }}>Settings</h1>
      <ActionButton className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={saveSettings}>
        <SettingsIcon fontSize="small" />
        Save Settings
      </ActionButton>
    </div>

    {/* Tab Navigation */}
    <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #334155', paddingBottom: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {['general', 'ui', 'ai', 'locations', 'search'].map(tab => (
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

        <h3 style={{ margin: '32px 0 16px 0' }}>Data Safety</h3>
        <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px', color:'#38bdf8'}}>
          <input type='checkbox' checked={settings.read_only_mode !== false} onChange={(e)=>updateUIPreferences({ read_only_mode: e.target.checked })} /> Enable Global Read-Only Mode (Overrides individual backup settings if enabled)
        </label>
        <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'0', color:'#ef4444'}}>
          <input type='checkbox' checked={settings.allow_unverified_deletion || false} onChange={(e)=>updateUIPreferences({ allow_unverified_deletion: e.target.checked })} /> Allow deleting unverified duplicates (Dangerous)
        </label>

        <h3 style={{ margin: '32px 0 16px 0' }}>Data Management</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Full Database Backup</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Create a safe, portable copy of your archive.db, ai_metadata.db, and config.yaml.</p>
            </div>
            <ActionButton disabled={actionInProgress} className="btn btn-secondary" onClick={backupDatabase}>
              Export / Backup Data
            </ActionButton>
          </div>
          <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Known People (Faces)</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Export or import named people and their face embeddings as a portable JSON file.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <ActionButton disabled={actionInProgress} className="btn btn-secondary" onClick={exportKnownPeople}>
                Export JSON
              </ActionButton>
              <ActionButton disabled={actionInProgress} className="btn btn-secondary" onClick={importKnownPeople}>
                Import JSON
              </ActionButton>
            </div>
          </div>
          <div style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', border: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '15px' }}>Object &amp; Custom Tags</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Export or import all applied tags mapped to file paths as a portable JSON file.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <ActionButton disabled={actionInProgress} className="btn btn-secondary" onClick={exportTags}>
                Export JSON
              </ActionButton>
              <ActionButton disabled={actionInProgress} className="btn btn-secondary" onClick={importTags}>
                Import JSON
              </ActionButton>
            </div>
          </div>
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

    {settingsTab === 'ui' && (
      <div style={{ padding: '20px', background: '#1e293b', borderRadius: '10px', border: '1px solid #334155', marginBottom: '24px' }}>
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
          <input type='checkbox' checked={settings.animations_enabled !== false} onChange={(e)=>updateUIPreferences({ animations_enabled: e.target.checked })} /> Enable UI Animations
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
              style={{ marginBottom: 0, width: '80px', padding: '4px 8px', fontSize: '14px' }}
              value={settings.photo_thumbnail_size_limit_mb !== undefined ? settings.photo_thumbnail_size_limit_mb : (settings.ui_preferences?.photo_thumbnail_size_limit_mb !== undefined ? settings.ui_preferences.photo_thumbnail_size_limit_mb : 5)}
              onChange={(e)=>updateUIPreferences({ photo_thumbnail_size_limit_mb: parseFloat(e.target.value) || 0 })}
            />
          </div>
        )}
        <div style={{ marginBottom: '0', marginTop: '16px' }}>
          <ActionButton className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={clearCache}>
            Clear Thumbnail Cache
          </ActionButton>
        </div>
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

        {(settings.smart_searches || []).map((search, index) => (
          <div key={search.id} style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', marginBottom: '16px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <input
                className='setting'
                style={{ margin: 0, fontWeight: 'bold', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '16px', padding: '0 4px', width: '100%', maxWidth: '300px' }}
                value={search.name || `Search ${index + 1}`}
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
              backup_configs: [...(prev.backup_configs || []), { id: newId, name: `Backup Location ${(prev.backup_configs?.length || 0) + 1}`, backup_path: '', mapped_backup_path: '', path_mapping_enabled: false, read_only_mode: true }]
            }));
          }}>+ Add Backup Location</ActionButton>
        </div>

        {(settings.backup_configs || []).map((config, index) => (
          <div key={config.id} style={{ padding: '16px', background: '#0f172a', borderRadius: '10px', marginBottom: '16px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <input
                className='setting'
                style={{ margin: 0, fontWeight: 'bold', background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '16px', padding: '0 4px', width: '100%', maxWidth: '300px' }}
                value={config.name || `Backup Location ${index + 1}`}
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
              Enable drive path remapping (Use if drive letter changed)
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
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>OpenAI API Key</p>
          <input
            type='password'
            className='setting'
            style={{ marginBottom: '0' }}
            value={settings.openai_api_key || ''}
            onChange={(e)=>setSettings({
            ...settings,
            openai_api_key:e.target.value
            })}
          />
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
            onChange={(e)=>setSettings({...settings, min_unknown_photos: parseInt(e.target.value) || 1})}
          />

          <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#94a3b8' }}>Object & Scene Detection</p>
          <select
            className='setting'
            style={{ marginBottom: '0', width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', outline: 'none' }}
            value={settings.object_sensitivity || 'medium'}
            onChange={(e)=>setSettings({...settings, object_sensitivity: e.target.value})}
          >
            <option value='high'>Detect more tags (Less accurate)</option>
            <option value='medium'>Balanced (Recommended)</option>
            <option value='low'>Detect fewer tags (More accurate)</option>
          </select>
        </div>
      </>
    )}

  </div>
</div>
}

{
page==='about' &&
<div style={{padding:'40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', height:'100%', overflowY: 'auto'}}>

<AppIcon size={100} />

<h1 style={{color:'#f8fafc', margin:'24px 0 8px 0', fontSize: '36px'}}>WABS</h1>
<h2 style={{color:'#3b82f6', fontWeight:'600', margin:'0 0 32px 0', fontSize: '18px', letterSpacing: '1px'}}>WiZarD's Archival and Backup Search System</h2>

<div style={{background:'#111827', padding:'32px', borderRadius:'16px', border:'1px solid #24324a', maxWidth: '600px', width: '100%', textAlign: 'left', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
  
  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
    <div style={{background:'#8b5cf61a', padding:'10px', borderRadius:'10px', color:'#8b5cf6', display:'flex'}}><InfoIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Version Info</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Current Release: <strong style={{color: '#f8fafc'}}>v1.0.0-beta.5</strong></p>
    </div>
  </div>

  <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
    <div style={{background:'#10b9811a', padding:'10px', borderRadius:'10px', color:'#10b981', display:'flex'}}><CodeIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Developer</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 2px 0', fontSize: '14px'}}>Author: <strong style={{color: '#f8fafc'}}>Winny Mathew Kurian</strong></p>
      <p style={{color:'#94a3b8', margin: '0', fontSize: '14px'}}>Email: <a href="mailto:WiZarD.Devel@gmail.com" style={{color: '#3b82f6', textDecoration: 'none'}}>WiZarD.Devel@gmail.com</a></p>
    </div>
  </div>

  <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
    <div style={{background:'#f59e0b1a', padding:'10px', borderRadius:'10px', color:'#f59e0b', display:'flex'}}><AnalyticsIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Acknowledgements</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px', fontStyle: 'italic'}}>AI Assisted Development by ChatGPT, GitHub Copilot, and Google Gemini (Pro)</p>
    </div>
  </div>

  <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

  <div style={{display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px'}}>
    <div style={{background:'#0ea5e91a', padding:'10px', borderRadius:'10px', color:'#0ea5e9', display:'flex'}}><MemoryIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Open Source & AI Models</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 8px 0', fontSize: '14px'}}>WABS is powered by the following open-source projects and models:</p>
      <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6' }}>
        <li><b>Face Detection:</b> YuNet (OpenCV Zoo)</li>
        <li><b>Face Recognition:</b> SFace (OpenCV Zoo)</li>
        <li><b>Object Classification:</b> MobileNetV2 (ONNX Model Zoo)</li>
        <li><b>Core Tech:</b> Python, FastAPI, SQLite (FTS5), OpenCV, PyMuPDF, React, Vite, Material UI</li>
      </ul>
    </div>
  </div>

  <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

  <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
    <div style={{background:'#ef44441a', padding:'10px', borderRadius:'10px', color:'#ef4444', display:'flex'}}><GavelIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>License</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Released under the <strong style={{color: '#f8fafc'}}>MIT License</strong></p>
    </div>
  </div>

  <div style={{height: '1px', background: '#1f2937', margin: '24px 0'}}></div>

  <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
    <div style={{background:'#64748b1a', padding:'10px', borderRadius:'10px', color:'#64748b', display:'flex'}}><GitHubIcon /></div>
    <div>
      <h3 style={{margin: 0, color: '#e2e8f0', fontSize: '16px'}}>Source Code</h3>
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Available on <a href="https://github.com/wizwin/WABS" target="_blank" rel="noopener noreferrer" style={{color: '#3b82f6', textDecoration: 'none'}}>GitHub</a></p>
    </div>
  </div>

</div>

<div style={{marginTop:'32px', padding:'24px', background:'linear-gradient(90deg, #1e293b 0%, #111827 100%)', borderRadius:'12px', borderLeft: '4px solid #3b82f6', maxWidth: '600px', width: '100%', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
  <p style={{color:'#cbd5e1', margin:'0', lineHeight: '1.6', fontSize: '15px'}}>A modern, cross-platform archival system for managing and searching your digital backups with AI-powered categorization and 100% offline capabilities.</p>
</div>

</div>
}

</div>

</>
)}
{showToast && (
  <div style={{
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
    gap: '8px',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'opacity 0.3s ease-in-out'
  }}>
    {toastMessage}
  </div>
)}
</div>
</SettingsContext.Provider>
)
}