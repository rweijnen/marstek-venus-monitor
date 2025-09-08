$port = 30000   # adjust if needed
$req = @{ id=0; method="Marstek.GetDevice"; params=@{ ble_mac="0" } } | ConvertTo-Json -Compress
$udp = New-Object System.Net.Sockets.UdpClient
$udp.EnableBroadcast = $true
$bytes = [Text.Encoding]::UTF8.GetBytes($req)
[void]$udp.Send($bytes, $bytes.Length, "255.255.255.255", $port)
$udp.Client.ReceiveTimeout = 1500
try {
  while ($true) {
    $remote = New-Object System.Net.IPEndPoint([Net.IPAddress]::Any,0)
    $resp = $udp.Receive([ref]$remote)
    "$($remote.Address):$($remote.Port) -> " + ([Text.Encoding]::UTF8.GetString($resp))
  }
} catch {}
$udp.Close()
