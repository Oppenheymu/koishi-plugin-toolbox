# koishi-plugin-setadmin

[![npm](https://img.shields.io/npm/v/koishi-plugin-setadmin?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-setadmin)

极致精简的 OneBot 群管理员设置插件，开箱即用。

## 功能

- 在群聊中设置 / 取消群管理员
- 仅适用于 OneBot 平台

## 使用

| 指令 | 说明 |
|------|------|
| `设置管理员 @某人` | 将指定成员设为管理员（也可直接传 QQ 号） |
| `取消管理员 @某人` | 取消指定成员的管理员身份 |
| `admin @某人` | 同上（英文别名） |
| `unadmin @某人` | 同上（英文别名） |

> 机器人需为群主才能成功设置管理员。需显式指定目标（`@` 或 QQ 号），不支持对机器人自身操作。

## 配置

| 配置项 | 类型 | 默认 | 说明 |
|--------|------|------|------|
| `minAuthority` | number | `2` | 使用「设置管理员 / 取消管理员」指令所需的最低用户权限等级（0-5）。为后续统一权限管理预留，指令级门槛由本配置控制，实际群操作权限仍由 OneBot 侧校验 |

## 依赖

- [koishi](https://koishi.chat/) ^4.17.4
- OneBot 协议适配器（如 `koishi-plugin-adapter-onebot`）
