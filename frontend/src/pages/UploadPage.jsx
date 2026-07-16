import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadCsv } from '../api/client'
import Layout from '../components/Layout'

export default function UploadPage() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(event) {
    event.preventDefault()
    if (!file) {
      setError('Please choose a CSV file to upload.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await uploadCsv(file)
      sessionStorage.setItem('feedbackSessionId', result.session_id)
      sessionStorage.setItem('feedbackFilename', result.filename)
      navigate('/groups')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout
      title="Upload Peer Evaluation CSV"
      subtitle="Upload the exported Microsoft Forms CSV to begin reviewing group feedback."
    >
      <section className="panel upload-panel">
        <form onSubmit={handleUpload} className="upload-form">
          <label className="file-dropzone">
            <input
              type="file"
              accept=".csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] || null)
                setError('')
              }}
            />
            <div className="file-dropzone-content">
              <span className="file-icon">📄</span>
              <p className="file-title">
                {file ? file.name : 'Drop your CSV here or click to browse'}
              </p>
              <p className="file-hint">Supports peer evaluation exports with group and rating columns.</p>
            </div>
          </label>

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading || !file}>
            {loading ? 'Processing…' : 'Feedback'}
          </button>
        </form>
      </section>
    </Layout>
  )
}
