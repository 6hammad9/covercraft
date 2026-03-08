/**
 * CoverCraft Content Script
 * Runs on job board pages and extracts structured job info.
 * Each extractor returns: { title, company, location, description }
 */

// ── Helpers ────────────────────────────────────────────────────

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function textOf(selector, root = document) {
  const el = root.querySelector(selector)
  return el ? clean(el.innerText || el.textContent) : ''
}

function multiText(selectors, root = document) {
  for (const sel of selectors) {
    const text = textOf(sel, root)
    if (text.length > 40) return text
  }
  return ''
}

// ── Site Extractors ────────────────────────────────────────────

function extractLinkedIn() {
  const title = multiText([
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1',
    'h1.t-24',
    'h1',
  ])

  const company = multiText([
    '.job-details-jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__subtitle-primary-grouping a',
  ])

  const location = multiText([
    '.job-details-jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__bullet',
    '.jobs-unified-top-card__workplace-type',
  ])

  const description = multiText([
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description-content__text',
    '.job-details-about-the-job-module__description',
    '#job-details',
    '.jobs-description',
  ])

  return { title, company, location, description }
}

function extractIndeed() {
  const title = multiText([
    'h1.jobsearch-JobInfoHeader-title',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    'h1',
  ])

  const company = multiText([
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    '.jobsearch-InlineCompanyRating-companyHeader a',
  ])

  const location = multiText([
    '[data-testid="job-location"]',
    '[data-testid="inlineHeader-companyLocation"]',
    '.jobsearch-JobInfoHeader-subtitle div:last-child',
  ])

  const description = multiText([
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[data-testid="jobDescriptionText"]',
  ])

  return { title, company, location, description }
}

function extractGlassdoor() {
  const title = multiText([
    '[data-test="job-title"]',
    'h1.job-title',
    '.JobDetails_jobTitle__Rw_gn',
    'h1',
  ])

  const company = multiText([
    '[data-test="employer-name"]',
    '.JobDetails_companyNameAndRating__qjdDl',
    '.EmployerProfile_employerName__Xemli',
  ])

  const location = multiText([
    '[data-test="job-location"]',
    '.JobDetails_location__mSg5h',
  ])

  const description = multiText([
    '[data-test="jobDescriptionContent"]',
    '.JobDetails_jobDescription__uW_fK',
    '.desc',
  ])

  return { title, company, location, description }
}

function extractStepStone() {
  const title = multiText([
    'h1[data-at="header-job-title"]',
    '.listing-content h1',
    'h1',
  ])

  const company = multiText([
    '[data-at="header-company-name"]',
    '.listing-header__company-name',
    '.at-header-company-name',
  ])

  const location = multiText([
    '[data-at="job-ad-contact-section-location"]',
    '.at-listing__list-icons_location',
    '[data-at="header-job-location"]',
  ])

  const description = multiText([
    '[data-at="jobad-responsibilities-text"]',
    '.job-ad-display-8y3rn',
    '.listing-content__description',
    'article',
  ])

  return { title, company, location, description }
}

function extractXING() {
  const title = multiText([
    '[data-xds="Headline"]',
    'h1.job-ad-title',
    'h1',
  ])

  const company = multiText([
    '.company-name',
    '[data-xds="BodyCopy"] a',
    '.xing-link',
  ])

  const location = multiText([
    '.location',
    '[data-xds="BodyCopy"]:nth-child(2)',
  ])

  const description = multiText([
    '.job-ad-description',
    '[data-xds="RteContent"]',
    '.description',
    'article',
  ])

  return { title, company, location, description }
}

// ── Router ─────────────────────────────────────────────────────

function extract() {
  const host = window.location.hostname

  let data
  if (host.includes('linkedin.com'))   data = extractLinkedIn()
  else if (host.includes('indeed.com')) data = extractIndeed()
  else if (host.includes('glassdoor')) data = extractGlassdoor()
  else if (host.includes('stepstone')) data = extractStepStone()
  else if (host.includes('xing.com'))  data = extractXING()
  else return null

  // Fallback: grab all visible text if description is empty
  if (!data.description || data.description.length < 100) {
    const body = document.body.innerText
    data.description = clean(body).slice(0, 5000)
    data._fallback = true
  }

  data.url = window.location.href
  data.site = host
  return data
}

// ── Message listener ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    const result = extract()
    sendResponse(result || { error: 'Could not extract job data from this page.' })
  }
  return true // keep channel open for async
})
