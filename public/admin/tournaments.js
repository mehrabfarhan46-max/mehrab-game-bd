const API = 'http://localhost:4000/api/admin/tournaments';

const form = document.getElementById('tournamentForm');
const list = document.getElementById('tournamentList');
const message = document.getElementById('message');

const categoryInput = document.getElementById('category');
const modeInput = document.getElementById('mode');

const createButton = document.getElementById('createButton');
const cancelButton = document.getElementById('cancelEditButton');
const formTitle = document.getElementById('formTitle');

let editingId = null;
let tournaments = [];

const token = sessionStorage.getItem('adminToken');

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.style.color = isError ? '#d32f2f' : '#168447';
}

function headers() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

async function apiRequest(url, options = {}) {
  if (!token) {
    window.location.href = 'login.html';
    throw new Error('Admin login required.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminProfile');
    window.location.href = 'login.html';
    throw new Error('Login expired.');
  }

  if (!response.ok) {
    const details = Array.isArray(data.errors)
      ? data.errors.map(item => item.message).join(' ')
      : '';
    throw new Error(data.message || details || 'Request failed.');
  }

  return data;
}

function getMode(category) {
  const modes = {
    solo_br: 'solo',
    survival_br: 'solo',
    duo_br: 'duo',
    lone_wolf: 'duo',
    lone_wolf_headshot: 'duo',
    pro_league: 'squad',
    cs_4v4: '4v4',
    cs_4v4_headshot: '4v4'
  };
  return modes[category] || 'solo';
}

if (categoryInput) {
  categoryInput.addEventListener('change', () => {
    modeInput.value = getMode(categoryInput.value);
  });
}

function getFormData() {
  const localDate = document.getElementById('starts_at').value;
  if (!localDate) throw new Error('Match date and time is required.');

  const videoUrl = document.getElementById('tutorial_video_url')?.value?.trim();
  if (videoUrl) {
    const parsedUrl = new URL(videoUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Tutorial video link must use HTTP or HTTPS.');
    }
  }

  const entryFeeInput = document.getElementById('entry_fee');

  return {
    title_en: document.getElementById('title_en').value.trim(),
    title_bn: document.getElementById('title_bn')?.value?.trim() || null,
    category: categoryInput.value,
    mode: modeInput.value,
    starts_at: new Date(localDate).toISOString(),
    max_players: Number(document.getElementById('max_players').value),
    entry_fee: Number(entryFeeInput ? entryFeeInput.value : 0),
    prize_info: document.getElementById('prize_info')?.value?.trim() || null,
    rules: document.getElementById('rules')?.value?.trim() || null,
    map_name: document.getElementById('map_name')?.value || null,
    per_kill_prize: Number(document.getElementById('per_kill_prize')?.value || 0),
    winning_prize: Number(document.getElementById('winning_prize')?.value || 0),
    tutorial_video_url: videoUrl || null
  };
}

function resetForm() {
  if (!form) return;
  form.reset();
  editingId = null;

  if (categoryInput) categoryInput.value = 'solo_br';
  if (modeInput) modeInput.value = 'solo';

  const maxPlayers = document.getElementById('max_players');
  if (maxPlayers) maxPlayers.value = 48;

  const entryFee = document.getElementById('entry_fee');
  if (entryFee) entryFee.value = 0;

  const perKill = document.getElementById('per_kill_prize');
  if (perKill) perKill.value = 0;

  const winPrize = document.getElementById('winning_prize');
  if (winPrize) winPrize.value = 0;

  if (formTitle) formTitle.textContent = 'Create New Match';
  if (createButton) createButton.textContent = 'Create Match';
  if (cancelButton) cancelButton.hidden = true;
}

if (cancelButton) {
  cancelButton.addEventListener('click', () => {
    resetForm();
    showMessage('');
  });
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString();
}

