/**
 * CoverCraft Popup Script
 * Manages the popup UI state machine and communicates with content.js + CoverCraft app.
 */

const SUPPORTED_HOSTS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'glassdoor.de',
  'stepstone.de',
  'xing.com',
]

// ── State machine ──────────────────────────────────────────────

const states = ['unsupported', 'idle', 'loading', 'preview', 'success', 'error']

function setState(name) {
  states.forEach(s => {
    const el = document.getElementById(`state-${s}`)
    if (el) el.classList.toggle('active', s === name)
  })
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg
  setState('error')
}

// ── Stored job data ────────────────────────────────────────────

let extractedJob = null

// ── Init ───────────────────────────────────────────────────────

async function init() {
  // Load saved server URL
  const stored = await chrome.storage.local.get('serverUrl')
  const url = stored.serverUrl || 'http://localhost:5173'
  document.getElementById('server-url').value = url

  // Check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const host = new URL(tab.url).hostname

  // Update site badge
  const badge = document.getElementById('site-badge')
  const match = SUPPORTED_HOSTS.find(h => host.includes(h))
  if (match) {
    badge.textContent = match
    badge.style.color = 'var(--teal)'
    badge.style.borderColor = 'var(--teal-border)'
    setState('idle')
  } else {
    badge.textContent = host.replace('www.', '')
    setState('unsupported')
  }
}

// ── Extract ────────────────────────────────────────────────────

async function extract() {
  setState('loading')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  try {
    // Inject content script if not already present
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    }).catch(() => {}) // already injected — ignore error

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'extract' })

    if (!result || result.error) {
      showError(result?.error || 'Could not extract job data. The page structure may have changed.')
      return
    }

    if (!result.description || result.description.length < 50) {
      showError('Job description not found on this page. Try scrolling to the full job posting first.')
      return
    }

    extractedJob = result
    showPreview(result)

  } catch (e) {
    showError('Could not read the page. Make sure you are on a job posting (not a search results page) and try again.\n\n' + e.message)
  }
}

// ── Preview ────────────────────────────────────────────────────

function showPreview(job) {
  document.getElementById('prev-title').textContent    = job.title    || 'Unknown title'
  document.getElementById('prev-company').textContent  = job.company  || 'Unknown company'
  document.getElementById('prev-location').textContent = job.location || ''
  document.getElementById('prev-desc').textContent     = job.description.slice(0, 300) + '...'

  // Show fallback warning if needed
  document.getElementById('fallback-warn').style.display = job._fallback ? 'block' : 'none'

  setState('preview')
}

// ── Send to CoverCraft ─────────────────────────────────────────

async function sendToCoverCraft() {
  if (!extractedJob) return

  const stored = await chrome.storage.local.get('serverUrl')
  const serverUrl = (stored.serverUrl || 'http://localhost:5173').replace(/\/$/, '')

  // Build formatted job text
  const jobText = [
    extractedJob.title    ? `Role: ${extractedJob.title}`       : '',
    extractedJob.company  ? `Company: ${extractedJob.company}`  : '',
    extractedJob.location ? `Location: ${extractedJob.location}`: '',
    extractedJob.url      ? `Source: ${extractedJob.url}`       : '',
    '',
    '--- Job Description ---',
    extractedJob.description,
  ].filter(Boolean).join('\n')

  // Store in chrome.storage so the app can pick it up
  await chrome.storage.local.set({
    pendingJob: {
      text: jobText,
      title: extractedJob.title,
      company: extractedJob.company,
      timestamp: Date.now(),
    }
  })

  // Try to find an existing CoverCraft tab
  const tabs = await chrome.tabs.query({})
  const appTab = tabs.find(t => t.url && t.url.startsWith(serverUrl))

  if (appTab) {
    // Focus existing tab and send message
    await chrome.tabs.update(appTab.id, { active: true })
    await chrome.windows.update(appTab.windowId, { focused: true })
    await chrome.tabs.sendMessage(appTab.id, {
      action: 'fillJob',
      jobText,
    }).catch(() => {
      // Tab exists but content script not ready — it will pick up from storage on load
    })
  } else {
    // Open CoverCraft in new tab
    await chrome.tabs.create({ url: serverUrl })
  }

  setState('success')
}

// ── Event listeners ────────────────────────────────────────────

document.getElementById('extract-btn').addEventListener('click', extract)

document.getElementById('send-btn').addEventListener('click', sendToCoverCraft)

document.getElementById('retry-btn').addEventListener('click', () => {
  setState('idle')
  extractedJob = null
})

document.getElementById('error-retry-btn').addEventListener('click', () => {
  setState('idle')
  extractedJob = null
})

document.getElementById('open-btn').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get('serverUrl')
  const url = stored.serverUrl || 'http://localhost:5173'
  chrome.tabs.create({ url })
})

document.getElementById('save-url-btn').addEventListener('click', async () => {
  const url = document.getElementById('server-url').value.trim()
  if (url) {
    await chrome.storage.local.set({ serverUrl: url })
    const btn = document.getElementById('save-url-btn')
    btn.textContent = '✓ Saved'
    btn.style.color = 'var(--teal)'
    setTimeout(() => { btn.textContent = 'Save'; btn.style.color = '' }, 2000)
  }
})

// ── Boot ───────────────────────────────────────────────────────

init()
