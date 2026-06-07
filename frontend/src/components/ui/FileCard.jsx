import React, { useState, useEffect, useRef, useContext } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import { formatSize, SettingsContext } from '../../States';

export function FileCard({ item, viewMode, isChecked, onToggleCheck, onClick, onContextMenu, onSelectAndOpen, renderThumb, isAltGroup, showVerified, showUnverified, isReadOnly, isProcessing }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [imgError, setImgError] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);

  const retryCount = useRef(0);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset error state if the item's underlying thumbnail changes
  useEffect(() => {
    setImgError(false);
    retryCount.current = 0;
    setRetryKey(0);
  }, [item.thumbnail]);

  const handleImageError = () => {
    if (retryCount.current < 3) {
      retryCount.current += 1;
      setTimeout(() => {
        setImgError(false);
        setRetryKey(prev => prev + 1);
      }, 1500 * retryCount.current); // Exponential backoff to bypass TCP queue limits
    } else {
      setImgError(true);
    }
  };

  let currentSrc = imgError ? renderThumb({ ...item, thumbnail: null }) : renderThumb(item);
  if (!imgError && retryKey > 0 && !currentSrc.startsWith('data:')) {
      currentSrc += (currentSrc.includes('?') ? '&' : '?') + `retry=${retryKey}`;
  }

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
            src={currentSrc}
            className='thumb'
            loading='lazy'
            style={{ minHeight: '150px' }}
            onClick={(e) => { e.stopPropagation(); onSelectAndOpen(item); }}
            onError={handleImageError}
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
            src={currentSrc}
            className='list-thumb'
            loading='lazy'
            style={{ minHeight: '60px', minWidth: '60px' }}
            onClick={(e) => { e.stopPropagation(); onSelectAndOpen(item); }}
            onError={handleImageError}
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