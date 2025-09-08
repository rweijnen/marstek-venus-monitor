param(
  [Parameter(Mandatory=$true)][string]$DeviceIP,
  [int]$Port = 8080
)

Add-Type -AssemblyName System.Net,System.Net.Sockets

function Invoke-UdpRpc {
  param([string]$Method, [hashtable]$Params = @{}, [int]$TimeoutMs = 1500)
  $req = @{
    id     = [int](Get-Random -Minimum 1 -Maximum 1000000)
    method = $Method
    params = $Params
  } | ConvertTo-Json -Compress -Depth 6

  $udp = New-Object System.Net.Sockets.UdpClient
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($req)
    [void]$udp.Send($bytes, $bytes.Length, $DeviceIP, $Port)
    $udp.Client.ReceiveTimeout = $TimeoutMs
    $remoteEP = New-Object System.Net.IPEndPoint([Net.IPAddress]::Any,0)
    $respBytes = $udp.Receive([ref]$remoteEP)
    [Text.Encoding]::UTF8.GetString($respBytes)
  } catch {
    "ERR: $($_.Exception.Message)"
  } finally {
    $udp.Close()
  }
}

# smoke tests
Invoke-UdpRpc -Method "Marstek.GetDevice" -Params @{ ble_mac = "0" }
Invoke-UdpRpc -Method "WiFi.GetStatus"    -Params @{ id = 0 }
Invoke-UdpRpc -Method "Bat.GetStatus"     -Params @{ id = 0 }
Invoke-UdpRpc -Method "PV.GetStatus"      -Params @{ id = 0 }
Invoke-UdpRpc -Method "ES.GetStatus"      -Params @{ id = 0 }
Invoke-UdpRpc -Method "ES.GetMode"        -Params @{ id = 0 }
