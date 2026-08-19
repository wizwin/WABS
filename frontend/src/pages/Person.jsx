import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import FaceIcon from '@mui/icons-material/Face';
import ImageIcon from '@mui/icons-material/Image';
import PlaceIcon from '@mui/icons-material/Place';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import { ActionButton } from '../components/ui/ActionButton';
import { TimelineItem } from '../components/ui/TimelineItem';
import { DateGroup } from '../components/ui/DateGroup';
import { PersonThumb } from '../components/ui/PersonThumb';
import { SelectionBar } from '../components/ui/SelectionBar';
import AddToFolderModal from '../components/ui/AddToFolderModal';
import { API, formatSize } from '../States';

function HoverableImage({ item, renderThumb, style, onClick, title, className }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [item?.thumbnail, item?.path]);

  if (!item) return null;

  const isGif = Boolean(
    (item.extension && item.extension.toLowerCase().includes('gif')) ||
    (item.filename && item.filename.toLowerCase().endsWith('.gif')) ||
    (item.path && item.path.toLowerCase().endsWith('.gif'))
  );

  const src = imgError
    ? renderThumb({ ...item, thumbnail: null })
    : renderThumb(item, { animated: isGif && isHovered });

  return (
    <img
      src={src}
      className={className}
      style={style}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      onError={() => setImgError(true)}
    />
  );
}

