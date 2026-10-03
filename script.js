document.getElementById('year').textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const siteHeader = document.querySelector('.site-header');

menuToggle.addEventListener('click', () => {
  siteHeader.classList.toggle('nav-open');
});