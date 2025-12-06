import { useState } from 'react'

function App() {
  const [uploadStatus, setUploadStatus] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

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
    } catch (error) {
      console.error(error)
      setUploadStatus({ error: error.message })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div style={{ padding: '40px', color: '#fff', fontFamily: 'sans-serif' }}>
      <h1>Voyis Image Upload</h1>

      <div style={{
        border: '2px dashed #666',
        padding: '20px',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.tif,.tiff"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
        id="file-input"
        />
        <label htmlFor="file-input" style={{
          cursor: 'pointer',
          backgroundColor: '#4a90e2',
          padding: '10px 20px',
          borderRadius: '4px',
          display: 'inline-block'
        }}>
          {isUploading ? 'Uploading...' : 'Select Images to Upload'}
        </label>
        <p style={{ marginTop: '10px', color: '#aaa', fontSize: '0.9em' }}>
          Supports: JPG, PNG, TIF
        </p>
      </div>

      {uploadStatus && (
        <div style={{
          backgroundColor: uploadStatus.error ? '#4a2222' : '#224a2b',
          padding: '15px',
          borderRadius: '8px'
        }}>
          {uploadStatus.error ? (
            <h3 style={{ color: '#ff6b6b', margin: 0 }}>Error: {uploadStatus.error}</h3>
          ) : (
            <>
              <h3 style={{ margin: '0 0 10px 0', color: '#6bff86' }}>{uploadStatus.message}</h3>
              <p><strong>Total Files:</strong> {uploadStatus.totalFiles}</p>
              <p><strong>Total Size:</strong> {uploadStatus.totalSize}</p>
              <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                <summary>View File Names</summary>
                <ul style={{ maxHeight: '100px', overflowY: 'auto' }}>
                  {uploadStatus.fileList.map((name, idx) => (
                    <li key={idx}>{name}</li>
                  ))}
                </ul>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App