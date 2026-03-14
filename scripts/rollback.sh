#!/bin/bash
# 部署回滚脚本
# 用于回滚到上一个 Git 版本部署的产物

set -e

REPO="Alex-Shen1121/personal-blog"
GH_PAGES_BRANCH="gh-pages"

echo "🔄 开始回滚部署..."

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️ 当前不在 main 分支，当前分支: $CURRENT_BRANCH"
    read -p "是否继续回滚? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消回滚"
        exit 0
    fi
fi

# 获取上一个提交的哈希
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
echo "📌 当前提交: $(git rev-parse --short HEAD)"
echo "📌 回滚到提交: $(git rev-parse --short $PREVIOUS_COMMIT)"

# 询问确认
read -p "确认回滚到上一个版本? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消回滚"
    exit 0
fi

# 检出上一个提交的内容
echo "📦 检出上一个提交的内容..."
git checkout $PREVIOUS_COMMIT -- .

# 创建回滚提交
echo "📝 创建回滚提交..."
git add -A
git commit -m "rollback: 回滚到 $(git rev-parse --short $PREVIOUS_COMMIT) 版本

回滚原因: 
- 由部署回滚脚本自动创建
- 回滚时间: $(date '+%Y-%m-%d %H:%M:%S')

如需恢复后续版本，请使用 git revert 或 git reset"

echo "✅ 回滚提交已创建"
echo ""
echo "下一步操作:"
echo "1. git push origin main - 推送到远程触发重新部署"
echo "2. 或手动撤销回滚: git revert HEAD"
