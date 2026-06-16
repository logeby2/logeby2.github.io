// Global Application State
let state = {
  players: [],
  user: null, // Logged in user session { email, role }
  users: [],   // Accounts roster
  activeView: 'dashboard', // 'dashboard', 'profile', 'db-manager'
  activePlayerId: null,
  activeStatsTab: 'totals', // 'per-game', 'totals', 'per-40', 'advanced'
  activeScoutingTab: 'notes', // 'notes', 'videos'
  filters: {
    search: '',
    class: 'all',
    position: 'all',
    aau: 'all',
    school: 'all'
  }
};

// Default Column Definitions for Stat Inputs
const STAT_FIELDS = [
  { key: 'season', label: 'Season/Year', type: 'text' },
  { key: 'team', label: 'Team/League', type: 'text' },
  { key: 'gp', label: 'GP', type: 'number' },
  { key: 'gs', label: 'GS', type: 'number' },
  { key: 'min', label: 'MIN', type: 'number' },
  { key: 'pts', label: 'PTS', type: 'number' },
  { key: 'fgm', label: 'FGM', type: 'number' },
  { key: 'fga', label: 'FGA', type: 'number' },
  { key: 'tpm', label: '3PM', type: 'number' },
  { key: 'tpa', label: '3PA', type: 'number' },
  { key: 'ftm', label: 'FTM', type: 'number' },
  { key: 'fta', label: 'FTA', type: 'number' },
  { key: 'orb', label: 'OFF', type: 'number' },
  { key: 'drb', label: 'DEF', type: 'number' },
  { key: 'ast', label: 'AST', type: 'number' },
  { key: 'stl', label: 'STL', type: 'number' },
  { key: 'blk', label: 'BLK', type: 'number' },
  { key: 'tov', label: 'TOV', type: 'number' },
  { key: 'pf', label: 'PF', type: 'number' }
];

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initDatabase();
  renderApp();
});

// Database Initialization
async function initDatabase() {
  // 1. Load users roster
  const localUsers = localStorage.getItem('wsu_user_accounts');
  if (localUsers) {
    try {
      state.users = JSON.parse(localUsers);
    } catch (e) {
      console.error('Failed to load users list, resetting...', e);
    }
  }
  
  if (!state.users || state.users.length === 0) {
    // Seed default admin account
    state.users = [
      { email: 'logeby2@gmail.com', password: 'Qrj1129', role: 'Admin' }
    ];
    localStorage.setItem('wsu_user_accounts', JSON.stringify(state.users));
  }

  // 2. Check active login session
  const session = sessionStorage.getItem('wsu_user_session');
  if (session) {
    try {
      state.user = JSON.parse(session);
      // Double check user still exists in database
      if (state.users.some(u => u.email === state.user.email)) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('user-display').innerText = state.user.email;
      } else {
        // Logged-out if user deleted
        sessionStorage.removeItem('wsu_user_session');
        state.user = null;
      }
    } catch (e) {
      console.error('Session parse error:', e);
      state.user = null;
    }
  }

  if (!state.user) {
    document.getElementById('login-overlay').style.display = 'flex';
  }

  // 3. Load players database
  const localDb = localStorage.getItem('wsu_player_db');
  if (localDb) {
    try {
      state.players = JSON.parse(localDb);
      console.log('Loaded database from localStorage');
      updateFilterOptions();
      return;
    } catch (e) {
      console.error('Failed to parse localStorage db, resetting to seed...', e);
    }
  }

  // Fallback to loading static players.json seed
  try {
    const response = await fetch('players.json');
    if (response.ok) {
      const seedData = await response.json();
      // Handle package format vs flat array format
      if (Array.isArray(seedData)) {
        state.players = seedData;
      } else if (seedData.players && Array.isArray(seedData.players)) {
        state.players = seedData.players;
        if (seedData.users && Array.isArray(seedData.users) && (!localUsers)) {
          // If they have users in players.json, seed those as well if no users exist
          state.users = seedData.users;
          localStorage.setItem('wsu_user_accounts', JSON.stringify(state.users));
        }
      }
      saveDatabase();
      console.log('Loaded database from seed players.json');
    } else {
      console.warn('players.json seed file not found. Initializing empty database.');
      state.players = [];
    }
  } catch (e) {
    console.error('Error fetching players.json:', e);
    state.players = [];
  }
  updateFilterOptions();
}

function saveDatabase() {
  localStorage.setItem('wsu_player_db', JSON.stringify(state.players));
  updateFilterOptions();
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation Links
  document.getElementById('nav-dashboard').addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('nav-db-manager').addEventListener('click', () => navigateTo('db-manager'));
  
  // Header Search Input
  const searchInput = document.getElementById('header-search');
  searchInput.addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase();
    // Auto-navigate to dashboard if typing search from another page
    if (state.activeView !== 'dashboard') {
      navigateTo('dashboard');
    }
    renderDashboard();
  });

  // Filter Selects
  document.getElementById('filter-class').addEventListener('change', (e) => {
    state.filters.class = e.target.value;
    renderDashboard();
  });
  document.getElementById('filter-position').addEventListener('change', (e) => {
    state.filters.position = e.target.value;
    renderDashboard();
  });
  document.getElementById('filter-aau').addEventListener('change', (e) => {
    state.filters.aau = e.target.value;
    renderDashboard();
  });
  document.getElementById('filter-school').addEventListener('change', (e) => {
    state.filters.school = e.target.value;
    renderDashboard();
  });

  // New Player Action Button
  document.getElementById('btn-add-player').addEventListener('click', () => openModal('modal-add-player'));
  
  // Forms & Modal Actions
  document.getElementById('form-add-player').addEventListener('submit', handleAddPlayer);
  document.getElementById('form-add-note').addEventListener('submit', handleAddNote);
  document.getElementById('form-add-video').addEventListener('submit', handleAddVideo);

  // Close Modals
  document.querySelectorAll('.modal-close-btn, .btn-cancel-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  // Stat Tab Switching
  document.querySelectorAll('.stat-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.stat-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeStatsTab = e.target.dataset.tab;
      renderPlayerStats();
    });
  });

  // Scouting Tab Switching
  document.querySelectorAll('.scouting-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.scouting-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      state.activeScoutingTab = e.target.dataset.tab;
      renderPlayerScouting();
    });
  });

  // DB Import/Export Actions
  document.getElementById('btn-export-json').addEventListener('click', exportDatabaseJSON);
  document.getElementById('btn-reset-db').addEventListener('click', resetDatabase);
  
  // CSV Import file uploader
  document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
  document.getElementById('form-csv-map').addEventListener('submit', handleCSVImportApply);
}

