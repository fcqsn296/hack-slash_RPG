@echo off
chcp 65001 > nul
rem Open the image import tool. Console stays open on error.
cd /d "%~dp0.."
python tools/import_images.py %*
if errorlevel 1 pause
