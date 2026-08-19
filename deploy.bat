@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   个人网站一键部署（上传到 Netlify）
echo ==========================================
echo.
python deploy.py
echo.
echo 如果上面报错提示 python 找不到，
echo 请把 python 换成 python3 或完整路径后重试。
echo.
pause