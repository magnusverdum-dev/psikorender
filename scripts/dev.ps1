docker compose up -d
Start-Process -WindowStyle Hidden powershell -ArgumentList "-NoExit", "-Command", "cargo run -p api"
Start-Process -WindowStyle Hidden powershell -ArgumentList "-NoExit", "-Command", "cargo run -p worker"
Set-Location apps/web
npm run dev
