// Quote requests are emailed by the Cloudflare Worker at /api/contact (see worker/index.js),
// which also sends the customer's automatic reply.
const PUBLIC_EMAIL = 'info@w28.construction';

// Paste a booking link here (Calendly, Google Calendar appointment page, etc.) and the
// "Book a Free Walkthrough" button will open it. While empty, the button selects the
// walkthrough option in the quote form instead.
const BOOKING_URL = '';
const MAX_PHOTOS = 3;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

// Add real profile URLs here; the Follow section and footer links appear only when set.
const SOCIAL = { instagram: 'https://www.instagram.com/w28.construction/', facebook: '' };

/* ---------------------------------------------------------------------------
   Visitor tracking. Everything here is OFF until you fill in a value.
   It only runs on your real website (never on localhost or the preview link)
   and never for visitors who have "Do Not Track" turned on.

   1) Visit counter - pick ONE provider and fill in its value:
        goatcounter : free, visitors + button clicks.   goatcounter: 'w28'   (the code you chose at goatcounter.com)
        plausible   : paid, visitors + button clicks.   plausible: 'w28.construction'
        cloudflare  : free, visitors only.              cloudflare: '<token from Cloudflare Web Analytics>'
   2) Microsoft Clarity (free): anonymous session recordings + heatmaps.
        Paste the project ID from clarity.microsoft.com into CLARITY_ID.
   3) Google Analytics 4 (free): paste your measurement ID (G-...) into GA4_ID.
   --------------------------------------------------------------------------- */
const ANALYTICS = { provider: '', goatcounter: '', plausible: '', cloudflare: '' };
const CLARITY_ID = '';
// Google Analytics 4 (free). Paste your measurement ID from analytics.google.com, e.g. 'G-ABC123XYZ'.
const GA4_ID = 'G-X3XZY8YZ47';

const doNotTrack = navigator.doNotTrack === '1' || window.doNotTrack === '1';
const trackingAllowed = (() => {
  const host = location.hostname;
  const isDev = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.claudeusercontent.com') || host.endsWith('claude.ai') || location.protocol === 'file:';
  return !isDev && !doNotTrack;
})();
const analyticsOn = trackingAllowed && Boolean(ANALYTICS.provider && ANALYTICS[ANALYTICS.provider]);
const clarityOn = trackingAllowed && Boolean(CLARITY_ID);
const ga4On = trackingAllowed && /^G-[A-Z0-9]{4,}$/i.test(GA4_ID);

function track(eventName) {
  try {
    if (ga4On && typeof window.gtag === 'function') window.gtag('event', eventName.replace(/-/g, '_'));
    if (analyticsOn && ANALYTICS.provider === 'goatcounter' && window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: eventName, title: eventName, event: true });
    } else if (analyticsOn && ANALYTICS.provider === 'plausible' && typeof window.plausible === 'function') {
      window.plausible(eventName);
    }
    if (clarityOn && typeof window.clarity === 'function') window.clarity('event', eventName);
  } catch (error) { /* analytics must never break the site */ }
}

if (analyticsOn) {
  const tag = document.createElement('script');
  tag.async = true;
  if (ANALYTICS.provider === 'goatcounter') {
    tag.dataset.goatcounter = 'https://' + ANALYTICS.goatcounter + '.goatcounter.com/count';
    tag.src = 'https://gc.zgo.at/count.js';
  } else if (ANALYTICS.provider === 'plausible') {
    tag.defer = true;
    tag.dataset.domain = ANALYTICS.plausible;
    tag.src = 'https://plausible.io/js/script.js';
  } else if (ANALYTICS.provider === 'cloudflare') {
    tag.defer = true;
    tag.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS.cloudflare });
    tag.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  }
  document.head.appendChild(tag);
}

if (clarityOn) {
  (function (c, l, a, r, i) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    const t = l.createElement(r);
    t.async = 1;
    t.src = 'https://www.clarity.ms/tag/' + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', CLARITY_ID);
}

if (ga4On) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const gaTag = document.createElement('script');
  gaTag.async = true;
  gaTag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
  document.head.appendChild(gaTag);
}

