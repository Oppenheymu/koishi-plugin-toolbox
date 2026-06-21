import type { Context, Session } from 'koishi';
import {} from 'koishi-plugin-adapter-onebot'


export const name = 'SetTitle';

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
    <li><code>清除头衔 [@某人]</code> — 清除自己（或指定成员）的群头衔</li>
    <li><code>cleartitle</code> — 同上（英文别名）</li>
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

/**
 * 解析 set_group_special_title 调用失败的原因，返回面向用户的可读提示。
 *
 * OneBot 实现（如 napcat）返回的 retcode 各不相同，这里做常见值归类：
 * - 1400：napcat 的 PacketBackend 不可用 / 不支持当前 QQ 版本架构（与权限无关）
 * - 100/102/103：通常为参数或目标无效（如目标不在群内）
 * - 104/权限类：机器人权限不足（设置群头衔需要机器人为群主）
 * - 其余：附上 retcode 以便排查
 *
 * koishi-plugin-adapter-onebot 抛出的 SenderError 会把 retcode 同时挂在 `error.code`
 * 与 `error.message` 文本中，两种来源都做兼容读取。
 */
function describeSetTitleError(error: unknown): string {
    const err = error as { code?: unknown; message?: string } | undefined;
    const code = typeof err?.code === 'number' ? err.code : undefined;

    // 兜底：从 message 中提取 retcode（不同适配器抛出的错误结构可能不同）
    let retcode = code;
    if (retcode === undefined && err?.message) {
        const match = err.message.match(/retcode[:\s]*(\d+)/i);
        if (match) retcode = Number(match[1]);
    }

    switch (retcode) {
        case 1400:
            return '设置头衔失败：OneBot 实现（如 napcat）的 PacketBackend 不可用或不支持当前 QQ 版本，与机器人权限无关，请联系机器人运维处理。';
        case 100:
        case 102:
        case 103:
            return '设置头衔失败：参数或目标用户无效，请确认目标成员在本群内。';
        case 104:
            return '设置头衔失败：机器人权限不足，设置群头衔需要机器人为群主。';
        case undefined:
            return '设置头衔失败，请稍后重试或联系机器人运维。';
        default:
            return `设置头衔失败（错误码 ${retcode}），请联系机器人运维排查。`;
    }
}

/**
 * 校验平台/群聊环境、解析目标，并调用 OneBot 设置群头衔 API。
 * 传入空 value 即为清除头衔。返回面向用户的结果文案。
 */
async function doSetTitle(
    ctx: Context,
    session: Session,
    value: string,
    target?: string,
): Promise<string> {
    if (session.platform !== 'onebot') return '该指令仅支持 OneBot 平台。';
    if (!session.guildId) return '请在群聊中使用该指令。';

    // 无目标参数时默认给自己设置
    const resolved = resolveTarget(session, target);
    const targetUserId = resolved ? resolved.targetUserId : session.userId;
    const targetLabel = resolved ? resolved.targetLabel : '你';

    try {
        // 使用 koishi onebot 适配器封装的 API，而非直接调用 napcat 底层 action
        await session.bot.internal.setGroupSpecialTitle(
            session.guildId,
            targetUserId,
            value,
            -1, // 永久有效
        );
        return value
            ? `已将 ${targetLabel} 的头衔设为「${value}」`
            : `已清除 ${targetLabel} 的头衔`;
    } catch (error) {
        ctx.logger('tools').error('设置头衔 API 调用失败：', error);
        return describeSetTitleError(error);
    }
}

export function apply(ctx: Context) {
    ctx.command('设置头衔 <title:string> [target:string]', '设置群专属头衔（仅 OneBot）')
        .alias('title')
        .action(async (argv, title, target) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';

            const value = title || '';
            // QQ 群头衔上限为 18 字节（UTF-8）
            if (Buffer.byteLength(value, 'utf8') > 18) {
                return '头衔过长，最多 18 字节（6 个汉字或 18 个英文字符）。';
            }
            return doSetTitle(ctx, session, value, target);
        });

    ctx.command('清除头衔 [target:string]', '清除群专属头衔（仅 OneBot）')
        .alias('cleartitle')
        .action(async (argv, target) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';
            return doSetTitle(ctx, session, '', target);
        });
}
