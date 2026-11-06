
const likesContainer = document.getElementById('likes-services');

const API = 'http://localhost:4000/api/public/likes';

async function loadLikesPackages() {
  if (!likesContainer) return;

  likesContainer.innerHTML = '<p>Loading Likes Packages...</p>';

  try {
    const response = await fetch(API);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Could not load packages.');
    }

    const packages = data.likes || [];

    likesContainer.innerHTML = '';

    if (packages.length === 0) {
      likesContainer.innerHTML =
        '<p>No Likes packages available right now.</p>';
      return;
    }

    packages.forEach(item => {
      const card = document.createElement('article');
      card.className = 'service-card package-card';

      const tag = document.createElement('span');
      tag.className = 'likes-package-tag';
      tag.textContent = item.platform || 'Likes Service';

      const title = document.createElement('h3');
      title.textContent = item.name_bn || item.name_en;

      const amount = document.createElement('p');
      amount.className = 'package-diamonds';
      amount.textContent =
        Number(item.quantity).toLocaleString() + ' Likes';

      const price = document.createElement('h2');
      price.className = 'package-price';
      price.textContent = '৳' + Number(item.price).toFixed(2);

      const button = document.createElement('button');
      button.className = 'main-btn';
      button.type = 'button';
      button.textContent = 'Order Now';
      button.disabled = true;
      button.title = 'Order system will be connected later';

      card.append(tag, title, amount, price, button);
      likesContainer.appendChild(card);
    });

  } catch (error) {
    likesContainer.innerHTML = '';

    const errorMessage = document.createElement('p');
    errorMessage.textContent =
      'Likes packages could not be loaded. Please try again later.';

    likesContainer.appendChild(errorMessage);
    console.error('Likes loading error:', error);
  }
}

loadLikesPackages();
