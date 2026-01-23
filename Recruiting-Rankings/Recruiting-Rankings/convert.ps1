
$filesSource = @(
    @{ Year = "2026"; Path = "Recruiting Rankings - 2026 Recruiting Spring 2026.csv" },
    @{ Year = "2027"; Path = "Recruiting Rankings - 2027 Recruiting Spring 2026.csv" },
    @{ Year = "2028"; Path = "Recruiting Rankings - 2028 Recruiting Spring 2026.csv" },
    @{ Year = "2029"; Path = "Recruiting Rankings - 2029 Recruiting Summer 2026.csv" }
)

$allData = @{}

Write-Host "Starting conversion..."
foreach ($item in $filesSource) {
    try {
        $year = $item.Year
        $path = $item.Path
        Write-Host " checking $year -> $path"
        
        if (Test-Path $path) {
            Write-Host "  Found. Processing..."
            
            # Read headers
            $lines = Get-Content $path
            if ($lines.Count -lt 2) {
                Write-Host "  Skipping: Not enough lines."
                continue
            }
            
            $headerLine = $lines[0]
            $headers = $headerLine.Split(',')
            
            # Unique headers
            $uniqueHeaders = @()
            $seen = @{}
            for ($i = 0; $i -lt $headers.Count; $i++) {
                $h = $headers[$i].Trim()
                if ([string]::IsNullOrWhiteSpace($h)) { $h = "UNKNOWN_$i" }
                
                if ($seen.ContainsKey($h)) {
                    $h = "{0}_{1}" -f $h, $i
                }
                $seen[$h] = $true
                $uniqueHeaders += $h
            }
            
            $csvData = $lines | Select-Object -Skip 1 | ConvertFrom-Csv -Header $uniqueHeaders
            
            $cleanData = @()
            foreach ($row in $csvData) {
                $newRow = @{}
                foreach ($prop in $row.PSObject.Properties) {
                    $key = $prop.Name.ToUpper().Trim()
                    $val = $prop.Value
                    if ($val -is [string]) { $val = $val.Trim() }
                    $newRow[$key] = $val
                }
                $cleanData += $newRow
            }
            
            $allData[$year] = $cleanData
            Write-Host ("  Done {0}: {1} records." -f $year, $cleanData.Count)
        }
        else {
            Write-Host "  ERROR: File not found."
        }
    }
    catch {
        Write-Host ("  CRITICAL ERROR processing {0} : {1}" -f $year, $_)
    }
}

$json = $allData | ConvertTo-Json -Depth 5
$jsContent = "const PLAYER_DATA = $json;"
Set-Content "data.js" $jsContent -Encoding UTF8
Write-Host "All done."
