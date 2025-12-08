import { useState, useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { applyGrayscaleWasm } from './wasm/filtersClient';
import * as UTIF from 'utif';
import './App.css';
import voyisLogo from './assets/voyis-logo.png';

function TiffCanvas({ src }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function decodeTif() {
      try {
        setStatus('loading');
        setError(null);

        //pull in TIF decode logic
        const res = await fetch(src);
        const buffer = await res.arrayBuffer();

        // use UTIF to decode
        const ifds = UTIF.decode(buffer);
        if (!ifds || ifds.length === 0) {
          throw new Error('No image data found in TIF file');
        }

        UTIF.decodeImage(buffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        const { width, height } = ifds[0];

        // Draw to canvas
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        ctx.putImageData(imageData, 0, 0);

        setStatus('ok');
      } catch (err) {
        console.error('TIF decode failed:', err);
        if (!cancelled) {
          setError(err.message || String(err));
          setStatus('error');
        }
      }
    }

    decodeTif();

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div style={{ textAlign: 'center', color: '#e2e8f0' }}>
      {status === 'loading' && (
        <p style={{ marginBottom: '10px', color: '#a0aec0' }}>Decoding TIF...</p>
      )}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '90%',
          maxHeight: '90%',
          backgroundColor: '#1a202c',
          border: '1px solid #4a5568',
        }}
      />
      {status === 'error' && (
        <p style={{ marginTop: '10px', color: '#fc8181' }}>
          Decode failed: {error}
        </p>
      )}
    </div>
  );
}


