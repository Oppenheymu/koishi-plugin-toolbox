# koishi-plugin-group-levelup

[![npm](https://img.shields.io/npm/v/koishi-plugin-group-levelup?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-group-levelup)

> 仅支持 OneBot/NapCat 平台

## 功能

- **群打卡**：通过 NapCat 的 `send_group_sign` 接口定时群签到，快速提升群等级
- **随机冒泡**：每日在随机时间点发送自定义文本到群聊，模拟真人活跃

## 配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `signIn` | `boolean` | `true` | 是否启用每日群打卡签到 |
| `signInCron` | `string` | `0 0 * * *` | 群打卡的 Cron 表达式 |
| `bubble` | `boolean` | `true` | 是否启用每日随机冒泡 |
| `bubbleCount` | `number` | `1` | 每日冒泡次数 |
| `bubbleTexts` | `string[]` | `["冒泡"]` | 冒泡文本列表，每次随机选择一条 |

## 依赖

- `cron` 服务（由 `koishi-plugin-cron-fix` 提供）
- OneBot/NapCat 适配器

## 注意事项

⚠️ 群打卡和冒泡行为可能会被群管理制裁，请谨慎使用。

## 许可证

MIT

