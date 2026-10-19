# Les Cafés de Paris

中英法三语的巴黎咖啡文化与需求匹配 MVP。六个栏目、场景筛选、地图、地点／文章／活动详情、SQLite 和巴黎市活动同步已经实现。

## 本地环境

- Node.js 24–26，npm 10 或以上。
- Git。
- 推荐使用 VS Code；也可以用其他文本编辑器修改源代码。
- 前端使用 Leaflet，后端使用 Node.js HTTP 与 SQLite 内置模块；Playwright 用于浏览器测试。本机已在 Node.js 26.1 / Windows 验证。

在 PowerShell 中运行：

```powershell
Set-Location 'C:\Users\86155\Documents\ChatGPT\cafes_de_paris'
npm.cmd ci
npm.cmd run check:env
npm.cmd run dev
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

运行 `npm.cmd run dev` 后打开 <http://127.0.0.1:3000/fr/>，也支持 `/en/`、`/zh/`。启动时自动建立 SQLite、执行迁移并导入种子内容；本地覆盖记录保留。另一个终端可运行 `code .` 编辑文件。`npm.cmd run check` 校验语法、JSON 和业务测试，`npm.cmd run test:browser` 验证浏览器流程。

## 代码架构

当前主要目录如下；字段、来源与本地覆盖维护方法见 [docs/DATA_GUIDE.md](docs/DATA_GUIDE.md)。

```text
web/                    可手动修改的 HTML、CSS、JavaScript
  pages/                首页、探索、咖啡馆、活动、文章
  components/           导航、卡片、筛选器、地图
  services/             调用我们自己的 API
  assets/               样式与本地图片
server/
  routes/               HTTP 接口
  services/             查询、筛选、内容关联
  routing/              ORS 步行、IDFM PRIM 公共交通适配器
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
shared/                 三态匹配、巴黎时区与活动场次逻辑
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

当前电脑的 Git 曾引用一个已经失效的证书文件路径。本项目已配置为使用 Windows 系统证书存储，HTTPS 证书验证保持开启。这项本地 Git 配置不会随克隆复制；如果在 Windows 的其他目录遇到同样的 `error setting certificate file`，可在对应仓库目录运行后重试：

```powershell
git config --local http.sslBackend schannel
```

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

## MVP 数据与当前边界

包含 10 个附官方来源的真实地点、3 个默认关闭的虚构演示地点、3 篇三语文化文章。真实政策有字段级证据；缺失信息保持未知，有限制的政策不算无条件符合。图片为明确标注的氛围示意图，不是地点实拍。

默认出行范围为 20 分钟。未配置路线密钥时不能确认可达时间，不使用直线距离冒充路线。实时空座／占用率尚无来源，显示未知。计时收费在详情展示，不冒充已知最低消费或完整预算。活动缺译时保留法语原文；源中消失不会被猜测为取消。

## 活动同步与路线配置

```powershell
npm.cmd run sync
```

开放活动源无需密钥。自动更新选择其一：在 `.env` 设置 `PARIS_DATA_ENABLED=true` 后启动网站；或单独运行 `npm.cmd run sync:watch`。进程运行期间按 `SYNC_INTERVAL_MINUTES` 更新（默认 180 分钟，最低 30 分钟）。失败保留已有资料，活动页显示同步状态。

步行及公共交通分别需要在 `.env` 填写 `ORS_API_KEY`、`PRIM_API_KEY`，然后重启。适配器解析和失败逻辑有测试；有密钥的真实调用仍需配置后验证账号、配额和覆盖。起点保留在浏览器会话，请求路线时发送给服务商，不保存到数据库。

底图与地址来自 [IGN](https://cartes.gouv.fr/)，活动来自 [Paris Data](https://parisdata.opendatasoft.com/explore/dataset/que-faire-a-paris-/)。备份数据库时先停止网站与同步进程，再复制整个 `data/` 目录。

## 修改与验证

界面翻译在 `web/locales/messages.mjs`，配色在 `web/assets/style.css`，页面在 `web/pages/`，场景和匹配规则在 `shared/match.mjs`，地点资料在 `seeds/catalog.json`，三语文章在 `content/articles.json`。修改资料后执行 `npm.cmd run db:seed`；本地覆盖可通过 `npm.cmd run data:override -- 地点ID data/补丁.json` 保存，导入种子不会覆盖。

```powershell
npm.cmd run check
npm.cmd run test:browser
```

浏览器测试在 Windows 默认使用 Chrome；其他系统可先运行 `npx playwright install chromium`。也可用 `BROWSER_CHANNEL` 指定浏览器。截图位于忽略的 `test-results/`。

## 可分享交互预览

`npm.cmd run build:preview` 生成 `dist/`，包含同一前端、公开地点和当前活动快照。界面显示快照时间；它不执行后台同步、不使用带密钥路线服务，不导出数据库、本地覆盖、密钥或原始 PDF。完整功能由 Node.js 服务提供，更新快照需重新构建发布。

Sites 身份保存在 `.openai/hosting.json`。托管预览与 GitHub 独立，不修改 GitHub origin。
