@echo off
chcp 65001 >nul
cd /d "C:\Users\Lenovo\个人网站"

echo ========================================
echo  Git 仓库状态检查
echo ========================================
echo.
echo 当前目录：
cd
echo.
echo 远程仓库地址：
git remote -v
echo.
echo 当前分支：
git branch --show-current
echo.
echo 文件状态（未提交的文件会显示在这里）：
git status --short
echo.
echo 已跟踪的 images 文件：
git ls-files images/
echo.
pause
