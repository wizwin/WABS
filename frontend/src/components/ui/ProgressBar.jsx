import React from 'react';

export function ProgressBar({ current = 0, total = 0, color = '#3b82f6' }) {
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