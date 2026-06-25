import type { Context, Session } from 'koishi';
import {} from 'koishi-plugin-adapter-onebot';


export const name = 'SetAdmin';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>✨ 极致精简，开箱即用，零配置</p>
  <p>🎯 仅适用于 <strong>OneBot</strong> 平台，用于设置 / 取消群管理员</p>
  <p>⚠️ 机器人需为 <strong>群主</strong> 才能成功设置管理员</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>设置管理员 @某人</code> — 将指定成员设为管理员（也可直接传 QQ 号）</li>
    <li><code>admin @某人</code> — 同上（英文别名）</li>
    <li><code>取消管理员 @某人</code> — 取消指定成员的管理员身份</li>
    <li><code>unadmin @某人</code> — 同上（英文别名）</li>
  </ul>
  <p>💡 需显式指定目标（<code>@</code> 或 QQ 号），不支持对自身或机器人操作。</p>
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
 * 解析 set_group_admin 调用失败的原因，返回面向用户的可读提示。
 *
 * OneBot 实现（如 napcat）返回的 retcode 各不相同，这里做常见值归类：
 * - 1400：napcat 的 PacketBackend 不可用 / 不支持当前 QQ 版本架构（与权限无关）
 * - 100/102/103：通常为参数或目标无效（如目标不在群内）
 * - 104/权限类：机器人权限不足（设置群管理员需要机器人为群主）
 * - 其余：附上 retcode 以便排查
 *
 * koishi-plugin-adapter-onebot 抛出的 SenderError 会把 retcode 同时挂在 `error.code`
 * 与 `error.message` 文本中，两种来源都做兼容读取。
 */
function describeSetAdminError(error: unknown, action: string): string {
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
            return `${action}失败：OneBot 实现（如 napcat）的 PacketBackend 不可用或不支持当前 QQ 版本，与机器人权限无关，请联系机器人运维处理。`;

        case 100: // fallthrough
        case 102: // fallthrough
        case 103:
            return `${action}失败：参数或目标用户无效，请确认目标成员在本群内。`;

        case 104:
            return `${action}失败：机器人权限不足，设置群管理员需要机器人为群主。`;

        case undefined:
            return `${action}失败，请稍后重试或联系机器人运维。`;

        default:
            return `${action}失败（错误码 ${retcode}），请联系机器人运维排查。`;
    }
}

/**
 * 校验平台/群聊环境、解析目标，并调用 OneBot 设置/取消群管理员 API。
 * enable=true 设置管理员，enable=false 取消管理员。返回面向用户的结果文案。
 */
async function doSetAdmin(
    ctx: Context,
    session: Session,
    enable: boolean,
    target?: string,
): Promise<string> {
    if (session.platform !== 'onebot') return '该指令仅支持 OneBot 平台。';
    if (!session.guildId) return '请在群聊中使用该指令。';

    const resolved = resolveTarget(session, target);
    if (!resolved) {
        return '请 @ 指定要操作的成员，或传入其 QQ 号。';
    }
    const { targetUserId, targetLabel } = resolved;

    // 不允许对机器人自身操作
    if (targetUserId === session.bot.selfId) {
        return '不能对机器人自身进行管理员操作。';
    }

    const action = enable ? '设置管理员' : '取消管理员';

    // 先查询目标成员信息，做合法性预校验，避免无意义的 API 调用与混淆报错
    let role: string | undefined;
    try {
        const info = await session.bot.internal.getGroupMemberInfo(
            session.guildId,
            targetUserId,
        );
        role = (info as { role?: string } | undefined)?.role;
    } catch (error) {
        ctx.logger('tools').error('查询群成员信息失败：', error);
        return `无法获取 ${targetLabel} 的群成员信息，请确认其在本群内。`;
    }

    if (role === 'owner') {
        return `无法${action}：${targetLabel} 是本群群主，群主身份不可变更。`;
    }
    if (enable && role === 'admin') {
        return `${targetLabel} 已经是管理员，无需重复设置。`;
    }
    if (!enable && role === 'member') {
        return `${targetLabel} 当前不是管理员，无需取消。`;
    }

    try {
        // 使用 koishi onebot 适配器封装的 API，而非直接调用 napcat 底层 action
        await session.bot.internal.setGroupAdmin(
            session.guildId,
            targetUserId,
            enable,
        );
        return enable
            ? `已将 ${targetLabel} 设为管理员`
            : `已取消 ${targetLabel} 的管理员身份`;
    } catch (error) {
        ctx.logger('tools').error(`${action} API 调用失败：`, error);
        return describeSetAdminError(error, action);
    }
}

export function apply(ctx: Context) {
    ctx.command('设置管理员 [target:string]', '设置群管理员（仅 OneBot）')
        .alias('admin')
        .action(async (argv, target) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';
            return doSetAdmin(ctx, session, true, target);
        });

    ctx.command('取消管理员 [target:string]', '取消群管理员（仅 OneBot）')
        .alias('unadmin')
        .action(async (argv, target) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';
            return doSetAdmin(ctx, session, false, target);
        });
}