if (analyticsOn || clarityOn || ga4On) {
  const privacyNote = document.createElement('p');
  if (ga4On && clarityOn) {
    privacyNote.textContent = 'We use Google Analytics and anonymous session recordings, which use cookies, to improve this website. Anything you type into a form is never recorded.';
  } else if (ga4On) {
    privacyNote.textContent = 'We use Google Analytics, which uses cookies, to understand how visitors use this website.';
  } else if (clarityOn) {
    privacyNote.textContent = 'We use analytics, including anonymous session recordings that use cookies, to improve this website. Anything you type into a form is never recorded.';
  } else {
    privacyNote.textContent = 'We count visits with privacy-friendly analytics: no cookies and no personal data.';
  }
  const footerBottom = document.querySelector('.footer-bottom .container');
  if (footerBottom) footerBottom.appendChild(privacyNote);
}

/* ---------------------------------------------------------------------------
   Visit journey: remembered for this visit only (in the browser) and attached to a quote
   request so you can see where a named lead came from and what they looked at.
   --------------------------------------------------------------------------- */
const SECTION_LABELS = {
  top: 'Home', services: 'Services', featured: 'Featured Project', 'our-work': 'Our Work', why: 'Why W28',
  schedule: 'Flexible Scheduling', who: 'Who We Help', 'property-managers': 'Landlords & Property Managers',
  realtors: 'Realtors', process: 'How We Work', about: 'About', contact: 'Contact',
};
const journey = (() => {
  try {
    const saved = JSON.parse(sessionStorage.getItem('w28_journey') || 'null');
    if (saved && saved.start) return saved;
  } catch (error) { /* storage unavailable */ }
  const params = new URLSearchParams(location.search);
  let source = params.get('ref') || params.get('utm_source') || '';
  if (!source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host && host !== location.hostname) source = host;
    } catch (error) { /* ignore bad referrer */ }
  }
  return {
    start: Date.now(),
    source: source || 'direct (typed link, bookmark, message or card QR)',
    landing: location.pathname + location.search,
    sections: [],
    actions: [],
  };
})();

function saveJourney() {
  if (doNotTrack) return;
  try { sessionStorage.setItem('w28_journey', JSON.stringify(journey)); } catch (error) { /* ignore */ }
}
function noteAction(label) {
  if (doNotTrack || journey.actions.includes(label)) return;
  journey.actions.push(label);
  saveJourney();
}
function noteSections() {
  if (doNotTrack) return;
  let changed = false;
  const viewHeight = window.innerHeight || document.documentElement.clientHeight || 800;
  document.querySelectorAll('main > section').forEach((section) => {
    const label = SECTION_LABELS[section.id];
    if (!label || journey.sections.includes(label)) return;
    const rect = section.getBoundingClientRect();
    if (rect.top < viewHeight * 0.65 && rect.bottom > viewHeight * 0.25) {
      journey.sections.push(label);
      changed = true;
    }
  });
  if (changed) saveJourney();
}
window.addEventListener('scroll', noteSections, { passive: true });
noteSections();
saveJourney();

function describeDevice() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'browser';
  const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const view = width <= 720 ? 'phone view' : 'wide view';
  return os + ', ' + browser + ' (' + width + 'x' + height + ', ' + view + ')';
}
function timeOnSite() {
  const seconds = Math.max(1, Math.round((Date.now() - journey.start) / 1000));
  return seconds < 60 ? seconds + ' sec' : Math.floor(seconds / 60) + ' min ' + (seconds % 60) + ' sec';
}
function makeLeadId() {
  return 'W28-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).toUpperCase().slice(2, 5);
}

