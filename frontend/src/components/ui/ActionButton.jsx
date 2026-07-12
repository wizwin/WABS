import React, { useState, useContext } from 'react';
import { SettingsContext } from '../../States';

export function ActionButton({ disabled, onClick, children, className = "btn btn-secondary", style = {}, title, ...rest }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const { animationsEnabled, theme } = useContext(SettingsContext);
  
  const isColorful = className.includes('btn-primary') || 
                     (style.background && (
                       style.background === '#ef4444' || 
                       style.background === '#ef44442a' || 
                       style.background === '#3b82f6' ||
                       style.background.includes('linear-gradient')
                     ));
                     
  const finalClassName = `${className} ${isColorful ? 'preserve-colors' : ''}`.trim();

  const getHoverShadow = () => {
    if (!style.boxShadow || style.boxShadow === 'none') {
      return '0 10px 15px -3px rgba(0,0,0,0.3)';
    }
    return style.boxShadow
      .replace('0 4px 14px 0 rgba(139, 92, 246, 0.4)', '0 8px 20px 0 rgba(139, 92, 246, 0.6)');
  };

  const getActiveShadow = () => {
    if (!style.boxShadow || style.boxShadow === 'none') {
      return '0 5px 10px -3px rgba(0,0,0,0.2)';
    }
    return style.boxShadow
      .replace('0 4px 14px 0 rgba(139, 92, 246, 0.4)', '0 2px 6px 0 rgba(139, 92, 246, 0.2)');
  };

  const getFilter = () => {
    if (style.filter) return style.filter;
    const hoverFilter = isHovered && !disabled ? 'brightness(1.1)' : '';
    
    // In light theme, colorful buttons are inverted via CSS class .preserve-colors.
    // If we set inline filter, it overrides the class filter, so we must include the inversion inline.
    if (theme === 'light' && isColorful) {
      return hoverFilter 
        ? `invert(1) hue-rotate(180deg) ${hoverFilter}` 
        : 'invert(1) hue-rotate(180deg)';
    }
    
    return hoverFilter || 'none';
  };

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
        boxShadow: animationsEnabled && isActive && !disabled 
          ? getActiveShadow() 
          : animationsEnabled && isHovered && !disabled 
            ? getHoverShadow() 
            : (style.boxShadow || 'none'),
        filter: getFilter()
      }}
    >
      {children}
    </button>
  );
}