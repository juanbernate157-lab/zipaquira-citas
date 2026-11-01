@echo off
setlocal
cd /d "%~dp0"
cls
echo ========================================================
echo   ZIPAQUIRA ENTERPRISE - SUBIR PROYECTO A GITHUB
echo ========================================================
echo.

git config user.name "Zipaquira Enterprise"
git config user.email "juanbernate157@gmail.com"

echo Guardando archivos del proyecto...
git add .
git commit -m "Zipaquira Enterprise: Citas, Lamborghini, QR y Calendar" >nul 2>nul

echo.
echo Conectando con tu repositorio:
echo https://github.com/juanbernate157-lab/zipaquira-citas.git
echo.
git remote remove origin >nul 2>nul
git remote add origin https://github.com/juanbernate157-lab/zipaquira-citas.git
git branch -M main

echo Subiendo archivos a GitHub...
echo (Si aparece una ventana pidiendo iniciar sesion o autorizar, haz clic en aceptar)
echo.

git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   TODO SE SUBIO CON EXITO A GITHUB!
    echo ========================================================
    echo Tu repositorio esta listo en:
    echo https://github.com/juanbernate157-lab/zipaquira-citas
    echo.
    echo Ahora tu pagina en Render se activara sola:
    echo https://zipaquira-citas.onrender.com/citas
    echo ========================================================
) else (
    echo ========================================================
    echo [AVISO] Si te pidio iniciar sesion en GitHub,
    echo inicia sesion en el navegador y vuelve a hacer doble clic.
    echo ========================================================
)

echo.
pause
