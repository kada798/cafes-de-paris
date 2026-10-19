# 数据来源、路线与每周精选

## Google Maps 与替代方案

已提供每张地点卡片的 Google Maps 导航链接。点击才将起点、目的地和所选方式传入 Google；不需要 API 密钥。选择“任一方式”时由 Google 自行选择方式。Maps URLs 不支持传递本项目的出发日期时间，用户需在 Google 内核对。Google 外部结果不会回传到本站的时间筛选。

本站内步行继续通过 IGN 的真实道路网络计算。本站内公共交通已有 PRIM 适配器，仍等待 `PRIM_API_KEY`。这两条路径与 Google 外部导航在界面上分开标注。

Google Routes API 可以在配置 Google Cloud 结算、启用 API、限制密钥及额度后接入；本次没有启用付费 Google API。Places 数据不能当作可任意批量爬取并永久复制的公共数据库，尤其 EEA 结算账号有与地图联用的限制。本次新增地点由品牌官网提供，坐标来自 IGN，没有混入 Google 的评分、评论或图片。

- [Google Maps URLs（免密钥导航）](https://developers.google.com/maps/documentation/urls/get-started)
- [Google Routes API 配置](https://developers.google.com/maps/documentation/routes/get-api-key)
- [Google Routes 计费](https://developers.google.com/maps/documentation/routes/usage-and-billing)
- [Places EEA 展示限制](https://developers.google.com/maps/comms/eea/places)
- [IGN 路线](https://ignf.github.io/cartes.gouv.fr-documentation/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-itineraire/)
- [PRIM](https://prim.iledefrance-mobilites.fr/)

## 分类与地点扩充

`content/taxonomy.json` 保存类别、定义、依据及版本。它是一套有来源的编辑分类，可以有多个标签；不是声称存在一个官方统一的“咖啡馆等级”。SCA 提供精品咖啡属性框架；巴黎市的获奖小酒馆标准提供地方服务参考；巴黎旅游局提供文学历史关联。INSEE 的 NAF 仅用于经济统计。

`content/venue-expansion.json` 保存新增 20 家门店的官方地址、网址和分类依据。执行 `node scripts/import-venues.mjs` 可将未导入的 ID 通过 IGN 地址核对后追加到种子；不会覆盖已有条目。导入后执行 `npm run db:seed`。新增店铺的营业时间、宠物、电脑、插座、低因等条件保持未知，直到有证据为止。

未来可以增加 OpenStreetMap/开放数据适配器或获授权的杂志渠道，并保留来源与许可说明。Google Places 应单独设计符合其当期规则的展示层，不能直接存入现有开放地点种子。

## 阅读库与每周精选

`content/reading-sources.json` 保存 15 条资料，五个主题各三条。文章、访谈、视频、参考页和目录均显式区分。本站只写三语短导语和入选理由，全文链接回出版方，不整篇转载。未公开的发表日期为 null；核验日期独立记录。

每周选读按巴黎时区的周一至周日计算。编辑分 = 相关性 40% + 来源可靠性 35% + 实用价值 25%，各项原始分为 0–5。候选需至少 75/100、核验不超过 90 天，目录排除；按周确定轮换起点，优先主题多样性，同一出版方最多两条。它是本周选读，不代表本周新发表。未通过新核验的旧资料继续留在库中，但退出周选。

修改 JSON 即可调整来源、理由和分数。原文变化、来源失效或有新文章时需要更新核验，不会把旧检查日期自动滚动成今天。未来 RSS 发现应先进入候选队列，经核验、归类、翻译后再发布。当前没有自动全文抓取或无人值守来源核验。

## 真实互动与外站数据

本地 Node 使用 SQLite，托管站点使用 Sites D1。两者是独立数据库，生产统计不会从本地测试数据导入。初始值为 0；不可连接时显示“—”，不生成热度数字。

| 指标        | 定义                                                       |
| ----------- | ---------------------------------------------------------- |
| 资料页访问  | 打开本站阅读导语，同一账号/浏览器、资料和 30 分钟窗口去重  |
| 原文点击    | 点击本站的原始链接，同一账号/浏览器、资料和 5 分钟窗口去重 |
| 有用好评    | 每个账号或浏览器每条资料一票，可撤销                       |
| 近 7 天活跃 | 最近七天去重后的资料页访问与原文点击总数                   |

统计键为账号或随机浏览器 ID 的哈希。未登录浏览器的去重是近似的，清除浏览器存储可能影响结果。统计表不存邮箱、IP、出发地址或坐标。来自原出版网站的浏览、点赞和活跃度目前不可获取，不以本站数字冒充；本站互动也不混入编辑评分。生产站点仍保持原访问权限。

## 托管结构与维护

原前端 `web/`、公共规则 `shared/`、本地 Node `server/` 继续保留。`hosting/` 使用 Sites 官方 Vinext 模板，只承载相同前端与 D1 统计接口，没有另写一套界面。

首次构建前在 `hosting/` 执行 `npm ci` 安装托管模板依赖；日常仅运行 Node 本地服务不需要这一步。

构建顺序：根目录 `npm run build:preview` → `node scripts/prepare-hosting.mjs` → `hosting/` 内执行 `npm run build`。前两步导出公开地点、活动与阅读资料，不导出本地数据库和密钥；可在根目录使用 `npm run build` 一次完成所有步骤。托管构建输出位于 `hosting/dist/`，同一发布产物复制到根目录 `dist/`。Sites 发布包使用这个输出和其 `.openai/hosting.json`，包含数据库迁移。

Windows 如 npm 启动器被工具错误解析，可用 Node 直接调用 npm 的 `npm-cli.js`，或在依赖已安装后执行 `node scripts/run-framework.mjs build`。不要将本机绝对工具路径写入项目配置。
