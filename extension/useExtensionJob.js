/**
 * Hook: listens for job data sent from the CoverCraft browser extension.
 * The extension stores the job in chrome.storage and sends a message.
 * This hook picks up either channel and calls onJob(text) when received.
 */
import { useEffect } from 'react'

export default function useExtensionJob(onJob) {
  useEffect(() => {
    // Channel 1: direct message from extension (if app tab was already open)
    const handler = (event) => {
      if (event.data?.type === 'COVERCRAFT_JOB') {
        onJob(event.data.jobText)
      }
    }
    window.addEventListener('message', handler)

    // Channel 2: chrome.storage (if app was opened fresh by extension)
    const checkStorage = async () => {
      if (typeof chrome === 'undefined' || !chrome?.storage?.local) return
      try {
        const result = await chrome.storage.local.get('pendingJob')
        if (result.pendingJob) {
          const age = Date.now() - result.pendingJob.timestamp
          if (age < 30000) { // only use if < 30 seconds old
            onJob(result.pendingJob.text)
            await chrome.storage.local.remove('pendingJob')
          }
        }
      } catch (_) {}
    }

    checkStorage()

    // Channel 3: chrome runtime message (extension → content script → app)
    const chromeHandler = (msg) => {
      if (msg.action === 'fillJob' && msg.jobText) {
        onJob(msg.jobText)
      }
    }

    if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(chromeHandler)
    }

    return () => {
      window.removeEventListener('message', handler)
      if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(chromeHandler)
      }
    }
  }, [onJob])
}
