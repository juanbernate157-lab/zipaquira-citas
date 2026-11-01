@echo off
title Zipaquira Enterprise - Servidor con Enlace Global de Internet
echo ===================================================================
echo  INICIANDO SERVIDOR Y ENLACE DE INTERNET GLOBAL (PARA CELULARES 4G/5G)
echo ===================================================================
echo.
echo 1. Iniciando servidor principal en el puerto 5000...
start "Servidor Zipaquira" cmd /c "node server/server.js"
timeout /t 2 >nul

echo 2. Creando enlace publico de Internet...
echo    Cualquier persona podra abrir tu enlace y tu QR desde cualquier lugar!
echo ===================================================================
npx localtunnel --port 5000
pause
