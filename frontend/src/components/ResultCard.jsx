import { useState } from 'react'
import styles from './ResultCard.module.css'

export default function ResultCard({ letter, filename, cvUsed, onReset }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    if (filename) window.open(`/api/download/${filename}`, '_blank')
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>
        <span className={styles.stepNum}>04</span>
        Your Letter
        {cvUsed && <span className={styles.cvBadge}>via {cvUsed}</span>}
      </div>

      <div className={styles.letterBox}>{letter}</div>

      <div className={styles.actions}>
        <button className={styles.btnDownload} onClick={download}>↓ PDF</button>
        <button className={styles.btnCopy} onClick={copy}>{copied ? '✓ Copied' : '⎘ Copy'}</button>
        <button className={styles.btnReset} onClick={onReset}>↺ New Letter</button>
      </div>
    </div>
  )
}