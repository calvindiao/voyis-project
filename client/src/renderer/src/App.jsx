import { useState, useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

const THEME = {
  primary: '#FFB902', // Voyis Yellow
  primaryHover: '#e5a700',
  bgGradient: 'linear-gradient(to bottom right, #001f3f, #00101a)',
  panelBg: 'rgba(0, 44, 88, 0.6)', // semi-transparent dark blue
  textMain: '#ffffff',
  textDim: '#a0b0c0',
  border: '1px solid rgba(255, 185, 2, 0.3)',
  danger: '#ff4d4f',
  success: '#00cc66'
};



function App() {

  const [images, setImages] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);

  const [uploadStatus, setUploadStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [selectedImages, setSelectedImages] = useState([]);


  const [activeImage, setActiveImage] = useState(null);
  const [isCropMode, setIsCropMode] = useState(false);
  const [selection, setSelection] = useState(null); // { x, y, width, height }
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null); // calculate crop area based on image position

  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

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
      alert("Sync failed! Check server connection.");
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
      // setUploadStatus({ error: error.message })
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  // const toggleSelection = (filename) => {
  //   setSelectedImages(prev => {
  //     if (prev.includes(filename)) {
  //       return prev.filter(name => name !== filename)
  //     } else {
  //       return [...prev, filename]
  //     }
  //   })
  // }
  const handleDownloadSelected = () => {
    if (selectedImages.length === 0) return;
    const url = `http://localhost:3000/api/download-zip?files=${selectedImages.join(',')}`;
    addLog(`Downloading ${selectedImages.length} files as ZIP...`, 'info');
    window.location.href = url;
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

      setActiveImage(null); // close Modal
      setIsCropMode(false); // exit crop mode
      setSelection(null);
      fetchImages(); // refresh list to see new image

    } catch (err) {
      addLog(`Crop failed: ${err.message}`, 'error');
    }
  };

  const filteredImages = images.filter(img => {
    if (filterType === 'all') return true
    if (filterType === 'tif') return img.type === 'tif'
    if (filterType === 'jpg') return img.name.toLowerCase().match(/\.(jpg|jpeg)$/)
    if (filterType === 'png') return img.name.toLowerCase().match(/\.png$/)
    return true
  })

  // const closeActiveImage = () => {
  //   setActiveImage(null);
  //   setIsCropMode(false);
  //   setSelection(null);
  // };



  return (
    <div style={{ height: '100vh', display: 'flex', background: THEME.bgGradient, fontFamily: '"Segoe UI", Roboto, sans-serif', color: THEME.textMain, overflow: 'hidden' }}>

      <div style={{ width: '300px', minWidth: '250px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(10px)' }}>

        {/* --- Control Panel --- */}
        <div style={{ padding: '20px', flexShrink: 0 }}>
          <h2 style={{ color: THEME.primary, margin: '0 0 20px 0', letterSpacing: '1px' }}>VOYIS <span style={{ color: 'white', fontSize: '0.6em' }}>IMG EDITOR</span></h2>

          {/* Card 1: Global Server Status */}
          <div style={{ background: THEME.panelBg, border: THEME.border, borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: THEME.textDim, marginBottom: '5px' }}>SERVER STATUS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Total Files:</span><span style={{ fontWeight: 'bold' }}>{stats.totalFiles}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span>Total Storage:</span><span style={{ fontWeight: 'bold' }}>{stats.totalSizeMB} MB</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span>Corrupted:</span><span style={{ fontWeight: 'bold', color: stats.corrupted > 0 ? THEME.danger : THEME.success }}>{stats.corrupted}</span>
            </div>
            {/* Last Sync Display */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '8px', fontSize: '11px', color: THEME.textDim, textAlign: 'right' }}>
              Last Sync: {lastSynced || 'Never'}
            </div>
          </div>

          {/* Card 2: Last Upload Feedback */}
          {uploadStatus && (
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: `1px solid ${THEME.success}`, borderRadius: '8px', padding: '15px', marginBottom: '15px', animation: 'fadeIn 0.5s' }}>
              <div style={{ fontSize: '12px', color: THEME.success, marginBottom: '5px', fontWeight: 'bold' }}>LAST UPLOAD REPORT</div>
              <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Uploaded:</span> <strong>{uploadStatus.totalFiles} files</strong>
              </div>
              <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Batch Size:</span> <strong>{uploadStatus.totalSize}</strong>
              </div>
              {uploadStatus.corruptedCount > 0 && (
                <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: THEME.danger, marginTop: '5px' }}>
                  <span>Corrupted:</span> <strong>{uploadStatus.corruptedCount}</strong>
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ background: isUploading ? '#555' : THEME.primary, color: '#000', padding: '12px', borderRadius: '4px', cursor: isUploading ? 'not-allowed' : 'pointer', fontWeight: 'bold', textAlign: 'center', transition: '0.2s', display: 'block' }}>
              {isUploading ? 'UPLOADING...' : 'UPLOAD IMAGES'}
              <input type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isUploading} />
            </label>

            <button onClick={() => { addLog("Manual sync triggered...", 'info'); fetchImages(); }} style={{ background: 'transparent', border: `1px solid ${THEME.primary}`, color: THEME.primary, padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' }}>
              SYNC DATA
            </button>

            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '12px', color: THEME.textDim, marginBottom: '5px' }}>FILTER VIEW</div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #444', borderRadius: '4px' }}>
                <option value="all">All Formats</option>
                <option value="jpg">JPG / JPEG</option>
                <option value="png">PNG</option>
                <option value="tif">TIF / TIFF</option>
              </select>
            </div>

            {selectedImages.length > 0 && (
              <button onClick={handleDownloadSelected} style={{ background: THEME.success, color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
                DOWNLOAD ({selectedImages.length})
              </button>
            )}
          </div>
        </div>

        {/* --- Log Section --- */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px', overflow: 'hidden' }}>
          <div style={{ fontSize: '12px', color: THEME.textDim, marginBottom: '10px' }}>SYSTEM LOGS</div>
          <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.4)', borderRadius: '4px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5' }}>
            {logs.length === 0 && <span style={{ color: '#666' }}>[Ready] Waiting for user action...</span>}
            {logs.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '5px', color: log.type === 'error' ? THEME.danger : log.type === 'warning' ? '#ffcc00' : log.type === 'success' ? THEME.success : '#ccc' }}>
                <span style={{ color: '#666' }}>[{log.time}]</span> {log.msg}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* ================= Gallery ================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ margin: 0, fontWeight: 'normal' }}>Gallery View <span style={{ color: THEME.primary, marginLeft: '10px' }}>{filteredImages.length} items</span></h3>
          <div style={{ fontSize: '12px', color: THEME.textDim }}>Double-click to view/edit • Click to select</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredImages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexDirection: 'column' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🌊</div>No images found.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
              {filteredImages.map((img) => {
                const isSelected = selectedImages.includes(img.name)
                return (
                  <div key={img.id}
                    onClick={() => setSelectedImages(prev => prev.includes(img.name) ? prev.filter(n => n !== img.name) : [...prev, img.name])}
                    onDoubleClick={(e) => { e.stopPropagation(); setActiveImage(img); addLog(`Opened viewer for ${img.name}`); }}
                    style={{ border: isSelected ? `2px solid ${THEME.primary}` : '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative', backgroundColor: 'rgba(255,255,255,0.05)', transition: 'transform 0.2s', transform: isSelected ? 'scale(1.02)' : 'scale(1)' }}>
                    {isSelected && <div style={{ position: 'absolute', top: '5px', right: '5px', background: THEME.primary, color: 'black', borderRadius: '50%', width: '20px', textAlign: 'center', fontWeight: 'bold' }}>✓</div>}
                    <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                      {img.type === 'tif' ? <div style={{ textAlign: 'center', color: '#777' }}>📄 <br /><small>TIF</small></div> : <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: '10px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#ddd' }}>{img.name}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= Modal ================= */}
      {activeImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 10, 20, 0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333' }}>
            <div><strong style={{ fontSize: '18px', color: THEME.primary }}>{activeImage.name}</strong> <span style={{ color: '#888', fontSize: '13px', marginLeft: '15px' }}>RAW: {activeImage.width}x{activeImage.height} | {(activeImage.size / 1024).toFixed(1)} KB</span></div>
            <div style={{ display: 'flex', gap: '15px' }}>
              {activeImage.type !== 'tif' && (
                <>
                  <button onClick={() => { setIsCropMode(!isCropMode); setSelection(null); addLog(!isCropMode ? "Entered Crop Mode" : "Exited Crop Mode"); }} style={{ background: isCropMode ? '#ff9800' : 'transparent', border: '1px solid #ff9800', color: isCropMode ? 'black' : '#ff9800', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{isCropMode ? 'EXIT CROP MODE' : '✂️ CROP TOOL'}</button>
                  {isCropMode && <button onClick={handleSaveCrop} style={{ background: THEME.success, border: 'none', color: 'white', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>SAVE SELECTION</button>}
                </>
              )}
              <button onClick={() => { setActiveImage(null); setIsCropMode(false); }} style={{ background: 'transparent', border: '1px solid #666', color: '#ccc', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>CLOSE X</button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            {activeImage.type === 'tif' ? <div style={{ textAlign: 'center', color: '#555' }}><div style={{ fontSize: '50px' }}>⚠️</div><h3>TIF Preview Not Supported</h3><p>Use external viewer or convert format.</p></div> :
              isCropMode ? (
                <div style={{ position: 'relative', userSelect: 'none' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                  <img ref={imgRef} src={activeImage.url} style={{ maxHeight: '80vh', maxWidth: '85vw', objectFit: 'contain', display: 'block', cursor: 'crosshair', border: '1px solid #333' }} draggable={false} />
                  {selection && <div style={{ position: 'absolute', left: selection.x, top: selection.y, width: selection.width, height: selection.height, border: `2px dashed ${THEME.primary}`, backgroundColor: 'rgba(255, 185, 2, 0.2)', pointerEvents: 'none' }}></div>}
                  <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.7)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px' }}>Drag to select area</div>
                </div>
              ) : (
                <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}><TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}><img src={activeImage.url} style={{ maxHeight: '80vh', maxWidth: '85vw', objectFit: 'contain' }} /></TransformComponent></TransformWrapper>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}

export default App