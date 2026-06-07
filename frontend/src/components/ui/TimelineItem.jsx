import React, { useState, useEffect, useContext } from 'react';
import { SettingsContext } from '../../States';

export function TimelineItem({ dateKey, isActiveDate, onClick }) {
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