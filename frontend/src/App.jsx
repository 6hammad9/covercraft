import { useState, useCallback } from 'react'
import Header from './components/Header'
import JobInput from './components/JobInput'
import CVManager from './components/CVManager'
import GenerateButton from './components/GenerateButton'
import ResultCard from './components/ResultCard'
import Settings from './components/Settings'
import useExtensionJob from 'D:/covercraft/extension/useExtensionJob.js'
import styles from './App.module.css'

export default function App() {
  const [jobMode, setJobMode] = useState('paste')
  const [jobInput, setJobInput] = useState('')
  const [selectedCV, setSelectedCV] = useState('auto')
  const [status, setStatus] = useState('idle')
  const [steps, setSteps] = useState([])
  const [progress, setProgress] = useState(0)
  const [letter, setLetter] = useState('')
  const [filename, setFilename] = useState('')
  const [cvUsed, setCvUsed] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  // Receive job from browser extension
  useExtensionJob(useCallback((text) => {
    setJobInput(text)
    setJobMode('paste')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, []))

  const addStep = useCallback((text) => {
    setSteps(prev => [...prev, text])
  }, [])

  const generate = async () => {
    if (!jobInput.trim()) return
    setStatus('loading')
    setSteps([])
    setProgress(0)
    setLetter('')
    setFilename('')
    setCvUsed('')
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: jobMode, job_input: jobInput, cv_choice: selectedCV }),
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) { setErrorMsg(data.error); setStatus('error'); return }
            if (data.step) { addStep(data.step); setProgress(data.progress || 0) }
            if (data.letter) setLetter(data.letter)
            if (data.cv_used) setCvUsed(data.cv_used)
            if (data.filename) setFilename(data.filename)
            if (data.pdf_ready) setStatus('done')
          } catch (_) {}
        }
      }
    } catch (e) {
      setErrorMsg('Connection error: ' + e.message)
      setStatus('error')
    }
  }

  const reset = () => {
    setStatus('idle'); setSteps([]); setProgress(0)
    setLetter(''); setFilename(''); setCvUsed('')
    setErrorMsg(''); setJobInput('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={styles.app}>
      <Header onOpenSettings={() => setShowSettings(true)} />

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      <main className={styles.main}>
        <div className={styles.hero}>
          <p className={styles.heroEyebrow}>AI Cover Letter Agent</p>
          <h1 className={styles.heroTitle}>
            Letters that open<br /><em>doors, not bins</em>
          </h1>
          <p className={styles.heroSub}>
            Paste a job description or drop a URL. The agent reads it, matches your experience, and writes a letter that actually connects the dots.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.leftCol}>
            <JobInput mode={jobMode} setMode={setJobMode} value={jobInput} onChange={setJobInput} disabled={status === 'loading'} />
            <CVManager selected={selectedCV} onSelect={setSelectedCV} disabled={status === 'loading'} />
            <GenerateButton onClick={generate} status={status} steps={steps} progress={progress} error={errorMsg} disabled={!jobInput.trim()} />
          </div>
          <div className={styles.rightCol}>
            {(status === 'done' || letter) ? (
              <ResultCard letter={letter} filename={filename} cvUsed={cvUsed} onReset={reset} />
            ) : (
              <div className={styles.placeholder}>
                <span className={styles.placeholderGlyph}>✦</span>
                <p className={styles.placeholderText}>your letter appears here</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}