const API_URL = "http://localhost:4000/api";

const token = sessionStorage.getItem("playerToken");

const accountInfo = document.getElementById("accountInfo");
const loginArea = document.getElementById("loginArea");
const walletBalance = document.getElementById("walletBalance");
const profileMessage = document.getElementById("profileMessage");

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== "") element.textContent = text;

  return element;
}

function showLogin() {
  accountInfo.innerHTML = `
    <p class="muted">You are not logged in.</p>
  `;

  loginArea.innerHTML = `
    <a class="action" href="login.html?next=profile.html">
      Player Login
    </a>
  `;

  walletBalance.textContent = "Login required";
}

function addProfileRow(parent, label, value) {
  const row = createElement("div", "profile-row");

  const left = createElement("span", "", label);
  const right = createElement(
    "span",
    "",
    value === null || value === undefined || value === ""
      ? "Not available"
      : String(value)
  );

  row.append(left, right);
  parent.appendChild(row);
}

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

function money(value) {
  const amount = Number(value || 0);

  return "৳ " + amount.toFixed(2);
}

function createJoinedMatchesSection() {
  let section = document.getElementById("joinedMatchesSection");

  if (!section) {
    section = createElement("section");
    section.id = "joinedMatchesSection";
    section.style.marginTop = "25px";

    const heading = createElement("h2", "", "Joined Matches");
    const list = createElement("div");
    list.id = "joinedMatchesList";

    section.append(heading, list);
    accountInfo.parentElement.appendChild(section);
  }

  return document.getElementById("joinedMatchesList");
}

function renderMatch(match, parent) {
  const card = createElement("article");

  card.style.cssText = `
    background: #171923;
    color: #ffffff;
    border: 1px solid #34394b;
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
  `;

  const title = createElement(
    "h3",
    "",
    match.title_en ||
    match.title_bn ||
    match.match_number ||
    "Free Fire Match"
  );

  card.appendChild(title);

  const details = [
    ["Match Number", match.match_number],
    ["Category", match.category],
    ["Mode", match.mode],
    ["Map", match.map_name],
    ["Date", formatDate(match.starts_at)],
    ["Prize", money(match.winning_prize)],
    ["Per Kill", money(match.per_kill_prize)],
    ["Entry Fee", money(match.entry_fee)],
    ["Registration", match.registration_status || match.status]
  ];

  details.forEach(([label, value]) => {
    addProfileRow(card, label, value);
  });

  const roomBox = createElement("div");

  roomBox.style.cssText = `
    margin-top: 15px;
    padding: 12px;
    border-radius: 8px;
    background: #252b3b;
  `;

  roomBox.appendChild(
    createElement("h4", "", "Room Information")
  );

  if (match.room_id && match.room_password) {
    addProfileRow(roomBox, "Room ID", match.room_id);
    addProfileRow(roomBox, "Password", match.room_password);
  } else {
    roomBox.appendChild(
      createElement(
        "p",
        "muted",
        "Waiting for Admin to release Room ID and Password."
      )
    );
  }

  card.appendChild(roomBox);

  if (match.rules) {
    const rules = createElement("details");
    const summary = createElement("summary", "", "Match Rules");
    const content = createElement("p", "", match.rules);

    rules.append(summary, content);
    card.appendChild(rules);
  }

  if (match.tutorial_video_url) {
    const link = createElement("a", "action", "Watch Tutorial");

    link.href = match.tutorial_video_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    card.appendChild(link);
  }

  parent.appendChild(card);
}

async function loadJoinedMatches() {
  const list = createJoinedMatchesSection();

  list.innerHTML = `
    <p class="muted">Loading joined matches...</p>
  `;

  try {
    const response = await fetch(`${API_URL}/tournaments/mine`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Could not load joined matches."
      );
    }

    list.innerHTML = "";

    const matches = data.matches || [];

    if (matches.length === 0) {
      list.appendChild(
        createElement(
          "p",
          "muted",
          "You have not joined any matches yet."
        )
      );

      return;
    }

    matches.forEach(match => {
      renderMatch(match, list);
    });

  } catch (error) {
    list.innerHTML = "";

    list.appendChild(
      createElement("p", "muted", error.message)
    );
  }
}

async function loadWallet() {
  try {
    const response = await fetch(`${API_URL}/wallet`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Wallet could not be loaded."
      );
    }

    const wallet = data.wallet || data;

    const balance = Number(
      wallet.balance ?? wallet.available_balance ?? 0
    );

    walletBalance.textContent = money(balance);

  } catch (error) {
    walletBalance.textContent = "Not available";
  }
}

async function loadProfile() {
  if (!token) {
    showLogin();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/user-auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.message || "Session expired."
      );
    }

    const user = data.user;

    accountInfo.innerHTML = "";

    const details = [
      ["Player Name", user.name],
      ["Email", user.email],
      ["Phone", user.phone || "Not added"],
      ["Game Name", user.ff_ingame_name || "Not added"]
    ];

    details.forEach(([label, value]) => {
      addProfileRow(accountInfo, label, value);
    });

    loginArea.innerHTML = `
      <button type="button" id="logoutButton">
        Logout
      </button>
    `;

    document
      .getElementById("logoutButton")
      .addEventListener("click", () => {
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("playerProfile");

        location.href = "login.html";
      });

    sessionStorage.setItem(
      "playerProfile",
      JSON.stringify(user)
    );

    if (profileMessage) {
      profileMessage.textContent = "";
    }

    await Promise.all([
      loadWallet(),
      loadJoinedMatches()
    ]);

  } catch (error) {
    sessionStorage.removeItem("playerToken");
    sessionStorage.removeItem("playerProfile");

    showLogin();

    if (profileMessage) {
      profileMessage.textContent = error.message;
    }
  }
}

loadProfile();