import { useState } from 'react'

function App() {
  const [status, setStatus] = useState('Checking connection...')

  const checkServer = async () => {
    try {
      // 访问刚才搭建的 Node API
      const response = await fetch('http://localhost:3000/api/status')
      const data = await response.json()
      setStatus(`Success! DB Time: ${data.db_time}`)
    } catch (error) {
      setStatus(`Error: ${error.message}`)
    }
  }

  return (
    <div style={{ padding: '20px', color: 'white' }}>
      <h1>Voyis MVP</h1>
      <div className="card">
        <button onClick={checkServer}>
          Test Server Connection
        </button>
        <p>Status: {status}</p>
      </div>
    </div>
  )
}

export default App