export default function Person(props) {
  const { 
    page, setPage, showTimeline, timelineWidth, timelineItems, activeDate, settings,
    fullTimelineData, setLoadingMore, currentPerson, setPersonFiles, setOffset,
    setStartOffset, setHasMore, isResizing, setIsResizing, setCheckedFiles,
    setSelected, setSimilarUnknowns, loadPeople, autoSuggestThumbnail,
    isFindingSimilar, stopFindSimilarUnknowns, showSimilarPanel, similarUnknowns,
    setShowSimilarPanel, setSimilarUnknownsPage, setCheckedSimilar, similarityThreshold,
    setSimilarityThreshold, findSimilarUnknowns, visibleSimilar, similarUnknownsPage,
    checkedSimilar, getPersonThumbUrl, indexer, showToastMessage, openPersonPhotos,
    checkedFiles, globalFileCache, setPersonThumbnail, locateSelectedFileInExplorer,
    actionInProgress, isTaggingPerson, setIsTaggingPerson, movePhotosToPerson,
    sortedNamedPeopleDropdown, removePersonPhotosBulk, startOffset, loadingPrevious,
    personFiles, viewMode, groupedPersonFiles, toggleCheck, handleItemClick,
    openContainingFolder, openFile, renderThumb, checkFileReadOnly, hasMore,
    loadingMore, showDetails, detailsWidth, selected, personPreviewPhotos,
    renderMetadata, handleScroll, dataOpProgress, savePersonCategory,
    personConnections, addPersonConnection, removePersonConnection, savePersonScroll
  } = props;

  const [isAddToFolderOpen, setIsAddToFolderOpen] = useState(false);
  const [isAddToFolderMoveMode, setIsAddToFolderMoveMode] = useState(false);
  const [showAddConnectionModal, setShowAddConnectionModal] = useState(false);
  const [newConnType, setNewConnType] = useState('spouse');
  const [newConnPersonId, setNewConnPersonId] = useState('');

  const openAddToFolder = (isMove = false) => {
    setIsAddToFolderMoveMode(isMove);
    setIsAddToFolderOpen(true);
  };
  const isTaskActive = indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running || indexer.data_operation_running || actionInProgress || !!dataOpProgress;

  const [localCategory, setLocalCategory] = useState(currentPerson?.category || '');
  const [localSubcategory, setLocalSubcategory] = useState(currentPerson?.subcategory || '');
  const [localRelationLabel, setLocalRelationLabel] = useState(currentPerson?.relation_label || '');

  const isMePerson = currentPerson?.is_me || (currentPerson?.name && (settings?.me_name || '').toLowerCase() === currentPerson.name.toLowerCase());

  React.useEffect(() => {
    setLocalCategory(currentPerson?.category || '');
    setLocalSubcategory(currentPerson?.subcategory || '');
    setLocalRelationLabel(currentPerson?.relation_label || '');
  }, [currentPerson?.id, currentPerson?.category, currentPerson?.subcategory, currentPerson?.relation_label]);

  const isRelChanged = (
    (localCategory || '') !== (currentPerson?.category || '') ||
    (localSubcategory || '') !== (currentPerson?.subcategory || '') ||
    (localRelationLabel || '') !== (currentPerson?.relation_label || '')
  );

  const handleSaveRelationship = () => {
    if (!currentPerson) return;
    savePersonCategory(
      currentPerson.id,
      localCategory || null,
      localCategory ? (localSubcategory || null) : null,
      localCategory ? (localRelationLabel || '') : ''
    );
  };

  const handleCancelRelationship = () => {
    setLocalCategory(currentPerson?.category || '');
    setLocalSubcategory(currentPerson?.subcategory || '');
    setLocalRelationLabel(currentPerson?.relation_label || '');
  };

  return (
    <>
        {
        page==='person_files' &&
        <div className='explorer'>
        {showTimeline && (
        <>
        <div className='timeline' style={{ width: timelineWidth, position: 'relative' }}>
        {timelineItems.length > 0 && (
            <ActionButton
            className="btn btn-secondary"
            onClick={() => {
                document.querySelector('.content')?.scrollTo({ top: 0, behavior: 'smooth' });
                document.querySelector('.timeline')?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ margin: '8px auto', padding: '4px 12px', width: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid #334155', color: '#94a3b8', position: 'sticky', top: '8px', zIndex: 10, borderRadius: '16px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' }}
            title="Jump to Top"
            >
            <ArrowUpwardIcon style={{ fontSize: '16px' }} /> Top
            </ActionButton>
        )}
        {timelineItems.map(dateKey => (
            <TimelineItem
            key={dateKey}
            dateKey={dateKey}
            isActiveDate={activeDate === dateKey}
            onClick={() => {
                const el = document.getElementById(`date-group-${dateKey}`);
                if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
                } else {
                const showFull = settings.show_full_timeline || settings.ui_preferences?.show_full_timeline;
                if (showFull) {
                    const tData = fullTimelineData.find(t => t.key === dateKey);
                    if (tData) {
                        const targetOffset = tData.offsetDesc;
                        const chunkSize = settings.lazy_load_chunk_size ?? settings?.ui_preferences?.lazy_load_chunk_size ?? 50;
                        const limit = settings.disable_lazy_loading || settings?.ui_preferences?.disable_lazy_loading ? 100000 : chunkSize;
                        
                        setLoadingMore(true);
                        axios.get(`${API}/people/${currentPerson.id}/photos?offset=${targetOffset}&limit=${limit}`).then(res => {
                            setPersonFiles(res.data);
                            setOffset(targetOffset + res.data.length);
                            setStartOffset(targetOffset);
                            setHasMore(res.data.length === limit);
                            setLoadingMore(false);
                            setTimeout(() => document.getElementById(`date-group-${dateKey}`)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 100);
                        }).catch(() => setLoadingMore(false));
                    }
                }
                }
            }}
            />
        ))}
        {timelineItems.length > 0 && (
            <ActionButton
            className="btn btn-secondary"
            onClick={() => {
                const content = document.querySelector('.content');
                content?.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
                const timeline = document.querySelector('.timeline');
                timeline?.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
            }}
            style={{ margin: '8px auto', padding: '4px 12px', width: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid #334155', color: '#94a3b8', position: 'sticky', bottom: '8px', zIndex: 10, borderRadius: '16px', fontSize: '12px', boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.2)' }}
            title="Jump to Bottom"
            >
            <ArrowDownwardIcon style={{ fontSize: '16px' }} /> Bottom
            </ActionButton>
        )}
        </div>
        <div className={`resizer ${isResizing === 'timeline' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('timeline'); }} />
        </>
        )}
        <div style={{display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0}}>
        <div style={{padding: '18px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '16px'}}>
            <ActionButton className="btn btn-secondary" onClick={() => { 
            if (savePersonScroll) savePersonScroll(currentPerson?.id);
            setPage('people'); 
            setCheckedFiles(new Set()); 
            setSelected(null);
            setSimilarUnknowns(null); 
            loadPeople(); 
            setTimeout(() => {
                const el = document.getElementById(`person-card-${currentPerson?.id}`);
                if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            }}>&larr; Back to People</ActionButton>
            <h2 style={{margin: 0}}>{currentPerson?.name}'s Photos</h2>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ActionButton 
                    className="btn btn-secondary" 
                    disabled={isTaskActive}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', borderColor: '#059669' }}
                    onClick={() => autoSuggestThumbnail(currentPerson.id)}
                    title="Automatically analyze photos to pick the clearest and largest face for the cover."
                >
                    <ImageIcon fontSize="small" /> Auto-Pick Cover
                </ActionButton>
                {!currentPerson?.name?.startsWith('Unknown Person') && (
                    isFindingSimilar ? (
                        <ActionButton 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#b91c1c' }}
                            onClick={stopFindSimilarUnknowns}
                        >
                            <CloseIcon fontSize="small" /> Stop Searching
                        </ActionButton>
                    ) : (
                        showSimilarPanel || similarUnknowns ? (
                        <ActionButton 
                            className="btn btn-secondary" 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#b91c1c' }}
                            onClick={() => {
                            setShowSimilarPanel(false);
                            setSimilarUnknowns(null);
                            setSimilarUnknownsPage(1);
                            setCheckedSimilar(new Set());
                            if (selected?.is_person) setSelected(null);
                            }}
                        >
                            <CloseIcon fontSize="small" /> Close Panel
                        </ActionButton>
                        ) : (
                        <ActionButton 
                            className="btn btn-secondary" 
                            disabled={isTaskActive}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', borderColor: '#3b82f6' }}
                            onClick={() => setShowSimilarPanel(true)}
                        >
                            <FaceIcon fontSize="small" /> Find Similar Unknowns
                        </ActionButton>
                        )
                    )
                )}
            </div>
        </div>

        {/* Primary Identity Badge for 'Me' Profile */}
        {currentPerson && !currentPerson.name?.startsWith('Unknown Person') && isMePerson && (
          <div style={{ padding: '10px 18px', background: 'rgba(37, 99, 235, 0.12)', borderBottom: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', background: '#3b82f6', color: '#0f172a', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                ★ Primary User Identity (Me)
              </span>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                Central root of your family & social network. All relationships are anchored to you.
              </span>
            </div>
          </div>
        )}

        {/* Inline Relationship Categorization Bar (for non-Me profiles) */}
        {currentPerson && !currentPerson.name?.startsWith('Unknown Person') && !isMePerson && (
          <div style={{ padding: '10px 18px', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>Relationship:</span>
              <select
                value={localCategory || ''}
                onChange={(e) => {
                  const newCat = e.target.value;
                  setLocalCategory(newCat);
                  if (newCat === 'Family' && !localSubcategory) setLocalSubcategory('Spouse');
                  else if (newCat === 'Friends' && !localSubcategory) setLocalSubcategory('Close Friend');
                  else if (newCat === 'Others' && !localSubcategory) setLocalSubcategory('Neighbor');
                  else if (!newCat) {
                    setLocalSubcategory('');
                    setLocalRelationLabel('');
                  }
                }}
                disabled={isTaskActive}
                style={{ padding: '4px 8px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', outline: 'none', fontSize: '13px' }}
              >
                <option value="">— Uncategorized —</option>
                <option value="Family">🏠 Family</option>
                <option value="Friends">👥 Friends</option>
                <option value="Others">🌐 Others</option>
              </select>
            </div>

            {localCategory && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Type:</span>
                <select
                  value={localSubcategory || ''}
                  onChange={(e) => setLocalSubcategory(e.target.value)}
                  disabled={isTaskActive}
                  style={{ padding: '4px 8px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', outline: 'none', fontSize: '13px' }}
                >
                  {localCategory === 'Family' && (
                    <>
                      <option value="Spouse">Spouse / Partner</option>
                      <option value="Parent">Parent (Father / Mother)</option>
                      <option value="Child">Child (Son / Daughter)</option>
                      <option value="Sibling">Sibling (Brother / Sister)</option>
                      <option value="In-law">In-law (Parents / Siblings / Extended In-laws)</option>
                      <option value="Spouse's Family">Spouse's Extended Family (Aunts / Uncles / Cousins)</option>
                      <option value="Grandparent">Grandparent (Maternal / Paternal)</option>
                      <option value="Grandchild">Grandchild (Grandson / Granddaughter)</option>
                      <option value="Great-Grandparent">Great-Grandparent / Ancestor</option>
                      <option value="Aunt / Uncle">Aunt / Uncle (Parents' Siblings)</option>
                      <option value="Great-Aunt / Uncle">Great-Aunt / Great-Uncle (Grandparents' Siblings)</option>
                      <option value="Cousin (1st)">Cousin (1st - Parents' Siblings' Children)</option>
                      <option value="Cousin (Once Removed)">Cousin (Once Removed - Parents' / Grandparents' Cousins)</option>
                      <option value="Cousin (2nd / Distant)">Cousin (2nd / 3rd / Distant)</option>
                      <option value="Niece / Nephew">Niece / Nephew (Siblings' Children)</option>
                      <option value="Other Family">Other Family / Relative</option>
                    </>
                  )}
                  {localCategory === 'Friends' && (
                    <>
                      <option value="Close Friend">Close Friend</option>
                      <option value="Colleague">Colleague / Work</option>
                      <option value="Classmate">Classmate / School</option>
                      <option value="Acquaintance">Acquaintance</option>
                      <option value="Other Friend">Other Friend</option>
                    </>
                  )}
                  {localCategory === 'Others' && (
                    <>
                      <option value="Neighbor">Neighbor</option>
                      <option value="Service Contact">Service Contact</option>
                      <option value="Unknown">Other</option>
                    </>
                  )}
                </select>
              </div>
            )}

            {localCategory && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>Custom Label:</span>
                <input
                  list="relationship-label-suggestions"
                  type="text"
                  placeholder='e.g. "Wife&#39;s Brother", "Mother-in-law", "Spouse&#39;s Cousin"'
                  value={localRelationLabel || ''}
                  onChange={(e) => setLocalRelationLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRelationship();
                    else if (e.key === 'Escape') handleCancelRelationship();
                  }}
                  disabled={isTaskActive}
                  style={{ padding: '4px 10px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', outline: 'none', fontSize: '13px', flex: 1, maxWidth: '260px' }}
                />
                <datalist id="relationship-label-suggestions">
                  {/* Family Suggestions */}
                  {localSubcategory === 'Spouse' && (
                    <>
                      <option value="Wife" />
                      <option value="Husband" />
                      <option value="Partner" />
                      <option value="Fiancée" />
                      <option value="Fiancé" />
                    </>
                  )}
                  {localSubcategory === 'Parent' && (
                    <>
                      <option value="Mother" />
                      <option value="Father" />
                      <option value="Mom" />
                      <option value="Dad" />
                      <option value="Stepmother" />
                      <option value="Stepfather" />
                    </>
                  )}
                  {localSubcategory === 'Child' && (
                    <>
                      <option value="Son" />
                      <option value="Daughter" />
                      <option value="Eldest Son" />
                      <option value="Youngest Son" />
                      <option value="Eldest Daughter" />
                      <option value="Youngest Daughter" />
                      <option value="Stepson" />
                      <option value="Stepdaughter" />
                    </>
                  )}
                  {localSubcategory === 'Sibling' && (
                    <>
                      <option value="Brother" />
                      <option value="Sister" />
                      <option value="Elder Brother" />
                      <option value="Younger Brother" />
                      <option value="Elder Sister" />
                      <option value="Younger Sister" />
                      <option value="Stepbrother" />
                      <option value="Stepsister" />
                    </>
                  )}
                  {(localSubcategory === 'In-law' || localSubcategory === "Spouse's Family") && (
                    <>
                      <option value="Mother-in-law (Spouse's Mother)" />
                      <option value="Father-in-law (Spouse's Father)" />
                      <option value="Brother-in-law (Spouse's Brother / Sister's Husband)" />
                      <option value="Sister-in-law (Spouse's Sister / Brother's Wife)" />
                      <option value="Son-in-law (Daughter's Husband)" />
                      <option value="Daughter-in-law (Son's Wife)" />
                      <option value="Co-Brother (Spouse's Sister's Husband)" />
                      <option value="Co-Sister (Spouse's Brother's Wife)" />
                      <option value="Cousin-in-law (1st Cousin's Wife / Husband)" />
                      <option value="Cousin's Wife (1st Cousin's Wife)" />
                      <option value="Cousin's Husband (1st Cousin's Husband)" />
                      <option value="Spouse's Maternal Uncle (Uncle-in-law)" />
                      <option value="Spouse's Maternal Aunt (Aunt-in-law)" />
                      <option value="Spouse's Paternal Uncle (Uncle-in-law)" />
                      <option value="Spouse's Paternal Aunt (Aunt-in-law)" />
                      <option value="Spouse's 1st Cousin (Spouse's Cousin)" />
                      <option value="Spouse's Grandfather" />
                      <option value="Spouse's Grandmother" />
                      <option value="Spouse's Nephew / Niece" />
                    </>
                  )}
                  {localSubcategory === 'Grandparent' && (
                    <>
                      <option value="Maternal Grandmother (Mother's Mom)" />
                      <option value="Maternal Grandfather (Mother's Dad)" />
                      <option value="Paternal Grandmother (Father's Mom)" />
                      <option value="Paternal Grandfather (Father's Dad)" />
                      <option value="Grandmother" />
                      <option value="Grandfather" />
                    </>
                  )}
                  {localSubcategory === 'Great-Grandparent' && (
                    <>
                      <option value="Maternal Great-Grandmother" />
                      <option value="Maternal Great-Grandfather" />
                      <option value="Paternal Great-Grandmother" />
                      <option value="Paternal Great-Grandfather" />
                    </>
                  )}
                  {localSubcategory === 'Grandchild' && (
                    <>
                      <option value="Grandson" />
                      <option value="Granddaughter" />
                      <option value="Great-Grandson" />
                      <option value="Great-Granddaughter" />
                    </>
                  )}
                  {localSubcategory === 'Aunt / Uncle' && (
                    <>
                      <option value="Maternal Uncle (Mother's Brother)" />
                      <option value="Maternal Aunt (Mother's Sister)" />
                      <option value="Paternal Uncle (Father's Brother)" />
                      <option value="Paternal Aunt (Father's Sister)" />
                      <option value="Uncle" />
                      <option value="Aunt" />
                    </>
                  )}
                  {localSubcategory === 'Great-Aunt / Uncle' && (
                    <>
                      <option value="Maternal Great-Uncle (Grandfather's / Grandmother's Brother)" />
                      <option value="Maternal Great-Aunt (Grandfather's / Grandmother's Sister)" />
                      <option value="Paternal Great-Uncle (Grandfather's / Grandmother's Brother)" />
                      <option value="Paternal Great-Aunt (Grandfather's / Grandmother's Sister)" />
                    </>
                  )}
                  {localSubcategory === 'Cousin (1st)' && (
                    <>
                      <option value="Maternal 1st Cousin (Mother's Sibling's Child)" />
                      <option value="Paternal 1st Cousin (Father's Sibling's Child)" />
                      <option value="Cousin Brother" />
                      <option value="Cousin Sister" />
                      <option value="Cousin's Wife (Cousin-in-law)" />
                      <option value="Cousin's Husband (Cousin-in-law)" />
                    </>
                  )}
                  {localSubcategory === 'Cousin (Once Removed)' && (
                    <>
                      <option value="1st Cousin's Son (1C1R Downwards)" />
                      <option value="1st Cousin's Daughter (1C1R Downwards)" />
                      <option value="Mother's 1st Cousin (Maternal 1C1R Upwards)" />
                      <option value="Father's 1st Cousin (Paternal 1C1R Upwards)" />
                      <option value="Mother's Cousin's Son (2nd Cousin)" />
                      <option value="Mother's Cousin's Daughter (2nd Cousin)" />
                      <option value="Father's Cousin's Son (2nd Cousin)" />
                      <option value="Father's Cousin's Daughter (2nd Cousin)" />
                    </>
                  )}
                  {localSubcategory?.includes('2nd') && (
                    <>
                      <option value="1st Cousin's Son (Cousin's Child)" />
                      <option value="1st Cousin's Daughter (Cousin's Child)" />
                      <option value="Maternal 2nd Cousin (Mother's 1st Cousin's Child)" />
                      <option value="Paternal 2nd Cousin (Father's 1st Cousin's Child)" />
                      <option value="Mother's 1st Cousin's Son" />
                      <option value="Mother's 1st Cousin's Daughter" />
                      <option value="Father's 1st Cousin's Son" />
                      <option value="Father's 1st Cousin's Daughter" />
                      <option value="3rd Cousin" />
                    </>
                  )}
                  {localSubcategory === 'Niece / Nephew' && (
                    <>
                      <option value="Nephew (Brother's / Sister's Son)" />
                      <option value="Niece (Brother's / Sister's Daughter)" />
                      <option value="Grandnephew" />
                      <option value="Grandniece" />
                    </>
                  )}
                  {/* Friends & Colleagues Suggestions */}
                  {localSubcategory === 'Close Friend' && (
                    <>
                      <option value="Best Friend" />
                      <option value="Childhood Friend" />
                      <option value="College Friend" />
                      <option value="School Friend" />
                    </>
                  )}
                  {localSubcategory === 'Colleague' && (
                    <>
                      <option value="Manager" />
                      <option value="Teammate" />
                      <option value="Co-worker" />
                      <option value="Mentor" />
                      <option value="Client" />
                      <option value="Business Partner" />
                    </>
                  )}
                  {localSubcategory === 'Classmate' && (
                    <>
                      <option value="Schoolmate" />
                      <option value="College Roommate" />
                      <option value="Batchmate" />
                      <option value="Alumni" />
                    </>
                  )}
                  {localSubcategory === 'Neighbor' && (
                    <>
                      <option value="Next-door Neighbor" />
                      <option value="Apartment Society" />
                      <option value="Community Member" />
                    </>
                  )}
                  {localSubcategory === 'Service Contact' && (
                    <>
                      <option value="Doctor" />
                      <option value="Teacher" />
                      <option value="Lawyer" />
                      <option value="Driver" />
                      <option value="Contractor" />
                    </>
                  )}
                </datalist>
              </div>
            )}

            {isRelChanged && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <button
                  onClick={handleSaveRelationship}
                  disabled={isTaskActive}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '12.5px',
                    transition: 'background 0.2s'
                  }}
                  title="Apply and save relationship changes"
                >
                  <CheckIcon style={{ fontSize: '15px' }} /> Save
                </button>
                <button
                  onClick={handleCancelRelationship}
                  disabled={isTaskActive}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: '#334155',
                    color: '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    transition: 'background 0.2s'
                  }}
                  title="Discard changes"
                >
                  <CloseIcon style={{ fontSize: '15px' }} /> Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Connected Family & Relationships Bar (Inter-Person Network) */}
        {currentPerson && !currentPerson.name?.startsWith('Unknown Person') && (
          <div style={{ padding: '8px 18px', background: '#0b1329', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#94a3b8', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Family Links:
            </span>
            {personConnections && personConnections.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {personConnections.map(c => {
                  let badgeColor = '#ec4899'; // pink for spouse/partner
                  let icon = '💍';
                  let label = 'Spouse';
                  if (c.relation_type === 'parent') { badgeColor = '#38bdf8'; icon = '👨‍👩‍👦'; label = 'Parent'; }
                  else if (c.relation_type === 'child') { badgeColor = '#f59e0b'; icon = '👶'; label = 'Child'; }
                  else if (c.relation_type === 'sibling') { badgeColor = '#818cf8'; icon = '👫'; label = 'Sibling'; }
                  else if (c.relation_type === 'partner') { badgeColor = '#ec4899'; icon = '❤️'; label = 'Partner'; }
                  
                  return (
                    <div
                      key={`${c.related_person_id}_${c.relation_type}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: `1px solid ${badgeColor}66`,
                        fontSize: '12px',
                        color: '#f8fafc'
                      }}
                    >
                      <span>{icon}</span>
                      <span
                        onClick={() => {
                          if (savePersonScroll) savePersonScroll(currentPerson.id);
                          openPersonPhotos({ id: c.related_ai_person_id || c.related_person_id, name: c.related_name });
                        }}
                        style={{ cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
                        title={`Open ${c.related_name}'s photos`}
                      >
                        {c.related_name}
                      </span>
                      <span style={{ fontSize: '11px', color: badgeColor, textTransform: 'capitalize', fontWeight: '600' }}>
                        ({label})
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Remove link "${label}" with ${c.related_name}?`)) {
                            removePersonConnection(currentPerson.id, c.related_person_id, c.relation_type);
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0 2px',
                          marginLeft: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontSize: '14px',
                          lineHeight: 1
                        }}
                        title="Remove link"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No family connections linked yet.</span>
            )}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowAddConnectionModal(prev => !prev)}
                disabled={isTaskActive}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: showAddConnectionModal ? '#3b82f6' : '#1e293b',
                  color: showAddConnectionModal ? '#0f172a' : '#38bdf8',
                  border: '1px solid #3b82f6',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s'
                }}
                title="Link a spouse, parent, child, or sibling to this person"
              >
                + Link Family Member
              </button>
            </div>
          </div>
        )}

        {/* Modal / Inline Panel to Link a Connection */}
        {showAddConnectionModal && (
          <div style={{ padding: '12px 18px', background: '#131e36', borderBottom: '1px solid #2563eb', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#93c5fd', fontWeight: 'bold' }}>Link to {currentPerson?.name}:</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Relationship:</span>
              <select
                value={newConnType}
                onChange={(e) => setNewConnType(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', outline: 'none', fontSize: '12.5px' }}
              >
                <option value="spouse">💍 Spouse (Wife / Husband)</option>
                <option value="partner">❤️ Partner</option>
                <option value="parent">👨‍👩‍👦 Parent (Mother / Father)</option>
                <option value="child">👶 Child (Son / Daughter)</option>
                <option value="sibling">👫 Sibling (Brother / Sister)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Select Person:</span>
              <select
                value={newConnPersonId}
                onChange={(e) => setNewConnPersonId(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', background: '#1e293b', color: '#f8fafc', border: '1px solid #334155', outline: 'none', fontSize: '12.5px', minWidth: '160px' }}
              >
                <option value="">— Choose a Person —</option>
                {sortedNamedPeopleDropdown
                  .filter(p => p.id !== currentPerson?.id && p.name !== currentPerson?.name)
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.relation_label ? `(${p.relation_label})` : p.subcategory ? `(${p.subcategory})` : ''}</option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={!newConnPersonId || isTaskActive}
                onClick={() => {
                  if (!newConnPersonId) return;
                  addPersonConnection(currentPerson.id, parseInt(newConnPersonId), newConnType);
                  setNewConnPersonId('');
                  setShowAddConnectionModal(false);
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: !newConnPersonId ? '#475569' : '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  cursor: !newConnPersonId ? 'not-allowed' : 'pointer',
                  fontSize: '12.5px',
                  fontWeight: '600'
                }}
              >
                Save Connection
              </button>
              <button
                onClick={() => {
                  setShowAddConnectionModal(false);
                  setNewConnPersonId('');
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {(showSimilarPanel || similarUnknowns) && (
        <div style={{ padding: '18px', borderBottom: '1px solid #1f2937', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>
                {similarUnknowns ? `Similar Unknown Profiles (${similarUnknowns.length})` : 'Find Similar Unknowns'}
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Similarity Threshold:</span>
                <input 
                type="range" 
                min="0.35" max="0.85" step="0.01" 
                    disabled={isFindingSimilar || isTaskActive}
                value={similarityThreshold} 
                onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))} 
                />
                <span style={{ color: '#38bdf8', fontSize: '14px', minWidth: '40px' }}>{Math.round(similarityThreshold * 100)}%</span>
                <ActionButton disabled={isFindingSimilar || isTaskActive} className="btn btn-primary" style={{ padding: '4px 10px' }} onClick={() => findSimilarUnknowns(currentPerson.id, similarityThreshold)}>
                {similarUnknowns ? 'Update Search' : 'Start Search'}
                </ActionButton>
                <ActionButton className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={() => { setSimilarUnknowns(null); setSimilarUnknownsPage(1); setShowSimilarPanel(false); setCheckedSimilar(new Set()); if (selected?.is_person) setSelected(null); }}>Close</ActionButton>
            </div>
            </div>
            
            {isFindingSimilar ? (
            <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#38bdf8' }}>
                <HourglassEmptyIcon style={{ fontSize: '32px', marginBottom: '8px', animation: 'spin 2s linear infinite' }} />
                <p style={{ margin: 0 }}>Searching for similar unknown profiles...</p>
            </div>
            ) : similarUnknowns ? (
            visibleSimilar.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No similar unknown profiles found at this threshold. Try lowering the slider.</p>
            ) : (
            <>
                {visibleSimilar.length > 500 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Page {similarUnknownsPage} of {Math.ceil(visibleSimilar.length / 500)} ({visibleSimilar.length} total)</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                    <ActionButton disabled={similarUnknownsPage === 1} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setSimilarUnknownsPage(prev => Math.max(1, prev - 1))}>Previous</ActionButton>
                    <ActionButton disabled={similarUnknownsPage >= Math.ceil(visibleSimilar.length / 500)} className="btn btn-secondary" style={{ padding: '4px 12px' }} onClick={() => setSimilarUnknownsPage(prev => prev + 1)}>Next</ActionButton>
                    </div>
                </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                {visibleSimilar.slice((similarUnknownsPage - 1) * 500, similarUnknownsPage * 500).map(p => (
                    <div key={p.id} style={{background:'#111827', padding:'10px', borderRadius:'12px', border: checkedSimilar.has(p.id) ? '2px solid #3b82f6' : '1px solid #24324a', cursor:'pointer', position: 'relative'}} onClick={() => {
                        const next = new Set(checkedSimilar);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        setCheckedSimilar(next);
                        setSelected({ is_person: true, ...p });
                    }}>
                    <input 
                        type="checkbox" 
                        checked={checkedSimilar.has(p.id)}
                        onChange={() => {}}
                        style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10, cursor: 'pointer' }}
                    />
                    <div style={{width:'100%', height:'100px', background:'#1e293b', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', overflow: 'hidden', marginBottom: '8px'}}>
                        <PersonThumb url={getPersonThumbUrl(p)} size={40} />
                    </div>
                    <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: '#38bdf8' }}>{Math.round(p.similarity * 100)}% Match</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{p.face_count} photo{p.face_count !== 1 ? 's' : ''}</div>
                    {p.context_score > 0 && !p.inSamePhoto && <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>★ Context Match</div>}
                    {p.inSamePhoto && <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold', marginTop: '2px' }} title="This person appears in the exact same photo as the named person. They are likely a different person.">⚠️ Group Photo</div>}
                    </div>
                ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                <ActionButton disabled={checkedSimilar.size === 0 || isTaskActive} className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={async () => {
                    if (actionInProgress || !!dataOpProgress || indexer.running || indexer.combined_scanner_running || indexer.face_scanner_running || indexer.object_scanner_running || indexer.document_scanner_running || indexer.hasher_running) {
                        alert("Please stop all background tasks before merging profiles to prevent database conflicts.");
                        return;
                    }
                    if (!window.confirm(`Merge ${checkedSimilar.size} unknown profile(s) into ${currentPerson.name}?`)) return;
                    try {
                        await axios.post(`${API}/people/merge`, { person_ids: [currentPerson.id, ...Array.from(checkedSimilar)] });
                        showToastMessage(`Merged ${checkedSimilar.size} profiles successfully.`);
                        setSimilarUnknowns(null);
                        setSimilarUnknownsPage(1);
                        setShowSimilarPanel(false);
                        setCheckedSimilar(new Set());
                        if (selected?.is_person) setSelected(null);
                        openPersonPhotos(currentPerson);
                        loadPeople();
                    } catch(err) {
                        alert('Error merging: ' + (err?.response?.data?.detail || err.message));
                    }
                }}>
                    Merge {checkedSimilar.size} Selected
                </ActionButton>
                <ActionButton disabled={isTaskActive} className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => {
                    const hidden = settings.hidden_people || [];
                    const visibleSimilar = similarUnknowns.filter(p => !hidden.includes(p.id) && !(p.name && hidden.includes(p.name)));
                    if (checkedSimilar.size === visibleSimilar.length && visibleSimilar.length > 0) setCheckedSimilar(new Set());
                    else setCheckedSimilar(new Set(visibleSimilar.map(p => p.id)));
                }}>
                    {checkedSimilar.size === visibleSimilar.length && visibleSimilar.length > 0 ? 'Deselect All' : 'Select All'}
                </ActionButton>
                </div>
            </>
            )) : (
            <p style={{ color: '#94a3b8' }}>Adjust the similarity threshold and click "Start Search" to find potential matches.</p>
            )}
        </div>
        )}

        <SelectionBar
          props={props}
          context="person_files"
          openAddToFolder={openAddToFolder}
        />

        <div className="content" onScroll={handleScroll} style={{paddingTop: '18px', paddingLeft: '18px', paddingRight: '18px', overflowY: 'auto'}}>

        {startOffset > 0 && (
        <div style={{ textAlign: 'center', paddingTop: '150px', paddingBottom: '20px', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '200px', boxSizing: 'border-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingPrevious ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading previous photos...</> : 'Scroll up to load previous photos...'}
            </div>
        </div>
        )}

            {Array.isArray(personFiles) && personFiles.length === 0 ? (
                <div className={viewMode === 'grid' ? 'grid' : 'list'}>
                    <p>No photos found for this person.</p>
                </div>
            ) : null}
            {Array.from(groupedPersonFiles.entries()).map(([dateKey, filesGroup]) => (
                <DateGroup
                key={dateKey}
                dateKey={dateKey}
                filesGroup={filesGroup}
                viewMode={viewMode}
                checkedFiles={checkedFiles}
                toggleCheck={toggleCheck}
                handleItemClick={handleItemClick}
                openContainingFolder={openContainingFolder}
                setSelected={setSelected}
                openFile={openFile}
                renderThumb={renderThumb}
                filterCategory="all"
                indexer={indexer}
                checkFileReadOnly={checkFileReadOnly}
                />
            ))}
        {hasMore && (
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', color: '#94a3b8', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '24px', boxSizing: 'content-box' }}>
            <div style={{ width: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loadingMore ? <><HourglassEmptyIcon fontSize="small" style={{ animation: 'spin 2s linear infinite' }} /> Loading more photos...</> : 'Scroll down to load more photos...'}
            </div>
        </div>
        )}
        {!hasMore && personFiles.length > 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0 40px 0', color: '#475569' }}>
            — End of results —
        </div>
        )}
        </div>
        </div>

        {showDetails && (
        <>
        <div className={`resizer ${isResizing === 'details' ? 'active' : ''}`} onMouseDown={(e) => { e.preventDefault(); setIsResizing('details'); }} />
        <div className='details' style={{ width: detailsWidth, overflowY: 'auto', maxHeight: '100%', display: 'flex', flexDirection: 'column'}}>

        <h3>Details</h3>

        {
        selected ?
        selected.is_person ? (
        <div>
        <img
        src={getPersonThumbUrl(selected)}
        style={{ width:'100%', borderRadius:'12px', marginBottom: '12px' }}
        key={`person-${selected.id}`}
        />
        <h2 style={{ wordBreak: 'break-word', marginTop: 0 }}>{selected.name}</h2>
        <p><b>Profile ID:</b> {selected.id}</p>
        {selected.similarity !== undefined && <p><b>Similarity:</b> {Math.round(selected.similarity * 100)}% Match</p>}
        <p><b>Face Count:</b> {selected.face_count} photos</p>
        <p style={{color: '#94a3b8', fontSize: '13px', marginTop: '16px', lineHeight: '1.5'}}>
        Merging will combine all {selected.face_count} photos from this profile into <b>{currentPerson?.name}</b>.
        </p>
        {personPreviewPhotos.length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f8fafc' }}><b>Sample Photos</b></p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {personPreviewPhotos.map(photo => (
                <HoverableImage 
                key={photo.path} 
                item={photo}
                renderThumb={renderThumb}
                style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid #334155' }} 
                onClick={() => openFile(photo.path)}
                title={photo.filename}
                />
            ))}
            </div>
        </div>
        )}
        </div>
        ) : (
        <div>

        <HoverableImage
        item={selected}
        renderThumb={renderThumb}
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

        <p><b>Size:</b> {formatSize(selected.size)}</p>

        <p><b>Modified:</b> {selected.modified}</p>

        {selected.metadata?.gps && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <b>Location:</b>
            <ActionButton 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#3b82f6', color: '#3b82f6' }}
            onClick={() => window.open(`https://www.google.com/maps?q=${selected.metadata.gps.latitude},${selected.metadata.gps.longitude}`, '_blank')}
            >
            <PlaceIcon fontSize="small" /> View on Map
            </ActionButton>
        </div>
        )}

        {selected.tags && (
        <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Detected Tags</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selected.tags.split(',').filter(t => t.trim()).map(tag => {
                const isObj = tag.startsWith('object:');
                const isPerson = tag.startsWith('person:');
                const color = isObj ? '#38bdf8' : isPerson ? '#10b981' : '#cbd5e1';
                const bg = isObj ? '#3b82f64a' : isPerson ? '#10b9814a' : '#334155';
                const border = isObj ? '#3b82f6' : isPerson ? '#10b981' : '#475569';
                const label = tag.replace('object:', '').replace('person:', '').replace(/_/g, ' ');
                return (
                <span key={tag} style={{ background: bg, color: color, padding: '4px 10px', borderRadius: '12px', fontSize: '12px', border: `1px solid ${border}`, fontWeight: '500' }}>
                    {label}
                </span>
                );
            })}
            </div>
        </div>
        )}

        <h3>Metadata</h3>

        <p><b>File ID:</b> {selected.id}</p>
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap',marginBottom:'16px'}}>
        <ActionButton className="btn btn-secondary" onClick={()=>openFile(selected.path)}>Open File</ActionButton>
        <ActionButton className="btn btn-secondary" onClick={()=>openContainingFolder(selected.path)}>Open Containing Folder</ActionButton>
        </div>
        {renderMetadata(selected.metadata)}

        </div>
        ) : (
        <p>Select file or profile to preview.</p>
        )
        }

        </div>
        </>
        )}

        </div>
        }
        <AddToFolderModal
          isOpen={isAddToFolderOpen}
          onClose={() => setIsAddToFolderOpen(false)}
          selectedFiles={Array.from(checkedFiles)}
          virtualFolders={props.virtualFolders}
          createVirtualFolder={props.createVirtualFolder}
          addFilesToVirtualFolder={props.addFilesToVirtualFolder}
          globalFileCache={globalFileCache}
          isMoveMode={isAddToFolderMoveMode}
          sourceVirtualFolder={null}
          removeFilesFromVirtualFolder={null}
          loadVirtualFolders={props.loadVirtualFolders}
        />
    </>
  );
}