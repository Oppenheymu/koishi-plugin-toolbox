# koishi-plugin-toolbox-settitle

[![npm](https://img.shields.io/npm/v/koishi-plugin-settitle?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-settitle)

极致精简的 OneBot 头衔设置插件，开箱即用。

## 功能

- 在群聊中设置 / 清除自己的专属头衔
- 仅适用于 OneBot 平台

## 使用

| 指令 | 说明 |
|------|------|
| `头衔 <内容>` | 将自己的群头衔设为指定内容 |
| `头衔` | 清除自己的群头衔 |
| `title <内容>` | 同上（英文别名） |

> 机器人需为群管理员或群主才能成功设置头衔。

## 配置

| 配置项 | 类型 | 默认 | 说明 |
|--------|------|------|------|
| `minAuthority` | number | `1` | 使用「设置头衔 / 清除头衔」指令所需的最低用户权限等级（0-5）。为后续统一权限管理预留，指令级门槛由本配置控制，实际群操作权限仍由 OneBot 侧校验 |

## 依赖

- [koishi](https://koishi.chat/) ^4.17.4
- OneBot 协议适配器（如 `koishi-plugin-adapter-onebot`）
