import {useEffect,useState,useMemo,useRef} from 'react'
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

const API='http://127.0.0.1:8000'

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{background:'#111827',padding:'16px',borderRadius:'16px',border:'1px solid #24324a', display:'flex', alignItems:'center', gap:'16px'}}>
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
const [stats,setStats]=useState({total:0,photos:0,videos:0,audio:0,documents:0,ebooks:0,code:0,fonts:0,databases:0,compressed:0,installers:0,binaries:0,others:0})
const [indexer,setIndexer]=useState({running:false,paused:false,stopped:false,current:0,total:0,current_file:'',status:'Idle',indexed:0})
const [sortBy,setSortBy]=useState('date')
const [sortOrder,setSortOrder]=useState('desc')
const [filterCategory, setFilterCategory] = useState('all')
const [viewMode, setViewMode] = useState('grid')
const [checkedFiles, setCheckedFiles] = useState(new Set())
const lastCheckedPath = useRef(null)
const [activeDate, setActiveDate] = useState('')
const observer = useRef(null)
const searchTimeout = useRef(null)
const [showSidebar, setShowSidebar] = useState(true)
const [showTimeline, setShowTimeline] = useState(true)
const [showDetails, setShowDetails] = useState(true)
const [sidebarWidth, setSidebarWidth] = useState(240)
const [timelineWidth, setTimelineWidth] = useState(150)
const [detailsWidth, setDetailsWidth] = useState(260)
const [isResizing, setIsResizing] = useState(null)
const [showSearchHelp, setShowSearchHelp] = useState(false)

async function loadFiles(nextOffset = 0, append = false, cat = filterCategory){
  const r = await axios.get(`${API}/files?category=${cat}&offset=${nextOffset}&limit=50`)
  if(append){
    setFiles(prev => [...prev, ...r.data])
  } else {
    setFiles(r.data)
  }
  setOffset(nextOffset + r.data.length)
  setHasMore(r.data.length === 50)
  if(!append){
    setSearchCache([])
  }
}

function doSearch(value, cat = filterCategory){
  setQuery(value)

  if(searchTimeout.current){
    clearTimeout(searchTimeout.current)
  }

  searchTimeout.current = setTimeout(async () => {
    if(!value){
      setPage('explorer')
      setSelected(null)
      await loadFiles(0, false, cat)
      return
    }

    setLoadingMore(true)
    setSelected(null)
    const r = await axios.get(`${API}/search?query=${encodeURIComponent(value)}&category=${cat}&offset=0&limit=50`)
    setSearchCache(r.data)
    setFiles(r.data)
    setOffset(r.data.length)
    setHasMore(r.data.length === 50)
    setPage('search')
    setLoadingMore(false)
  }, 600)
}

async function goToSearch(cat = filterCategory){
  setSelected(null)
  if(query){
    setLoadingMore(true)
    const r = await axios.get(`${API}/search?query=${encodeURIComponent(query)}&category=${cat}&offset=0&limit=50`)
    setSearchCache(r.data)
    setFiles(r.data)
    setOffset(r.data.length)
    setHasMore(r.data.length === 50)
    setLoadingMore(false)
  } else {
    setFiles([])
    setOffset(0)
    setHasMore(false)
  }
  setPage('search')
}

async function loadMore(){
  if(loadingMore || !hasMore) return

  setLoadingMore(true)
  if(page === 'explorer'){
    await loadFiles(offset, true, filterCategory)
  } else if(page === 'search'){
    const r = await axios.get(`${API}/search?query=${encodeURIComponent(query)}&category=${filterCategory}&offset=${offset}&limit=50`)
    setFiles(prev => [...prev, ...r.data])
    setSearchCache(prev => [...prev, ...r.data])
    setOffset(offset + r.data.length)
    setHasMore(r.data.length === 50)
  }
  setLoadingMore(false)
}

function handleScroll(e){
  const {scrollTop, scrollHeight, clientHeight} = e.currentTarget
  if(scrollHeight - scrollTop - clientHeight < 120){
    loadMore()
  }
}

