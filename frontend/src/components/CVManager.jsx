import { useState, useEffect, useRef } from 'react'
import styles from './CVManager.module.css'

export default function CVManager({ selected, onSelect, disabled }) {
  const [cvs, setCvs] = useState({})
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState(null) // { type: 'success'|'error', text }
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => {
    fetchCVs()
  }, [])

  const fetchCVs = async () => {
    try {
      const res = await fetch('/api/cvs')
      const data = await res.json()
      setCvs(data)
    } catch (e) {
      console.error('Could not load CVs', e)
    }
  }

  const uploadCV = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadMsg(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload_cv', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.error) {
        setUploadMsg({ type: 'error', text: data.error })
      } else {
        setCvs(prev => ({ ...prev, [data.key]: data.label }))
        setUploadMsg({ type: 'success', text: `"${data.label}" uploaded` })
        setTimeout(() => setUploadMsg(null), 3000)
      }
    } catch (e) {
      setUploadMsg({ type: 'error', text: 'Upload failed: ' + e.message })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const deleteCV = async (key) => {
    if (!confirm(`Remove "${cvs[key]}"?`)) return
    try {
      const res = await fetch(`/api/delete_cv/${key}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setCvs(prev => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        if (selected === key) onSelect('auto')
      }
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadCV(file)
  }

  return (
    <div className={styles.card} style={{ animationDelay: '0.1s' }}>
      <div className={styles.cardLabel}>
        <span className={styles.step}>02</span>
        CV Profile
      </div>

      <div className={styles.cvGrid}>
        {/* Auto option */}
        <button
          className={`${styles.cvOption} ${selected === 'auto' ? styles.selected : ''}`}
          onClick={() => onSelect('auto')}
          disabled={disabled}
        >
          <span className={styles.cvIcon}>⚡</span>
          <span className={styles.cvName}>Auto-select</span>
          <span className={styles.cvSub}>Agent picks best fit</span>
        </button>

        {/* Dynamic CVs */}
        {Object.entries(cvs).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.cvOption} ${selected === key ? styles.selected : ''}`}
            onClick={() => !disabled && onSelect(key)}
            disabled={disabled}
          >
            <span className={styles.cvIcon}>📄</span>
            <span className={styles.cvName}>{label}</span>
            <span className={styles.cvSub}>{key}.txt</span>
            <span
              className={styles.deleteBtn}
              onClick={(e) => { e.stopPropagation(); deleteCV(key) }}
              title="Remove"
            >✕</span>
          </button>
        ))}
      </div>

      {/* Upload area */}
      <div
        className={`${styles.uploadArea} ${dragOver ? styles.dragOver : ''} ${uploading ? styles.uploading : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf"
          style={{ display: 'none' }}
          onChange={(e) => uploadCV(e.target.files[0])}
        />
        <span className={styles.uploadIcon}>{uploading ? '⏳' : '↑'}</span>
        <div>
          <p className={styles.uploadTitle}>
            {uploading ? 'Uploading...' : 'Upload a CV'}
          </p>
          <p className={styles.uploadSub}>.txt or .pdf · drag & drop or click</p>
        </div>
      </div>

      {uploadMsg && (
        <div className={`${styles.uploadMsg} ${styles[uploadMsg.type]}`}>
          {uploadMsg.type === 'success' ? '✓' : '✕'} {uploadMsg.text}
        </div>
      )}
    </div>
  )
}
