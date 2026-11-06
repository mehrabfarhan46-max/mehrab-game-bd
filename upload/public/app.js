
document.addEventListener('DOMContentLoaded', () => {
  // Update footer year
  const yearElements = document.querySelectorAll(
    '#currentYear, .current-year'
  );

  yearElements.forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  // Smooth navigation
  const navLinks = document.querySelectorAll(
    'a[href^="#"]'
  );

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');

      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);

      if (!target) return;

      event.preventDefault();

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  console.log('MEHRAB GAMING BD loaded successfully.');
});
