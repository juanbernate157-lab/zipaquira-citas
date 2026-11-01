@echo off
chcp 65001 >nul
title Zipaquira Enterprise - Subir a GitHub para Despliegue en la Nube
color 0B
cls
echo =========================================================================
echo    🚀 ZIPAQUIRA ENTERPRISE - PREPARAR Y SUBIR A GITHUB (NUBE 24/7)
echo =========================================================================
echo.
echo Este asistente subira tu proyecto a GitHub para que puedas conectarlo
echo gratis a Render.com o Railway y tener tu enlace activo 24/7 en la nube.
echo.
echo =========================================================================
echo [Paso 1/4] Verificando Git...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git no esta instalado en este computador.
    echo Descargalo e instalalo desde: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git esta listo.
echo.

echo [Paso 2/4] Verificando configuracion de Git...
git config user.name >nul 2>nul
if %errorlevel% neq 0 (
    git config user.name "Zipaquira Enterprise"
)
git config user.email >nul 2>nul
if %errorlevel% neq 0 (
    git config user.email "juanbernate157@gmail.com"
)

if not exist ".git" (
    echo [INFO] Inicializando nuevo repositorio Git local...
    git init
    git branch -M main
) else (
    git branch -M main
)

echo.
echo [Paso 3/4] Guardando todos los cambios y archivos...
git add .
git commit -m "Zipaquira Enterprise: Sistema de citas con Lamborghini, QR universal y Calendar" >nul 2>nul
echo [OK] Archivos preparados correctamente.
echo.

echo =========================================================================
echo [Paso 4/4] Subir a tu repositorio de GitHub
echo.
echo Instrucciones rapidas:
echo 1. Abre en tu navegador: https://github.com/new
echo 2. Ponle nombre al repositorio (por ejemplo: zipaquira-citas)
echo 3. Dejalo Publico o Privado y haz clic en "Create repository"
echo 4. Copia el enlace HTTPS (ej: https://github.com/tu-usuario/zipaquira-citas.git)
echo =========================================================================
echo.
set DEFAULT_URL=https://github.com/juanbernate157-lab/zipaquira-citas.git
echo URL por defecto: %DEFAULT_URL%
echo.
set /p REPO_URL="Pega la URL de tu repositorio (o presiona ENTER para usar la de por defecto): "

if "%REPO_URL%"=="" (
    set REPO_URL=%DEFAULT_URL%
    echo Usando: %DEFAULT_URL%
)

echo.
echo Conectando con GitHub y subiendo proyecto...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo =========================================================================
    echo  🎉 ¡TODO SUBIDO CON EXITO A GITHUB!
    echo =========================================================================
    echo Ahora solo falta conectar tu repositorio a Render.com (gratis):
    echo.
    echo 1. Ve a: https://dashboard.render.com
    echo 2. Clic en "New +" -> "Web Service"
    echo 3. Selecciona tu repositorio de GitHub
    echo 4. Render detectara automaticamente el archivo render.yaml y comenzara
    echo    el despliegue en la nube en Node.js 22.
    echo 5. ¡En 2 minutos tendras tu enlace publico 24/7 con HTTPS!
    echo =========================================================================
) else (
    echo.
    echo [AVISO] Si GitHub te pidio inicio de sesion, completa el inicio en la ventana
    echo que se abrio y vuelve a intentarlo.
)

echo.
pause
