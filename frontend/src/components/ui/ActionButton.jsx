import React, { useState, useContext } from 'react';
import { SettingsContext } from '../../States';

export function ActionButton({ disabled, onClick, children, className = "btn btn-secondary", style = {}, title, ...rest }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const { animationsEnabled } = useContext(SettingsContext);
  
  const isColorful = className.includes('btn-primary') || 
                     style.background === '#ef4444' || 
                     style.background === '#ef44442a' || 
                     style.background === '#3b82f6';
                     
  const finalClassName = `${className} ${isColorful ? 'preserve-colors' : ''}`.trim();

  return (
    <button 
      className={finalClassName} 
      disabled={disabled} 
      onClick={onClick}
      title={title}
      {...rest}
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => { setIsHovered(false); setIsActive(false); }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      style={{
        ...style,
        pointerEvents: disabled ? 'none' : (style.pointerEvents || 'auto'),
        opacity: disabled ? 0.5 : (style.opacity !== undefined ? style.opacity : 1),
        transition: animationsEnabled ? 'all 0.2s ease' : 'none', 
        transform: animationsEnabled && isActive && !disabled ? 'scale(0.95)' : animationsEnabled && isHovered && !disabled ? 'translateY(-2px)' : 'none', 
        boxShadow: animationsEnabled && isActive && !disabled ? '0 5px 10px -3px rgba(0,0,0,0.2)' : animationsEnabled && isHovered && !disabled ? '0 10px 15px -3px rgba(0,0,0,0.3)' : 'none'
      }}
    >
      {children}
    </button>
  );
}