import type { Context, Session } from 'koishi';

export const name = 'settitle';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>✨ 极致精简，开箱即用，零配置</p>
  <p>🎯 仅适用于 <strong>OneBot</strong> 平台，用于设置群成员的专属头衔</p>
  <p>⚠️ 机器人需为 <strong>群主</strong> 才能成功设置头衔</p>
  <p>📏 头衔最多 <strong>18 字节</strong>（6 个汉字或 18 个英文字符）</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>头衔 &lt;内容&gt;</code> — 设置自己的群头衔</li>
    <li><code>头衔 &lt;内容&gt; @某人</code> — 为指定成员设置头衔（也可直接传 QQ 号）</li>
    <li><code>title &lt;内容&gt;</code> — 同上（英文别名）</li>
  </ul>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

interface TargetResolution {
    targetUserId: string;
    targetLabel: string;
}

/** 解析目标用户：优先取消息中的 @ 元素，其次取传入的 QQ 号字符串。 */
function resolveTarget(session: Session, target?: string): TargetResolution | null {
    const atElement = session.elements?.find((element) => {
        return element.type === 'at' && typeof element.attrs?.id === 'string';
    });

    if (typeof atElement?.attrs?.id === 'string' && atElement.attrs.id.trim()) {
        const targetUserId = atElement.attrs.id.trim();
        return {
            targetUserId,
            targetLabel: `@${targetUserId}`,
        };
    }

    const targetUserId = target?.trim();
    if (!targetUserId) return null;

    return {
        targetUserId,
        targetLabel: targetUserId,
    };
}

export function apply(ctx: Context) {
    ctx.command('头衔 <title:string> [target:string]', '设置群专属头衔（仅 OneBot）')
        .alias('title')
        .action(async (argv, title, target) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';
            if (session.platform !== 'onebot') return '该指令仅支持 OneBot 平台。';
            if (!session.guildId) return '请在群聊中使用该指令。';

            const value = title || '';
            // QQ 群头衔上限为 18 字节（UTF-8）
            if (Buffer.byteLength(value, 'utf8') > 18) {
                return '头衔过长，最多 18 字节（6 个汉字或 18 个英文字符）。';
            }

            // 无目标参数时默认给自己设置
            const resolved = resolveTarget(session, target);
            const targetUserId = resolved ? resolved.targetUserId : session.userId;
            const targetLabel = resolved ? resolved.targetLabel : '你';

            try {
                await session.bot.internal.setGroupSpecialTitle(
                    session.guildId,
                    targetUserId,
                    value
                );
                return value
                    ? `已将 ${targetLabel} 的头衔设为「${value}」`
                    : `已清除 ${targetLabel} 的头衔`;
            } catch {
                return '设置头衔失败，请确认机器人为群管理员。';
            }
        });
}