// Navigation Router
function navigateTo(view, playerId = null) {
  state.activeView = view;
  state.activePlayerId = playerId;
  
  // Update Header active tab
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (view === 'dashboard') {
    document.getElementById('nav-dashboard').classList.add('active');
  } else if (view === 'db-manager') {
    document.getElementById('nav-db-manager').classList.add('active');
  }

  // Toggle visible sections
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  
  if (view === 'dashboard') {
    document.getElementById('view-dashboard').classList.add('active');
    renderDashboard();
  } else if (view === 'profile') {
    document.getElementById('view-profile').classList.add('active');
    renderPlayerProfile();
  } else if (view === 'db-manager') {
    document.getElementById('view-db-manager').classList.add('active');
    renderDbManager();
  }
}

// Notification System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Generate Dropdown Options for Filters
function updateFilterOptions() {
  const years = new Set();
  const aaus = new Set();
  const schools = new Set();

  state.players.forEach(p => {
    if (p.recruitingYear) years.add(p.recruitingYear);
    if (p.aauProgram) aaus.add(p.aauProgram);
    if (p.highSchool) schools.add(p.highSchool);
  });

  populateSelect('filter-class', Array.from(years).sort(), 'All Classes');
  populateSelect('filter-position', ['Guards', 'Spacers', 'Blurs', 'Bigs'], 'All Positions');
  populateSelect('filter-aau', Array.from(aaus).sort(), 'All AAU Programs');
  populateSelect('filter-school', Array.from(schools).sort(), 'All High Schools');
}

function populateSelect(selectId, items, placeholder) {
  const select = document.getElementById(selectId);
  const currentValue = select.value;
  select.innerHTML = `<option value="all">${placeholder}</option>`;
  items.forEach(item => {
    if (item && item.toString().trim() !== '') {
      select.innerHTML += `<option value="${item}">${item}</option>`;
    }
  });
  // Restore value if it still exists
  if (Array.from(select.options).some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  } else {
    select.value = 'all';
  }
}

// Renders the overall state of the SPA
function renderApp() {
  navigateTo(state.activeView, state.activePlayerId);
}

