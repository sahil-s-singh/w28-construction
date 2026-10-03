document.getElementById('year').textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const siteHeader = document.querySelector('.site-header');

menuToggle.addEventListener('click', () => {
  siteHeader.classList.toggle('nav-open');
});
const contactForm = document.querySelector('.contact-form');
const formStatus = contactForm.querySelector('.form-status');
const submitButton = contactForm.querySelector('button[type="submit"]');

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
    formStatus.classList.add('is-success');
    formStatus.textContent = "Thanks! We've received your message and will be in touch soon.";
  } catch (error) {
    formStatus.classList.add('is-error');
    formStatus.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send Message';
  }
});
