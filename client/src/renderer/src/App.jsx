import { useState, useEffect, useRef } from 'react'
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
function App() {

  const [images, setImages] = useState([])
  const [lastSynced, setLastSynced] = useState(null)

  const [uploadStatus, setUploadStatus] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const [filterType, setFilterType] = useState('all')
  const [selectedImages, setSelectedImages] = useState([])


  const [activeImage, setActiveImage] = useState(null)
  const [isCropMode, setIsCropMode] = useState(false);
  const [selection, setSelection] = useState(null); // { x, y, width, height }
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef(null); // calculate crop area based on image position


  const fetchImages = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/images')
      const data = await res.json()
      setImages(data)
      setLastSynced(new Date().toLocaleTimeString())
    } catch (error) {
      console.error("Failed to load images:", error)
      alert("Sync failed! Check server connection.")
    }
  }

  useEffect(() => {
    fetchImages()
  }, [])


  const handleFileUpload = async (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i])
    }

    setIsUploading(true)
    setUploadStatus(null)

    try {
      const response = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData, //  Content-Type is multipart/form-data
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      setUploadStatus(result)
      fetchImages()  // Refresh the image list after upload
    } catch (error) {
      console.error(error)
      setUploadStatus({ error: error.message })
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const toggleSelection = (filename) => {
    setSelectedImages(prev => {
      if (prev.includes(filename)) {
        return prev.filter(name => name !== filename)
      } else {
        return [...prev, filename]
      }
    })
  }
  const handleDownloadSelected = () => {
    if (selectedImages.length === 0) return
    const url = `http://localhost:3000/api/download-zip?files=${selectedImages.join(',')}`
    window.location.href = url
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
      return;
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

      alert('Crop saved successfully! Check the gallery.');
      setActiveImage(null); // close Modal
      setIsCropMode(false); // exit crop mode
      setSelection(null);
      fetchImages(); // refresh list to see new image

    } catch (err) {
      alert(err.message);
    }
  };

  const filteredImages = images.filter(img => {
    if (filterType === 'all') return true
    if (filterType === 'tif') return img.type === 'tif'
    if (filterType === 'jpg') return img.name.toLowerCase().match(/\.(jpg|jpeg)$/)
    if (filterType === 'png') return img.name.toLowerCase().match(/\.png$/)
    return true
  })

  const closeActiveImage = () => {
    setActiveImage(null);
    setIsCropMode(false);
    setSelection(null);
  };



  return (
    <div style={{ padding: '20px', color: '#333', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

      <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '15px', marginBottom: '15px', flexShrink: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #e0e0e0', paddingBottom: '10px' }}>
          <h2 style={{ margin: 0, color: '#2c3e50' }}>Voyis Manager</h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '12px', color: '#666' }}>
              Server Strategy: <strong>Sync (Server Wins)</strong>
            </span>
            <span style={{ fontSize: '12px', color: '#888' }}>
              Last Synced: {lastSynced || 'Never'}
            </span>
            <button
              onClick={fetchImages}
              style={{ background: 'white', border: '1px solid #ccc', padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              🔄 Sync Now
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>

          <label style={{
            background: isUploading ? '#ccc' : '#2196F3', color: 'white', padding: '8px 16px',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px'
          }}>
            {isUploading ? '⏳ Uploading...' : '☁️ Upload Files'}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Filter:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: '#555' }}
            >
              <option value="all">All Files</option>
              <option value="jpg">JPG / JPEG</option>
              <option value="png">PNG</option>
              <option value="tif">TIF / TIFF</option>
            </select>
          </div>

          {selectedImages.length > 0 && (
            <button
              onClick={handleDownloadSelected}
              style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto' }}
            >
              ⬇️ Download ({selectedImages.length})
            </button>
          )}
        </div>

        {uploadStatus && (
          <div style={{
            marginTop: '15px', padding: '10px', borderRadius: '6px', fontSize: '13px',
            background: uploadStatus.error ? '#ffebee' : '#e8f5e9',
            border: `1px solid ${uploadStatus.error ? '#ffcdd2' : '#c8e6c9'}`,
            display: 'flex', flexDirection: 'column', gap: '5px'
          }}>
            {uploadStatus.error ? (
              <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>⚠️ Error: {uploadStatus.error}</span>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Upload Complete</span>
                  <span><strong>Total Files:</strong> {uploadStatus.totalFiles}</span>
                  <span><strong>Total Size:</strong> {uploadStatus.totalSize}</span>
                  <span style={{ color: uploadStatus.corruptedCount > 0 ? '#d32f2f' : '#2e7d32' }}>
                    <strong>Corrupted:</strong> {uploadStatus.corruptedCount}
                  </span>
                </div>
                <details style={{ marginTop: '5px', cursor: 'pointer' }}>
                  <summary style={{ color: '#666' }}>View File Details</summary>
                  <div style={{ maxHeight: '60px', overflowY: 'auto', marginTop: '5px', background: 'rgba(255,255,255,0.5)', padding: '5px' }}>
                    {uploadStatus.fileList && uploadStatus.fileList.map((f, i) => (
                      <div key={i}>{f}</div>
                    ))}
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '10px' }}>
        <div style={{ marginBottom: '10px', color: '#777', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
          <span>Showing {filteredImages.length} items</span>
          <span>Double-click to view/crop</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
          {filteredImages.map((img) => {
            const isSelected = selectedImages.includes(img.name)
            return (
              <div key={img.id} onClick={() => toggleSelection(img.name)} onDoubleClick={(e) => { e.stopPropagation(); setActiveImage(img); }}
                style={{
                  border: isSelected ? '3px solid #2196F3' : '1px solid #eee',
                  borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'transform 0.1s'
                }}>
                {isSelected && <div style={{ position: 'absolute', top: '5px', right: '5px', background: '#2196F3', color: 'white', borderRadius: '50%', width: '20px', textAlign: 'center' }}>✓</div>}

                <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9' }}>
                  {img.type === 'tif' ? (
                    <div style={{ textAlign: 'center', color: '#999' }}>📄 <br /><small>TIF</small></div>
                  ) : (
                    <img src={img.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ padding: '8px', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: isSelected ? '#e3f2fd' : 'white' }}>
                  {img.name}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* --- Modal --- */}
      {activeImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', background: '#222' }}>
            <div>
              <strong>{activeImage.name}</strong> <span style={{ color: '#888', fontSize: '12px' }}>({activeImage.width}x{activeImage.height})</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {activeImage.type !== 'tif' && (
                <>
                  <button onClick={() => { setIsCropMode(!isCropMode); setSelection(null); }} style={{ background: isCropMode ? '#ff9800' : '#444', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                    {isCropMode ? 'Exit Crop' : '✂️ Crop'}
                  </button>
                  {isCropMode && <button onClick={handleSaveCrop} style={{ background: '#4CAF50', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Save Crop</button>}
                </>
              )}
              <button onClick={closeActiveImage} style={{ background: 'transparent', border: '1px solid #666', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
            {activeImage.type === 'tif' ? <div style={{ color: 'white' }}>TIF Preview Not Supported</div> :
              isCropMode ? (
                <div style={{ position: 'relative', userSelect: 'none' }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                  <img ref={imgRef} src={activeImage.url} style={{ maxHeight: '85vh', maxWidth: '90vw', objectFit: 'contain', display: 'block', cursor: 'crosshair' }} draggable={false} />
                  {selection && <div style={{ position: 'absolute', left: selection.x, top: selection.y, width: selection.width, height: selection.height, border: '2px dashed #00ff00', backgroundColor: 'rgba(0, 255, 0, 0.2)', pointerEvents: 'none' }}></div>}
                </div>
              ) : (
                <TransformWrapper initialScale={1} minScale={0.5} maxScale={4}>
                  <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                    <img src={activeImage.url} style={{ maxHeight: '85vh', maxWidth: '90vw', objectFit: 'contain' }} />
                  </TransformComponent>
                </TransformWrapper>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}

export default App