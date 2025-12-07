import { useState , useEffect} from 'react'

function App() {
  const [uploadStatus, setUploadStatus] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [images, setImages] = useState([])

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

return (
    <div style={{ padding: '30px', color: '#333', fontFamily: 'sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* 顶部：上传控制区 */}
      <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px', marginBottom: '20px', flexShrink: 0 }}>
        <h2 style={{margin: '0 0 15px 0'}}>Voyis Gallery Manager</h2>

        {/* 按钮行 */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <label style={{
            background: isUploading ? '#ccc' : '#2196F3', color: 'white', padding: '10px 20px',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', display: 'inline-block'
          }}>
            {isUploading ? 'Uploading...' : '+ Upload Images'}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* --- 新增：详细上传反馈区域 (位于按钮下方) --- */}
        {uploadStatus && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            borderRadius: '6px',
            background: uploadStatus.error ? '#ffebee' : '#e8f5e9', // 成功绿/失败红背景
            border: `1px solid ${uploadStatus.error ? '#ffcdd2' : '#c8e6c9'}`,
            color: '#333',
            fontSize: '14px'
          }}>
            {uploadStatus.error ? (
              <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>⚠️ Error: {uploadStatus.error}</div>
            ) : (
              <div>
                {/* 统计数据行 */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '10px', fontWeight: '500' }}>
                  <span>📊 Total Files: <strong>{uploadStatus.totalFiles}</strong></span>
                  <span>💾 Total Size: <strong>{uploadStatus.totalSize}</strong></span>
                  {/* 只有当有损坏文件时才显示红色，否则绿色 */}
                  <span style={{ color: uploadStatus.corruptedCount > 0 ? 'red' : 'green' }}>
                    {uploadStatus.corruptedCount > 0 ? '❌' : '✅'} Corrupted: <strong>{uploadStatus.corruptedCount}</strong>
                  </span>
                </div>

                {/* 文件名列表 (折叠面板) */}
                <details style={{ cursor: 'pointer', borderTop: '1px solid #ccc', paddingTop: '5px' }}>
                  <summary style={{ outline: 'none', color: '#555' }}>View Uploaded Filenames</summary>
                  <ul style={{
                    marginTop: '5px',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    paddingLeft: '20px',
                    margin: '5px 0 0 0',
                    background: 'rgba(255,255,255,0.5)'
                  }}>
                    {uploadStatus.fileList && uploadStatus.fileList.map((name, i) => (
                      <li key={i} style={{ fontFamily: 'monospace', fontSize: '12px' }}>{name}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部：图库展示区 (Gallery Viewer) */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h3 style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Gallery ({images.length})</h3>

        {images.length === 0 ? (
          <p style={{ color: '#999' }}>No images found on server.</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '15px'
          }}>
            {images.map((img, idx) => (
              <div key={idx} style={{
                border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden',
                background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
              }}>
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
                <div style={{ padding: '8px', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {img.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default App