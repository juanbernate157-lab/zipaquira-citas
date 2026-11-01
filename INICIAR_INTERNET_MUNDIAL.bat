@echo off
setlocal
cd /d "%~dp0"
title Zipaquira Enterprise - Enlace Mundial para Celulares
cls
echo ========================================================
echo   ZIPAQUIRA ENTERPRISE - INTERNET MUNDIAL (CLOUDFLARE)
echo ========================================================
echo.
echo 1. Verificando servidor local en el puerto 5000...
start /min cmd /c "node server/server.js"
timeout /t 2 >nul

echo 2. Generando enlace publico mundial con Cloudflare...
echo    Cualquier celular en el mundo con 4G o Wi-Fi podra entrar!
echo ========================================================
echo.
cloudflared.exe tunnel --url http://localhost:5000
pause
