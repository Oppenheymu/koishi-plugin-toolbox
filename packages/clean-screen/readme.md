# koishi-plugin-cleanscreen

[![npm](https://img.shields.io/npm/v/koishi-plugin-cleanscreen?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-cleanscreen)

极致精简的 OneBot 群清屏插件，撤回最近的若干条消息。

## 功能

- 在群聊中撤回最近 N 条消息，达到「清屏」效果
- 不传参按默认条数撤回，传参指定条数
- 自动翻页获取历史消息，跳过机器人自身消息
- 仅适用于 OneBot 平台

## 使用

| 指令 | 说明 |
|------|------|
| `清屏` | 撤回最近 `count` 条消息（默认 20） |
| `清屏 <条数>` | 撤回指定条数的最近消息（受 `maxCount` 限制） |
| `cleanscreen` | 同上（英文别名） |

> 机器人需为 **群主** 才能撤回他人消息。群主撤回群内消息无时间限制（自己与群员消息均可撤回）。
>
> 已经被撤回的消息会被自动跳过（不计为失败）。

## 配置

| 配置项 | 类型 | 默认 | 说明 |
|--------|------|------|------|
| `minAuthority` | number | `2` | 使用「清屏」指令所需的最低用户权限等级（0-5） |
| `count` | number | `20` | 不传参时撤回的消息条数 |
| `maxCount` | number | `50` | 单次清屏允许撤回的最大条数，防止滥用 |

## 依赖

- [koishi](https://koishi.chat/) ^4.17.4
- OneBot 协议适配器（如 `koishi-plugin-adapter-onebot`）
