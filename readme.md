# koishi-plugin-toolbox

> Koishi「工具箱」插件集合 · 单仓多包管理
> 部分简单的API进行了加工提升健壮性

## 子包导航

| 包名 | 路径 | 版本 | 简介 |
|------|------|------|------|
| [koishi-plugin-toolbox-settitle](./packages/set-title) | `packages/set-title` | ![npm](https://img.shields.io/npm/v/koishi-plugin-settitle) | 极致精简的 OneBot 群头衔设置插件，开箱即用、零配置 |
| [koishi-plugin-toolbox-deltable](./packages/del-table) | `packages/del-table` | ![npm](https://img.shields.io/npm/v/koishi-plugin-deltable) | 一次性硬删除数据表工具，多步确认防误操作 |
| [koishi-plugin-setadmin](./packages/set-admin) | `packages/set-admin` | ![npm](https://img.shields.io/npm/v/koishi-plugin-setadmin) | 极致精简的 OneBot 群管理员设置/取消插件，开箱即用、零配置 |
| [koishi-plugin-cleanscreen](./packages/clean-screen) | `packages/clean-screen` | ![npm](https://img.shields.io/npm/v/koishi-plugin-cleanscreen) | 极致精简的 OneBot 群清屏插件，撤回最近若干条消息 |

## 特性一览

### 🏷️ settitle

- 仅适用于 **OneBot** 平台，用于设置 / 清除群成员专属头衔
- 指令：`头衔 <内容>`、`头衔 <内容> @某人`（也支持直接传 QQ 号）、`title`（英文别名）
- 无参数时清除自己头衔；可 `@` 或传 QQ 号为他人设置
- 头衔长度校验（最多 18 字节，即 6 个汉字或 18 个英文字符）
- 机器人需为群管理员或群主才能成功设置

### 👑 setadmin

- 仅适用于 **OneBot** 平台，用于设置 / 取消群管理员
- 指令：`设置管理员 @某人`、`取消管理员 @某人`（也支持直接传 QQ 号），`admin` / `unadmin` 为英文别名
- 需显式指定目标（`@` 或 QQ 号），不支持对机器人自身操作
- 调用前先查询成员信息预校验：拦截对群主操作、重复设置 / 取消等无意义请求
- 完善的 retcode 错误归类（权限不足、目标无效、PacketBackend 不可用等）
- 机器人需为群主才能成功设置管理员

### 🗑️ deltable

- **硬删除**数据表，非软删除，数据不可恢复，需谨慎使用
- 多步确认机制（二步 / 三步可选），防止误操作
- 指令：`删除表 <表名>`（需 4 级权限，多步确认）、`检查表`（别名 `查看表`）
- 可配置确认等待时间（默认 30 秒）与确认模式
- 依赖 `database` 服务，内置 `zh-CN` / `en-US` 双语本地化

### 🧹 cleanscreen

- 仅适用于 **OneBot** 平台，撤回群内最近若干条消息，达到「清屏」效果
- 指令：`清屏 [条数]`、`cleanscreen [条数]`（英文别名）
- 不传参按默认条数撤回，传参指定条数（受 `maxCount` 上限钳制）
- 机器人需为 **群主** 才能撤回他人消息；自动翻页获取历史消息，跳过机器人自身消息
- 单条撤回失败（如超过 2 分钟）不中断，统计成功数

## 交流与反馈

遇到问题或有建议？欢迎加入 QQ 群 **[1071284605【晓基地插件工坊】](https://qm.qq.com/q/WngX4RQoca)** 进行交流。

## 许可证

MIT
