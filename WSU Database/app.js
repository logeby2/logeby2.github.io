// Configuration for Reference Data Sources
const REFERENCE_SOURCES = [
  { id: 'ncaa-d1', label: '2026 NCAA D1', file: '2026 D1 Players.csv', type: 'NCAA' },
  { id: 'ncaa-d2', label: '2026 NCAA D2', file: '2026 D2 Players.csv', type: 'NCAA' },
  { id: 'eybl-16u', label: '2025 EYBL 16U', file: '2025 EYBL 16U.csv', type: 'AAU_EYBL' },
  { id: 'eybl-15u', label: '2025 EYBL 15U', file: '2025 EYBL 15U.csv', type: 'AAU_EYBL' },
  { id: 'sssb-16u', label: '2025 3SSB 16U', file: '2025 3SSB 16U.csv', type: 'AAU_3SSB' },
  { id: 'puma-16u', label: '2025 Puma Pro16 16U', file: '2025 Puma NxtPro16 16u.csv', type: 'AAU_PUMA' }
];

// Global Application State
let state = {
  players: [],
  user: null, // Logged in user session { email, role }
  users: [],   // Accounts roster
  activeView: 'dashboard', // 'dashboard', 'profile', 'db-manager'
  activePlayerId: null,
  activeStatsTab: 'totals', // 'per-game', 'totals', 'per-40', 'advanced'
  activeScoutingTab: 'notes', // 'notes', 'videos'
  referenceDb: null, // NCAA/AAU reference players list
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

  // Auth Forms Actions
  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('form-create-user').addEventListener('submit', handleCreateUser);

  // Link NCAA/AAU Player Search Input
  const ncaaSearchInput = document.getElementById('ncaa-search-input');
  if (ncaaSearchInput) {
    ncaaSearchInput.addEventListener('input', async (e) => {
      const query = e.target.value.toLowerCase().trim();
      const resultsContainer = document.getElementById('ncaa-search-results');
      
      if (query.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
      }
      
      // Lazy load Reference database if not loaded
      if (!state.referenceDb) {
        resultsContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="loading-spinner"></div>
            Loading NCAA & AAU Reference Databases...
          </div>
        `;
        resultsContainer.style.display = 'block';
        await loadReferenceDatabase();
      }
      
      // Filter matches
      const matches = state.referenceDb.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.team.toLowerCase().includes(query)
      ).slice(0, 30); // Limit to top 30 matches
      
      if (matches.length === 0) {
        resultsContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: var(--text-muted);">
            No NCAA or AAU players found matching "${query}"
          </div>
        `;
        resultsContainer.style.display = 'block';
        return;
      }
      
      resultsContainer.innerHTML = matches.map(item => {
        let htDetails = '';
        if (item["Player Height"]) {
          const inches = parseInt(item["Player Height"]);
          if (!isNaN(inches) && inches > 0) {
            htDetails = ` • Ht: ${Math.floor(inches/12)}'${inches%12}"`;
          }
        }
        return `
          <div class="ncaa-result-item" onclick="linkNcaaPlayer('${state.activePlayerId}', '${item.id}', '${item.sourceId}')">
            <div style="font-weight: 700; color: var(--text-primary);">${item.name}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
              ${item.team} (${item.sourceLabel}) • Pos: ${item.position || 'N/A'}${htDetails}
            </div>
          </div>
        `;
      }).join('');
      resultsContainer.style.display = 'block';
    });
  }
}

