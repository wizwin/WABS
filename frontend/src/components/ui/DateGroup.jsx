import React, { useState, useEffect, useRef, Fragment } from 'react';
import { FileCard } from './FileCard';

export function DateGroup({ dateKey, filesGroup, viewMode, checkedFiles, toggleCheck, handleItemClick, openContainingFolder, setSelected, openFile, renderThumb, filterCategory, indexer, checkFileReadOnly, getImplicitSelection, pendingLocatePath }) {
  return (
    <div id={`date-group-${dateKey}`} style={{ contentVisibility: 'auto', containIntrinsicSize: '0 200px' }}>
      <h2 className="date-header" data-date={dateKey}>{dateKey}</h2>
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
    </div>
  );
}