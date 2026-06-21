import { type Context, Schema } from 'koishi';
import type { Config as PluginConfig } from './types';

export const name = 'del-table';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>🗑️ 一次性删表工具，开箱即用，需数据库服务</p>
  <p>⚠️ <strong>硬删除</strong>，非软删除！数据不会进回收站，删了就没了</p>
  <p>🔒 采用多步确认机制（二步/三步可选），防止误操作</p>
  <p>👤 删除表指令需 <strong>4 级权限</strong>，请谨慎授权</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>删除表 &lt;表名&gt;</code> — 删除指定数据表（需 4 级权限，多步确认）</li>
    <li><code>检查表</code> — 查看当前已注册的数据表（别名：<code>查看表</code>）</li>
  </ul>
  <h3 style="color: #e0574a;">⚙️ 配置项</h3>
  <ul>
    <li><code>confirmWaitingTime</code> — 确认等待时间（秒），默认 30</li>
    <li><code>confirmMode</code> — 确认模式：<code>two-step</code>（二步）/ <code>three-step</code>（三步）</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export const Config: Schema<PluginConfig> = Schema.object({
    confirmWaitingTime: Schema.number()
        .min(1)
        .default(30)
        .description('删除表的确认等待时间 (单位: 秒)'),
    confirmMode: Schema.union([
        Schema.const('two-step').description('二步确认（输入 2 次）'),
        Schema.const('three-step').description('三步确认（输入 3 次）'),
    ])
        .default('two-step')
        .description('删除确认模式'),
});

const locales = {
    'zh-CN': {
        commands: {
            删除表: {
                description: '删除指定数据表（危险）',
                messages: {
                    noUser: '无法获取用户信息',
                    noTarget: '请输入要删除的表名',
                    tableNotFound: '表 "{0}" 不存在。当前可用表：{1}',
                    timeout: '重置表 {0} 的确认已超时',
                    success: '{0} 表数据已成功重置',
                    confirm:
                        '[危险操作确认]\n将重置 {0} 表的所有数据！\n此操作不可撤销！请慎重考虑！\n当前已确认 {1}/{2} 次。\n请在 {3} 秒内再输入 {4} 次：\n“删除表 {0}”',
                },
            },
            检查表: {
                description: '查看当前已注册的数据表',
                messages: {
                    current: '当前表：{0}',
                    empty: '当前没有已注册表。',
                },
            },
        },
    },
    'en-US': {
        commands: {
            删除表: {
                description: 'Delete a target table (dangerous)',
                messages: {
                    noUser: 'Cannot get user information.',
                    noTarget: 'Please provide a table name to delete.',
                    tableNotFound: 'Table "{0}" does not exist. Available tables: {1}',
                    timeout: 'Confirmation for resetting table {0} has timed out.',
                    success: 'Table {0} has been reset successfully.',
                    confirm:
                        '[Dangerous Operation Confirmation]\nAll data in table {0} will be reset!\nThis action cannot be undone.\nConfirmed {1}/{2} times.\nPlease enter {4} more time(s) within {3} seconds:\n"删除表 {0}"',
                },
            },
            检查表: {
                description: 'Check currently registered tables',
                messages: {
                    current: 'Current tables: {0}',
                    empty: 'No table is currently registered.',
                },
            },
        },
    },
};

export const inject = ['database'];

import { checkTable } from './checktable';
import { deltable } from './deltable';

export function apply(ctx: Context, config: PluginConfig) {
    for (const [locale, data] of Object.entries(locales)) {
        ctx.i18n.define(locale, data);
    }
    ctx.plugin(checkTable);
    ctx.plugin(deltable, config);
}