// Navigation Router
function navigateTo(view, playerId = null) {
  if (!state.user) {
    document.getElementById('login-overlay').style.display = 'flex';
    return;
  }

  // Role Protection
  if (view === 'db-manager' && state.user.role !== 'Admin') {
    navigateTo('dashboard');
    return;
  }

  state.activeView = view;
  state.activePlayerId = playerId;
  
  // Toggle Nav Elements visibility based on role
  const isAdmin = state.user.role === 'Admin';
  document.getElementById('nav-db-manager').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('btn-add-player').style.display = isAdmin ? 'block' : 'none';
  
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
  const isAdmin = state.user && state.user.role === 'Admin';
  
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
        ${isAdmin ? `<span class="sidebar-edit-icon" onclick="openEditMetadataModal('personal')">✎</span>` : ''}
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
        ${isAdmin ? `<span class="sidebar-edit-icon" onclick="openEditMetadataModal('recruiting')">✎</span>` : ''}
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
        ${isAdmin ? `<span class="sidebar-edit-icon" onclick="openEditMetadataModal('socials')">✎</span>` : ''}
      </div>
      <div class="sidebar-data-list">
        <div class="sidebar-data-row"><span class="sidebar-label">Twitter:</span><span class="sidebar-val">${p.social?.twitter ? `@${p.social.twitter}` : 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Instagram:</span><span class="sidebar-val">${p.social?.instagram ? `@${p.social.instagram}` : 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Phone:</span><span class="sidebar-val">${p.phone || 'N/A'}</span></div>
        <div class="sidebar-data-row"><span class="sidebar-label">Email:</span><span class="sidebar-val">${p.email || 'N/A'}</span></div>
      </div>
    </div>

    <!-- NCAA/AAU Reference Stats Link Group -->
    <div class="sidebar-group">
      <div class="sidebar-group-title">
        <span>Stats Database Link</span>
      </div>
      <div class="sidebar-data-list" style="background: var(--bg-secondary); padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-light);">
        ${p.ncaaLink ? `
          <div class="sidebar-data-row" style="flex-direction: column; align-items: flex-start; gap: 4px; border-bottom: none; padding-bottom: 0;">
            <span class="sidebar-val" style="font-weight: 700; color: var(--wsu-crimson); text-align: left;">${p.ncaaLink.fullName}</span>
            <span class="sidebar-label" style="font-size: 0.75rem; text-align: left;">${p.ncaaLink.teamMarket} (${p.ncaaLink.division})</span>
            ${isAdmin ? `<button class="secondary-btn" style="padding: 2px 6px; font-size: 0.75rem; margin-top: 6px; width: 100%; justify-content: center;" onclick="unlinkNcaaPlayer('${p.id}')">Remove Link</button>` : ''}
          </div>
        ` : `
          <div class="sidebar-data-row" style="flex-direction: column; align-items: flex-start; gap: 4px; border-bottom: none; padding-bottom: 0;">
            <span class="sidebar-label" style="font-size: 0.8rem; font-style: italic; text-align: left;">Not linked to reference stats.</span>
            ${isAdmin ? `<button class="action-btn" style="padding: 4px 8px; font-size: 0.75rem; margin-top: 6px; width: 100%; justify-content: center;" onclick="openLinkNcaaModal('${p.id}')">Link NCAA/AAU Player</button>` : ''}
          </div>
        `}
      </div>
    </div>

    <!-- Actions -->
    ${isAdmin ? `
    <div class="sidebar-group" style="margin-top: 10px;">
      <button class="secondary-btn" style="color: var(--wsu-crimson); border-color: var(--wsu-crimson); justify-content: center;" onclick="deletePlayer('${p.id}')">✕ Delete Player</button>
    </div>` : ''}
  `;

  // Render Title and Sub-details
  document.getElementById('profile-player-name').innerText = p.name;
  document.getElementById('profile-player-info').innerText = `${p.position || 'N/A'} | ${p.height || 'N/A'} | ${p.weight || 'N/A'} | Class of ${p.recruitingYear || 'N/A'}`;

  // Reset Sub Tabs UI
  const ncaaTab = document.getElementById('tab-ncaa-stats');
  if (ncaaTab) {
    if (p.ncaaLink) {
      ncaaTab.style.display = 'inline-block';
    } else {
      ncaaTab.style.display = 'none';
      if (state.activeStatsTab === 'ncaa') {
        state.activeStatsTab = 'totals';
      }
    }
  }

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
  const isAdmin = state.user && state.user.role === 'Admin';
  
  // NCAA/AAU Linked Reference Stats Tab Handler
  if (state.activeStatsTab === 'ncaa') {
    if (!p.ncaaLink) {
      container.innerHTML = `<div class="empty-state"><h3>No reference player linked</h3></div>`;
      return;
    }
    
    if (!state.referenceDb) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <div class="loading-spinner"></div>
          Loading NCAA & AAU Reference Stats...
        </div>
      `;
      loadReferenceDatabase().then(() => {
        if (state.activeView === 'profile' && state.activeStatsTab === 'ncaa' && state.activePlayerId === p.id) {
          renderPlayerStats();
        }
      });
      return;
    }
    
    const refPlayer = state.referenceDb.find(x => x.id === p.ncaaLink.playerId && x.sourceId === p.ncaaLink.sourceId);
    if (!refPlayer) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>Reference stats not found</h3>
          <p>The linked player stats could not be found in the current CSV files.</p>
        </div>
      `;
      return;
    }
    
    renderReferenceStatsTable(refPlayer);
    return;
  }

  if (!p.stats || p.stats.length === 0) {
    const emptyCta = isAdmin 
      ? `<p>You can add individual stat rows manually below or upload an Excel/CSV file in the Database Manager.</p>
         <button class="action-btn" style="margin: 0 auto;" onclick="addEmptyStatRow()">+ Add Stat Row</button>`
      : `<p>Roster stats are not currently loaded for this recruit.</p>`;

    container.innerHTML = `
      <div class="empty-state">
        <h3>No stats uploaded yet</h3>
        ${emptyCta}
      </div>
    `;
    return;
  }

  let headers = [];
  let rowsHtml = '';
  
  if (state.activeStatsTab === 'totals') {
    headers = ['Season', 'Team/League', 'GP', 'GS', 'MIN', 'PTS', 'FGM-A', 'FG%', '3PM-A', '3P%', 'FTM-A', 'FT%', 'OFF', 'DEF', 'TRB', 'AST', 'STL', 'BLK', 'TOV', 'PF'];
    if (isAdmin) headers.push('');
    
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

      if (isAdmin) {
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
      } else {
        rowsHtml += `
          <tr>
            <td>${row.season}</td>
            <td>${row.team}</td>
            <td class="text-center">${row.gp}</td>
            <td class="text-center">${row.gs}</td>
            <td class="text-center">${row.min}</td>
            <td class="text-center highlight-column font-bold">${row.pts}</td>
            <td class="text-center">${row.fgm}-${row.fga}</td>
            <td class="text-center">${formatPercentage(row.fgm, row.fga)}</td>
            <td class="text-center">${row.tpm}-${row.tpa}</td>
            <td class="text-center">${formatPercentage(row.tpm, row.tpa)}</td>
            <td class="text-center">${row.ftm}-${row.fta}</td>
            <td class="text-center">${formatPercentage(row.ftm, row.fta)}</td>
            <td class="text-center">${row.orb}</td>
            <td class="text-center">${row.drb}</td>
            <td class="text-center font-bold">${parseNum(row.orb) + parseNum(row.drb)}</td>
            <td class="text-center">${row.ast}</td>
            <td class="text-center">${row.stl}</td>
            <td class="text-center">${row.blk}</td>
            <td class="text-center">${row.tov}</td>
            <td class="text-center">${row.pf}</td>
          </tr>
        `;
      }
    });

    // Totals/Lifetime Row
    const trbSum = totalsSum.orb + totalsSum.drb;
    const actionCellPlaceholder = isAdmin ? '<td></td>' : '';
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
        ${actionCellPlaceholder}
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

  const addRowBtn = isAdmin ? `<button class="secondary-btn" onclick="addEmptyStatRow()">+ Add Stat Row</button>` : '';
  const footerHint = isAdmin ? `<span style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">* Hover or click on cells to edit values directly. Changes save automatically!</span>` : '';

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
      ${addRowBtn}
      ${footerHint}
    </div>
  `;
}

// Render scouting notes & videos
function renderPlayerScouting() {
  const p = state.players.find(x => x.id === state.activePlayerId);
  const notesContainer = document.getElementById('scouting-notes-section');
  const videosContainer = document.getElementById('scouting-videos-section');
  const isAdmin = state.user && state.user.role === 'Admin';
  
  // Show/Hide Add Scouting buttons based on role
  document.querySelector('#scouting-notes-section .action-btn').style.display = isAdmin ? 'block' : 'none';
  document.querySelector('#scouting-videos-section .action-btn').style.display = isAdmin ? 'block' : 'none';

  if (state.activeScoutingTab === 'notes') {
    notesContainer.style.display = 'block';
    videosContainer.style.display = 'none';
    
    const list = document.getElementById('notes-timeline-list');
    list.innerHTML = '';
    
    if (!p.notes || p.notes.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">
          No scouting notes added yet.
        </div>
      `;
      return;
    }

    // Render chronological list of notes
    p.notes.forEach(note => {
      const noteItem = document.createElement('div');
      noteItem.className = 'note-timeline-item';
      
      const deleteAction = isAdmin 
        ? `<div class="note-actions">
             <span class="note-action-link" onclick="deleteNote('${p.id}', '${note.id}')">✕ Delete</span>
           </div>`
        : '';

      noteItem.innerHTML = `
        <div class="note-header">
          <span class="note-author">${note.author || 'WSU Staff'}</span>
          <span class="note-date">${formatDateString(note.date)}</span>
        </div>
        <div class="note-content">${note.content}</div>
        ${deleteAction}
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
          No scouting videos embedded yet.
        </div>
      `;
      return;
    }

    p.videos.forEach(vid => {
      const card = document.createElement('div');
      card.className = 'video-card';
      
      const deleteAction = isAdmin
        ? `<span class="note-action-link" style="color:var(--wsu-crimson);" onclick="deleteVideo('${p.id}', '${vid.id}')">✕ Delete</span>`
        : '';

      card.innerHTML = `
        <div class="video-frame-container">
          <iframe src="${vid.url}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
        </div>
        <div class="video-details">
          <div class="video-title">${vid.title}</div>
          <div class="video-footer">
            <span>Uploaded: ${formatDateString(vid.date)}</span>
            ${deleteAction}
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
  
  // Render user roster if Admin
  const isAdmin = state.user && state.user.role === 'Admin';
  document.getElementById('admin-user-management').style.display = isAdmin ? 'block' : 'none';
  if (isAdmin) {
    renderUsersRoster();
  }
}

function exportDatabaseJSON() {
  const backupData = {
    players: state.players,
    users: state.users
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href",     dataStr);
  downloadAnchor.setAttribute("download", "players.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Database backup players.json exported.');
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

// Authentication & User Accounts Handlers
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value.trim();

  const matchedUser = state.users.find(u => u.email.toLowerCase() === email && u.password === pass);
  if (matchedUser) {
    state.user = { email: matchedUser.email, role: matchedUser.role };
    sessionStorage.setItem('wsu_user_session', JSON.stringify(state.user));
    
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('user-display').innerText = state.user.email;
    e.target.reset();
    
    showToast(`Welcome back, ${matchedUser.email}!`);
    renderApp();
  } else {
    showToast('Invalid email address or password.', 'error');
  }
}

function handleLogout() {
  sessionStorage.removeItem('wsu_user_session');
  state.user = null;
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  showToast('You have been logged out.');
  navigateTo('dashboard');
}

function handleCreateUser(e) {
  e.preventDefault();
  const email = document.getElementById('create-user-email').value.trim().toLowerCase();
  const pass = document.getElementById('create-user-pass').value.trim();
  const role = document.getElementById('create-user-role').value;

  if (pass.length < 4) {
    alert('Password must be at least 4 characters.');
    return;
  }

  if (state.users.some(u => u.email.toLowerCase() === email)) {
    alert('A user account with this email already exists.');
    return;
  }

  const newUser = { email, password: pass, role };
  state.users.push(newUser);
  localStorage.setItem('wsu_user_accounts', JSON.stringify(state.users));
  
  closeModal('modal-create-user');
  e.target.reset();
  
  renderUsersRoster();
  showToast(`Account created for ${email}.`);
}

function renderUsersRoster() {
  const list = document.getElementById('user-accounts-list');
  list.innerHTML = '';

  state.users.forEach(user => {
    const isSelf = user.email.toLowerCase() === state.user.email.toLowerCase();
    const deleteBtn = isSelf 
      ? `<span style="color:var(--text-muted); font-size:0.8rem; font-style:italic;">Active Session</span>`
      : `<button class="secondary-btn" style="padding:2px 8px; font-size:0.75rem; color:var(--wsu-crimson); border-color:var(--wsu-crimson);" onclick="deleteUserAccount('${user.email}')">✕ Delete</button>`;
    
    list.innerHTML += `
      <tr>
        <td style="font-weight:700;">${user.email}</td>
        <td><span style="background:var(--wsu-gray-light); padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.8rem;">${user.role}</span></td>
        <td style="text-align:center;">${deleteBtn}</td>
      </tr>
    `;
  });
}

function deleteUserAccount(email) {
  if (confirm(`Are you sure you want to delete the user account for ${email}?`)) {
    state.users = state.users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    localStorage.setItem('wsu_user_accounts', JSON.stringify(state.users));
    renderUsersRoster();
    showToast(`User account ${email} deleted.`, 'error');
  }
}

// ----------------------------------------------------
// Reference Databases Loader & Normalizer (NCAA & AAU)
// ----------------------------------------------------
async function loadReferenceDatabase() {
  if (state.referenceDb) return;
  state.referenceDb = [];
  
  try {
    const fetchPromises = REFERENCE_SOURCES.map(async (src) => {
      try {
        const res = await fetch(src.file);
        if (res.ok) {
          const text = await res.text();
          const parsed = parseReferenceCSV(text, src);
          state.referenceDb.push(...parsed);
        } else {
          console.warn(`Could not load reference file: ${src.file} (HTTP ${res.status})`);
        }
      } catch (err) {
        console.error(`Error loading reference ${src.label}:`, err);
      }
    });
    
    await Promise.all(fetchPromises);
    console.log(`Loaded ${state.referenceDb.length} players from reference sheets.`);
  } catch (e) {
    console.error('Failed to load reference databases:', e);
  }
}

function parseReferenceCSV(text, source) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]);
  const players = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length !== headers.length) continue;
    
    const player = { sourceId: source.id, sourceType: source.type, sourceLabel: source.label };
    headers.forEach((h, idx) => {
      player[h] = values[idx];
    });
    
    // Normalize Name, Team, and ID fields
    if (source.type === 'NCAA') {
      player.name = player.fullName;
      player.team = player["Team Market"];
      player.id = player.playerId;
    } else if (source.type === 'AAU_EYBL') {
      player.name = player.Name;
      player.team = player.Team;
      player.id = `${player.Name}-${player.Team}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    } else { // AAU_3SSB or AAU_PUMA
      player.name = player.Player;
      player.team = player.Team;
      player.id = `${player.Player}-${player.Team}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }
    
    players.push(player);
  }
  return players;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

// ----------------------------------------------------
// NCAA/AAU Player Linking Handlers
// ----------------------------------------------------
function openLinkNcaaModal(playerId) {
  state.activePlayerId = playerId;
  openModal('modal-link-ncaa');
  
  const searchInput = document.getElementById('ncaa-search-input');
  const resultsContainer = document.getElementById('ncaa-search-results');
  if (searchInput && resultsContainer) {
    searchInput.value = '';
    resultsContainer.innerHTML = '';
    resultsContainer.style.display = 'none';
    setTimeout(() => searchInput.focus(), 100);
  }
}

function linkNcaaPlayer(recruitId, refPlayerId, sourceId) {
  const recruit = state.players.find(x => x.id === recruitId);
  const refPlayer = state.referenceDb.find(x => x.id === refPlayerId && x.sourceId === sourceId);
  
  if (!recruit || !refPlayer) {
    showToast('Failed to link player.', 'error');
    return;
  }
  
  recruit.ncaaLink = {
    playerId: refPlayer.id,
    fullName: refPlayer.name,
    teamMarket: refPlayer.team,
    division: refPlayer.sourceLabel
  };
  
  saveDatabase();
  closeModal('modal-link-ncaa');
  
  // Set active stats tab to ncaa so they see the result immediately
  state.activeStatsTab = 'ncaa';
  
  renderPlayerProfile();
  showToast(`Successfully linked ${recruit.name} to reference player ${refPlayer.name}.`);
}

function unlinkNcaaPlayer(recruitId) {
  if (confirm('Are you sure you want to remove the link to NCAA/AAU stats?')) {
    const recruit = state.players.find(x => x.id === recruitId);
    if (recruit) {
      delete recruit.ncaaLink;
      saveDatabase();
      
      if (state.activeStatsTab === 'ncaa') {
        state.activeStatsTab = 'totals';
      }
      
      renderPlayerProfile();
      showToast('Reference stats link removed.', 'error');
    }
  }
}

// Helper formats for NCAA Metrics
function formatNcaaPct(val) {
  if (val === undefined || val === null || val === '') return 'N/A';
  // Strip percent sign if present
  let cleanVal = val.toString().replace('%', '').trim();
  const num = parseFloat(cleanVal);
  if (isNaN(num)) return val;
  // If it is in decimal format (e.g. 0.548) convert to %
  if (num > 0 && num < 1.0) {
    return (num * 100).toFixed(1) + '%';
  }
  return num.toFixed(1) + '%';
}

function formatNcaaRatio(val) {
  if (val === undefined || val === null || val === '') return 'N/A';
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  return num.toFixed(2);
}

function formatNcaaPercentile(val) {
  if (val === undefined || val === null || val === '') return 'N/A';
  const num = parseFloat(val);
  if (isNaN(num)) return val;
  const pct = Math.round(num * 100);
  
  // Ordinal suffix helper
  let suffix = 'th';
  if (pct % 10 === 1 && pct % 100 !== 11) suffix = 'st';
  else if (pct % 10 === 2 && pct % 100 !== 12) suffix = 'nd';
  else if (pct % 10 === 3 && pct % 100 !== 13) suffix = 'rd';
  
  return `${pct}${suffix} %ile`;
}

// ----------------------------------------------------
// Reference stats table renderer
// ----------------------------------------------------
function renderReferenceStatsTable(refPlayer) {
  const container = document.getElementById('profile-stats-container');
  const type = refPlayer.sourceType;
  
  const getVal = (key) => refPlayer[key] !== undefined && refPlayer[key] !== '' ? refPlayer[key] : 'N/A';
  
  let html = `
    <div style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); background:var(--bg-secondary); padding:8px 12px; border-radius:var(--border-radius-sm); border:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
      <span>Linked Profile: <strong>${refPlayer.name}</strong> (${refPlayer.team})</span>
      <span style="background:var(--wsu-crimson); color:white; padding:2px 6px; border-radius:4px; font-weight:700; font-size:0.75rem;">${refPlayer.sourceLabel}</span>
    </div>
  `;
  
  if (type === 'NCAA') {
    const rows = [
      // General
      { category: "General", label: "Games Played", val: getVal("Games Played"), pctKey: null },
      { category: "General", label: "Games Started", val: getVal("Games Started"), pctKey: null },
      { category: "General", label: "Minutes Played", val: formatNcaaRatio(getVal("Minutes Played")), pctKey: null },
      { category: "General", label: "Player Height", val: getVal("Player Height") ? `${Math.floor(parseInt(getVal("Player Height"))/12)}'${parseInt(getVal("Player Height"))%12}"` : 'N/A', pctKey: null },
      
      // Shooting & Scoring
      { category: "Shooting", label: "True Shooting % (TS%)", val: formatNcaaPct(getVal("True Shooting %")), pctKey: "True Shooting % %ile" },
      { category: "Shooting", label: "2-Point FG %", val: formatNcaaPct(getVal("2-Point Pct")), pctKey: "2-Point Pct %ile" },
      { category: "Shooting", label: "3-Point FG %", val: formatNcaaPct(getVal("3-Point Pct")), pctKey: "3-Point Pct %ile" },
      { category: "Shooting", label: "Free Throw % (FT%)", val: formatNcaaPct(getVal("Free Throw Pct")), pctKey: "Free Throw Pct %ile" },
      { category: "Shooting", label: "FT Attempt Rate", val: formatNcaaPct(getVal("FT Attempt Rate")), pctKey: "FT Attempt Rate %ile" },
      { category: "Shooting", label: "3P Attempt Rate", val: formatNcaaPct(getVal("3-Point Att Rate")), pctKey: "3-Point Att Rate %ile" },
      
      // Playmaking
      { category: "Playmaking", label: "Usage Pct", val: formatNcaaPct(getVal("Usage Pct")), pctKey: "Usage Pct %ile" },
      { category: "Playmaking", label: "Assist Pct", val: formatNcaaPct(getVal("Assist Pct")), pctKey: "Assist Pct %ile" },
      { category: "Playmaking", label: "Assist Ratio", val: formatNcaaPct(getVal("Assist Ratio")), pctKey: "Assist Ratio %ile" },
      { category: "Playmaking", label: "Turnover Pct", val: formatNcaaPct(getVal("Turnover Pct")), pctKey: "Turnover Pct %ile" },
      { category: "Playmaking", label: "Ast / Tov Ratio", val: formatNcaaRatio(getVal("Ast/Tov Ratio")), pctKey: "Ast/Tov Ratio %ile" },
      
      // Rebounding
      { category: "Rebounding", label: "Off Rebound Pct", val: formatNcaaPct(getVal("Off Rebound Pct")), pctKey: "Off Rebound Pct %ile" }
    ];

    let tbodyHtml = '';
    let lastCategory = '';
    
    rows.forEach(row => {
      if (row.category !== lastCategory) {
        tbodyHtml += `
          <tr class="category-header-row" style="background: var(--wsu-crimson); color: white; font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">
            <td colspan="3" style="padding: 6px 12px; font-weight:700;">${row.category} Metrics</td>
          </tr>
        `;
        lastCategory = row.category;
      }
      
      let percentileHtml = '<span style="color:var(--text-muted); font-style:italic;">N/A</span>';
      if (row.pctKey && refPlayer[row.pctKey]) {
        const pctVal = parseFloat(refPlayer[row.pctKey]);
        const pctInt = Math.round(pctVal * 100);
        const pctText = formatNcaaPercentile(pctVal);
        
        percentileHtml = `
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="percentile-bar-outer">
              <div class="percentile-bar-inner" style="width:${pctInt}%;"></div>
            </div>
            <span style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${pctText}</span>
          </div>
        `;
      }
      
      tbodyHtml += `
        <tr>
          <td style="font-weight: 600; padding: 10px 12px;">${row.label}</td>
          <td class="text-center font-bold highlight-column" style="width: 120px; padding: 10px 12px;">${row.val}</td>
          <td style="padding: 10px 12px;">${percentileHtml}</td>
        </tr>
      `;
    });

    html += `
      <div class="table-wrapper">
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px 12px;">Statistic Metric</th>
              <th class="text-center highlight-column" style="width: 120px; padding: 10px 12px;">Value</th>
              <th style="text-align: left; padding: 10px 12px;">Percentile Rank (vs. NCAA ${refPlayer.division})</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }
  else if (type === 'AAU_EYBL') {
    const rows = [
      { category: "Averages", label: "Games Played", val: getVal("Games") },
      { category: "Averages", label: "Minutes Per Game (MPG)", val: getVal("MPG") },
      { category: "Averages", label: "Points Per Game (PPG)", val: getVal("PPG") },
      { category: "Averages", label: "Assists Per Game (APG)", val: getVal("APG") },
      { category: "Averages", label: "Rebounds Per Game (RPG)", val: `${getVal("RPG")} (Off: ${getVal("ORPG")} / Def: ${getVal("DRPG")})` },
      { category: "Averages", label: "Steals Per Game (SPG)", val: getVal("SPG") },
      { category: "Averages", label: "Blocks Per Game (BPG)", val: getVal("BPG") },
      { category: "Averages", label: "Stocks Per Game (STL+BLK)", val: getVal("STOCKS") },
      { category: "Averages", label: "Turnovers Per Game (TOV)", val: getVal("TOV") },
      { category: "Averages", label: "Ast / Tov Ratio", val: getVal("AST/TOV") },
      { category: "Averages", label: "Fouls Per Game (FPG)", val: getVal("FPG") },
      
      { category: "Percentages", label: "Field Goal % (FG%)", val: `${formatPercent(getVal("FG%"))} (${getVal("FGM")}/${getVal("FGA")})` },
      { category: "Percentages", label: "Effective FG % (eFG%)", val: formatPercent(getVal("FGE%")) },
      { category: "Percentages", label: "2-Point FG % (2P%)", val: `${formatPercent(getVal("2P%"))} (${getVal("2-PM")}/${getVal("2PA")})` },
      { category: "Percentages", label: "3-Point FG % (3P%)", val: `${formatPercent(getVal("3P%"))} (${getVal("3-PM")}/${getVal("3PA")})` },
      { category: "Percentages", label: "Free Throw % (FT%)", val: `${formatPercent(getVal("FT%"))} (${getVal("FTM")}/${getVal("FTA")})` },
      { category: "Percentages", label: "3P Attempt Rate (3Pr)", val: getVal("3pr") },
      { category: "Percentages", label: "FT Attempt Rate (FTr)", val: getVal("FTr") }
    ];

    let tbodyHtml = '';
    let lastCategory = '';
    
    rows.forEach(row => {
      if (row.category !== lastCategory) {
        tbodyHtml += `
          <tr class="category-header-row" style="background: var(--wsu-crimson); color: white; font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">
            <td colspan="2" style="padding: 6px 12px; font-weight:700;">${row.category}</td>
          </tr>
        `;
        lastCategory = row.category;
      }
      
      tbodyHtml += `
        <tr>
          <td style="font-weight: 600; padding: 10px 12px;">${row.label}</td>
          <td class="text-center font-bold highlight-column" style="width: 200px; padding: 10px 12px;">${row.val}</td>
        </tr>
      `;
    });

    html += `
      <div class="table-wrapper">
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px 12px;">AAU Statistic Metric</th>
              <th class="text-center highlight-column" style="width: 200px; padding: 10px 12px;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }
  else if (type === 'AAU_3SSB') {
    const rows = [
      { category: "Averages", label: "Points Per Game (PPG)", val: getVal("PPG") },
      { category: "Averages", label: "Rebounds Per Game (RPG)", val: getVal("RPG") },
      { category: "Averages", label: "Assists Per Game (APG)", val: getVal("APG") },
      { category: "Averages", label: "Turnovers Per Game (TOV)", val: getVal("TOV") },
      { category: "Averages", label: "Ast / Tov Ratio", val: getVal("AST/TOV") },
      { category: "Averages", label: "Steals Per Game (SPG)", val: getVal("SPG") },
      { category: "Averages", label: "Blocks Per Game (BPG)", val: getVal("BPG") },
      { category: "Averages", label: "Stocks Per Game", val: getVal("STOCKS PER") },
      
      { category: "Percentages", label: "Field Goal % (FG%)", val: `${formatPercent(getVal("FG%"))} (${getVal("FGM")}/${getVal("FGA")})` },
      { category: "Percentages", label: "3-Point FG % (3PT%)", val: `${formatPercent(getVal("3PT%"))} (${getVal("3PTM")}/${getVal("3PTA")})` },
      { category: "Percentages", label: "Free Throw % (FT%)", val: `${formatPercent(getVal("FT%"))} (${getVal("FTM")}/${getVal("FTA")})` },
      { category: "Percentages", label: "FT Attempt Rate (FTR)", val: getVal("FTR") },
      { category: "Percentages", label: "3P Attempt Rate (3Pr)", val: getVal("3Pr") }
    ];

    let tbodyHtml = '';
    let lastCategory = '';
    
    rows.forEach(row => {
      if (row.category !== lastCategory) {
        tbodyHtml += `
          <tr class="category-header-row" style="background: var(--wsu-crimson); color: white; font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">
            <td colspan="2" style="padding: 6px 12px; font-weight:700;">${row.category}</td>
          </tr>
        `;
        lastCategory = row.category;
      }
      
      tbodyHtml += `
        <tr>
          <td style="font-weight: 600; padding: 10px 12px;">${row.label}</td>
          <td class="text-center font-bold highlight-column" style="width: 200px; padding: 10px 12px;">${row.val}</td>
        </tr>
      `;
    });

    html += `
      <div class="table-wrapper">
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px 12px;">AAU Statistic Metric</th>
              <th class="text-center highlight-column" style="width: 200px; padding: 10px 12px;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }
  else if (type === 'AAU_PUMA') {
    const games = parseFloat(getVal("Games")) || 1;
    const pts = parseFloat(getVal("PTS")) || 0;
    const ppg = (pts / games).toFixed(1);
    const ast = parseFloat(getVal("AST")) || 0;
    const apg = (ast / games).toFixed(1);
    const to = parseFloat(getVal("TO")) || 0;
    const topg = (to / games).toFixed(1);
    
    const rows = [
      { category: "General", label: "Games Played", val: getVal("Games") },
      { category: "General", label: "Possessions Played", val: getVal("POSS ") },
      { category: "General", label: "Points Per Game (PPG)", val: ppg },
      { category: "General", label: "Points Per Possession (PPP)", val: getVal("PPP") },
      { category: "General", label: "Assists Per Game", val: apg },
      { category: "General", label: "Turnovers Per Game", val: topg },
      { category: "General", label: "Turnover Pct (TO%)", val: getVal("TO%") },
      { category: "General", label: "Ast / Tov Ratio", val: getVal("AST/TO") },
      { category: "General", label: "Game Score Average (GM SCORE)", val: getVal("GM SCORE") },
      
      { category: "Rebounding & Defensive", label: "Total Rebounds", val: getVal("TOT REB") },
      { category: "Rebounding & Defensive", label: "Off Rebounds", val: getVal("OFF REB") },
      { category: "Rebounding & Defensive", label: "Def Rebounds", val: getVal("DEF REB") },
      { category: "Rebounding & Defensive", label: "Steals", val: getVal("STL") },
      { category: "Rebounding & Defensive", label: "Blocks", val: getVal("BLK") },
      { category: "Rebounding & Defensive", label: "Steals + Blocks", val: getVal("STL+BLK") },
      
      { category: "Shooting Percentages", label: "Field Goal % (FG%)", val: `${formatPercent(getVal("FG%"))} (${getVal("FG MADE")}/${getVal("FG ATT")})` },
      { category: "Shooting Percentages", label: "Effective FG % (eFG%)", val: formatPercent(getVal("EFG%")) },
      { category: "Shooting Percentages", label: "True Shooting % (TS%)", val: formatPercent(getVal("TS%")) },
      { category: "Shooting Percentages", label: "2-Point FG % (2 FG%)", val: `${formatPercent(getVal("2 FG%"))} (${getVal("2 FG MADE")}/${getVal("2 FG ATT")})` },
      { category: "Shooting Percentages", label: "3-Point FG % (3FG%)", val: `${formatPercent(getVal("3FG%"))} (${getVal("3 FG MADE")}/${getVal("3 FG ATT")})` },
      { category: "Shooting Percentages", label: "Free Throw % (FT%)", val: `${formatPercent(getVal("FT%"))} (${getVal("FT MADE")}/${getVal("FT ATT")})` },
      { category: "Shooting Percentages", label: "FT Attempt Rate (FTA/FGA)", val: getVal("FTA/FGA") },
      { category: "Shooting Percentages", label: "3P Attempt Rate (3PA/FGA)", val: getVal("3PA/FGA") }
    ];

    let tbodyHtml = '';
    let lastCategory = '';
    
    rows.forEach(row => {
      if (row.category !== lastCategory) {
        tbodyHtml += `
          <tr class="category-header-row" style="background: var(--wsu-crimson); color: white; font-weight: 700; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">
            <td colspan="2" style="padding: 6px 12px; font-weight:700;">${row.category}</td>
          </tr>
        `;
        lastCategory = row.category;
      }
      
      tbodyHtml += `
        <tr>
          <td style="font-weight: 600; padding: 10px 12px;">${row.label}</td>
          <td class="text-center font-bold highlight-column" style="width: 200px; padding: 10px 12px;">${row.val}</td>
        </tr>
      `;
    });

    html += `
      <div class="table-wrapper">
        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left; padding: 10px 12px;">AAU Statistic Metric</th>
              <th class="text-center highlight-column" style="width: 200px; padding: 10px 12px;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

function formatPercent(val) {
  if (val === undefined || val === null || val === '') return 'N/A';
  let s = val.toString().trim();
  if (s === 'N/A') return 'N/A';
  if (!s.endsWith('%')) {
    const num = parseFloat(s);
    if (!isNaN(num) && num > 0 && num < 1.0) {
      return (num * 100).toFixed(1) + '%';
    }
    return s + '%';
  }
  return s;
}
