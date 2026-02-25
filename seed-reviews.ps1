$reviewsContent = [System.IO.File]::ReadAllText('G:\Projects\lgs\reviews.md')
$body = @{
    reviewsText = $reviewsContent
    clearExisting = $true
}
$jsonBody = $body | ConvertTo-Json -Compress -Depth 10
try {
    $response = Invoke-RestMethod -Uri 'http://localhost:5000/api/admin/seed-reviews' -Method Post -Body $jsonBody -ContentType 'application/json'
    Write-Host "Success: $($response.message)"
    Write-Host "Reviews seeded: $($response.count)"
    Write-Host "Reviews deleted: $($response.deleted)"
} catch {
    Write-Host "Error: $_"
    Write-Host "Response: $($_.Exception.Response)"
}