function categoryName(category) {
  const names = {
    solo_br: 'Solo BR',
    duo_br: 'Duo BR',
    pro_league: 'Pro League',
    lone_wolf: 'Lone Wolf',
    lone_wolf_headshot: 'Lone Wolf Headshot',
    survival_br: 'Survival BR',
    cs_4v4: 'CS 4v4',
    cs_4v4_headshot: 'CS 4v4 Headshot'
  };
  return names[category] || category || 'Unknown';
}
function createTournamentCard(tournament) {
  const card = document.createElement('article');
  card.className = 'tournament-card';

  const title = document.createElement('h3');
  title.textContent = tournament.title_en || 'Untitled Match';

  const details = document.createElement('div');
  const rows = [
    ['Match Number', tournament.match_number || `MATCH-${tournament.id}`],
    ['Category', categoryName(tournament.category)],
    ['Mode', tournament.mode || 'Not set'],
    ['Date & Time', formatDate(tournament.starts_at)],
    ['Map', tournament.map_name || 'Not added'],
    ['Player Slots', tournament.max_players ?? 'Not set'],
    ['Entry Fee', Number(tournament.entry_fee) > 0 ? `৳${tournament.entry_fee}` : 'Free'],
    ['Winning Prize', `৳${tournament.winning_prize ?? 0}`],
    ['Per Kill', `৳${tournament.per_kill_prize ?? 0}`],
    ['Room ID', tournament.room_id || 'Not published'],
    ['Room Password', tournament.room_password || 'Not published']
  ];

  rows.forEach(([label, value]) => {
    const p = document.createElement('p');
    p.textContent = `${label}: ${value}`;
    details.appendChild(p);
  });

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.flexDirection = 'column';
  actions.style.gap = '8px';
  actions.style.marginTop = '12px';

  // Status Selector
  const statusSelect = document.createElement('select');
  statusSelect.className = 'status-control';
  ['draft', 'upcoming', 'live', 'completed', 'cancelled'].forEach(status => {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = status.toUpperCase();
    option.selected = status === tournament.status;
    statusSelect.appendChild(option);
  });

  statusSelect.addEventListener('change', async () => {
    const prev = tournament.status;
    statusSelect.disabled = true;
    try {
      await apiRequest(`${API}/${tournament.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusSelect.value })
      });
      showMessage('Status updated.');
      await loadTournaments();
    } catch (err) {
      showMessage(err.message, true);
      statusSelect.value = prev;
    } finally {
      statusSelect.disabled = false;
    }
  });

  // Set Room Button
  const roomButton = document.createElement('button');
  roomButton.type = 'button';
  roomButton.textContent = 'Set Room ID & Password';
  roomButton.style.background = '#1565c0';
  roomButton.style.color = 'white';
  roomButton.addEventListener('click', async () => {
    const roomId = prompt('Enter Room ID:', tournament.room_id || '');
    if (!roomId) return;
    const roomPassword = prompt('Enter Room Password:', tournament.room_password || '');
    if (!roomPassword) return;

    try {
      await apiRequest(`${API}/${tournament.id}/room`, {
        method: 'PATCH',
        body: JSON.stringify({ room_id: roomId.trim(), room_password: roomPassword.trim() })
      });
      showMessage('Room ID & Password saved.');
      await loadTournaments();
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  // Declare Winners & Distribute Prizes Button
  const prizeButton = document.createElement('button');
  prizeButton.type = 'button';
  prizeButton.textContent = 'Declare Winner & Distribute Prize';
  prizeButton.style.background = '#2e7d32';
  prizeButton.style.color = 'white';
  prizeButton.addEventListener('click', async () => {
    try {
      const pData = await apiRequest(`${API}/${tournament.id}/participants`);
      const participants = pData.participants || [];
      if (!participants.length) {
        alert('No registered participants in this match to distribute prizes.');
        return;
      }

      const results = [];
      for (const p of participants) {
        const isWinner = confirm(`Is ${p.ff_ingame_name || p.user_name} the WINNER? (OK = Yes, Cancel = No)`);
        const killsInput = prompt(`Enter Kills for ${p.ff_ingame_name || p.user_name}:`, '0');
        const kills = Number(killsInput || 0);

        results.push({
          participant_id: p.id,
          is_winner: isWinner,
          kills: kills,
          prize_amount: 0
        });
      }

      if (confirm('Distribute prizes and add balance to winners wallets now?')) {
        await apiRequest(`${API}/${tournament.id}/results`, {
          method: 'POST',
          body: JSON.stringify({ results })
        });
        showMessage('Prizes distributed and match marked completed.');
        await loadTournaments();
      }
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  // Edit Button
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'primary';
  editButton.textContent = 'Edit Match';
  editButton.addEventListener('click', () => startEdit(tournament));

  // Delete Button
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete Match';
  deleteButton.style.background = '#d32f2f';
  deleteButton.style.color = 'white';
  deleteButton.addEventListener('click', async () => {
    if (!confirm(`Are you sure you want to delete match "${tournament.title_en}"?`)) return;
    try {
      await apiRequest(`${API}/${tournament.id}`, { method: 'DELETE' });
      showMessage('Match deleted successfully.');
      await loadTournaments();
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  actions.append(statusSelect, roomButton, prizeButton, editButton, deleteButton);
  card.append(title, details, actions);
  return card;
}

function startEdit(tournament) {
  editingId = tournament.id;

  document.getElementById('title_en').value = tournament.title_en || '';
  if (document.getElementById('title_bn')) {
    document.getElementById('title_bn').value = tournament.title_bn || '';
  }

  categoryInput.value = tournament.category || 'solo_br';
  modeInput.value = tournament.mode || getMode(categoryInput.value);
  document.getElementById('max_players').value = tournament.max_players || 48;

  const entryFeeInput = document.getElementById('entry_fee');
  if (entryFeeInput) entryFeeInput.value = tournament.entry_fee || 0;

  document.getElementById('prize_info').value = tournament.prize_info || '';
  document.getElementById('rules').value = tournament.rules || '';
  document.getElementById('map_name').value = tournament.map_name || '';
  document.getElementById('per_kill_prize').value = tournament.per_kill_prize ?? 0;
  document.getElementById('winning_prize').value = tournament.winning_prize ?? 0;

  if (document.getElementById('tutorial_video_url')) {
    document.getElementById('tutorial_video_url').value = tournament.tutorial_video_url || '';
  }

  if (tournament.starts_at) {
    const date = new Date(tournament.starts_at);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    document.getElementById('starts_at').value = localDate;
  }

  formTitle.textContent = 'Edit Match';
  createButton.textContent = 'Save Changes';
  if (cancelButton) cancelButton.hidden = false;

  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  showMessage('Editing selected match.');
}

async function loadTournaments() {
  if (!list) return;
  list.textContent = 'Loading matches...';

  try {
    const data = await apiRequest(API);
    tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];

    list.replaceChildren();

    if (!tournaments.length) {
      list.textContent = 'No matches found.';
      return;
    }

    tournaments.forEach(tournament => {
      list.appendChild(createTournamentCard(tournament));
    });
  } catch (error) {
    list.textContent = error.message;
  }
}

if (form) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (createButton) createButton.disabled = true;

    try {
      const data = getFormData();
      const url = editingId ? `${API}/${editingId}` : API;

      const result = await apiRequest(url, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(data)
      });

      showMessage(
        editingId
          ? 'Match updated successfully.'
          : `Match created successfully. Number: ${result.tournament?.match_number || 'Generated'}`
      );

      resetForm();
      await loadTournaments();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      if (createButton) createButton.disabled = false;
    }
  });
}

if (token) {
  loadTournaments();
} else {
  window.location.href = 'login.html';
}