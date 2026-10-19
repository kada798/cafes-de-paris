# 地点与内容维护

## 文件入口

| 内容 | 文件 |
| --- | --- |
| 首页 | `web/pages/home.mjs` |
| 筛选页 | `web/pages/explore.mjs` |
| 文化、类型、图集、活动与关于 | `web/pages/discover.mjs` |
| 地点、文章与活动详情 | `web/pages/detail.mjs` |
| 导航、语言与状态 | `web/app.mjs` |
| 界面翻译（法、英、中顺序） | `web/locales/messages.mjs` |
| 样式与设备断点 | `web/assets/style.css` |
| 地点 | `seeds/catalog.json` |
| 三语文章 | `content/articles.json` |
| 场景与匹配 | `shared/match.mjs` |

编辑后运行 `npm.cmd run check`。种子资料修改后运行 `npm.cmd run db:seed` 或重启，再刷新页面。

## 地点规则

`kind` 为 `cafe`、`library`、`workspace`；`type` 为文化分类，与实际用途独立。`id` 是文章和页面关联依据，不要随意更改。

政策状态：`yes` 有证据支持；`no` 不符合；`unknown` 未核实；`limited` 有限制。宠物的 `inside` 表示室内允许，`terrace` 表示仅露台。限制需要在三语 `notes` 中明确，例如宠物牵引或仅指定区域。仅会议室可预约使用 `limited`，不代表普通座位可预约。

真实地点每个已知政策都需要 `evidence[字段名]` 的 URL、说明和 `checkedAt`。脱咖啡因 `decaf` 与明确标注无咖啡因 `caffeineFree` 分开记录，具体菜单写在 `drinkOptions`，不能根据名称推断。

## 时段

`hours: null` 为未知。星期一到日使用 `1` 到 `7`，每个值是多个时间区间。示例：

```json
{
  "1": [["09:00", "12:00"], ["13:00", "19:00"]],
  "2": [],
  "3": [["20:00", "02:00"]]
}
```

空数组为已知关闭；缺失星期为未知。跨午夜区间归在开始日；`exceptions` 可用日期覆盖，如 `"2026-12-25": []`。不要将示例时间赋给真实地点。

电脑独立时段暂用 `limited` 并在备注说明，首版不会当作无条件满足。临时闭馆用 `availability.status: "closed"`；重新开放须核实后手动更新。

## 本地覆盖

可公开修改直接编辑种子文件并提交 Git。本地个人记录可以放在 `data/patch.json`：

```json
{"notes":{"fr":"Note personnelle.","en":"Personal note.","zh":"个人备注。"}}
```

```powershell
npm.cmd run data:override -- flore data/patch.json
```

覆盖保存到 SQLite，后续种子导入保留。静态预览只使用公开种子数据，不导出本地覆盖。

## 文章、图片、活动

文章分别编辑三语 `title`、`excerpt`、`body`，通过 `placeIds` 关联地点并提供来源。原文变化后需检查译文，首版未启用机器翻译。

当前图片为 Unsplash 氛围示意，保存在 `web/assets/photos/`，`imageSource` 保留原始 URL。替换成地点实拍时需同时记录作者、许可与真实关联，再调整展示说明。

循环活动使用下一已知场次，详情保留来源日程。源的时区和文字有冲突时，以公告确认，不擅自纠正。只有地址完全一致，或名称相同且坐标接近才关联店内；300 米内的其他活动标为附近，这不是步行时间判断。

当前无真实拥挤来源。后续数据至少需要观测时间、有效期、测量区域及来源；过期信息不能继续作为当前状态，不编造空座或插座数量。
