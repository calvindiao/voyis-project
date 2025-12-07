import { useState, useEffect } from 'react'

function App() {
  const [uploadStatus, setUploadStatus] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [images, setImages] = useState([])


  const [filterType, setFilterType] = useState('all')
  const [selectedImages, setSelectedImages] = useState([])


  const fetchImages = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/images')
      const data = await res.json()
      setImages(data)
    } catch (error) {
      console.error("Failed to load images:", error)
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
  const filteredImages = images.filter(img => {
    if (filterType === 'all') return true
    if (filterType === 'tif') return img.type === 'tif'
    if (filterType === 'jpg') return img.name.toLowerCase().match(/\.(jpg|jpeg)$/)
    if (filterType === 'png') return img.name.toLowerCase().match(/\.png$/)
    return true
  })

  return (
    <div style={{ padding: '30px', color: '#333', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* 顶部控制面板 */}
      <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '20px', flexShrink: 0 }}>
        <h2 style={{margin: '0 0 15px 0'}}>Voyis Gallery Manager</h2>

        {/* 按钮与过滤器行 */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* 上传按钮 */}
          <label style={{
            background: isUploading ? '#ccc' : '#2196F3', color: 'white', padding: '10px 20px',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center'
          }}>
            {isUploading ? 'Uploading...' : '☁️ Upload Images'}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {/* 分隔符 */}
          <div style={{ width: '1px', height: '30px', background: '#ccc' }}></div>

          {/* 过滤器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '500' }}>Filter:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="all">All Types</option>
              <option value="jpg">JPG / JPEG</option>
              <option value="png">PNG</option>
              <option value="tif">TIF / TIFF</option>
            </select>
          </div>

          {/* 下载按钮 (仅当有选中时显示) */}
          {selectedImages.length > 0 && (
             <button
               onClick={handleDownloadSelected}
               style={{
                 background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px',
                 borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: 'auto'
               }}
             >
               ⬇️ Download Selected ({selectedImages.length})
             </button>
          )}

        </div>

        {/* 上传状态反馈 (保留之前的逻辑) */}
        {uploadStatus && (
          <div style={{
            marginTop: '15px',
            padding: '10px 15px',
            borderRadius: '6px',
            background: uploadStatus.error ? '#ffebee' : '#e8f5e9',
            border: `1px solid ${uploadStatus.error ? '#ffcdd2' : '#c8e6c9'}`,
            fontSize: '14px'
          }}>
            {uploadStatus.error ? (
              <span style={{ color: '#d32f2f' }}>⚠️ Error: {uploadStatus.error}</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                 <span>✅ Upload Complete</span>
                 <span>📊 Files: <strong>{uploadStatus.totalFiles}</strong></span>
                 <span>❌ Corrupted: <strong>{uploadStatus.corruptedCount}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部：图库展示区 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Gallery ({filteredImages.length} visible)</h3>
          <span style={{ color: '#666', fontSize: '14px' }}>
            {selectedImages.length > 0 ? `${selectedImages.length} images selected` : 'Click images to select'}
          </span>
        </div>

        {filteredImages.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', marginTop: '50px' }}>No images match current filter.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '15px'
          }}>
            {filteredImages.map((img) => {
              const isSelected = selectedImages.includes(img.name)
              return (
                <div
                  key={img.id}
                  onClick={() => toggleSelection(img.name)}
                  style={{
                    border: isSelected ? '3px solid #2196F3' : '1px solid #ddd', // 选中高亮
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: 'white',
                    boxShadow: isSelected ? '0 4px 8px rgba(33, 150, 243, 0.3)' : '0 2px 5px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* 选中时的勾选图标 */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: '5px', right: '5px',
                      background: '#2196F3', color: 'white', borderRadius: '50%',
                      width: '20px', height: '20px', textAlign: 'center', lineHeight: '20px', fontSize: '12px'
                    }}>✓</div>
                  )}

                  <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee' }}>
                    {img.type === 'tif' ? (
                      <div style={{ textAlign: 'center', color: '#666' }}>
                        <span style={{ fontSize: '24px' }}>📄</span><br/>TIF File
                      </div>
                    ) : (
                      <img
                        src={img.url}
                        alt={img.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <div style={{ padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: isSelected ? '#e3f2fd' : 'white' }}>
                    {img.name}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

export default App