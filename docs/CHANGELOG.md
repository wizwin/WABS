# WABS Changelog

## v1.0.0
- **Initial Release** of WABS (WiZarD's Archival and Backup Search System).
- **100% Offline Capable**: Removed internet dependencies. Uses local Material UI icons, native fonts, and local SVG placeholders.
- **Smart Indexer**: Categorizes photos, videos, documents, compressed files, installers, and binaries with EXIF extraction.
- **High-Performance Search**: Optimized SQLite queries with batch commits and database streams for handling millions of files.
- **Customizable Workspace**: Draggable, resizable UI panes (Sidebar, Timeline, Details) with persistent state saving.
- **Explorer Enhancements**:
  - Grid and List view modes.
  - Advanced multi-selection (Shift+Click, Ctrl+Click, Checkboxes).
  - Batch actions to Copy, Move, Delete, and Open selected files.
  - Scrollable timeline grouping files chronologically.
- **Media Previews**: Native video frame extraction for `.mp4`, `.mkv`, and `.avi` files using OpenCV.
- **Dashboard & Settings**: Live indexing statistics, system native file-chooser integration, and archive overview.