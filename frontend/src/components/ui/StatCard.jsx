import React, { useState, useContext } from 'react';
import { SettingsContext } from '../../States';

export function StatCard({ title, value, icon, color, onClick }) {
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