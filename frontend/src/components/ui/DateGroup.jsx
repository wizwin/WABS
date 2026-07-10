import React, { useState, useEffect, useRef, Fragment } from 'react';
import { FileCard } from './FileCard';

export function DateGroup({ dateKey, filesGroup, viewMode, checkedFiles, toggleCheck, handleItemClick, openContainingFolder, setSelected, openFile, renderThumb, filterCategory, indexer, checkFileReadOnly, getImplicitSelection }) {
  const [isVisible, setIsVisible] = useState(false);
  const [minHeight, setMinHeight] = useState('100px');
  const groupRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
      } else {
        if (groupRef.current) {
          const rect = groupRef.current.getBoundingClientRect();
          if (rect.height > 50) {
            setMinHeight(`${rect.height}px`);
          }
        }
        setIsVisible(false);
      }
    }, { rootMargin: '2000px' });

    if (groupRef.current) observer.observe(groupRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div id={`date-group-${dateKey}`} ref={groupRef} style={{ minHeight }}>
      <h2 className="date-header" data-date={dateKey}>{dateKey}</h2>
      {isVisible && (
        <div className={viewMode === 'grid' ? 'grid' : 'list'}>
          {(() => {
            let isAlternateGroup = false;
            return filesGroup.map((item, index) => {
              const prevItem = index > 0 ? filesGroup[index - 1] : null;
              const isNewDuplicateGroup = filterCategory === 'duplicates' && prevItem && prevItem.size !== item.size;
              if (isNewDuplicateGroup) isAlternateGroup = !isAlternateGroup;
              const isImplicit = getImplicitSelection && getImplicitSelection(item.path);
              return (
                <Fragment key={item.path}>
                  {isNewDuplicateGroup && (
                    <div style={{ gridColumn: '1 / -1', width: '100%', height: '2px', background: '#3b82f6', margin: viewMode === 'grid' ? '8px 0' : '4px 0', opacity: 0.5, borderRadius: '2px' }} />
                  )}
                  <FileCard
                    item={item}
                    viewMode={viewMode}
                    isChecked={checkedFiles.has(item.path) || isImplicit}
                    isImplicit={isImplicit}
                    onToggleCheck={toggleCheck}
                    onClick={handleItemClick}
                    onContextMenu={openContainingFolder}
                    onSelectAndOpen={(i) => { setSelected(i); openFile(i.path); }}
                    renderThumb={renderThumb}
                    isAltGroup={isAlternateGroup}
                    showVerified={filterCategory === 'duplicates' && !!item.metadata?.sha256}
                    showUnverified={filterCategory === 'duplicates' && !item.metadata?.sha256}
                    isReadOnly={checkFileReadOnly(item.path)}
                    isProcessing={filterCategory === 'duplicates' && indexer?.hasher_running && indexer?.hasher_current_file === item.path}
                    hasSelections={checkedFiles.size > 0}
                  />
                </Fragment>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}