// Count the actions that matter: calls, emails, Instagram taps, walkthrough and service quote clicks.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.startsWith('tel:')) { track('call-click'); noteAction('Tapped the phone number'); }
  else if (href.startsWith('mailto:')) { track('email-click'); noteAction('Tapped the email address'); }
  else if (href.includes('instagram.com')) { track('instagram-click'); noteAction('Opened Instagram'); }
  else if (link.id === 'book-walkthrough') { track('walkthrough-click'); noteAction('Clicked "Book a Free Walkthrough"'); }
  else if (link.classList.contains('service-cta')) { track('service-quote-click'); noteAction('Clicked the ' + (link.dataset.project || 'service') + ' quote button'); }
});
document.addEventListener('play', (event) => {
  if (event.target.matches && event.target.matches('.media-tile')) noteAction('Played a project video');
}, true);
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* Hero video: phones get the vertical version; larger screens keep the wide one already in the page */
const heroVideo = document.querySelector('.hero-video');
const phoneQuery = window.matchMedia('(max-width: 720px)');
const HERO_TALL = { src: 'assets/videos/hero-tall.mp4', poster: 'assets/posters/hero-tall.jpg' };
const HERO_WIDE = { src: 'assets/videos/hero-wide.mp4', poster: 'assets/posters/hero-wide.jpg' };
function loadHeroVideo() {
  const wanted = phoneQuery.matches ? HERO_TALL : HERO_WIDE;
  if (heroVideo && !heroVideo.currentSrc.endsWith(wanted.src)) {
    heroVideo.poster = wanted.poster;
    heroVideo.src = wanted.src;
    heroVideo.play().catch(() => {});
  }
}
loadHeroVideo();
phoneQuery.addEventListener('change', loadHeroVideo);

/* Navigation */
const menuToggle = document.querySelector('.menu-toggle');
const siteHeader = document.querySelector('.site-header');

function setMenu(open) {
  siteHeader.classList.toggle('nav-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}
menuToggle.addEventListener('click', () => setMenu(!siteHeader.classList.contains('nav-open')));
document.querySelectorAll('.nav a, .nav-cta').forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && siteHeader.classList.contains('nav-open')) {
    setMenu(false);
    menuToggle.focus();
  }
});

/* Social links */
let anySocial = false;
document.querySelectorAll('[data-social]').forEach((el) => {
  const url = SOCIAL[el.dataset.social];
  if (url) {
    el.href = url;
    el.hidden = false;
    anySocial = true;
  }
});
if (anySocial) {
  const follow = document.getElementById('follow');
  const footerSocial = document.querySelector('.footer-social');
  if (SOCIAL.instagram && follow) follow.hidden = false;
  if (footerSocial) footerSocial.hidden = false;
}

/* Quote form */
const contactForm = document.querySelector('.contact-form');
const formStatus = contactForm.querySelector('.form-status');
const submitButton = contactForm.querySelector('button[type="submit"]');
const formSuccess = contactForm.querySelector('.form-success');
const submitLabel = submitButton.textContent;

// CTA buttons pre-select the matching project type in the form.
document.querySelectorAll('[data-project]').forEach((button) => {
  button.addEventListener('click', () => {
    const select = contactForm.querySelector('select[name="project_type"]');
    if (select) {
      select.value = button.dataset.project;
      validateField(select);
    }
  });
});

contactForm.querySelector('.form-reset').addEventListener('click', () => {
  contactForm.classList.remove('is-sent');
  contactForm.querySelector('input[name="name"]').focus();
});

const TYPO_DOMAINS = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'hotnail.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com', 'outloook.com': 'outlook.com',
};

const validators = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your name.'),
  email: (v) => {
    const value = v.trim();
    if (!value) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(value)) {
      return 'That email looks incorrect. It should look like name@example.com.';
    }
    const domain = value.split('@')[1].toLowerCase();
    if (TYPO_DOMAINS[domain]) return 'Did you mean ' + value.split('@')[0] + '@' + TYPO_DOMAINS[domain] + '?';
    return '';
  },
  phone: (v) => {
    if (!v.trim()) return 'Please enter a phone number so we can reach you.';
    const digits = v.replace(/\D/g, '');
    const national = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
    if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national) || /[^\d\s()+.\-]/.test(v)) {
      return 'That phone number looks incorrect. Please enter 10 digits, like (306) 555-0123.';
    }
    return '';
  },
  project_type: (v) => (v ? '' : 'Please choose a project type.'),
  message: (v) => (v.trim().length >= 10 ? '' : 'Please tell us a little about your project (at least 10 characters).'),
};

function validateField(field) {
  const message = validators[field.name] ? validators[field.name](field.value) : '';
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  const slot = field.parentElement.querySelector('.field-error');
  if (slot) slot.textContent = message;
  return !message;
}

const fields = Array.from(contactForm.querySelectorAll('input[name], select[name], textarea[name]')).filter((f) => validators[f.name]);
fields.forEach((field) => {
  field.addEventListener('blur', () => validateField(field));
  const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
  field.addEventListener(eventName, () => {
    if (field.getAttribute('aria-invalid') === 'true') validateField(field);
  });
});

