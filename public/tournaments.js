const API_URL = "http://localhost:4000/api/public/tournaments";

const CATEGORY_NAMES = {
  solo_br: "Solo BR",
  duo_br: "Duo BR",
  pro_league: "Pro League",
  lone_wolf: "Lone Wolf",
  lone_wolf_headshot: "Lone Wolf Headshot",
  survival_br: "Survival BR",
  cs_4v4: "CS 4v4",
  cs_4v4_headshot: "CS 4v4 Headshot"
};

let tournaments = [];
let selectedCategory = "all";
let selectedStatus = "upcoming";

const list = document.getElementById("tournament-list");
const categoryButtons = document.querySelectorAll("#tournament-modes button");
const statusButtons = document.querySelectorAll("#tournament-tabs button");
const allButton = document.getElementById("all-tournaments");

function safeText(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function formatDate(value) {
  if (!value) return "Date not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not set";

  return date.toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function createTournamentCard(item) {
  const card = document.createElement("article");
  card.className = "tournament-card";

  const title = document.createElement("h3");
  title.textContent = safeText(item.title_en, "Tournament Match");

  const category = document.createElement("p");
  category.textContent = "Category: " + (CATEGORY_NAMES[item.category] || safeText(item.category));

  const status = document.createElement("p");
  status.textContent = "Status: " + safeText(item.status).toUpperCase();

  const prize = document.createElement("p");
  const winPrize = Number(item.winning_prize || 0);
  const killPrize = Number(item.per_kill_prize || 0);
  prize.textContent = `Prize: ৳${winPrize} (Win) | ৳${killPrize} (Per Kill)`;

  const slots = document.createElement("p");
  slots.textContent = "Slots: " + safeText(item.max_players) + " Players";

  const entry = document.createElement("p");
  const fee = Number(item.entry_fee || 0);
  entry.textContent = "Entry Fee: " + (fee > 0 ? `৳${fee}` : "Free");

  const date = document.createElement("p");
  date.textContent = "Time: " + formatDate(item.starts_at);

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "join-btn";

  if (item.status === "upcoming") {
    actionButton.textContent = "View Details / Join";
  } else if (item.status === "live") {
    actionButton.textContent = "Match Live (View)";
  } else {
    actionButton.textContent = "Match Completed";
  }

  actionButton.onclick = () => {
    window.location.href = `match-details.html?id=${item.id}&category=${encodeURIComponent(item.category || '')}`;
  };

  card.append(title, category, status, prize, slots, entry, date, actionButton);
  return card;
}

function renderTournaments() {
  if (!list) return;
  list.replaceChildren();

  const filtered = tournaments.filter(item => {
    const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
    const statusMatch = item.status === selectedStatus;
    return categoryMatch && statusMatch;
  });

  if (filtered.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "No tournaments available in this section.";
    list.appendChild(message);
    return;
  }

  filtered.forEach(item => {
    list.appendChild(createTournamentCard(item));
  });
}

async function loadTournaments() {
  if (!list) return;
  list.textContent = "Loading tournaments...";

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error("Could not load tournaments.");
    }

    const data = await response.json();
    tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
    renderTournaments();
  } catch (error) {
    list.textContent = "Tournament list is currently unavailable. Please try again later.";
    console.error("Tournament loading error:", error);
  }
}

function setActive(buttons, selectedButton) {
  buttons.forEach(button => {
    button.classList.toggle("active", button === selectedButton);
  });
}

if (allButton) {
  allButton.addEventListener("click", () => {
    selectedCategory = "all";
    setActive(categoryButtons, allButton);
    renderTournaments();
  });
}

categoryButtons.forEach(button => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    if (!category || !CATEGORY_NAMES[category]) return;

    selectedCategory = category;
    setActive(categoryButtons, button);
    renderTournaments();
  });
});

statusButtons.forEach(button => {
  button.addEventListener("click", () => {
    const status = button.dataset.status;
    if (!["upcoming", "live", "completed"].includes(status)) return;

    selectedStatus = status;
    setActive(statusButtons, button);
    renderTournaments();
  });
});

loadTournaments();