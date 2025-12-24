document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('rankings-body');
    const headers = document.querySelectorAll('th.sortable');
    const regionFilterSelect = document.getElementById('region-filter');
    const offensiveRoleSelect = document.getElementById('offensive-role-filter');
    const defensiveRoleSelect = document.getElementById('defensive-role-filter');
    const searchInput = document.getElementById('search-input');

    let playersData = [];
    let currentSort = { column: 'consensus', direction: 'asc' };
    let currentRegion = '';
    let currentOffensiveRole = '';
    let currentDefensiveRole = '';
    let currentSearch = '';

    // Helper to parse Height to inches for sorting/logic
    function parseHeight(heightStr) {
        if (!heightStr) return 0;
        const parts = heightStr.split("'");
        if (parts.length < 1) return 0;
        const feet = parseInt(parts[0]);
        const inches = parts.length > 1 ? parseInt(parts[1].replace('"', '')) : 0;
        return (feet * 12) + (isNaN(inches) ? 0 : inches);
    }

    // Helper to get Position from Role + Height (Simplified)
    function getPosition(role, heightStr) {
        const hVal = parseHeight(heightStr);
        let r = role ? role.toLowerCase() : '';

        // 1. Check explicit Role keywords
        if (r.includes('guard') || r.includes('initiator') || r.includes('initator') || r.includes('handler') || r.includes('point')) return 'Guard';
        if (r.includes('wing') || r.includes('slasher') || r.includes('shooter')) return 'Wing';
        if (r.includes('big') || r.includes('center') || r.includes('post') || r.includes('rim')) return 'Big';

        // 2. Ambiguous terms (Forward) or Missing Role -> Use Height Fallback
        // Guard < 6'5 | Wing 6'5 - 6'8 | Big > 6'8
        // 6'5 = 77 inches, 6'8 = 80 inches
        if (hVal < 77) return 'Guard';
        if (hVal >= 77 && hVal <= 80) return 'Wing'; // 6'5 to 6'8
        return 'Big'; // > 6'8
    }

    // Helper for Country Flags and Region Logic
    function getCountryInfo(teamHsString, playerName) {
        let flag = `https://flagcdn.com/20x15/us.png`;
        let isInternational = false;

        // Exception List for players who should count as International despite invalid/USA code
        const forcedInternational = ['Rhys Robinson', 'Joaquim Boumtje Boumtje'];
        if (forcedInternational.includes(playerName)) {
            isInternational = true;
        }

        // Exception List for players who should count as USA despite having an International code
        // They will keep their flag generation but fall under USA filter
        const forcedUSA = [
            'Felipe Quinones', 'Felipe Minzer', 'Boyuan Zhang', 'Amadou Seini',
            'Arafan Diane', 'Isaiah Hamilton', 'Miles Sadler', 'Maxime Meyer', 'Paul Osaruyi', 'Paul Osayuri',
            'Emmanuel Ouedraogo', 'Aaron Ona Embo', 'Abdou Toure', 'Ikenna Alozie', 'Bamba Touray', 'Rafa Corta'
        ];

        if (teamHsString) {
            const match = teamHsString.match(/\(([A-Z]{3})\)/);
            if (match) {
                const code = match[1];
                if (code !== 'USA') {
                    isInternational = true;
                    // Start Override: if in forcedUSA, treat as not international
                    if (forcedUSA.includes(playerName)) {
                        isInternational = false;
                    }

                    // Map 3 letter IOC codes to 2 letter ISO codes for flagcdn
                    const countryMap = {
                        'FRA': 'fr', 'ESP': 'es', 'ITA': 'it', 'LTU': 'lt',
                        'SRB': 'rs', 'RUS': 'ru', 'CAN': 'ca', 'AUS': 'au',
                        'GER': 'de', 'SEN': 'sn', 'CMR': 'cm', 'SSD': 'ss',
                        'CIV': 'ci', 'BEL': 'be',
                        'MLI': 'ml', 'LAT': 'lv', 'SLO': 'si', 'NED': 'nl',
                        'FIN': 'fi', 'BRA': 'br', 'GEO': 'ge', 'SUI': 'ch',
                        'TUR': 'tr', 'GRE': 'gr', 'NGA': 'ng', 'CRO': 'hr', 'DEN': 'dk',
                        'URU': 'uy', 'PUR': 'pr', 'ARG': 'ar', 'CHN': 'cn', 'GIN': 'gn'
                    };
                    flag = `https://flagcdn.com/20x15/${countryMap[code] || 'us'}.png`;
                }
            }
        }
        return { flag, isInternational };
    }

    // Process Data
    function processData(rawData) {
        return rawData.map((p, index) => {
            // Rank calculation
            const consensus = parseFloat(p.CONSENSUS) || 999;
            const countryInfo = getCountryInfo(p['TEAM/HS'], p.PLAYER);

            // Normalize Offensive Role
            let offRole = p['OFFENSIVE ROLE'];
            if (offRole && (offRole.toLowerCase().includes('initiator') || offRole.toLowerCase().includes('initator'))) {
                offRole = 'Primary Ball Handler';
            }

            return {
                id: index,
                rank: index + 1,
                name: p.PLAYER,
                team_hs: p['TEAM/HS'],
                commitment: p.COMMITMENT,
                offensive_role: offRole,
                defensive_role: p['DEFENSIVE ROLE'] || '-',
                height: p.HEIGHT,
                height_val: parseHeight(p.HEIGHT),
                rivals: parseFloat(p.RIVALS) || 999,
                _247: parseFloat(p['247']) || 999,
                prep: parseFloat(p.PREP) || 999,
                espn: parseFloat(p.ESPN) || 999,
                made: parseFloat(p.MADE) || 999,
                eby: parseFloat(p.EBY) || 999,
                industry_pro: parseFloat(p['INDUSTRY PRO']) || 999,
                consensus: consensus,
                position: getPosition(p['OFFENSIVE ROLE'], p.HEIGHT),
                flag: countryInfo.flag,
                isInternational: countryInfo.isInternational,
                color: getTeamColor(p.COMMITMENT) // Use getTeamColor from logos.js
            };
        });
    }

    // Render Table
    function renderTable(data) {
        tableBody.innerHTML = '';
        data.forEach((player, index) => {
            const tr = document.createElement('tr');

            // Fix 999 display to be empty or '-'
            const formatRank = (val) => val === 999 ? '-' : val;

            // Commitment HTML: Logo + Text with Color
            let commitHtml = '-';
            if (player.commitment && player.commitment !== '?' && player.commitment !== '') {
                // Get Logo
                let logoImg = '';
                if (typeof getTeamLogo === 'function') {
                    const logoUrl = getTeamLogo(player.commitment);
                    if (logoUrl) {
                        logoImg = `<img src="${logoUrl}" class="team-logo" alt="${player.commitment}" onerror="this.style.display='none'">`;
                    }
                }

                // If logo exists, show ONLY logo. If not, show text.
                if (logoImg) {
                    commitHtml = `<div style="display:flex; align-items:center; justify-content:center;">${logoImg}</div>`;
                } else {
                    commitHtml = `<div style="display:flex; align-items:center;"><span style="color:${player.color}; font-weight:bold; font-size:0.95em;">${player.commitment}</span></div>`;
                }
            }

            const teamHs = player.team_hs || '';

            tr.innerHTML = `
                <td class="num-cell">${index + 1}</td>
                <td class="player-cell">
                    <img src="${player.flag}" class="flag-icon" alt="Flag">
                    <div>
                        <div style="font-size:1.1em; color:#fff;">${player.name}</div>
                        <div style="font-size:0.8em; color:#888;">${teamHs.replace(/\(.*\)/, '')}</div>
                    </div>
                </td>
                <td class="pos-cell">${player.position}</td>
                <td class="height-cell">${player.height}</td>
                <td style="text-align:center">${commitHtml}</td>
                <td class="role-cell" style="font-size:0.85em; color:var(--accent);"><div class="role-content">${player.offensive_role}</div></td>
                <td class="role-cell" style="font-size:0.85em; color:#888;"><div class="role-content">${player.defensive_role}</div></td>
                <td class="rating-cell" style="color:var(--text-secondary); font-weight:bold;">${player.consensus === 999 ? '-' : player.consensus}</td>
                <td class="rating-cell">${formatRank(player.industry_pro)}</td>
                <td class="rating-cell">${formatRank(player.eby)}</td>
                <td class="rating-cell">${formatRank(player.rivals)}</td>
                <td class="rating-cell">${formatRank(player._247)}</td>
                <td class="rating-cell">${formatRank(player.prep)}</td>
                <td class="rating-cell">${formatRank(player.espn)}</td>
                <td class="rating-cell">${formatRank(player.made)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Main Function to Filter and Sort logic
    function applyFilterAndSort() {
        // 1. Start with all data
        let displayData = [...playersData]; // Copy original

        // 1.5 Filter by Region
        if (currentRegion === 'High School') {
            displayData = displayData.filter(p => !p.isInternational);
        } else if (currentRegion === 'International') {
            displayData = displayData.filter(p => p.isInternational);
        }

        // 1.6 Filter by Offensive Role
        if (currentOffensiveRole) {
            displayData = displayData.filter(p => p.offensive_role === currentOffensiveRole);
        }

        // 1.7 Filter by Defensive Role
        if (currentDefensiveRole) {
            displayData = displayData.filter(p => p.defensive_role === currentDefensiveRole);
        }

        // 1.7 Search
        if (currentSearch) {
            const lowerTerm = currentSearch.toLowerCase();
            displayData = displayData.filter(p =>
                (p.name && p.name.toLowerCase().includes(lowerTerm)) ||
                (p.team_hs && p.team_hs.toLowerCase().includes(lowerTerm))
            );
        }

        // 2. Sort
        const field = currentSort.column;
        const direction = currentSort.direction;

        displayData.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // Use numerical height value for sorting if field is 'height'
            if (field === 'height') {
                valA = a.height_val;
                valB = b.height_val;
            }

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        // 3. Update Header UI
        headers.forEach(th => {
            th.classList.remove('active-asc', 'active-desc');
            if (th.dataset.sort === field) {
                th.classList.add(direction === 'asc' ? 'active-asc' : 'active-desc');
            }
        });

        // 4. Render
        renderTable(displayData);
    }

    // Handle Header Click (Sorting)
    function handleSort(field) {
        if (currentSort.column === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = field;
            currentSort.direction = 'asc';
        }
        applyFilterAndSort();
    }

    // Event Listeners: Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            applyFilterAndSort();
        });
    }

    // Event Listeners: Sorting
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const sortField = th.dataset.sort;
            if (!sortField) return; // Ignore clicks if no data-sort
            let key = sortField;
            if (key === '247') key = '_247';
            handleSort(key);
        });
    });



    // Event Listeners: Region Filtering
    if (regionFilterSelect) {
        regionFilterSelect.addEventListener('change', (e) => {
            currentRegion = e.target.value;
            applyFilterAndSort();
        });
    }

    // Event Listeners: Offensive Role
    if (offensiveRoleSelect) {
        offensiveRoleSelect.addEventListener('change', (e) => {
            currentOffensiveRole = e.target.value;
            applyFilterAndSort();
        });
    }

    // Event Listeners: Defensive Role
    if (defensiveRoleSelect) {
        defensiveRoleSelect.addEventListener('change', (e) => {
            currentDefensiveRole = e.target.value;
            applyFilterAndSort();
        });
    }

    // Populate Role Dropdowns
    function populateRoleFilters(data) {
        // Collect unique roles
        const offensiveRoles = new Set();
        const defensiveRoles = new Set();

        data.forEach(p => {
            if (p.offensive_role) offensiveRoles.add(p.offensive_role);
            if (p.defensive_role && p.defensive_role !== '-') defensiveRoles.add(p.defensive_role);
        });

        // Helper to populate
        const populate = (selectElement, set, defaultText) => {
            if (!selectElement) return;
            // Clear existing options except first
            selectElement.innerHTML = `<option value="">${defaultText}</option>`;

            // Sort and add
            Array.from(set).sort().forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                selectElement.appendChild(option);
            });
        };

        populate(offensiveRoleSelect, offensiveRoles, "All Offensive Roles");
        populate(defensiveRoleSelect, defensiveRoles, "All Defensive Roles");
    }

    // Year Switching
    function loadYear(year) {
        if (!PLAYER_DATA[year]) {
            console.error(`Data for ${year} not found.`);
            return;
        }
        currentYear = year;
        playersData = processData(PLAYER_DATA[year]);

        // Populate Filters for the new year
        populateRoleFilters(playersData);

        // Update Buttons
        document.querySelectorAll('.year-btn').forEach(btn => {
            if (btn.dataset.year === year) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Reset sort/filter? Optional. Let's keep them if compatible, or reset.
        // For now, keep them.
        applyFilterAndSort();
    }

    // Initialize
    if (typeof PLAYER_DATA !== 'undefined') {
        const yearBtns = document.querySelectorAll('.year-btn');
        yearBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                loadYear(btn.dataset.year);
            });
        });

        // Default to 2026
        loadYear('2026');
    } else {
        console.error('PLAYER_DATA not loaded!');
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="15" style="text-align:center; padding:20px;">Error loading data.js</td>';
        tableBody.appendChild(tr);
    }
});
