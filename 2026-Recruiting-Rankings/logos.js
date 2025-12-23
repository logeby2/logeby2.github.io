const TEAM_COLORS = {
    // ACC
    "Duke": "#0069B0", // Duke Royal Blue (Lightened)
    "UNC": "#7BAFD4", // Carolina Blue
    "Miami": "#F47321", // Miami Orange (Better visibility than green)
    "Florida St.": "#782F40", // Garnet
    "Virginia": "#E57200", // Orange
    "Wake Forest": "#9E7E38", // Gold
    "Syracuse": "#F76900", // Orange
    "Pittsburgh": "#C1C6C8", // Silver/Grey (Blue is too dark?) - sticking to Gold #FFB81C
    "Pittsburg": "#FFB81C", // Pittsburgh Gold
    "Clemson": "#F56600", // Orange
    "Louisville": "#E03A3E", // Red
    "Notre Dame": "#C99700", // Gold
    "Georgia Tech": "#B3A369", // Tech Gold
    "Stanford": "#C41E3A", // Cardinal
    "Boston College": "#98002E", // Maroon (Might need lightening) -> #BC2045? Let's try standard.
    "Cal": "#FDB515", // Gold
    "SMU": "#CC0035", // Red

    // SEC
    "Kentucky": "#0033A0", // Royal Blue
    "Alabama": "#9E1B32", // Crimson
    "Auburn": "#E87722", // Orange
    "Arkansas": "#9D2235", // Cardinal
    "Tennessee": "#FF8200", // Orange
    "Florida": "#FA4616", // Orange
    "Texas": "#BF5700", // Burnt Orange
    "Oklahoma": "#841617", // Crimson
    "Texas A&M": "#500000", // Maroon
    "LSU": "#FDD023", // Purple and GOLD - Gold pops better
    "Missouri": "#F1B82D", // Gold
    "Ole Miss": "#CE1126",
    "Mississippi State": "#660000", // Maroon
    "South Carolina": "#73000A", // Garnet
    "Vanderbilt": "#A89968", // Gold

    // Big 12
    "Kansas": "#0051BA", // Blue
    "Baylor": "#154734", // Green - Warning: Dark. Maybe Gold #FFB81C?
    "Houston": "#C8102E", // Red
    "Arizona": "#CC0033", // Red
    "Iowa State": "#F1BE48", // Gold
    "Texas Tech": "#CC0000", // Red
    "West Virginia": "#EAAA00", // Gold
    "Cincinnati": "#E00122", // Red
    "BYU": "#002E5D", // Navy - Dark.
    "UCF": "#BA9B37", // Gold
    "Oklahoma State": "#FF7300", // Orange

    // Big Ten
    "Michigan St.": "#18453B", // Green
    "Michigan": "#FFCB05", // Maize
    "Purdue": "#CEB888", // Old Gold
    "Indiana": "#990000", // Crimson
    "Illinois": "#E84A27", // Orange
    "Ohio State": "#BB0000", // Scarlet
    "Maryland": "#E03A3E", // Red
    "Rutgers": "#CC0033", // Scarlet
    "UCLA": "#2D68C4", // Blue
    "USC": "#9D2235", // Cardinal
    "Oregon": "#154733", // Green
    "Washington": "#4B2E83", // Purple
    "Iowa": "#FFCD00", // Gold
    "Nebraska": "#E41C38", // Scarlet
    "Northwestern": "#4E2A84", // Purple

    // Big East
    "UConn": "#000E2F", // Navy
    "Marquette": "#FFCC00", // Gold
    "Villanova": "#0060A9", // Blue
    "Creighton": "#005CA9", // Blue
    "St. John's": "#BA0C2F", // Red
    "Providence": "#000000", // Black - Use White text? Or Silver #D6D6D6
    "Georgetown": "#041E42", // Gray #A7B1B7
    "Xavier": "#0C2340", // Navy
    "Seton Hall": "#0033A0", // Blue
    "Butler": "#13294B", // Blue
    "DePaul": "#005EB8", // Blue

    // Other
    "Gonzaga": "#041E42", // Navy
    "Memphis": "#003087", // Blue
    "San Diego St.": "#A6192E", // Red
    "UNLV": "#CF0A2C", // Red
    "St. Mary's": "#003262", // Navy
    "Dayton": "#CE1141", // Red
    "Florida Atlantic": "#003366", // Blue
    "VCU": "#FFB300", // Gold
    "Liberty": "#0A254E", // Navy
    "High Point": "#280071", // Purple
    "George Mason": "#006633", // Green
    "Harvard": "#A51C30", // Crimson
};

// Function to get color
function getTeamColor(teamName) {
    if (!teamName || teamName === '?' || teamName === '') return '#ffffff'; // Default to white

    // Direct match
    if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];

    // Fallbacks for dark colors that might need lightening or unknown teams
    // Just return a generic 'accent' color or white if unknown
    return '#aebbc7'; // Default greyish
}