async function loadSettings(){
 const r=await axios.get(`${API}/settings`)
 setSettings(r.data)
 if(r.data.show_sidebar !== undefined) setShowSidebar(r.data.show_sidebar)
 if(r.data.show_timeline !== undefined) setShowTimeline(r.data.show_timeline)
 if(r.data.show_details !== undefined) setShowDetails(r.data.show_details)
 if(r.data.sidebar_width) setSidebarWidth(r.data.sidebar_width)
 if(r.data.timeline_width) setTimelineWidth(r.data.timeline_width)
 if(r.data.details_width) setDetailsWidth(r.data.details_width)
}

async function saveSettings(){
 await axios.post(`${API}/settings`,settings)
 alert('Settings Saved')
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

async function loadDashboard(){
 const [statsRes, indexerRes] = await Promise.all([
   axios.get(`${API}/stats`),
   axios.get(`${API}/indexer/status`)
 ])
 setStats(prev => ({...prev, ...statsRes.data}))
 setIndexer(indexerRes.data)
}

async function indexerAction(action){
 if ((action === 'start' || action === 'update' || action === 'reindex') && indexer.running) {
   return;
 }

 if(action === 'reindex'){
   if(!window.confirm('Are you sure you want to completely re-index the archive? This will wipe the current database and may take a considerable amount of time for large backups.')) return;
   await axios.post(`${API}/indexer/reindex`)
   setFiles([])
   setSearchCache([])
   setSelected(null)
   setCheckedFiles(new Set())
   setOffset(0)
   setHasMore(false)
 } else {
   await axios.post(`${API}/indexer/${action}`)
 }
 await loadDashboard()
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
  if (checkedFiles.size === files.length) setCheckedFiles(new Set());
  else setCheckedFiles(new Set(files.map(f => f.path)));
};

async function deleteSelected() {
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

const handleFilterChange = (e) => {
  const newCat = e.target.value;
  setFilterCategory(newCat);
  setSelected(null);
  if (page === 'explorer') {
    loadFiles(0, false, newCat);
  } else if (page === 'search') {
    doSearch(query, newCat);
  }
};

const sortedFiles = useMemo(() => {
  const sorted = [...files].sort((a,b) => {
    let aVal, bVal;
    if(sortBy === 'date'){
      aVal = new Date(a.modified).getTime();
      bVal = new Date(b.modified).getTime();
    } else if(sortBy === 'size'){
      const parseSize = (s) => {
        const match = String(s).match(/(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)/i);
        if(!match) return 0;
        const num = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        const mult = {B:1, KB:1024, MB:1024**2, GB:1024**3}[unit];
        return num * mult;
      };
      aVal = parseSize(a.size || '0 B');
      bVal = parseSize(b.size || '0 B');
    } else if(sortBy === 'filename'){
      aVal = String(a.filename || '').toLowerCase();
      bVal = String(b.filename || '').toLowerCase();
    }
    if(sortOrder === 'asc'){
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  return sorted;
}, [files, sortBy, sortOrder]);

const groupedFiles = useMemo(() => {
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

useEffect(() => {
  observer.current = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setActiveDate(entry.target.getAttribute('data-date'));
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px' });
  return () => observer.current?.disconnect();
}, []);

const updateUIPreferences = (updates) => {
  setSettings(prev => {
    const next = { ...prev, ...updates };
    axios.post(`${API}/settings`, next).catch(e => console.warn(e));
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
  observer.current?.disconnect();
  document.querySelectorAll('.date-header').forEach(h => observer.current?.observe(h));
}, [groupedFiles, page]);

useEffect(()=>{
 loadFiles()
 loadSettings()
 loadDashboard()
},[])

useEffect(() => {
  let interval;
  if (indexer.running) {
    interval = setInterval(() => {
      loadDashboard();
    }, 1000); // Poll every 1 second while the indexer is running
  }
  return () => clearInterval(interval);
}, [indexer.running]);

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

return(
<div className='layout'>

{showSidebar && (
<>
<div className='sidebar' style={{ width: sidebarWidth }}>

<div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '8px 0' }}>
  <AppIcon size={40} />
  <div>
    <h2 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>WABS</h2>
    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>v1.0.0</div>
  </div>
</div>

<button onClick={()=>{ setPage('dashboard'); setSelected(null); }}>
<DashboardIcon fontSize="small" /> Dashboard
</button>

<button onClick={()=>{ setQuery(''); setPage('explorer'); setSelected(null); loadFiles(0, false)}}>
<FolderIcon fontSize="small" /> Explorer
</button>

<button onClick={()=>goToSearch()}>
<SearchIcon fontSize="small" /> Search
</button>

<button onClick={()=>{ setPage('settings'); setSelected(null); }}>
<SettingsIcon fontSize="small" /> Settings
</button>

<button onClick={()=>{ setPage('about'); setSelected(null); }}>
<InfoIcon fontSize="small" /> About
</button>

</div>
<div className={`resizer ${isResizing === 'sidebar' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('sidebar'); }} />
</>
)}

<div className='workspace'>

<div className='topbar' style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

<button
  onClick={toggleSidebar}
  style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showSidebar ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
  title="Toggle Sidebar"
>
  {showSidebar ? <MenuOpenIcon /> : <MenuIcon />}
</button>

<div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
  <input
    className='search'
    placeholder='Search files, tags, metadata...'
    value={query}
    onChange={(e)=>{ doSearch(e.target.value); setShowSearchHelp(false); }}
    style={{ flex: 1, margin: 0, paddingRight: '70px' }}
  />
  <div style={{ position: 'absolute', right: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
    {query && (
      <button
        onClick={() => { doSearch(''); setShowSearchHelp(false); }}
        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
        title="Clear search"
      >
        <CloseIcon fontSize="small" />
      </button>
    )}
    <button 
      onClick={() => setShowSearchHelp(!showSearchHelp)}
      style={{ background: 'transparent', border: 'none', color: showSearchHelp ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
      title="Search Help"
    >
      <HelpIcon fontSize="small" />
    </button>
  </div>
  {showSearchHelp && (
    <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '0', background: '#1e293b', border: '1px solid #334155', padding: '16px', zIndex: 100, borderRadius: '12px', width: '300px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', color: '#cbd5e1', fontSize: '13px' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#f8fafc', fontSize: '14px' }}>Search Patterns Supported</h4>
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <li><b>type:</b>mp3, audio, document</li>
        <li><b>name:</b>vacation (exact match)</li>
        <li><b>size:</b>300 (size match)</li>
        <li><b>length:</b>300 (metadata duration)</li>
        <li><b>date:</b>dd/mm/yyyy or yyyy</li>
        <li><b>*.mp3</b> or <b>*vacation*</b> (wildcards)</li>
      </ul>
      <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Combine multiple filters like: <br/><code style={{ background: '#0f172a', padding: '2px 4px', borderRadius: '4px', color: '#38bdf8' }}>*.mp3 type:audio length:300</code></p>
    </div>
  )}
</div>

{(page === 'explorer' || page === 'search') && (
  <div style={{ display: 'flex', gap: '8px' }}>
    <button
      onClick={toggleTimeline}
      style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showTimeline ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      title="Toggle Timeline"
    >
      <ViewTimelineIcon />
    </button>
    <button
      onClick={toggleDetails}
      style={{ padding: '8px', background: '#172033', border: 'none', borderRadius: '8px', color: showDetails ? '#3b82f6' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      title="Toggle Details"
    >
      <InfoIcon />
    </button>
  </div>
)}
</div>

{
(page==='explorer' || page==='search') &&
<div className='explorer'>

{showTimeline && (
<>
<div className='timeline' style={{ width: timelineWidth }}>
  {Object.keys(groupedFiles).map(dateKey => (
    <div
      key={dateKey}
      className={`timeline-item ${activeDate === dateKey ? 'active' : ''}`}
      onClick={() => document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'smooth' })}
    >
      {dateKey}
    </div>
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
      checked={checkedFiles.size > 0 && checkedFiles.size === files.length} 
      onChange={selectAll} 
    />
    Select All
  </label>

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
  </select>

  <label style={{marginLeft:'10px'}}>Sort by:</label>
  <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)}>
    <option value='date'>Date</option>
    <option value='size'>Size</option>
    <option value='filename'>Filename</option>
  </select>
  <button onClick={()=>setSortOrder(sortOrder==='asc'?'desc':'asc')}>
    {sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
  </button>

  <div style={{ flex: 1 }}></div>

  <div style={{ display: 'flex', gap: '4px', background: '#111827', padding: '4px', borderRadius: '8px' }}>
    <button 
      onClick={() => setViewMode('grid')} 
      style={{ padding: '6px', background: viewMode === 'grid' ? '#3b82f6' : 'transparent', color: viewMode === 'grid' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
    >
      <GridViewIcon fontSize="small" />
    </button>
    <button 
      onClick={() => setViewMode('list')} 
      style={{ padding: '6px', background: viewMode === 'list' ? '#3b82f6' : 'transparent', color: viewMode === 'list' ? 'white' : '#94a3b8', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex' }}
    >
      <ViewListIcon fontSize="small" />
    </button>
  </div>
</div>

{checkedFiles.size > 0 && (
  <div style={{ padding: '10px 18px', background: '#1e293b', borderBottom: '1px solid #1f2937', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ fontWeight: 'bold', color: '#3b82f6', marginRight: 'auto' }}>{checkedFiles.size} files selected</span>
    <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={openSelected}>Open Selected</button>
    <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={copySelected}>Copy Selected</button>
    <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={moveSelected}>Move Selected</button>
    <button className="btn btn-secondary" style={{ padding: '6px 12px', background: '#ef4444', borderColor: '#b91c1c', color: 'white' }} onClick={deleteSelected}>Delete Selected</button>
    <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setCheckedFiles(new Set())}>Clear Selection</button>
  </div>
)}

<div className='content' onScroll={handleScroll} style={{ paddingTop: '18px' }}>

{
Object.entries(groupedFiles).map(([dateKey, filesGroup]) => (
<div key={dateKey} id={`date-group-${dateKey}`}>
<h2 className="date-header" data-date={dateKey}>{dateKey}</h2>
<div className={viewMode === 'grid' ? 'grid' : 'list'}>
{
filesGroup.map((item)=>(
<div
className={viewMode === 'grid' ? 'card' : 'list-item'}
key={item.path}
onClick={(e)=>handleItemClick(e, item)}
onContextMenu={(e)=>{ e.preventDefault(); openContainingFolder(item.path); }}
>

{viewMode === 'grid' ? (
  <>
    <input type="checkbox" className="select-cb" checked={checkedFiles.has(item.path)} onChange={(e)=>toggleCheck(e, item.path)} onClick={(e)=>e.stopPropagation()} />
    <img
      src={renderThumb(item)}
      className='thumb'
      loading='lazy'
      onClick={(e)=>{ e.stopPropagation(); setSelected(item); openFile(item.path); }}
      onError={(e)=>{ e.target.src = renderThumb({...item, thumbnail: null}) }}
    />
    {item.category === 'video' && (
      <div className='overlay'>
        <PlayCircleIcon style={{ fontSize: 'inherit' }} />
      </div>
    )}
    <div className='info' style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px' }}>
      <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.filename}>{item.filename}</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8' }}>
        <span>{item.category}</span>
        <span>{item.size}</span>
      </div>
    </div>
  </>
) : (
  <>
    <input type="checkbox" className="select-cb list-cb" checked={checkedFiles.has(item.path)} onChange={(e)=>toggleCheck(e, item.path)} onClick={(e)=>e.stopPropagation()} />
    <img
      src={renderThumb(item)}
      className='list-thumb'
      loading='lazy'
      onClick={(e)=>{ e.stopPropagation(); setSelected(item); openFile(item.path); }}
      onError={(e)=>{ e.target.src = renderThumb({...item, thumbnail: null}) }}
    />
    <div className="list-info">
      <p className="list-title">{item.filename}</p>
      <p className="list-meta">
        <span>{item.category}</span>
        <span>{item.size}</span>
        <span>{item.modified}</span>
      </p>
    </div>
    {item.category === 'video' && (
      <PlayCircleIcon style={{ color: '#94a3b8', marginRight: '12px' }} />
    )}
  </>
)}

</div>
))
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

<p><b>Size:</b> {selected.size}</p>

<p><b>Modified:</b> {selected.modified}</p>

{selected.metadata?.gps && (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
    <b>Location:</b>
    <button 
      className="btn btn-secondary" 
      style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#3b82f6', color: '#3b82f6' }}
      onClick={() => window.open(`https://www.google.com/maps?q=${selected.metadata.gps.latitude},${selected.metadata.gps.longitude}`, '_blank')}
    >
      <PlaceIcon fontSize="small" /> View on Map
    </button>
  </div>
)}

<h3>Metadata</h3>

<p><b>File ID:</b> {selected.id}</p>
<div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'16px'}}>
 <button className="btn btn-secondary" onClick={()=>openFile(selected.path)}>Open File</button>
 <button className="btn btn-secondary" onClick={()=>openContainingFolder(selected.path)}>Open Containing Folder</button>
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
page==='dashboard' &&
<div style={{padding:'20px', overflowY:'auto', height:'100%'}}>
<h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 0 }}><DashboardIcon fontSize="large" style={{ color: '#3b82f6' }} /> Dashboard</h1>
<p>Archive overview, statistics, and indexing controls.</p>
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'16px',marginTop:'20px'}}>
<StatCard title="Total Files" value={stats.total} icon={<LibraryBooksIcon />} color="#3b82f6" />
<StatCard title="Photos" value={stats.photos} icon={<ImageIcon />} color="#10b981" />
<StatCard title="Videos" value={stats.videos} icon={<MovieIcon />} color="#ef4444" />
<StatCard title="Audio" value={stats.audio} icon={<AudiotrackIcon />} color="#f59e0b" />
<StatCard title="Documents" value={stats.documents} icon={<DescriptionIcon />} color="#8b5cf6" />
<StatCard title="eBooks" value={stats.ebooks} icon={<MenuBookIcon />} color="#ec4899" />
<StatCard title="Code" value={stats.code} icon={<CodeIcon />} color="#06b6d4" />
<StatCard title="Fonts" value={stats.fonts} icon={<FontDownloadIcon />} color="#f43f5e" />
<StatCard title="Databases" value={stats.databases} icon={<StorageIcon />} color="#eab308" />
<StatCard title="Compressed" value={stats.compressed} icon={<ArchiveIcon />} color="#6366f1" />
<StatCard title="Installers" value={stats.installers} icon={<SystemUpdateIcon />} color="#14b8a6" />
<StatCard title="Binaries" value={stats.binaries} icon={<MemoryIcon />} color="#64748b" />
<StatCard title="Others" value={stats.others} icon={<CategoryIcon />} color="#94a3b8" />
</div>
<div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:'18px',marginTop:'24px'}}>
<div style={{background:'#111827',padding:'18px',borderRadius:'16px',border:'1px solid #24324a'}}>
<h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><AnalyticsIcon style={{ color: '#3b82f6' }} /> Indexing Status</h2>
<p><b>Status:</b> {indexer.status}</p>
<p><b>Running:</b> {indexer.running ? 'Yes' : 'No'}</p>
<p><b>Paused:</b> {indexer.paused ? 'Yes' : 'No'}</p>
<p><b>Indexed:</b> {indexer.indexed}</p>
<p><b>Progress:</b> {indexer.current} / {indexer.total}</p>
<p style={{wordBreak:'break-word'}}><b>Current File:</b> {indexer.current_file || '—'}</p>
</div>
<div style={{background:'#111827',padding:'18px',borderRadius:'16px',border:'1px solid #24324a'}}>
<h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0 }}><SettingsApplicationsIcon style={{ color: '#3b82f6' }} /> Indexer Controls</h2>
<div style={{display:'grid',gap:'10px',marginTop:'12px'}}>
<button className="btn btn-secondary" disabled={indexer.running} onClick={()=>indexerAction('start')}>
Start
</button>
<button className="btn btn-secondary" disabled={indexer.running} onClick={()=>indexerAction('update')}>
Update
</button>
<button className="btn btn-secondary" disabled={!indexer.running || indexer.paused || indexer.stopped} onClick={()=>indexerAction('pause')}>
Pause
</button>
<button className="btn btn-secondary" disabled={(indexer.running && !indexer.paused) || indexer.stopped} onClick={()=>indexerAction('resume')}>
Resume
</button>
<button className="btn btn-secondary" disabled={!indexer.running || indexer.stopped} onClick={()=>indexerAction('stop')}>
Stop
</button>
<button className="btn btn-secondary" disabled={indexer.running} onClick={()=>indexerAction('reindex')}>
Re-index
</button>
</div>
</div>
</div>
</div>
}