// Render Dashboard (Recruits Grid)
function renderDashboard() {
  const grid = document.getElementById('players-grid');
  grid.innerHTML = '';

  const filteredPlayers = state.players.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(state.filters.search) || 
                          (p.highSchool && p.highSchool.toLowerCase().includes(state.filters.search)) || 
                          (p.aauProgram && p.aauProgram.toLowerCase().includes(state.filters.search));
    const matchesClass = state.filters.class === 'all' || p.recruitingYear.toString() === state.filters.class;
    const matchesPos = state.filters.position === 'all' || p.position === state.filters.position;
    const matchesAau = state.filters.aau === 'all' || p.aauProgram === state.filters.aau;
    const matchesSchool = state.filters.school === 'all' || p.highSchool === state.filters.school;

    return matchesSearch && matchesClass && matchesPos && matchesAau && matchesSchool;
  });

  if (filteredPlayers.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-muted);">
        <p style="font-size: 1.2rem; font-weight: 600;">No recruits found matching the current filters.</p>
        <p style="font-size: 0.9rem; margin-top: 8px;">Try adjusting your search criteria or add a new player.</p>
      </div>
    `;
    return;
  }

  filteredPlayers.forEach(p => {
    // Generate Initials
    const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2);
    
    // Calculate Age
    let ageDisplay = 'N/A';
    if (p.birthday) {
      const birth = new Date(p.birthday);
      const diffMs = Date.now() - birth.getTime();
      const ageDate = new Date(diffMs);
      ageDisplay = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
    }

    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="player-card-header">
        <div class="player-card-avatar">${initials}</div>
        <div class="player-card-name">${p.name}</div>
        <div class="player-card-meta">Class of ${p.recruitingYear || 'N/A'} • ${p.position || 'N/A'}</div>
      </div>
      <div class="player-card-body">
        <div class="player-card-stat-row">
          <span class="player-card-stat-label">High School:</span>
          <span class="player-card-stat-val">${p.highSchool || 'N/A'}</span>
        </div>
        <div class="player-card-stat-row">
          <span class="player-card-stat-label">AAU Program:</span>
          <span class="player-card-stat-val">${p.aauProgram || 'N/A'}</span>
        </div>
        <div class="player-card-stat-row">
          <span class="player-card-stat-label">Age / Birthday:</span>
          <span class="player-card-stat-val">${ageDisplay} (${formatDateString(p.birthday)})</span>
        </div>
        <div class="player-card-stat-row">
          <span class="player-card-stat-label">Agent:</span>
          <span class="player-card-stat-val">${p.agent || 'None'}</span>
        </div>
      </div>
      <div class="player-card-footer">
        <button class="action-btn" style="width: 100%; justify-content: center;" onclick="navigateTo('profile', '${p.id}')">View Profile</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render Individual Player Profile Screen (DX Gold Style)
function renderPlayerProfile() {
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) {
    navigateTo('dashboard');
    return;
  }

  // Initials
  const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2);

  // Age calculation
  let ageDisplay = 'N/A';
  if (p.birthday) {
    const birth = new Date(p.birthday);
    const diffMs = Date.now() - birth.getTime();
    const ageDate = new Date(diffMs);
    ageDisplay = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
  }

  // Render Sidebar details (personal, contact, ranking info)
  const sidebar = document.getElementById('profile-sidebar-container');
  sidebar.innerHTML = `
    <div class="sidebar-avatar-section">
      <div class="sidebar-avatar">${initials}</div>
      <div class="sidebar-name">${p.name}</div>
      <div class="sidebar-position">${p.position || 'N/A'} • Class of ${p.recruitingYear || 'N/A'}</div>
    </div>

    <!-- Personal Group -->
    <div class="sidebar-group">
      <div class="sidebar-group-title">
        <span>Personal Details</span>
        <span class="sidebar-edit-icon" onclick="openEditMetadataModal('personal')">✎</span>
      </div>
      <div class="sidebar-data-list">
        <div class="sidebar-data-row"><span class="sidebar-label">Birthday:</span><span class="sidebar-val">${formatDateString(p.birthday)}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Age:</span><span class="sidebar-val">${ageDisplay}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Height:</span><span class="sidebar-val">${p.height || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Weight:</span><span class="sidebar-val">${p.weight || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Hometown:</span><span class="sidebar-val">${p.hometown || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Nationality:</span><span class="sidebar-val">${p.nationality || 'N/A'}</span></div>
      </div>
    </div>

    <!-- Career Recruiting Group -->
    <div class="sidebar-group">
      <div class="sidebar-group-title">
        <span>Recruiting Info</span>
        <span class="sidebar-edit-icon" onclick="openEditMetadataModal('recruiting')">✎</span>
      </div>
      <div class="sidebar-data-list">
        <div class="sidebar-data-row"><span class="sidebar-label">High School:</span><span class="sidebar-val">${p.highSchool || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">AAU Program:</span><span class="sidebar-val">${p.aauProgram || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Recr Class:</span><span class="sidebar-val">${p.recruitingYear || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Agent:</span><span class="sidebar-val">${p.agent || 'None'}</span></div>
      </div>
    </div>

    <!-- Contact & Socials -->
    <div class="sidebar-group">
      <div class="sidebar-group-title">
        <span>Contact & Socials</span>
        <span class="sidebar-edit-icon" onclick="openEditMetadataModal('socials')">✎</span>
      </div>
      <div class="sidebar-data-list">
        <div class="sidebar-data-row"><span class="sidebar-label">Twitter:</span><span class="sidebar-val">${p.social?.twitter ? `@${p.social.twitter}` : 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Instagram:</span><span class="sidebar-val">${p.social?.instagram ? `@${p.social.instagram}` : 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Phone:</span><span class="sidebar-val">${p.phone || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Email:</span><span class="sidebar-val">${p.email || 'N/A'}</span></div>
      </div>
    </div>

    <!-- Actions -->
    <div class="sidebar-group" style="margin-top: 10px;">
      <button class="secondary-btn" style="color: var(--wsu-crimson); border-color: var(--wsu-crimson); justify-content: center;" onclick="deletePlayer('${p.id}')">✕ Delete Player</button>
    </div>
  `;

  // Render Title and Sub-details
  document.getElementById('profile-player-name').innerText = p.name;
  document.getElementById('profile-player-info').innerText = `${p.position || 'N/A'} | ${p.height || 'N/A'} | ${p.weight || 'N/A'} | Class of ${p.recruitingYear || 'N/A'}`;

  // Reset Sub Tabs UI
  document.querySelectorAll('.stat-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeStatsTab);
  });
  document.querySelectorAll('.scouting-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeScoutingTab);
  });

  renderPlayerStats();
  renderPlayerScouting();
}

// Render player stats table based on selected tab (Totals, Per Game, Per 40, Advanced)
function renderPlayerStats() {
  const p = state.players.find(x => x.id === state.activePlayerId);
  const container = document.getElementById('profile-stats-container');
  
  if (!p.stats || p.stats.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No stats uploaded yet</h3>
        <p>You can add individual stat rows manually below or upload an Excel/CSV file in the Database Manager.</p>
        <button class="action-btn" style="margin: 0 auto;" onclick="addEmptyStatRow()">+ Add Stat Row</button>
      </div>
    `;
    return;
  }

  let headers = [];
  let rowsHtml = '';
  
  if (state.activeStatsTab === 'totals') {
    headers = ['Season', 'Team/League', 'GP', 'GS', 'MIN', 'PTS', 'FGM-A', 'FG%', '3PM-A', '3P%', 'FTM-A', 'FT%', 'OFF', 'DEF', 'TRB', 'AST', 'STL', 'BLK', 'TOV', 'PF'];
    
    // Sort stats by season descending/ascending
    const sortedStats = [...p.stats].sort((a,b) => a.season.localeCompare(b.season));
    let totalsSum = { gp: 0, gs: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
    
    sortedStats.forEach((row, idx) => {
      // Keep track of totals
      totalsSum.gp += parseNum(row.gp);
      totalsSum.gs += parseNum(row.gs);
      totalsSum.min += parseNum(row.min);
      totalsSum.pts += parseNum(row.pts);
      totalsSum.fgm += parseNum(row.fgm);
      totalsSum.fga += parseNum(row.fga);
      totalsSum.tpm += parseNum(row.tpm);
      totalsSum.tpa += parseNum(row.tpa);
      totalsSum.ftm += parseNum(row.ftm);
      totalsSum.fta += parseNum(row.fta);
      totalsSum.orb += parseNum(row.orb);
      totalsSum.drb += parseNum(row.drb);
      totalsSum.ast += parseNum(row.ast);
      totalsSum.stl += parseNum(row.stl);
      totalsSum.blk += parseNum(row.blk);
      totalsSum.tov += parseNum(row.tov);
      totalsSum.pf += parseNum(row.pf);

      rowsHtml += `
        <tr>
          <td><input type="text" class="editable-stat" value="${row.season}" onchange="updateStatValue('${p.id}', ${idx}, 'season', this.value)"></td>
          <td><input type="text" class="editable-stat" value="${row.team}" onchange="updateStatValue('${p.id}', ${idx}, 'team', this.value)"></td>
          <td><input type="number" class="editable-stat text-center" value="${row.gp}" onchange="updateStatValue('${p.id}', ${idx}, 'gp', this.value)"></td>
          <td><input type="number" class="editable-stat text-center" value="${row.gs}" onchange="updateStatValue('${p.id}', ${idx}, 'gs', this.value)"></td>
          <td><input type="number" class="editable-stat text-center" value="${row.min}" onchange="updateStatValue('${p.id}', ${idx}, 'min', this.value)"></td>
          <td class="highlight-column"><input type="number" class="editable-stat text-center" value="${row.pts}" onchange="updateStatValue('${p.id}', ${idx}, 'pts', this.value)"></td>
          <td class="text-center">${row.fgm}-${row.fga}</td>
          <td class="text-center">${formatPercentage(row.fgm, row.fga)}</td>
          <td class="text-center">${row.tpm}-${row.tpa}</td>
          <td class="text-center">${formatPercentage(row.tpm, row.tpa)}</td>
          <td class="text-center">${row.ftm}-${row.fta}</td>
          <td class="text-center">${formatPercentage(row.ftm, row.fta)}</td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.orb}" onchange="updateStatValue('${p.id}', ${idx}, 'orb', this.value)"></td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.drb}" onchange="updateStatValue('${p.id}', ${idx}, 'drb', this.value)"></td>
          <td class="text-center font-bold">${parseNum(row.orb) + parseNum(row.drb)}</td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.ast}" onchange="updateStatValue('${p.id}', ${idx}, 'ast', this.value)"></td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.stl}" onchange="updateStatValue('${p.id}', ${idx}, 'stl', this.value)"></td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.blk}" onchange="updateStatValue('${p.id}', ${idx}, 'blk', this.value)"></td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.tov}" onchange="updateStatValue('${p.id}', ${idx}, 'tov', this.value)"></td>
          <td class="text-center"><input type="number" class="editable-stat text-center" value="${row.pf}" onchange="updateStatValue('${p.id}', ${idx}, 'pf', this.value)"></td>
          <td class="text-center"><span class="sidebar-edit-icon" style="color: var(--wsu-crimson);" onclick="deleteStatRow('${p.id}', ${idx})">✕</span></td>
        </tr>
      `;
    });

    // Totals/Lifetime Row
    const trbSum = totalsSum.orb + totalsSum.drb;
    rowsHtml += `
      <tr class="totals-row">
        <td colspan="2">LIFETIME TOTALS</td>
        <td class="text-center">${totalsSum.gp}</td>
        <td class="text-center">${totalsSum.gs}</td>
        <td class="text-center">${totalsSum.min}</td>
        <td class="text-center highlight-column">${totalsSum.pts}</td>
        <td class="text-center">${totalsSum.fgm}-${totalsSum.fga}</td>
        <td class="text-center">${formatPercentage(totalsSum.fgm, totalsSum.fga)}</td>
        <td class="text-center">${totalsSum.tpm}-${totalsSum.tpa}</td>
        <td class="text-center">${formatPercentage(totalsSum.tpm, totalsSum.tpa)}</td>
        <td class="text-center">${totalsSum.ftm}-${totalsSum.fta}</td>
        <td class="text-center">${formatPercentage(totalsSum.ftm, totalsSum.fta)}</td>
        <td class="text-center">${totalsSum.orb}</td>
        <td class="text-center">${totalsSum.drb}</td>
        <td class="text-center">${trbSum}</td>
        <td class="text-center">${totalsSum.ast}</td>
        <td class="text-center">${totalsSum.stl}</td>
        <td class="text-center">${totalsSum.blk}</td>
        <td class="text-center">${totalsSum.tov}</td>
        <td class="text-center">${totalsSum.pf}</td>
        <td></td>
      </tr>
    `;

  } else if (state.activeStatsTab === 'per-game') {
    headers = ['Season', 'Team/League', 'GP', 'GS', 'MIN', 'PTS', 'FGM', 'FGA', 'FG%', '3PM', '3PA', '3P%', 'FTM', 'FTA', 'FT%', 'OFF', 'DEF', 'TRB', 'AST', 'STL', 'BLK', 'TOV', 'PF'];
    
    const sortedStats = [...p.stats].sort((a,b) => a.season.localeCompare(b.season));
    let totalsSum = { gp: 0, gs: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };

    sortedStats.forEach(row => {
      const gp = parseNum(row.gp) || 1;
      
      totalsSum.gp += parseNum(row.gp);
      totalsSum.gs += parseNum(row.gs);
      totalsSum.min += parseNum(row.min);
      totalsSum.pts += parseNum(row.pts);
      totalsSum.fgm += parseNum(row.fgm);
      totalsSum.fga += parseNum(row.fga);
      totalsSum.tpm += parseNum(row.tpm);
      totalsSum.tpa += parseNum(row.tpa);
      totalsSum.ftm += parseNum(row.ftm);
      totalsSum.fta += parseNum(row.fta);
      totalsSum.orb += parseNum(row.orb);
      totalsSum.drb += parseNum(row.drb);
      totalsSum.ast += parseNum(row.ast);
      totalsSum.stl += parseNum(row.stl);
      totalsSum.blk += parseNum(row.blk);
      totalsSum.tov += parseNum(row.tov);
      totalsSum.pf += parseNum(row.pf);

      rowsHtml += `
        <tr>
          <td>${row.season}</td>
          <td>${row.team}</td>
          <td class="text-center">${row.gp}</td>
          <td class="text-center">${row.gs}</td>
          <td class="text-center">${(parseNum(row.min)/gp).toFixed(1)}</td>
          <td class="text-center highlight-column font-bold">${(parseNum(row.pts)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fgm)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fga)/gp).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.fgm, row.fga)}</td>
          <td class="text-center">${(parseNum(row.tpm)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.tpa)/gp).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.tpm, row.tpa)}</td>
          <td class="text-center">${(parseNum(row.ftm)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fta)/gp).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.ftm, row.fta)}</td>
          <td class="text-center">${(parseNum(row.orb)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.drb)/gp).toFixed(1)}</td>
          <td class="text-center font-bold">${((parseNum(row.orb) + parseNum(row.drb))/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.ast)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.stl)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.blk)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.tov)/gp).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.pf)/gp).toFixed(1)}</td>
        </tr>
      `;
    });

    // Lifetime Per Game Row
    const lifetimeGp = totalsSum.gp || 1;
    rowsHtml += `
      <tr class="totals-row">
        <td colspan="2">LIFETIME AVERAGES</td>
        <td class="text-center">${totalsSum.gp}</td>
        <td class="text-center">${totalsSum.gs}</td>
        <td class="text-center">${(totalsSum.min/lifetimeGp).toFixed(1)}</td>
        <td class="text-center highlight-column">${(totalsSum.pts/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fgm/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fga/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.fgm, totalsSum.fga)}</td>
        <td class="text-center">${(totalsSum.tpm/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.tpa/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.tpm, totalsSum.tpa)}</td>
        <td class="text-center">${(totalsSum.ftm/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fta/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.ftm, totalsSum.fta)}</td>
        <td class="text-center">${(totalsSum.orb/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.drb/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${((totalsSum.orb + totalsSum.drb)/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.ast/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.stl/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.blk/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.tov/lifetimeGp).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.pf/lifetimeGp).toFixed(1)}</td>
      </tr>
    `;

  } else if (state.activeStatsTab === 'per-40') {
    headers = ['Season', 'Team/League', 'GP', 'MIN', 'PTS', 'FGM', 'FGA', 'FG%', '3PM', '3PA', '3P%', 'FTM', 'FTA', 'FT%', 'OFF', 'DEF', 'TRB', 'AST', 'STL', 'BLK', 'TOV', 'PF'];
    
    const sortedStats = [...p.stats].sort((a,b) => a.season.localeCompare(b.season));
    let totalsSum = { gp: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };

    sortedStats.forEach(row => {
      const min = parseNum(row.min) || 40;
      const scale = 40 / min;

      totalsSum.gp += parseNum(row.gp);
      totalsSum.min += parseNum(row.min);
      totalsSum.pts += parseNum(row.pts);
      totalsSum.fgm += parseNum(row.fgm);
      totalsSum.fga += parseNum(row.fga);
      totalsSum.tpm += parseNum(row.tpm);
      totalsSum.tpa += parseNum(row.tpa);
      totalsSum.ftm += parseNum(row.ftm);
      totalsSum.fta += parseNum(row.fta);
      totalsSum.orb += parseNum(row.orb);
      totalsSum.drb += parseNum(row.drb);
      totalsSum.ast += parseNum(row.ast);
      totalsSum.stl += parseNum(row.stl);
      totalsSum.blk += parseNum(row.blk);
      totalsSum.tov += parseNum(row.tov);
      totalsSum.pf += parseNum(row.pf);

      rowsHtml += `
        <tr>
          <td>${row.season}</td>
          <td>${row.team}</td>
          <td class="text-center">${row.gp}</td>
          <td class="text-center">${row.min}</td>
          <td class="text-center highlight-column font-bold">${(parseNum(row.pts)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fgm)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fga)*scale).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.fgm, row.fga)}</td>
          <td class="text-center">${(parseNum(row.tpm)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.tpa)*scale).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.tpm, row.tpa)}</td>
          <td class="text-center">${(parseNum(row.ftm)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.fta)*scale).toFixed(1)}</td>
          <td class="text-center">${formatPercentage(row.ftm, row.fta)}</td>
          <td class="text-center">${(parseNum(row.orb)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.drb)*scale).toFixed(1)}</td>
          <td class="text-center font-bold">${((parseNum(row.orb) + parseNum(row.drb))*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.ast)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.stl)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.blk)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.tov)*scale).toFixed(1)}</td>
          <td class="text-center">${(parseNum(row.pf)*scale).toFixed(1)}</td>
        </tr>
      `;
    });

    // Lifetime Per 40 Row
    const lifetimeMin = totalsSum.min || 40;
    const lifetimeScale = 40 / lifetimeMin;
    rowsHtml += `
      <tr class="totals-row">
        <td colspan="2">LIFETIME PER 40 MIN</td>
        <td class="text-center">${totalsSum.gp}</td>
        <td class="text-center">${totalsSum.min}</td>
        <td class="text-center highlight-column">${(totalsSum.pts*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fgm*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fga*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.fgm, totalsSum.fga)}</td>
        <td class="text-center">${(totalsSum.tpm*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.tpa*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.tpm, totalsSum.tpa)}</td>
        <td class="text-center">${(totalsSum.ftm*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.fta*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${formatPercentage(totalsSum.ftm, totalsSum.fta)}</td>
        <td class="text-center">${(totalsSum.orb*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.drb*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${((totalsSum.orb + totalsSum.drb)*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.ast*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.stl*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.blk*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.tov*lifetimeScale).toFixed(1)}</td>
        <td class="text-center">${(totalsSum.pf*lifetimeScale).toFixed(1)}</td>
      </tr>
    `;

  } else if (state.activeStatsTab === 'advanced') {
    headers = ['Season', 'Team/League', 'GP', 'MIN', 'TS%', 'eFG%', 'AST/TO', 'PTS/Shot', '3P Rate', 'FT Rate'];

    const sortedStats = [...p.stats].sort((a,b) => a.season.localeCompare(b.season));
    let totalsSum = { gp: 0, min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, ast: 0, tov: 0 };

    sortedStats.forEach(row => {
      const pts = parseNum(row.pts);
      const fga = parseNum(row.fga);
      const fgm = parseNum(row.fgm);
      const fta = parseNum(row.fta);
      const tpm = parseNum(row.tpm);
      const tpa = parseNum(row.tpa);
      const ast = parseNum(row.ast);
      const tov = parseNum(row.tov) || 1; // avoid divide by zero

      totalsSum.gp += parseNum(row.gp);
      totalsSum.min += parseNum(row.min);
      totalsSum.pts += pts;
      totalsSum.fgm += fgm;
      totalsSum.fga += fga;
      totalsSum.tpm += tpm;
      totalsSum.tpa += tpa;
      totalsSum.ftm += parseNum(row.ftm);
      totalsSum.fta += fta;
      totalsSum.ast += ast;
      totalsSum.tov += parseNum(row.tov);

      const tsPct = fga + 0.44 * fta > 0 ? (pts / (2 * (fga + 0.44 * fta)) * 100).toFixed(1) + '%' : '.000';
      const efgPct = fga > 0 ? ((fgm + 0.5 * tpm) / fga * 100).toFixed(1) + '%' : '.000';
      const astTo = ast / tov;
      const ptsPerShot = fga + 0.44 * fta > 0 ? (pts / (fga + 0.44 * fta)).toFixed(2) : '0.00';
      const tpRate = fga > 0 ? (tpa / fga * 100).toFixed(1) + '%' : '0.0%';
      const ftRate = fga > 0 ? (fta / fga * 100).toFixed(1) + '%' : '0.0%';

      rowsHtml += `
        <tr>
          <td>${row.season}</td>
          <td>${row.team}</td>
          <td class="text-center">${row.gp}</td>
          <td class="text-center">${row.min}</td>
          <td class="text-center highlight-column font-bold">${tsPct}</td>
          <td class="text-center">${efgPct}</td>
          <td class="text-center">${astTo.toFixed(2)}</td>
          <td class="text-center">${ptsPerShot}</td>
          <td class="text-center">${tpRate}</td>
          <td class="text-center">${ftRate}</td>
        </tr>
      `;
    });

    // Lifetime Advanced Row
    const lifPts = totalsSum.pts;
    const lifFga = totalsSum.fga;
    const lifFgm = totalsSum.fgm;
    const lifFta = totalsSum.fta;
    const lifTpm = totalsSum.tpm;
    const lifTpa = totalsSum.tpa;
    const lifAst = totalsSum.ast;
    const lifTov = totalsSum.tov || 1;

    const lifTsPct = lifFga + 0.44 * lifFta > 0 ? (lifPts / (2 * (lifFga + 0.44 * lifFta)) * 100).toFixed(1) + '%' : '.000';
    const lifEfgPct = lifFga > 0 ? ((lifFgm + 0.5 * lifTpm) / lifFga * 100).toFixed(1) + '%' : '.000';
    const lifAstTo = lifAst / lifTov;
    const lifPtsPerShot = lifFga + 0.44 * lifFta > 0 ? (lifPts / (lifFga + 0.44 * lifFta)).toFixed(2) : '0.00';
    const lifTpRate = lifFga > 0 ? (lifTpa / lifFga * 100).toFixed(1) + '%' : '0.0%';
    const lifFtRate = lifFga > 0 ? (lifFta / lifFga * 100).toFixed(1) + '%' : '0.0%';

    rowsHtml += `
      <tr class="totals-row">
        <td colspan="2">LIFETIME ADVANCED</td>
        <td class="text-center">${totalsSum.gp}</td>
        <td class="text-center">${totalsSum.min}</td>
        <td class="text-center highlight-column">${lifTsPct}</td>
        <td class="text-center">${lifEfgPct}</td>
        <td class="text-center">${lifAstTo.toFixed(2)}</td>
        <td class="text-center">${lifPtsPerShot}</td>
        <td class="text-center">${lifTpRate}</td>
        <td class="text-center">${lifFtRate}</td>
      </tr>
    `;
  }

  // Build the complete Table HTML
  let headerCells = headers.map(h => `<th class="${h === 'PTS' || h === 'TS%' || h === 'FG%' ? 'highlight-column text-center' : 'text-center'}">${h}</th>`).join('');
  
  // Custom headers adjust for Season/Team which aren't numeric
  headerCells = headerCells.replace('class="text-center">Season', 'style="text-align:left;">Season');
  headerCells = headerCells.replace('class="text-center">Team', 'style="text-align:left;">Team');

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <button class="secondary-btn" onclick="addEmptyStatRow()">+ Add Stat Row</button>
      <span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">* Hover or click on cells to edit values directly. Changes save automatically!</span>
    </div>
  `;
}

// Render scouting notes & videos
function renderPlayerScouting() {
  const p = state.players.find(x => x.id === state.activePlayerId);
  const notesContainer = document.getElementById('scouting-notes-section');
  const videosContainer = document.getElementById('scouting-videos-section');
  
  if (state.activeScoutingTab === 'notes') {
    notesContainer.style.display = 'block';
    videosContainer.style.display = 'none';
    
    const list = document.getElementById('notes-timeline-list');
    list.innerHTML = '';
    
    if (!p.notes || p.notes.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">
          No scouting notes added yet. Click the button below to add one.
        </div>
      `;
      return;
    }

    // Render chronological list of notes
    p.notes.forEach(note => {
      const noteItem = document.createElement('div');
      noteItem.className = 'note-timeline-item';
      noteItem.innerHTML = `
        <div class="note-header">
          <span class="note-author">${note.author || 'WSU Staff'}</span>
          <span class="note-date">${formatDateString(note.date)}</span>
        </div>
        <div class="note-content">${note.content}</div>
        <div class="note-actions">
          <span class="note-action-link" onclick="deleteNote('${p.id}', '${note.id}')">✕ Delete</span>
        </div>
      `;
      list.appendChild(noteItem);
    });

  } else if (state.activeScoutingTab === 'videos') {
    notesContainer.style.display = 'none';
    videosContainer.style.display = 'block';
    
    const grid = document.getElementById('videos-grid-list');
    grid.innerHTML = '';
    
    if (!p.videos || p.videos.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">
          No scouting videos embedded yet. Click the button below to add one.
        </div>
      `;
      return;
    }

    p.videos.forEach(vid => {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <div class="video-frame-container">
          <iframe src="${vid.url}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
        <div class="video-details">
          <div class="video-title">${vid.title}</div>
          <div class="video-footer">
            <span>Uploaded: ${formatDateString(vid.date)}</span>
            <span class="note-action-link" style="color:var(--wsu-crimson);" onclick="deleteVideo('${p.id}', '${vid.id}')">✕ Delete</span>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }
}

// In-place Stat Table Editor
function updateStatValue(playerId, rowIdx, key, value) {
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;

  const originalRow = p.stats[rowIdx];
  let processedValue = value;

  // Convert stats key values
  if (key !== 'season' && key !== 'team') {
    processedValue = value === '' ? 0 : parseInt(value);
  }

  p.stats[rowIdx][key] = processedValue;

  // Auto-calculate Shooting Percentages or Rebounds if row is changed
  const r = p.stats[rowIdx];
  if (key === 'fgm' || key === 'fga') {
    r.fg_pct = r.fga > 0 ? (r.fgm / r.fga) : 0;
  }
  if (key === 'tpm' || key === 'tpa') {
    r.tp_pct = r.tpa > 0 ? (r.tpm / r.tpa) : 0;
  }
  if (key === 'ftm' || key === 'fta') {
    r.ft_pct = r.fta > 0 ? (r.ftm / r.fta) : 0;
  }
  if (key === 'orb' || key === 'drb') {
    r.reb = parseNum(r.orb) + parseNum(r.drb);
  }

  saveDatabase();
  showToast('Stat updated successfully.');
  
  // Re-render only if the stats tab is active
  if (state.activeView === 'profile') {
    renderPlayerStats();
  }
}

function addEmptyStatRow() {
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) return;

  if (!p.stats) p.stats = [];
  
  // Add a blank row
  const blankRow = {
    season: '2025/26',
    team: p.aauProgram || 'High School',
    gp: 0,
    gs: 0,
    min: 0,
    pts: 0,
    fgm: 0,
    fga: 0,
    fg_pct: 0,
    tpm: 0,
    tpa: 0,
    tp_pct: 0,
    ftm: 0,
    fta: 0,
    ft_pct: 0,
    orb: 0,
    drb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0
  };

  p.stats.push(blankRow);
  saveDatabase();
  renderPlayerStats();
  showToast('New blank stat row added.');
}

function deleteStatRow(playerId, rowIdx) {
  if (confirm('Are you sure you want to delete this stat row?')) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;
    
    p.stats.splice(rowIdx, 1);
    saveDatabase();
    renderPlayerStats();
    showToast('Stat row deleted.', 'error');
  }
}

// Edit Player Metadata Modals
let activeEditSection = '';

function openEditMetadataModal(section) {
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) return;

  activeEditSection = section;
  const body = document.getElementById('modal-edit-body');
  body.innerHTML = '';
  
  const title = document.getElementById('modal-edit-title');
  
  if (section === 'personal') {
    title.innerText = 'Edit Personal Details';
    body.innerHTML = `
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Recruit Name</label>
          <input type="text" id="edit-name" class="form-input" value="${p.name}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Position</label>
          <select id="edit-position" class="form-input" required>
            <option value="Guards" ${p.position === 'Guards' ? 'selected' : ''}>Guards</option>
            <option value="Spacers" ${p.position === 'Spacers' ? 'selected' : ''}>Spacers</option>
            <option value="Blurs" ${p.position === 'Blurs' ? 'selected' : ''}>Blurs</option>
            <option value="Bigs" ${p.position === 'Bigs' ? 'selected' : ''}>Bigs</option>
          </select>
        </div>
      </div>
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Birthday</label>
          <input type="date" id="edit-birthday" class="form-input" value="${p.birthday || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Nationality</label>
          <input type="text" id="edit-nationality" class="form-input" value="${p.nationality || 'USA'}">
        </div>
      </div>
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Height (e.g. 6'8")</label>
          <input type="text" id="edit-height" class="form-input" value="${p.height || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Weight (e.g. 210 lbs)</label>
          <input type="text" id="edit-weight" class="form-input" value="${p.weight || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Hometown</label>
        <input type="text" id="edit-hometown" class="form-input" value="${p.hometown || ''}">
      </div>
    `;
  } else if (section === 'recruiting') {
    title.innerText = 'Edit Recruiting & Amateur Info';
    body.innerHTML = `
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">High School</label>
          <input type="text" id="edit-school" class="form-input" value="${p.highSchool || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">AAU Program</label>
          <input type="text" id="edit-aau" class="form-input" value="${p.aauProgram || ''}">
        </div>
      </div>
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Recruiting Class (Year)</label>
          <input type="number" id="edit-class" class="form-input" value="${p.recruitingYear || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Agent</label>
          <input type="text" id="edit-agent" class="form-input" value="${p.agent || ''}">
        </div>
      </div>
    `;
  } else if (section === 'socials') {
    title.innerText = 'Edit Contact & Social Details';
    body.innerHTML = `
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Twitter handle (without @)</label>
          <input type="text" id="edit-twitter" class="form-input" value="${p.social?.twitter || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Instagram handle (without @)</label>
          <input type="text" id="edit-instagram" class="form-input" value="${p.social?.instagram || ''}">
        </div>
      </div>
      <div class="form-group row-group">
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="text" id="edit-phone" class="form-input" value="${p.phone || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input type="email" id="edit-email" class="form-input" value="${p.email || ''}">
        </div>
      </div>
    `;
  }

  openModal('modal-edit-metadata');
}

// Handle Editing metadata form submission
document.getElementById('form-edit-metadata').addEventListener('submit', (e) => {
  e.preventDefault();
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) return;

  if (activeEditSection === 'personal') {
    p.name = document.getElementById('edit-name').value.trim();
    p.position = document.getElementById('edit-position').value.trim();
    p.birthday = document.getElementById('edit-birthday').value;
    p.nationality = document.getElementById('edit-nationality').value.trim();
    p.height = document.getElementById('edit-height').value.trim();
    p.weight = document.getElementById('edit-weight').value.trim();
    p.hometown = document.getElementById('edit-hometown').value.trim();
    
    // Auto-update ID if name changes? No, keep ID static to avoid breaking links.
  } else if (activeEditSection === 'recruiting') {
    p.highSchool = document.getElementById('edit-school').value.trim();
    p.aauProgram = document.getElementById('edit-aau').value.trim();
    p.recruitingYear = parseInt(document.getElementById('edit-class').value) || 2027;
    p.agent = document.getElementById('edit-agent').value.trim();
  } else if (activeEditSection === 'socials') {
    if (!p.social) p.social = {};
    p.social.twitter = document.getElementById('edit-twitter').value.trim();
    p.social.instagram = document.getElementById('edit-instagram').value.trim();
    p.phone = document.getElementById('edit-phone').value.trim();
    p.email = document.getElementById('edit-email').value.trim();
  }

  saveDatabase();
  closeModal('modal-edit-metadata');
  renderPlayerProfile();
  showToast('Player profile details updated.');
});

// Modals management
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Add New Player
function handleAddPlayer(e) {
  e.preventDefault();
  const name = document.getElementById('add-player-name').value.trim();
  const position = document.getElementById('add-player-pos').value.trim();
  const recruitingYear = parseInt(document.getElementById('add-player-class').value) || 2027;
  const birthday = document.getElementById('add-player-bday').value;
  const highSchool = document.getElementById('add-player-school').value.trim();
  const aauProgram = document.getElementById('add-player-aau').value.trim();
  const agent = document.getElementById('add-player-agent').value.trim() || 'None';

  // Slugify Name for unique ID
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Avoid duplicate ID
  let suffix = 1;
  const baseId = id;
  while (state.players.some(x => x.id === id)) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  const newPlayer = {
    id,
    name,
    position,
    birthday,
    recruitingYear,
    height: "6'4\"", // defaults
    weight: "190 lbs",
    hometown: "",
    nationality: "USA",
    highSchool,
    aauProgram,
    agent,
    social: { twitter: '', instagram: '' },
    notes: [],
    videos: [],
    stats: []
  };

  state.players.push(newPlayer);
  saveDatabase();
  closeModal('modal-add-player');
  e.target.reset();
  
  // Navigate directly to the new player profile
  navigateTo('profile', id);
  showToast(`Added profile for ${name}.`);
}

function deletePlayer(playerId) {
  const p = state.players.find(x => x.id === playerId);
  if (!p) return;

  if (confirm(`Are you sure you want to permanently delete the profile of ${p.name}? All notes, videos, and stats will be lost.`)) {
    state.players = state.players.filter(x => x.id !== playerId);
    saveDatabase();
    navigateTo('dashboard');
    showToast(`Player profile deleted.`, 'error');
  }
}

// Scouting Notes CRUD
function handleAddNote(e) {
  e.preventDefault();
  const content = document.getElementById('note-content-input').value.trim();
  const author = document.getElementById('note-author-input').value.trim() || 'WSU Staff';
  
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) return;

  const newNote = {
    id: 'note-' + Date.now(),
    date: new Date().toISOString().substring(0, 10),
    author,
    content
  };

  if (!p.notes) p.notes = [];
  p.notes.unshift(newNote); // newest first
  
  saveDatabase();
  closeModal('modal-add-note');
  e.target.reset();
  renderPlayerScouting();
  showToast('Scouting report note added.');
}

function deleteNote(playerId, noteId) {
  if (confirm('Delete this scouting note?')) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;
    
    p.notes = p.notes.filter(n => n.id !== noteId);
    saveDatabase();
    renderPlayerScouting();
    showToast('Scouting note deleted.', 'error');
  }
}

// Scouting Videos CRUD (Embed parser)
function handleAddVideo(e) {
  e.preventDefault();
  const title = document.getElementById('video-title-input').value.trim();
  let rawUrl = document.getElementById('video-url-input').value.trim();
  
  const p = state.players.find(x => x.id === state.activePlayerId);
  if (!p) return;

  // Convert YouTube/Vimeo links to embed urls
  let embedUrl = rawUrl;
  
  if (rawUrl.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(new URL(rawUrl).search);
    const videoId = urlParams.get('v');
    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (rawUrl.includes('youtu.be/')) {
    const videoId = rawUrl.split('youtu.be/')[1].split('?')[0];
    if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
  } else if (rawUrl.includes('vimeo.com/')) {
    const videoId = rawUrl.split('vimeo.com/')[1].split('?')[0];
    if (videoId) embedUrl = `https://player.vimeo.com/video/${videoId}`;
  }

  const newVid = {
    id: 'vid-' + Date.now(),
    title,
    url: embedUrl,
    date: new Date().toISOString().substring(0, 10)
  };

  if (!p.videos) p.videos = [];
  p.videos.unshift(newVid);

  saveDatabase();
  closeModal('modal-add-video');
  e.target.reset();
  renderPlayerScouting();
  showToast('Video scouting report added.');
}

function deleteVideo(playerId, videoId) {
  if (confirm('Delete this scouting video report?')) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;

    p.videos = p.videos.filter(v => v.id !== videoId);
    saveDatabase();
    renderPlayerScouting();
    showToast('Video report deleted.', 'error');
  }
}

// Database Sync and Management
function renderDbManager() {
  // Update totals text
  document.getElementById('db-total-players').innerText = state.players.length;
}

function exportDatabaseJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.players, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  downloadAnchor.setAttribute("download", "players.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Database exported as players.json');
}

async function resetDatabase() {
  if (confirm('WARNING: This will erase all local modifications, custom stats, and scouting notes, resetting to the original seed data. Continue?')) {
    localStorage.removeItem('wsu_player_db');
    await initDatabase();
    navigateTo('dashboard');
    showToast('Database reset to original seed data.', 'error');
  }
}

// CSV Stats Importer Logic
let csvHeaders = [];
let csvDataRows = [];

function handleCSVUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    const text = evt.target.result;
    parseCSV(text);
  };
  reader.readAsText(file);
}

function parseCSV(text) {
  // Simple CSV parser supporting double quotes
  const lines = [];
  let row = [''];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i+1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push('');
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }

  if (lines.length < 2) {
    showToast('Invalid CSV file. Must have a header row and at least one data row.', 'error');
    return;
  }

  csvHeaders = lines[0].map(h => h.trim());
  csvDataRows = lines.slice(1).filter(r => r.length === csvHeaders.length);

  setupCSVMappingUI();
}

function setupCSVMappingUI() {
  // Populate Player Target Select
  const playerSelect = document.getElementById('csv-target-player');
  playerSelect.innerHTML = '';
  state.players.forEach(p => {
    playerSelect.innerHTML += `<option value="${p.id}">${p.name} (Class of ${p.recruitingYear})</option>`;
  });

  // Render columns selectors
  const container = document.getElementById('csv-mapping-selectors');
  container.innerHTML = '';

  // Common mapping suggestions (case insensitive matching)
  const findMatch = (key) => {
    const cleanKey = key.toLowerCase();
    const commonAliases = {
      season: ['year', 'season', 'yr'],
      team: ['team', 'league', 'school', 'program'],
      gp: ['gp', 'games', 'g'],
      gs: ['gs', 'starts', 'started'],
      min: ['min', 'minutes', 'm'],
      pts: ['pts', 'points', 'p'],
      fgm: ['fgm', 'fg', 'field goals'],
      fga: ['fga', 'fga', 'field goal attempts'],
      tpm: ['3pm', '3p', '3pm', '3pts', '3fgm'],
      tpa: ['3pa', '3pa', '3pts attempts', '3fga'],
      ftm: ['ftm', 'ft', 'free throws'],
      fta: ['fta', 'fta', 'free throw attempts'],
      orb: ['orb', 'off', 'offensive rebounds'],
      drb: ['drb', 'def', 'defensive rebounds'],
      ast: ['ast', 'assists', 'a'],
      stl: ['stl', 'steals', 's'],
      blk: ['blk', 'blocks', 'b'],
      tov: ['tov', 'to', 'turnovers'],
      pf: ['pf', 'fouls', 'f']
    };

    const aliases = commonAliases[key] || [key];
    return csvHeaders.findIndex(h => aliases.includes(h.toLowerCase()));
  };

  // Build a selection dropdown for each required stat field
  STAT_FIELDS.forEach(field => {
    const matchedIdx = findMatch(field.key);
    let options = `<option value="">-- Skip Field --</option>`;
    
    csvHeaders.forEach((header, idx) => {
      const selected = idx === matchedIdx ? 'selected' : '';
      options += `<option value="${idx}" ${selected}>Column ${idx+1}: ${header}</option>`;
    });

    container.innerHTML += `
      <div class="csv-mapping-row">
        <span class="csv-mapping-label">${field.label} (${field.key}):</span>
        <select class="csv-mapping-select" data-field="${field.key}">
          ${options}
        </select>
      </div>
    `;
  });

  // Open CSV importer mapping modal
  openModal('modal-csv-mapping');
}

function handleCSVImportApply(e) {
  e.preventDefault();
  const playerId = document.getElementById('csv-target-player').value;
  const p = state.players.find(x => x.id === playerId);
  
  if (!p) {
    showToast('Target player not found!', 'error');
    return;
  }

  // Retrieve mapping mapping
  const mappings = {};
  let seasonMapped = false;
  let teamMapped = false;

  document.querySelectorAll('#csv-mapping-selectors select').forEach(select => {
    const fieldKey = select.dataset.field;
    const colIdx = select.value;
    if (colIdx !== '') {
      mappings[fieldKey] = parseInt(colIdx);
      if (fieldKey === 'season') seasonMapped = true;
      if (fieldKey === 'team') teamMapped = true;
    }
  });

  if (!seasonMapped || !teamMapped) {
    alert('You must map both Season (Season/Year) and Team (Team/League) fields.');
    return;
  }

  // Process rows
  if (!p.stats) p.stats = [];
  let rowsImported = 0;

  csvDataRows.forEach(csvRow => {
    // Construct single stats row
    const statRow = {
      season: csvRow[mappings.season] || '2025/26',
      team: csvRow[mappings.team] || 'Unknown',
      gp: parseVal(csvRow[mappings.gp], 0),
      gs: parseVal(csvRow[mappings.gs], 0),
      min: parseVal(csvRow[mappings.min], 0),
      pts: parseVal(csvRow[mappings.pts], 0),
      fgm: parseVal(csvRow[mappings.fgm], 0),
      fga: parseVal(csvRow[mappings.fga], 0),
      tpm: parseVal(csvRow[mappings.tpm], 0),
      tpa: parseVal(csvRow[mappings.tpa], 0),
      ftm: parseVal(csvRow[mappings.ftm], 0),
      fta: parseVal(csvRow[mappings.fta], 0),
      orb: parseVal(csvRow[mappings.orb], 0),
      drb: parseVal(csvRow[mappings.drb], 0),
      ast: parseVal(csvRow[mappings.ast], 0),
      stl: parseVal(csvRow[mappings.stl], 0),
      blk: parseVal(csvRow[mappings.blk], 0),
      tov: parseVal(csvRow[mappings.tov], 0),
      pf: parseVal(csvRow[mappings.pf], 0)
    };

    // Derived percentages
    statRow.fg_pct = statRow.fga > 0 ? (statRow.fgm / statRow.fga) : 0;
    statRow.tp_pct = statRow.tpa > 0 ? (statRow.tpm / statRow.tpa) : 0;
    statRow.ft_pct = statRow.fta > 0 ? (statRow.ftm / statRow.fta) : 0;
    statRow.reb = statRow.orb + statRow.drb;

    p.stats.push(statRow);
    rowsImported++;
  });

  saveDatabase();
  closeModal('modal-csv-mapping');
  
  // Reset input file
  document.getElementById('csv-upload').value = '';
  
  // Navigate to player profile to inspect results
  navigateTo('profile', playerId);
  showToast(`Successfully imported ${rowsImported} stats rows for ${p.name}.`);
}

// Utilities Helpers
function parseNum(val) {
  if (val === undefined || val === null || isNaN(val)) return 0;
  return parseInt(val);
}

function parseVal(csvVal, defaultVal = 0) {
  if (csvVal === undefined || csvVal === null) return defaultVal;
  const num = parseInt(csvVal.toString().replace(/[^0-9-]/g, ''));
  return isNaN(num) ? defaultVal : num;
}

function formatPercentage(made, attempted) {
  const att = parseNum(attempted);
  const md = parseNum(made);
  if (att <= 0) return '.000';
  return (md / att).toFixed(3).substring(1); // formats as .750 instead of 0.750
}

function formatDateString(dateStr) {
  if (!dateStr) return 'N/A';
  const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}