function App() {
  console.log('>>> App rendered');
  const [images, setImages] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);

  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [selectedImages, setSelectedImages] = useState([]);

  const [viewMode, setViewMode] = useState('gallery');
  const [activeImage, setActiveImage] = useState(null);

  const [isCropMode, setIsCropMode] = useState(false);
  const [selection, setSelection] = useState(null); // { x, y, width, height }
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const [isWasmBusy, setIsWasmBusy] = useState(false);

  const imgRef = useRef(null); // calculate crop area based on image position
  const logsEndRef = useRef(null);
  const [logs, setLogs] = useState([]);

  // log helper
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time: timestamp, msg: message, type }]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const fetchImages = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/images');
      const data = await res.json();
      setImages(data);
      setLastSynced(new Date().toLocaleTimeString());
      setSelectedImages([]);
    } catch (error) {
      console.error("Failed to load images:", error);
      addLog("Sync failed: Could not connect to server.", 'error');
    }
  }

  useEffect(() => {
    fetchImages();
    addLog("System initialized. Ready.", 'info');
  }, [])

  const stats = {
    totalFiles: images.length,
    totalSizeMB: (images.reduce((acc, img) => acc + (Number(img.size) || 0), 0) / 1024 / 1024).toFixed(2),
    corrupted: images.filter(img => img.is_corrupted).length
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    setIsUploading(true);
    setUploadStatus(null);
    addLog(`Starting upload of ${files.length} files...`, 'info');
    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData, //  Content-Type is multipart/form-data
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      addLog(`Upload complete. Success: ${result.totalFiles}, Corrupted: ${result.corruptedCount}`, result.corruptedCount > 0 ? 'warning' : 'success');
      setUploadStatus(result);
      fetchImages();  // Refresh the image list after upload
    } catch (error) {
      addLog(`Upload error: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  const handleDownloadSelected = () => {
    if (selectedImages.length === 0) return;
    const url = `http://localhost:3000/api/download-zip?files=${selectedImages.join(',')}`;
    addLog(`Downloading ${selectedImages.length} files...`, 'info');
    window.location.href = url;
  }

  const openEditor = (img) => {
    setActiveImage(img);
    setViewMode('workspace');
    setIsCropMode(false);
    setSelection(null);
    addLog(`Opened workspace: ${img.name}`);
  }

  const closeEditor = () => {
    setViewMode('gallery');
    setActiveImage(null);
    setIsCropMode(false);
  }

  const handleMouseDown = (e) => {
    if (!isCropMode) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !isCropMode) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // calculate width and height
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);
    const x = Math.min(currentX, startPos.x);
    const y = Math.min(currentY, startPos.y);

    const maxX = rect.width - width;
    const maxY = rect.height - height;

    setSelection({
      x: Math.max(0, Math.min(x, maxX)), // prevent going out of top-left boundary
      y: Math.max(0, Math.min(y, maxY)),
      width,
      height
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSaveCrop = async () => {
    if (!selection || selection.width < 10 || selection.height < 10) {
      alert("Please select a larger area.");
      return addLog("Crop selection too small", 'warning');
    }

    // scale = natural width of original image / current displayed width
    const scaleX = activeImage.width / imgRef.current.offsetWidth;
    const scaleY = activeImage.height / imgRef.current.offsetHeight;

    const cropData = {
      filename: activeImage.name,
      x: Math.round(selection.x * scaleX),
      y: Math.round(selection.y * scaleY),
      width: Math.round(selection.width * scaleX),
      height: Math.round(selection.height * scaleY),
    };

    try {
      const res = await fetch('http://localhost:3000/api/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cropData)
      });

      if (!res.ok) throw new Error('Crop failed');

      const resData = await res.json();
      addLog(`Crop saved: ${resData.newFilename}`, 'success');

      fetchImages();
      setIsCropMode(false); // exit crop mode
      setSelection(null);

    } catch (err) {
      addLog(`Crop failed: ${err.message}`, 'error');
    }
  };

  const handleApplyWasmGrayAndSave = async () => {
    if (!activeImage || activeImage.type === 'tif') return;

    try {
      setIsWasmBusy(true);
      addLog(`WASM grayscale on ${activeImage.name}...`, 'info');

        // create <img> and <canvas>
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = activeImage.url;

      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // get RGBA pixels and pass to WASM
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      await applyGrayscaleWasm(imageData.data);  // <- call WASM
      ctx.putImageData(imageData, 0, 0);

      // export processed canvas as PNG Blob
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (!b) return reject(new Error('Failed to create blob from canvas'));
          resolve(b);
        }, 'image/png');
      });

        // upload via /api/upload endpoint
      const base = activeImage.name.replace(/\.[^.]+$/, '');
      const newFilename = `${base}_gray_wasm.png`;

      const formData = new FormData();
      formData.append('images', blob, newFilename);

      const res = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      addLog(`WASM grayscale saved as ${newFilename}`, 'success');
      fetchImages();

    } catch (err) {
      console.error(err);
      addLog(`WASM grayscale failed: ${err.message}`, 'error');
      alert(`WASM processing failed: ${err.message}`);
    } finally {
      setIsWasmBusy(false);
    }
  };

  const filteredImages = images.filter(img => {
    if (filterType === 'all') return true
    if (filterType === 'tif') return img.type === 'tif'
    if (filterType === 'jpg') return img.name.toLowerCase().match(/\.(jpg|jpeg)$/)
    if (filterType === 'png') return img.name.toLowerCase().match(/\.png$/)
    return true
  })

  return (
    <div className="app-container">
      {/* === LEFT SIDEBAR === */}
      <div className="sidebar">
        <div className="brand-header">
          <img src={voyisLogo} alt="Voyis logo" className="brand-logo" />
          VOYIS MiniProject
        </div>

        {/* Global Stats */}
        <div className="status-card">
          <div className="card-title">Server Health</div>
          <div className="stat-row">
            <span>Indexed Files</span>
            <span className="stat-val">{stats.totalFiles}</span>
          </div>
          <div className="stat-row">
            <span>Storage</span>
            <span className="stat-val">{stats.totalSizeMB} MB</span>
          </div>
          <div className="stat-row" style={{ color: stats.corrupted > 0 ? 'var(--danger)' : 'var(--success)' }}>
            <span>Corrupted Images</span>
            <span className="stat-val">{stats.corrupted > 0 ? `${stats.corrupted}` : 'Stable'}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#a0aec0', marginTop: '10px', textAlign: 'right' }}>
            Last Sync: {lastSynced || '--'}
          </div>
        </div>

        {/* Upload Feedback (Dynamic Error Style) */}
        {uploadStatus && (
          <div className={`status-card ${uploadStatus.corruptedCount > 0 ? 'error' : ''}`}>
            <div className="card-title">Last Upload Report</div>
            <div className="stat-row">
              <span>Success</span>
              <span className="stat-val">{uploadStatus.totalFiles}</span>
            </div>
            <div className="stat-row">
              <span>Size</span>
              <span className="stat-val">{uploadStatus.totalSize}</span>
            </div>
            <div className="stat-row" style={{ fontWeight: 'bold' }}>
              <span>Corrupted</span>
              <span className="stat-val">{uploadStatus.corruptedCount}</span>
            </div>
            {uploadStatus.corruptedCount > 0 && (
              <div style={{ fontSize: '11px', marginTop: 5 }}>⚠️ Some files were skipped.</div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="action-group">
          <label className={`btn btn-primary ${isUploading ? 'disabled' : ''}`}>
            {isUploading ? 'Processing...' : 'Upload New Images'}
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.tif,.tiff"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </label>

          <button
            className="btn btn-secondary"
            onClick={() => { addLog("Sync triggered.", 'info'); fetchImages(); }}>
            Sync with Server (Server wins)
          </button>

          <div style={{ marginTop: '10px' }}>
            <select
              className="filter-select"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All Formats</option>
              <option value="jpg">JPG / JPEG</option>
              <option value="png">PNG</option>
              <option value="tif">TIF / TIFF</option>
            </select>
          </div>

          {selectedImages.length > 0 && (
            <button
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--success)', color: 'white' }}
              onClick={handleDownloadSelected}>
              Download ({selectedImages.length})
            </button>
          )}
        </div>

        {/* System Logs (Fills bottom space) */}
        <div className="log-container">
          <div className="log-header">
            <span>SYSTEM LOGS</span>
            <span
              className="clear-btn"
              style={{ fontSize: '10px', opacity: 0.5, cursor: 'pointer' }}
              onClick={() => setLogs([])}>
              CLEAR
            </span>
          </div>
          <div className="log-body">
            {logs.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#cbd5e0',
                  padding: 20
                }}>
                No recent activity
              </div>
            )}
            {logs.map((log, idx) => (
              <div key={idx} className={`log-item ${log.type}`}>
                <span className="log-time">{log.time}</span>
                <span className="log-msg">{log.msg}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="main-content">

        {viewMode === 'gallery' ? (
          /* --- GALLERY VIEW --- */
          <>
            <div className="top-nav">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="nav-title">Image Gallery</span>
                <span className="nav-badge">{filteredImages.length}</span>
              </div>
              <div className="nav-hint">
                <span className="nav-hint-dot" />
                <span>Double click to crop</span>
              </div>
            </div>
            <div className="gallery-container">
              {filteredImages.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#cbd5e0',
                    flexDirection: 'column'
                  }}>
                  <h2>Empty Gallery</h2>
                  <p>Upload files to get started</p>
                </div>
              ) : (
                <div className="gallery-grid">
                  {filteredImages.map((img) => {
                    const isSelected = selectedImages.includes(img.name);
                    return (
                      <div
                        key={img.id}
                        className={`img-card ${isSelected ? 'selected' : ''}`}
                        onClick={() =>
                          setSelectedImages(prev =>
                            prev.includes(img.name)
                              ? prev.filter(n => n !== img.name)
                              : [...prev, img.name]
                          )
                        }
                        onDoubleClick={() => openEditor(img)}
                      >
                        <div className="img-thumb">
                          {img.type === 'tif'
                            ? <span>TIF File</span>
                            : <img
                              src={img.url}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          }
                        </div>
                        <div className="img-meta">
                          <div className="img-name" title={img.name}>{img.name}</div>
                          <div className="img-sub">{(img.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* --- WORKSPACE VIEW (Fixed Layout) --- */
          <div className="workspace-container">
            {/* Toolbar */}
            <div className="workspace-toolbar">
              <button className="back-btn" onClick={closeEditor}>
                <span>←</span> Back to Gallery
              </button>

              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {activeImage.name}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                {activeImage.type !== 'tif' && (
                  <>
                    <button
                      className={isCropMode ? "btn btn-outline-danger" : "btn btn-secondary"}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => { setIsCropMode(!isCropMode); setSelection(null); }}
                    >
                      {isCropMode ? 'Cancel Crop' : 'Crop Image'}
                    </button>

                    {isCropMode && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={handleSaveCrop}
                      >
                        Save Crop
                      </button>
                    )}

                    <button
                      className="btn btn-secondary"
                      disabled={isWasmBusy}
                      onClick={handleApplyWasmGrayAndSave}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        opacity: isWasmBusy ? 0.6 : 1,
                        cursor: isWasmBusy ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isWasmBusy ? 'WASM Processing…' : 'WASM Grayscale + Save'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Canvas - Fills remaining space */}
            <div className="editor-area">
              {activeImage.type === 'tif' ? (
                <TiffCanvas src={activeImage.url} />
              ) : isCropMode ? (
                <div
                  style={{
                    position: 'relative',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}>
                  <img
                    ref={imgRef}
                    src={activeImage.url}
                    draggable={false}
                    style={{
                      maxHeight: 'calc(100vh - 120px)',
                      maxWidth: '90vw',
                      display: 'block',
                      cursor: 'crosshair'
                    }}
                  />
                  {selection && (
                    <div
                      style={{
                        position: 'absolute',
                        left: selection.x,
                        top: selection.y,
                        width: selection.width,
                        height: selection.height,
                        border: '2px dashed #FFB902',
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                </div>
              ) : (
                <TransformWrapper initialScale={1} minScale={0.1} maxScale={8}>
                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <img
                      src={activeImage.url}
                      style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                    />
                  </TransformComponent>
                </TransformWrapper>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
