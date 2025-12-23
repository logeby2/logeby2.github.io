const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '2026 Recruiting Rankings.csv');
const dataPath = path.join(__dirname, 'data.js');

try {
    const csvText = fs.readFileSync(csvPath, 'utf8');
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const row = [];
        let inQuotes = false;
        let currentVal = '';
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

        if (row.length === headers.length) {
            const player = {};
            headers.forEach((header, index) => {
                const key = header.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                player[key] = row[index] ? row[index].replace(/^"|"$/g, '') : '';
            });
            data.push(player);
        }
    }

    const jsContent = `const PLAYER_DATA = ${JSON.stringify(data, null, 2)};`;

    fs.writeFileSync(dataPath, jsContent);
    console.log('Successfully created data.js with ' + data.length + ' records.');

} catch (err) {
    console.error('Error:', err);
}
