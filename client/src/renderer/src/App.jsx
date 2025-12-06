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
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <label style={{
            background: isUploading ? '#ccc' : '#2196F3', color: 'white', padding: '10px 20px',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
          }}>
            {isUploading ? 'Uploading...' : '+ Upload Images'}
            <input type="file" multiple accept=".jpg,.jpeg,.png,.tif,.tiff" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          {uploadStatus && (
            <span style={{ color: uploadStatus.error ? 'red' : 'green' }}>
              {uploadStatus.error ? `Error: ${uploadStatus.error}` : `Success: ${uploadStatus.totalFiles} files uploaded`}
            </span>
          )}
        </div>
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