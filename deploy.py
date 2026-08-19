# -*- coding: utf-8 -*-
"""
个人网站一键部署脚本
====================
功能：把当前「个人网站」目录打包成 zip，并上传到你的 Netlify 站点。

首次使用前，只需要在下面的「配置区」填两个值（每个只需填一次）：
    1. NETLIFY_TOKEN  —— 你的 Netlify 个人访问令牌
    2. SITE_ID        —— 你站点的 API ID

以后每次改完代码，双击 deploy.bat（或执行 python deploy.py）即可自动上线。

两个值的获取方法见文件末尾的说明。
"""

import os
import sys
import io
import json
import zipfile
import urllib.request
import urllib.error

# ==================== 配置区（只需填一次） ====================
NETLIFY_TOKEN = ""          # 例如："nfp_xxxxxxxxxx" 或 "xxxxx"
SITE_ID = ""                # 例如："a1b2c3d4-...."
# ==============================================================

# 打包时排除这些内容，避免把部署脚本/缓存一起传上去
EXCLUDE_NAMES = {
    "deploy.py", ".git", ".gitignore",
    "check-git.bat", "push-to-netlify.bat",
    "push-netlify.sh", "init-repo.sh",
    "image-test.html",
}

SITE_ROOT = os.path.dirname(os.path.abspath(__file__))


def log(msg):
    print(msg)


def make_zip_bytes():
    """把站点目录打包成 zip，返回字节数据。"""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(SITE_ROOT):
            # 过滤掉不需要的目录
            dirs[:] = [d for d in dirs if d not in EXCLUDE_NAMES]
            for f in files:
                if f in EXCLUDE_NAMES:
                    continue
                full = os.path.join(root, f)
                # zip 内使用相对路径，保证部署到站点根目录
                rel = os.path.relpath(full, SITE_ROOT).replace("\\", "/")
                zf.write(full, rel)
    buf.seek(0)
    return buf.getvalue()


def deploy(zip_bytes):
    """调用 Netlify Deploy API，上传 zip 并返回部署结果。"""
    url = f"https://api.netlify.com/api/v1/sites/{SITE_ID}/deploys"
    req = urllib.request.Request(url, data=zip_bytes, method="POST")
    req.add_header("Authorization", f"Bearer {NETLIFY_TOKEN}")
    req.add_header("Content-Type", "application/zip")

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"上传失败（HTTP {e.code}）：{body}") from e


def main():
    if not NETLIFY_TOKEN or not SITE_ID:
        log("=" * 56)
        log("⚠ 尚未配置。请打开本脚本 deploy.py，填写：")
        log("   1. NETLIFY_TOKEN")
        log("   2. SITE_ID")
        log("=" * 56)
        log("")
        log("获取方法：")
        log("  Token  → https://app.netlify.com/user/applications")
        log("           点击 New access token 生成一个。")
        log("  Site ID → Netlify 站点 → Site configuration → Site details → API ID")
        log("")
        sys.exit(1)

    log("正在打包站点目录 ...")
    zip_bytes = make_zip_bytes()
    log(f"打包完成，共 {len(zip_bytes) / 1024:.0f} KB，开始上传 ...")

    try:
        result = deploy(zip_bytes)
    except Exception as e:
        log(f"❌ {e}")
        log("请检查上面两个配置值是否正确，然后重试。")
        sys.exit(1)

    log("✅ 上传成功！")
    deploy_id = result.get("id", "未知")
    url = result.get("url", "未知")
    state = result.get("state", "未知")
    log(f"   Deploy ID : {deploy_id}")
    log(f"   状态      : {state}")
    if url and url != "未知":
        log(f"   预览地址  : {url}")
    log("")
    log("生产环境稍后会自动更新，访问：https://personalsitess.netlify.app/")
    log("如果上面域名不对，请在脚本末尾的提示里确认你的正式域名。")


if __name__ == "__main__":
    main()