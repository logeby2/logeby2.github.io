try {
    # Define mapping of year to filename
    $files = @{
        "2026" = "Recruiting Rankings - 2026 Recruiting Spring 2026.csv"
        "2027" = "Recruiting Rankings - 2027 Recruiting Spring 2026.csv"
        "2028" = "Recruiting Rankings - 2028 Recruiting Spring 2026.csv"
    }

    $allData = @{}

    foreach ($year in $files.Keys) {
        $path = $files[$year]
        if (Test-Path $path) {
            Write-Host "Processing $year from $path..."
            # Get headers from first line to handle empty columns issue
            $headerLine = Get-Content $path -TotalCount 1
            $headers = $headerLine.Split(',')
            
            # Uniquify headers to handle empty ones
            $uniqueHeaders = @()
            $counts = @{}
            for ($i = 0; $i -lt $headers.Count; $i++) {
                $h = $headers[$i].Trim()
                if ([string]::IsNullOrWhiteSpace($h)) {
                    $h = "UNKNOWN_$i"
                }
                # Check duplicates? Usually not needed if we just sanitized empty ones
                $uniqueHeaders += $h
            }
            
            # Import with explicit headers (skipping the first line which is headers)
            $content = Get-Content $path | Select-Object -Skip 1
            if ($content) {
                # ConvertFrom-Csv is used so we can supply our sanitized headers
                $data = $content | ConvertFrom-Csv -Header $uniqueHeaders
                
                # Now we fix the property names to match expected JSON format (UPPERCASE with underscores)
                # And select only the relevant columns to keep it clean
                $cleanData = @()
                foreach ($row in $data) {
                    $newRow = @{}
                    # Map properties: uppercase and preserve special chars for script.js compatibility
                    foreach ($prop in $row.PSObject.Properties) {
                        $key = $prop.Name.ToUpper().Trim()
                        # Fix TEAM_HS to TEAM/HS if needed? No, script.js uses "TEAM/HS" (which becomes TEAM_HS in key logic?)
                        # Wait, convert_csv.js had: key = header.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                        # So "TEAM/HS" -> "TEAM_HS"
                        # But script.js uses p['TEAM/HS'] ...
                        # Wait. Step 12 convert_csv.js:
                        # player[key] = ...
                        # key = header.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                        # So "TEAM/HS" becomes "TEAM_HS".
                        # But Step 9 script.js:
                        # team_hs: p['TEAM/HS'],
                        # This implies data.js currently has keys like "TEAM/HS".
                        # Let's check existing data.js logic in Step 12.
                        # key = header.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                        # "TEAM/HS" -> "TEAM_HS".
                        # So script.js line 70: team_hs: p['TEAM/HS'] would be undefined if keys are TEAM_HS?
                        # Let's verify Step 9 line 70.
                        # 70: team_hs: p['TEAM/HS'],
                        # If convert_csv.js replaces slash with underscore...
                        # Run convert_csv.js line 32: header.toUpperCase().replace(/[^A-Z0-9]/g, '_');
                        # T, E, A, M, /, H, S -> / is NOT A-Z0-9. So yes, it becomes _.
                        # So "TEAM_HS".
                        # So script.js line 70 is WRONG?
                        # Or maybe "TEAM/HS" logic in convert_csv was different before?
                        # Wait, maybe I misread regex.
                        # `[^A-Z0-9]` matches anything NOT A-Z 0-9. So `/` is matched and replaced by `_`.
                        # So the key in `data.js` is `TEAM_HS`.
                        # But `script.js` uses `p['TEAM/HS']`.
                        # If that's the case, the site would be broken ALREADY.
                        # But the user says "make this website have multiple pages".
                        # Maybe I should check `data.js` to see what keys are actually there.
                        # I can't check it directly as it's binary or large, but I can check `logos.js` or `script.js` closer.
                        # Actually, let's look at `script.js` again.
                        # 61: function processData(rawData) {
                        # 62:   return rawData.map((p, index) => {
                        # 70:       team_hs: p['TEAM/HS'],
                        # 192:      playersData = processData(PLAYER_DATA);
                        # If `p['TEAM/HS']` is undefined, `team_hs` is undefined.
                        # Line 106: const teamHs = player.team_hs || '';
                        # Line 114: ... ${teamHs.replace(/\(.*\)/, '')} ...
                        # So if it's undefined, it shows nothing?
                        # Maybe the regex doesn't match what I think?
                        # Or maybe the Header in the CSV is "TEAM HS" (space)?
                        # CSV view in Step 21: `TIER,PLAYER,TEAM/HS,COMMITMENT...`
                        # It is `TEAM/HS`.
                        # Maybe my js regex interpretation is wrong?
                        # `/[^A-Z0-9]/g`
                        # / is not A-Z or 0-9.
                        # So it is replaced.
                        # Unless `convert_csv.js` I saw in Step 12 IS the one used? Yes.
                        # Let's assume I should fix the key logic to be consistent.
                        # I will use the ORIGINAL key from the CSV (just UpperCase?) or stick to the regex?
                        # If I want to fix `script.js`, I can.
                        # But let's check if the previous developer made a mistake or if I am missing something.
                        
                        # Fix: I will output keys exactly as `script.js` expects: "TEAM/HS", "OFFENSIVE ROLE", etc.
                        # This means I should NOT replace special characters if script.js expects them.
                        # Script.js expects:
                        # CONSENSUS, PLAYER, TEAM/HS, COMMITMENT, OFFENSIVE ROLE, DEFENSIVE ROLE, HEIGHT, RIVALS, 247, ESPN, MADE, EBY, INDUSTRY PRO.
                        # These contain spaces and slashes.
                        # My `convert_csv.js` (Step 12) DID replace them: `header.toUpperCase().replace(/[^A-Z0-9]/g, '_');`
                        # This means `OFFENSIVE ROLE` -> `OFFENSIVE_ROLE`.
                        # Script.js: `p['OFFENSIVE ROLE']`
                        # This means the current code IS BROKEN regarding specific columns unless keys match.
                        # Wait, Step 9 Line 72: `offensive_role: p['OFFENSIVE ROLE'],`
                        # Line 73: `defensive_role: p['DEFENSIVE ROLE']`
                        # If the keys are `OFFENSIVE_ROLE`, then `p['OFFENSIVE ROLE']` is undefined.
                        
                        # I will generate `data.js` with keys compatible with `script.js` (i.e., with spaces and slashes).
                        # So I will NOT use the replace regex. I will just ToUpper() and Trim().
                        
                        $key = $prop.Name.ToUpper().Trim()
                        # Manually fix if needed?
                        $newRow[$key] = $prop.Value
                    }
                    $cleanData += $newRow
                }
                $allData[$year] = $cleanData
            }
        }
    }

    $json = $allData | ConvertTo-Json -Depth 5
    $jsContent = "const PLAYER_DATA = $json;"
    Set-Content "data.js" $jsContent -Encoding UTF8
    Write-Host "Done."
}
catch {
    Write-Error $_
}