{
page==='settings' &&
<div style={{padding:'20px', overflow:'auto', height:'100%'}}>

<h1>Settings</h1>

<h3>View Preferences</h3>

<label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
<input type='checkbox' checked={showSidebar} onChange={toggleSidebar} /> Show Sidebar
</label>
<label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
<input type='checkbox' checked={showTimeline} onChange={toggleTimeline} /> Show Timeline
</label>
<label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'24px'}}>
<input type='checkbox' checked={showDetails} onChange={toggleDetails} /> Show Details
</label>

<h3>Storage</h3>

<p>Backup Path</p>

<div style={{display:'flex',gap:'10px', marginBottom: '14px'}}>
<input
className='setting'
style={{ marginBottom: 0 }}
value={settings.backup_path || ''}
onChange={(e)=>setSettings({
...settings,
backup_path:e.target.value
})}
/>
<button className="btn btn-secondary" onClick={()=>choosePath('backup_path','directory')}>Select</button>
</div>

<p>Database Path</p>

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
<button className="btn btn-secondary" onClick={()=>choosePath('database_path','file')}>Select</button>
</div>

<p>Thumbnail Path</p>

<div style={{display:'flex',gap:'10px', marginBottom: '14px'}}>
<input
className='setting'
style={{ marginBottom: 0 }}
value={settings.thumbnail_path || ''}
onChange={(e)=>setSettings({
...settings,
thumbnail_path:e.target.value
})}
/>
<button className="btn btn-secondary" onClick={()=>choosePath('thumbnail_path','directory')}>Select</button>
</div>

