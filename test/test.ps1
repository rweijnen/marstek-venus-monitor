param(
  [Parameter(Mandatory=$true)][string]$DeviceIP,
  [int]$Port = 8080,
  [string]$Path = "/" # change to "/rpc" if your device expects it
)

function Invoke-Marstek {
  param(
    [string]$Method,
    [hashtable]$Params = @{}
  )
  $uri = "http://$DeviceIP`:$Port$Path"
  $body = @{
    id = [int](Get-Random -Minimum 1 -Maximum 999999)
    method = $Method
    params = $Params
  } | ConvertTo-Json -Depth 5 -Compress

  try {
    Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $body -TimeoutSec 5
  } catch {
    Write-Error "Call failed: $Method  -> $($_.Exception.Message)"
  }
}

# 1) Basic device info (discovery-equivalent over HTTP)
$dev = Invoke-Marstek -Method "Marstek.GetDevice" -Params @{ ble_mac = "0" }   # ble_mac is used as an id selector in the draft
"== Marstek.GetDevice =="; $dev | ConvertTo-Json -Depth 8

# 2) WiFi status
$wifi = Invoke-Marstek -Method "WiFi.GetStatus" -Params @{ id = 0 }
"== WiFi.GetStatus =="; $wifi | ConvertTo-Json -Depth 8

# 3) BLE status
$ble = Invoke-Marstek -Method "BLE.GetStatus" -Params @{ id = 0 }
"== BLE.GetStatus =="; $ble | ConvertTo-Json -Depth 8

# 4) Battery status
$bat = Invoke-Marstek -Method "Bat.GetStatus" -Params @{ id = 0 }
"== Bat.GetStatus =="; $bat | ConvertTo-Json -Depth 8

# 5) PV status
$pv = Invoke-Marstek -Method "PV.GetStatus" -Params @{ id = 0 }
"== PV.GetStatus =="; $pv | ConvertTo-Json -Depth 8

# 6) Energy System status
$es = Invoke-Marstek -Method "ES.GetStatus" -Params @{ id = 0 }
"== ES.GetStatus =="; $es | ConvertTo-Json -Depth 8

# 7) Energy System mode
$mode = Invoke-Marstek -Method "ES.GetMode" -Params @{ id = 0 }
"== ES.GetMode =="; $mode | ConvertTo-Json -Depth 8
