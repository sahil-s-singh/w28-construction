document.getElementById('year').textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const siteHeader = document.querySelector('.site-header');

menuToggle.addEventListener('click', () => {
  siteHeader.classList.toggle('nav-open');
});
const contactForm = document.querySelector('.contact-form');
const formStatus = contactForm.querySelector('.form-status');
const submitButton = contactForm.querySelector('button[type="submit"]');
const formSuccess = contactForm.querySelector('.form-success');

contactForm.querySelector('.form-reset').addEventListener('click', () => {
  contactForm.classList.remove('is-sent');
  contactForm.querySelector('input[name="name"]').focus();
});

contactForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';
  formStatus.className = 'form-status';
  formStatus.textContent = '';

  try {
    const response = await fetch(contactForm.action, {
      method: 'POST',
      body: new FormData(contactForm),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Sorry, your message could not be sent. Please call or email us instead.');
    }
    contactForm.reset();
    contactForm.classList.add('is-sent');
    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
    formSuccess.focus({ preventScroll: true });
  } catch (error) {
    formStatus.classList.add('is-error');
    formStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send Message';
  }
});