<h3>Drive Mapping</h3>

<label style={{display:'flex',alignItems:'center',gap:'10px'}}>
<input
 type='checkbox'
 checked={settings.path_mapping_enabled || false}
 onChange={(e)=>setSettings({
 ...settings,
 path_mapping_enabled:e.target.checked
 })}
/>
 Enable portable drive path remapping
</label>

{settings.path_mapping_enabled && (
  <>
    <p style={{marginTop:'14px'}}>New Backup Base Path</p>
    <div style={{display:'flex',gap:'10px', marginBottom: '14px'}}>
      <input
        className='setting'
        style={{ marginBottom: 0 }}
        value={settings.backup_path || ''}
        onChange={(e)=>setSettings({
          ...settings,
          backup_path:e.target.value
        })}
      />
      <button className="btn btn-secondary" onClick={()=>choosePath('backup_path','directory')}>Select</button>
    </div>

    <p style={{marginTop:'14px'}}>Original Indexed Base Path</p>
    <div style={{padding:'12px',border:'1px solid #24324a',borderRadius:'10px',background:'#0f172a',color:'#d1d5db'}}>
      {settings.original_backup_path || 'Not available yet'}
    </div>
  </>
)}

<p style={{color:'#94a3b8',fontSize:'13px',marginTop:'10px'}}>
When enabled, WABS will use the current Backup Path as the new base and resolve missing indexed files by preserving the relative path under the original indexed root.
</p>

