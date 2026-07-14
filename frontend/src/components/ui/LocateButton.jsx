import React, { useState, useEffect, useRef } from 'react';
import PlaceIcon from '@mui/icons-material/Place';
import { ActionButton } from './ActionButton';

export function LocateButton({ locateSelectedFile, style = {} }) {
  const [isLocateMenuOpen, setIsLocateMenuOpen] = useState(false);
  const locateMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (locateMenuRef.current && !locateMenuRef.current.contains(e.target)) {
        setIsLocateMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonStyle = {
    padding: '5px 10px',
    fontSize: '13px',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    ...style
  };

  const optionButtonStyle = {
    background: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    width: '100%'
  };

  return (
    <div ref={locateMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
      <ActionButton
        className="btn btn-secondary"
        style={buttonStyle}
        onClick={() => setIsLocateMenuOpen(!isLocateMenuOpen)}
      >
        <PlaceIcon style={{ fontSize: '15px' }} /> Locate
      </ActionButton>
      {isLocateMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '32px',
          left: 0,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          padding: '6px 0',
          zIndex: 1000,
          minWidth: '160px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <button
            onClick={() => {
              setIsLocateMenuOpen(false);
              locateSelectedFile('tree');
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            style={optionButtonStyle}
          >
            📁 Folder (Tree View)
          </button>
          <button
            onClick={() => {
              setIsLocateMenuOpen(false);
              locateSelectedFile('flat');
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            style={optionButtonStyle}
          >
            📋 Flat List (Flat View)
          </button>
          <button
            onClick={() => {
              setIsLocateMenuOpen(false);
              locateSelectedFile('virtual_folder');
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#334155'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            style={optionButtonStyle}
          >
            ⭐ Virtual Folder
          </button>
        </div>
      )}
    </div>
  );
}
