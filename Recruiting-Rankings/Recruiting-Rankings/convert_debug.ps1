try {
    Write-Host "Starting debug conversion..."
    $files = @{
        "2026" = "Recruiting Rankings - 2026 Recruiting Spring 2026.csv"
        "2027" = "Recruiting Rankings - 2027 Recruiting Spring 2026.csv"
        "2029" = "Recruiting Rankings - 2029 Recruiting Summer 2026.csv"
        "2028" = "Recruiting Rankings - 2028 Recruiting Spring 2026.csv"
    }

    $allData = @{}
    
    Write-Host "Keys found: $($files.Keys -join ', ')"

    foreach ($year in $files.Keys) {
        $path = $files[$year]
        Write-Host "Checking Year: $year Path: '$path'"
        if (Test-Path $path) {
            Write-Host "Processing $year from $path..."
            $headerLine = Get-Content $path -TotalCount 1
            $headers = $headerLine.Split(',')
            
            $uniqueHeaders = @()
            for ($i = 0; $i -lt $headers.Count; $i++) {
                $h = $headers[$i].Trim()
                if ([string]::IsNullOrWhiteSpace($h)) {
                    $h = "UNKNOWN_$i"
                }
                $uniqueHeaders += $h
            }
            
            $content = Get-Content $path | Select-Object -Skip 1
            if ($content) {
                $data = $content | ConvertFrom-Csv -Header $uniqueHeaders
                $cleanData = @()
                foreach ($row in $data) {
                    $newRow = @{}
                    foreach ($prop in $row.PSObject.Properties) {
                        $key = $prop.Name.ToUpper().Trim()
                        $val = $prop.Value
                        if ($val -is [string]) {
                            $val = $val.Trim()
                        }
                        $newRow[$key] = $val
                    }
                    $cleanData += $newRow
                }
                $allData[$year] = $cleanData
            }
        }
        else {
            Write-Host "ERROR: Path not found for $year: '$path'"
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
