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
                        # Use the original header name but maybe cleaner?
                        # Actually we want the headers from the CSV which might be "TEAM/HS"
                        
                        $val = $prop.Value
                        if ($val -is [string]) {
                            $val = $val.Trim()
                        }
                        
                        $newRow[$key] = $val
                    }
                    $cleanData += $newRow
                }
            }
            $allData[$year] = $cleanData
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
