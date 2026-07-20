import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadCsv } from '../api/client'
import Layout from '../components/Layout'
import { clearFeedbackSession } from '../utils/session'

function FilePicker({ label, hint, file, onChange }) {
  return (
    <label className="file-dropzone">
      <input
        type="file"
        accept=".csv"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
      <div className="file-dropzone-content">
        <p className="file-label-title">{label}</p>
        <p className="file-title">
          {file ? file.name : 'Drop CSV file here or click to browse'}
        </p>
        <p className="file-hint">{hint}</p>
      </div>
    </label>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [peerFile, setPeerFile] = useState(null)
  const [masterFile, setMasterFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(event) {
    event.preventDefault()
    if (!peerFile || !masterFile) {
      setError('Please upload both the peer evaluation CSV and the master list CSV.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await uploadCsv(peerFile, masterFile)
      clearFeedbackSession()
      sessionStorage.setItem('feedbackSessionId', result.session_id)
      sessionStorage.setItem('feedbackFilename', result.filename)
      navigate('/groups')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const ready = Boolean(peerFile && masterFile)

  return (
    <Layout
      title="Upload evaluation files"
      subtitle="Upload the peer eval CSV and master list. Groups are from the master list."
    >
      <section className="panel upload-panel">
        <form onSubmit={handleUpload} className="upload-form">
          <FilePicker
            label="1. Peer evaluation CSV"
            hint="Microsoft Forms export"
            file={peerFile}
            onChange={(file) => {
              setPeerFile(file)
              setError('')
            }}
          />
          <FilePicker
            label="2. Master list CSV"
            hint="Master list with Current Group column"
            file={masterFile}
            onChange={(file) => {
              setMasterFile(file)
              setError('')
            }}
          />

          {error && <p className="error-banner">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading || !ready}>
            {loading ? 'Uploading…' : 'Continue'}
          </button>
        </form>
      </section>
    </Layout>
  )
}
