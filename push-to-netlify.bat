@echo off
chcp 65001 >nul
cd /d "C:\Users\Lenovo\个人网站"

echo ========================================
echo  正在提交图片和网页文件到 Git...
echo ========================================

git add images\ index.html image-test.html
if %errorlevel% neq 0 (
    echo [错误] git add 失败
    pause
    exit /b 1
)

git commit -m "add certificate images, update image paths, add image test page"
if %errorlevel% neq 0 (
    echo [提示] 没有新的修改需要提交，或者提交失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo  正在推送到 GitHub，Netlify 会自动重新部署...
echo ========================================
git push
if %errorlevel% neq 0 (
    echo [错误] git push 失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo  推送成功！Netlify 正在重新部署...
echo  大约 1-2 分钟后访问：https://prismatic-pastelito-ff4f4b.netlify.app/
echo ========================================
pause
