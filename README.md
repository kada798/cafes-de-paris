# Les Cafés de Paris

巴黎咖啡文化杂志与咖啡馆探索项目。当前阶段只准备开发环境；网页、API、数据库结构和自动采集功能将在下一步实现。

## 本地环境

- Node.js 24–26，npm 10 或以上。
- Git。
- 推荐使用 VS Code；也可以用其他文本编辑器修改源代码。
- 当前没有第三方运行依赖。SQLite 将使用 Node.js 自带模块。

在 PowerShell 中运行：

```powershell
Set-Location 'C:\Users\86155\Documents\ChatGPT\cafes_de_paris'
npm.cmd ci
npm.cmd run check:env
code .
```

Windows 下使用 `npm.cmd` 可避免 `npm.ps1` 受到 PowerShell 执行策略限制。

环境检查使用内存 SQLite，不写入业务数据、不联网、不显示密钥。它检查 Git 远程是否已配置，但不能证明具有 GitHub 推送权限。

本地配置在 `.env` 中，配置模板是 `.env.example`。如果 `.env` 不存在：

```powershell
if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

目前没有 `dev` 启动命令：业务程序尚未实现。`npm.cmd run check` 用于校验当前环境脚本和工具支持。

## 代码架构

以下为后续实现时的目录约定；业务目录按实际需要创建。

```text
web/                    可手动修改的 HTML、CSS、JavaScript
  pages/                首页、探索、咖啡馆、活动、文章
  components/           导航、卡片、筛选器、地图
  services/             调用我们自己的 API
  assets/               样式与本地图片
server/
  routes/               HTTP 接口
  services/             查询、筛选、内容关联
  repositories/         数据库读写边界
  db/migrations/        可追踪的数据库结构变更
  ingestion/
    sources/            每个来源的独立适配器
    normalize.js        统一字段
    match.js            去重与店铺关联
    sync.js             同步编排和结果记录
content/                人工编辑的文化文章
seeds/                  可公开的初始咖啡馆数据
scripts/                环境检查、初始化和同步入口
tests/                  核心流程验证
data/                   本地运行数据，Git 忽略
```

前端只访问项目 API；外部数据由服务端适配器获取。人工编辑内容和自动更新字段分开管理。采集频率、来源许可和字段存储方式由各适配器明确规定。

## 自己调整代码

代码是本地普通文件，可以直接在编辑器中修改。后续实现按以下入口维护：

| 想调整的内容 | 对应位置 |
| --- | --- |
| 配色、字体、布局 | `web/assets/` |
| 页面内容与交互 | `web/pages/`、`web/components/` |
| 文化文章 | `content/` |
| 初始咖啡馆资料 | `seeds/` |
| 新增采集来源 | `server/ingestion/sources/` |
| 数据库结构 | 新增 `server/db/migrations/` 迁移文件 |
| 本机配置或接口密钥 | `.env` |

修改后先运行相关检查，再查看 `git diff`。我后续也会基于你修改后的文件继续开发，保留你的改动。

## GitHub 连接与同步

公开仓库：[kada798/cafes-de-paris](https://github.com/kada798/cafes-de-paris)。本项目的 `origin` 指向该仓库；沿用现有 `master` 分支。

本项目使用 GitHub noreply 提交邮箱，避免在公开提交中暴露个人邮箱；此设置仅作用于本项目。GitHub 连接器登录与本地 Git 推送认证是两个独立连接。

仓库配置好后查看连接：

```powershell
git remote -v
git status
```

本地 Git 通过 Git Credential Manager 或你已有的 SSH 设置认证。登录应在 GitHub 官方授权界面完成，不要将访问令牌写进源码、远程 URL 或聊天中。

新仓库用于保存项目源码和后续修改记录。换电脑时可先克隆，再安装并检查环境：

```powershell
git clone https://github.com/kada798/cafes-de-paris.git
Set-Location cafes-de-paris
npm.cmd ci
npm.cmd run check:env
code .
```

首次连接完成后，日常手动修改流程如下（先保持工作区干净，再拉取远程更新）：

```powershell
git pull --ff-only
# 在编辑器中修改文件
npm.cmd run check
git diff
git status
git add README.md
# 把 README.md 换成这次实际修改的文件，逐项确认
git commit -m "Describe your change"
git push
```

若已有未提交改动，先完成本地提交或妥善保存后再拉取；出现冲突时保留内容并处理冲突，不使用强制推送。

## 哪些文件会留在本地

`.env`、依赖目录、运行数据库和临时文件已由 `.gitignore` 排除。项目根目录的原始 PDF 作为本地参考资料保留，默认不上传；代码及可公开内容通过 Git 管理。`.env.example` 只保留无密钥的配置示例。

数据库文件不进入 Git；后续通过迁移文件和种子数据复现结构与演示内容。