/* Photos */
const photoInput = contactForm.querySelector('input[name="photos"]');
const photoList = contactForm.querySelector('.file-list');
const photoError = photoInput.parentElement.querySelector('.field-error');
let selectedPhotos = [];

function formatSize(bytes) {
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function renderPhotos() {
  photoList.textContent = '';
  selectedPhotos.forEach((file, index) => {
    const item = document.createElement('span');
    item.className = 'file-item';
    item.textContent = file.name + ' (' + formatSize(file.size) + ') ';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', 'Remove photo ' + file.name);
    remove.addEventListener('click', () => {
      selectedPhotos.splice(index, 1);
      renderPhotos();
    });
    item.appendChild(remove);
    photoList.appendChild(item);
  });
  photoInput.value = '';
}

photoInput.addEventListener('change', () => {
  photoError.textContent = '';
  const incoming = Array.from(photoInput.files);
  const valid = incoming.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
  if (valid.length !== incoming.length) photoError.textContent = 'Please choose JPG, PNG or WebP photos only.';
  const room = MAX_PHOTOS - selectedPhotos.length;
  if (valid.length > room) photoError.textContent = 'You can add up to ' + MAX_PHOTOS + ' photos.';
  selectedPhotos = selectedPhotos.concat(valid.slice(0, Math.max(0, room)));
  renderPhotos();
});

async function compressImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (blob && blob.size < file.size) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (error) { /* fall back to the original file */ }
  return file;
}

/* Phone quick-jump chips: highlight the section you are in */
const chips = Array.from(document.querySelectorAll('.section-chips a'));
let activeChip = null;
function updateChips() {
  if (!chips.length || !chips[0].offsetParent) return;
  let current = null;
  chips.forEach((chip) => {
    const target = document.querySelector(chip.getAttribute('href'));
    if (target && target.getBoundingClientRect().top <= 150) current = chip;
  });
  if (current === activeChip) return;
  activeChip = current;
  chips.forEach((chip) => chip.classList.toggle('is-active', chip === current));
  if (current) {
    const bar = current.parentElement;
    bar.scrollTo({ left: Math.max(0, current.offsetLeft - 16), behavior: 'smooth' });
  }
}
window.addEventListener('scroll', updateChips, { passive: true });
window.addEventListener('resize', updateChips);
updateChips();

/* Phone: tuck the jump bar away while scrolling down, bring it back when scrolling up */
const chipBar = document.querySelector('.section-chips');
let lastScrollY = window.scrollY;
function tuckChips() {
  if (!chipBar || !chipBar.offsetParent) return;
  const y = window.scrollY;
  if (y < 140 || y < lastScrollY - 6) chipBar.classList.remove('is-tucked');
  else if (y > lastScrollY + 6) chipBar.classList.add('is-tucked');
  lastScrollY = y;
}
window.addEventListener('scroll', tuckChips, { passive: true });

/* Phone: position dots under each swipe row */
document.querySelectorAll('.service-columns, .gallery-grid, .bda, .who-grid, .why-grid').forEach((row) => {
  const items = Array.from(row.children);
  if (items.length < 2) return;
  const dots = document.createElement('div');
  dots.className = 'carousel-dots';
  dots.setAttribute('aria-hidden', 'true');
  items.forEach(() => dots.appendChild(document.createElement('span')));
  row.after(dots);
  const spans = Array.from(dots.children);
  const update = () => {
    if (!dots.offsetParent) return;
    const max = row.scrollWidth - row.clientWidth;
    const index = max > 0 ? Math.round((row.scrollLeft / max) * (items.length - 1)) : 0;
    spans.forEach((span, i) => span.classList.toggle('is-on', i === index));
  };
  row.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
});

/* Walkthrough booking */
const bookButton = document.getElementById('book-walkthrough');
bookButton.addEventListener('click', (event) => {
  event.preventDefault();
  if (BOOKING_URL) {
    window.open(BOOKING_URL, '_blank', 'noopener');
    return;
  }
  contactForm.querySelector('input[name="walkthrough"]').checked = true;
  contactForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  formStatus.className = 'form-status';
  formStatus.textContent = 'Free walkthrough selected. Choose a preferred timing and send your request.';
  setTimeout(() => contactForm.querySelector('select[name="timing"]').focus({ preventScroll: true }), 500);
});

