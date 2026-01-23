const fs = require('fs');
const path = require('path');

const files = {
    '2026': 'Recruiting Rankings - 2026 Recruiting Spring 2026.csv',
    '2027': 'Recruiting Rankings - 2027 Recruiting Spring 2026.csv',
    '2028': 'Recruiting Rankings - 2028 Recruiting Spring 2026.csv'
};

const dataPath = path.join(__dirname, 'data.js');

try {
    const allData = {};

    for (const [year, filename] of Object.entries(files)) {
        console.log(`Processing ${year} from ${filename}...`);
        const csvPath = path.join(__dirname, filename);

        if (!fs.existsSync(csvPath)) {
            console.warn(`Warning: File not found: ${filename}`);
            allData[year] = [];
            continue;
        }

        const csvText = fs.readFileSync(csvPath, 'utf8');
        const lines = csvText.trim().split('\n');

        if (lines.length < 2) {
            console.warn(`Warning: File empty or no data: ${filename}`);
            allData[year] = [];
            continue;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const row = [];
            let inQuotes = false;
            let currentVal = '';
            // Basic CSV parsing for quoted fields
            for (let char of lines[i]) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    row.push(currentVal.trim());
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
            row.push(currentVal.trim());

            // Check if row has reasonable amount of data (allow some missing trailing commas if valid)
            if (row.length > 1) {
                const player = {};
                headers.forEach((header, index) => {
                    // Normalize header keys: preserve spaces/slashes for script.js compatibility
                    const key = header.toUpperCase().trim();
                    // Clean up quotes from values
                    let val = row[index] ? row[index].replace(/^"|"$/g, '') : '';
                    if (val === '?' || val === '') val = ''; // Normalize empty/unknown
                    if (key) player[key] = val;
                });
                data.push(player);
            }
        }
        allData[year] = data;
        console.log(`  Loaded ${data.length} records for ${year}.`);
    }

    const jsContent = `const PLAYER_DATA = ${JSON.stringify(allData, null, 2)};`;

    fs.writeFileSync(dataPath, jsContent);
    console.log('Successfully created data.js with years: ' + Object.keys(allData).join(', '));

} catch (err) {
    console.error('Error:', err);
}
