# Backup del database di Lena su Neon. Si lancia dalla cartella del progetto:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-neon.ps1
# Chiede la stringa di connessione di Neon (Connect, con "Connection pooling" spento): mentre la incolli non si vede.
# Il file va in C:\Users\<tu>\backup-lena, FUORI dal progetto: contiene dati veri e non deve mai finire su GitHub.
# Serve Docker acceso. Si tengono gli ultimi 14 backup.

$cartella = Join-Path $env:USERPROFILE "backup-lena"
New-Item -ItemType Directory -Force -Path $cartella | Out-Null

$sicura = Read-Host "Incolla la stringa di connessione di Neon (non si vede mentre la incolli)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sicura)
try { $u = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
$u = ($u.Trim().Trim('"')) -replace "&channel_binding=require", ""

if ($u -notmatch "^postgres(ql)?://") {
  Write-Host "Questa non sembra una stringa di connessione: deve cominciare con postgresql://"
  exit 1
}
if ($u -match "pooler") {
  Write-Host "Attenzione: nell'indirizzo c'e' 'pooler'. In Neon spegni 'Connection pooling' e copia di nuovo la stringa."
  exit 1
}

$nome = "lena-" + (Get-Date -Format "yyyy-MM-dd-HHmm") + ".dump"
$percorso = Join-Path $cartella $nome

Write-Host "Backup in corso (la prima volta scarica il programma giusto, ci vuole qualche minuto)..."
docker run --rm -v "${cartella}:/backup" postgres:18 pg_dump "$u" -Fc --no-owner --no-privileges -f "/backup/$nome"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Backup NON riuscito: guarda il messaggio qui sopra."
  Remove-Item $percorso -ErrorAction SilentlyContinue
  exit 1
}

# Controllo: il file si deve poter leggere
docker run --rm -v "${cartella}:/backup" postgres:18 pg_restore --list "/backup/$nome" | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Il file e' stato creato ma non si legge: NON fidarti di questo backup."
  exit 1
}

$kb = [math]::Round((Get-Item $percorso).Length / 1KB, 1)
Write-Host "Fatto: $percorso ($kb KB). Il file si legge correttamente."

# Si tengono gli ultimi 14 backup
Get-ChildItem $cartella -Filter "lena-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item
