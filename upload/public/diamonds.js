
const API = 'http://localhost:4000/api/public/packages';

document.addEventListener('DOMContentLoaded', () => {
  const packageList = document.getElementById('diamond-packages');
  const categoryButtons = document.querySelectorAll('.store-category');
  const packageHeading = document.getElementById('package-heading');

  let allPackages = [];
  let activeCategory = 'diamonds';

  const categoryNames = {
    diamonds: '💎 Diamond Packages',
    weekly: '📅 Weekly Membership',
    monthly: '🗓️ Monthly Membership',
    levelup: '🚀 Level Up Pass'
  };

  function getCategory(item) {
    const value = [
      item.category,
      item.type,
      item.name_en,
      item.name_bn
    ].filter(Boolean).join(' ').toLowerCase();

    if (value.includes('weekly')) return 'weekly';
    if (value.includes('monthly')) return 'monthly';
    if (value.includes('level up') || value.includes('levelup')) {
      return 'levelup';
    }

    return 'diamonds';
  }

  function showPackages() {
    if (!packageList) return;

    packageList.replaceChildren();

    const filtered = allPackages.filter(
      item => getCategory(item) === activeCategory
    );

    if (!filtered.length) {
      packageList.textContent =
        'No packages available in this category yet.';
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'package-card';

      if (item.image_url) {
        const image = document.createElement('img');
        image.className = 'package-image';
        image.src = item.image_url;
        image.alt = item.name_en || 'Free Fire package';
        image.loading = 'lazy';

        image.onerror = () => image.remove();

        card.appendChild(image);
      }

      const title = document.createElement('h3');
      title.textContent = item.name_en || 'Free Fire Package';

      const banglaName = document.createElement('p');
      banglaName.textContent = item.name_bn || '';

      card.append(title, banglaName);

      if (getCategory(item) === 'diamonds' && item.diamonds) {
        const diamonds = document.createElement('p');
        diamonds.className = 'package-diamonds';
        diamonds.textContent = `${item.diamonds} Diamonds`;
        card.appendChild(diamonds);
      }

      const price = document.createElement('p');
      price.className = 'package-price';
      price.textContent = `৳${item.price}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Order Now';

      button.addEventListener('click', () => {
        const params = new URLSearchParams({
          package_id: String(item.id)
        });

        window.location.href = `login.html?${params.toString()}`;
      });

      card.append(price, button);
      packageList.appendChild(card);
    });
  }

  async function loadPackages() {
    if (!packageList) return;

    packageList.textContent = 'Loading packages...';

    try {
      const response = await fetch(API);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load packages.');
      }

      allPackages = data.packages || [];
      showPackages();
    } catch (error) {
      packageList.textContent =
        'Could not load packages. Please try again later.';
    }
  }

  categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
      categoryButtons.forEach(item =>
        item.classList.remove('active')
      );

      button.classList.add('active');
      activeCategory = button.dataset.category;

      if (packageHeading) {
        packageHeading.textContent =
          categoryNames[activeCategory] || 'Packages';
      }

      showPackages();
    });
  });

  loadPackages();
});
