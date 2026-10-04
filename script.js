// Quote requests are emailed by the Cloudflare Worker at /api/contact (see worker/index.js).
const PUBLIC_EMAIL = 'info@w28.construction';

// Add real profile URLs here; the Follow section and footer links appear only when set.
const SOCIAL = { instagram: 'https://www.instagram.com/w28.construction/', facebook: '' };

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

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

  const formData = new FormData(contactForm);
  const data = Object.fromEntries(formData);
  const subject = 'New W28 Construction quote request from ' + (data.name || 'website');

  try {
    const response = await fetch(contactForm.action, { method: 'POST', body: formData });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Sorry, your request could not be sent. Please call or email us instead.');
    }
    contactForm.reset();
    contactForm.classList.add('is-sent');
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
      '',
      data.message || '',
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