<h3>AI / LLM</h3>

<label>
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

<p>AI Provider Base URL (Leave empty for OpenAI)</p>

<input
className='setting'
value={settings.ai_provider || ''}
onChange={(e)=>setSettings({
...settings,
ai_provider:e.target.value
})}
/>

<p>AI Model</p>

<input
className='setting'
value={settings.ai_model || ''}
onChange={(e)=>setSettings({
...settings,
ai_model:e.target.value
})}
/>

<p>OpenAI API Key</p>

<input
type='password'
className='setting'
value={settings.openai_api_key || ''}
onChange={(e)=>setSettings({
...settings,
openai_api_key:e.target.value
})}
/>

<button className="btn btn-primary" style={{ marginTop: '20px', padding: '12px 24px', fontSize: '15px' }} onClick={saveSettings}>
<SettingsIcon fontSize="small" />
Save Settings
</button>

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
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Current Release: <strong style={{color: '#f8fafc'}}>v1.0.0</strong></p>
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
      <p style={{color:'#94a3b8', margin: '4px 0 0 0', fontSize: '14px'}}>Available on <a href="https://github.com/dummy-repo/WABS" target="_blank" rel="noopener noreferrer" style={{color: '#3b82f6', textDecoration: 'none'}}>GitHub</a></p>
    </div>
  </div>

</div>

<div style={{marginTop:'32px', padding:'24px', background:'linear-gradient(90deg, #1e293b 0%, #111827 100%)', borderRadius:'12px', borderLeft: '4px solid #3b82f6', maxWidth: '600px', width: '100%', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
  <p style={{color:'#cbd5e1', margin:'0', lineHeight: '1.6', fontSize: '15px'}}>A modern, cross-platform archival system for managing and searching your digital backups with AI-powered categorization and 100% offline capabilities.</p>
</div>

</div>
}

</div>

</div>
)
}