/* Mobile quick-contact bar: hide while the form is on screen so it never covers the submit button */
const mobileBar = document.querySelector('.mobile-bar');
function updateMobileBar() {
  if (!mobileBar) return;
  const rect = contactForm.getBoundingClientRect();
  const formOnScreen = rect.top < window.innerHeight - 40 && rect.bottom > 40;
  mobileBar.classList.toggle('is-hidden', formOnScreen);
}
window.addEventListener('scroll', updateMobileBar, { passive: true });
window.addEventListener('resize', updateMobileBar);
updateMobileBar();

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const results = fields.map((field) => ({ field, ok: validateField(field) }));
  const firstBad = results.find((r) => !r.ok);
  if (firstBad) {
    firstBad.field.focus();
    return;
  }
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  formStatus.className = 'form-status';
  formStatus.textContent = '';

  const data = {};
  new FormData(contactForm).forEach((value, key) => { if (key !== 'photos') data[key] = value; });
  const wantsWalkthrough = Boolean(data.walkthrough);
  const leadId = makeLeadId();
  data.lead_id = leadId;
  if (!doNotTrack) {
    data.source = journey.source;
    data.landing_page = journey.landing;
    data.device = describeDevice();
    data.time_on_site = timeOnSite();
    data.sections_viewed = journey.sections.join(' > ') || '(none recorded)';
    data.actions_taken = journey.actions.join('; ') || '(none recorded)';
  }
  const subject = (wantsWalkthrough ? 'Walkthrough + quote request from ' : 'Quote request from ') + (data.name || 'website') + ' [' + leadId + ']';

  try {
    const photos = await Promise.all(selectedPhotos.map(compressImage));
    const totalBytes = photos.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      photoError.textContent = 'Your photos are too large to send together (limit 5 MB). Please remove one or email them to ' + PUBLIC_EMAIL + '.';
      submitButton.disabled = false;
      submitButton.textContent = submitLabel;
      return;
    }
    const body = new FormData();
    Object.keys(data).forEach((key) => body.append(key, data[key]));
    photos.forEach((file, index) => body.append('photo_' + (index + 1), file, file.name));

    const response = await fetch(contactForm.action, { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Sorry, your request could not be sent. Please call or email us instead.');
    }
    contactForm.reset();
    selectedPhotos = [];
    renderPhotos();
    const formRef = contactForm.querySelector('.form-ref');
    if (formRef) formRef.textContent = 'Your reference number: ' + leadId;
    contactForm.classList.add('is-sent');
    if (clarityOn && typeof window.clarity === 'function') {
      window.clarity('set', 'lead_id', leadId);
      window.clarity('identify', leadId);
    }
    track(wantsWalkthrough ? 'quote-request-walkthrough' : 'quote-request');
    if (ga4On && typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { lead_id: leadId, method: wantsWalkthrough ? 'walkthrough' : 'quote' });
    formSuccess.focus({ preventScroll: true });
  } catch (error) {
    formStatus.classList.add('is-error');
    const offline = error instanceof TypeError;
    formStatus.textContent = offline ? "We couldn't send this online right now. " : error.message + ' ';
    const body = [
      'Name: ' + (data.name || ''),
      'Phone: ' + (data.phone || ''),
      'Email: ' + (data.email || ''),
      'Property address: ' + (data.address || ''),
      'Project type: ' + (data.project_type || ''),
      'Preferred contact method: ' + (data.contact_method || ''),
      'Preferred timing: ' + (data.timing || ''),
      'Free walkthrough requested: ' + (wantsWalkthrough ? 'Yes' : 'No'),
      'How they heard about us: ' + (data.heard_from || ''),
      'Reference: ' + leadId,
      '',
      data.message || '',
      '',
      selectedPhotos.length ? '(Please attach your photos to this email.)' : '',
    ].join('\n');
    const fallback = document.createElement('a');
    fallback.href = 'mailto:' + PUBLIC_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    fallback.textContent = 'Email your request instead';
    formStatus.appendChild(fallback);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = submitLabel;
  }
});
