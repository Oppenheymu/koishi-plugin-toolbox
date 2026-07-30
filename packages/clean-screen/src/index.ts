import { type Context, Schema, type Session } from 'koishi';
import 'koishi-plugin-adapter-onebot';

export const name = 'clean-screen';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>✨ 极致精简，开箱即用，零配置</p>
  <p>🎯 在群聊中撤回最近的若干条消息，达到「清屏」效果</p>
  <p>⚠️ 仅适用于 <strong>OneBot</strong> 平台，机器人需为 <strong>群主</strong> 才能撤回他人消息</p>
  <p>⏳ 群主撤回群内消息<strong>无时间限制</strong>（自己与群员消息均可撤回）</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>清屏</code> — 按默认类型和数量清屏</li>
    <li><code>清屏 &lt;类型&gt;</code> — 按指定类型清屏（空格 / 撤回 / 混合）</li>
    <li><code>清屏 &lt;类型&gt; &lt;条数&gt;</code> — 按指定类型和数量清屏</li>
    <li><code>cleanscreen</code> — 同上（英文别名）</li>
    <li><code>cleanscreen &lt;类型&gt; [条数]</code> — 同上（英文别名）</li>
  </ul>
  <p>📌 <strong>清屏类型说明：</strong></p>
  <ul>
    <li><code>空格</code> / <code>space</code> — 发送大量空行消息，将聊天记录「顶」出屏幕</li>
    <li><code>撤回</code> / <code>recall</code> — 撤回最近若干条消息（默认，需群主）</li>
    <li><code>混合</code> / <code>both</code> — 先撤回再发空格，双保险</li>
  </ul>
  <p>💡 机器人自身的历史消息会被跳过，不参与撤回。</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

/**
 * 获取本群最近 count 条消息的 message_id（按时间从新到旧），跳过机器人自身消息。
 *
 * napcat 的 get_group_msg_history 传 message_seq 时不会向前回溯（Issue #441），
 * 故翻页无效；但其支持 count 参数，可一次指定返回条数。koishi 适配器的
 * internal.getGroupMsgHistory 未暴露 count，这里通过底层 _request 直接调用，
 * 不传 message_seq 即从最新消息向前取 count 条。
 */
async function collectRecentMessageIds(
    ctx: Context,
    session: Session,
    groupId: string,
    count: number
): Promise<number[]> {
    const selfId = session.bot.selfId;

    let messages: { message_id: number; sender?: { user_id?: number } }[];
    try {
        // koishi 适配器未暴露 count 参数，直接通过底层 _request 调用 napcat 原生接口
        const response = await session.bot.internal._request?.('get_group_msg_history', {
            group_id: groupId,
            count,
        });
        if (response?.retcode !== 0) {
            ctx.logger('tools').error(
                `获取群历史消息失败：retcode ${response?.retcode ?? 'unknown'}`
            );
            return [];
        }
        messages = (response.data?.messages ?? []) as typeof messages;
    } catch (error) {
        ctx.logger('tools').error('获取群历史消息失败：', error);
        return [];
    }

    const targetIds: number[] = [];
    const seen = new Set<number>();
    // 历史消息按时间正序（旧→新），从最新一条向前收集
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (seen.has(msg.message_id)) continue;
        seen.add(msg.message_id);

        // 跳过机器人自身的历史消息
        const senderId = msg.sender?.user_id;
        if (senderId !== undefined && String(senderId) === selfId) continue;

        targetIds.push(msg.message_id);
        if (targetIds.length >= count) break;
    }
    return targetIds;
}

/**
 * 从 delete_msg 失败的 SenderError 中提取 retcode，返回简短标识（仅用于 debug 日志）。
 *
 * 撤回失败最常见原因是目标消息已被撤回，调用方会将其静默跳过，
 * 此处仅给出 retcode 便于排查，不做可能误导的具体归因。
 *
 * koishi-plugin-adapter-onebot 抛出的 SenderError 会把 retcode 同时挂在
 * `error.code` 与 `error.message` 文本中，两种来源都做兼容读取。
 */
function describeRecallError(error: unknown): string {
    const err = error as { code?: unknown; message?: string } | undefined;
    const code = typeof err?.code === 'number' ? err.code : undefined;

    let retcode = code;
    if (retcode === undefined && err?.message) {
        const match = err.message.match(/retcode[:\s]*(\d+)/i);
        if (match) retcode = Number(match[1]);
    }

    return retcode === undefined ? '未知错误' : `retcode ${retcode}`;
}

/** 清屏模式类型 */
type CleanMode = 'recall' | 'space' | 'both';

/**
 * 发送大量仅含空行的消息，将聊天记录「顶」出屏幕。
 * 逐条发送，间隔 200ms 避免触发频率限制。
 */
async function sendSpaceMessages(
    ctx: Context,
    session: Session,
    spaceCount: number,
    spaceLines: number
): Promise<number> {
    const content = '\n'.repeat(spaceLines);
    let sent = 0;
    for (let i = 0; i < spaceCount; i++) {
        try {
            await session.send(content);
            sent++;
        } catch (error) {
            ctx.logger('tools').debug(`发送空格消息 ${i + 1}/${spaceCount} 失败：`, error);
        }
        // 间隔 200ms，避免触发频率限制
        if (i < spaceCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }
    return sent;
}

/**
 * 校验平台/群聊环境，按指定模式清屏。
 * - recall：撤回最近 count 条消息（需群主）
 * - space：发送大量空行消息
 * - both：先撤回再发空格
 * 返回面向用户的结果文案。
 */
async function doCleanScreen(
    ctx: Context,
    session: Session,
    mode: CleanMode,
    count: number,
    spaceCount: number,
    spaceLines: number
): Promise<string> {
    if (session.platform !== 'onebot') return '该指令仅支持 OneBot 平台。';
    const groupId = session.guildId;
    if (!groupId) return '请在群聊中使用该指令。';

    const results: string[] = [];
    const needRecall = mode === 'recall' || mode === 'both';
    const needSpace = mode === 'space' || mode === 'both';

    // ── 撤回阶段 ──
    if (needRecall) {
        // 校验机器人为群主：只有群主能撤回群内他人消息
        let isOwner = false;
        try {
            const selfInfo = await session.bot.internal.getGroupMemberInfo(
                groupId,
                session.bot.selfId
            );
            isOwner = (selfInfo as { role?: string })?.role === 'owner';
        } catch (error) {
            ctx.logger('tools').error('查询机器人群成员信息失败：', error);
            return '无法获取机器人在本群的成员信息，请确认机器人在本群内。';
        }

        if (!isOwner) {
            results.push('撤回失败：机器人需为本群群主才能撤回他人消息。');
        } else {
            const targetIds = await collectRecentMessageIds(ctx, session, groupId, count);
            if (!targetIds.length) {
                results.push('没有可撤回的消息。');
            } else {
                let success = 0;
                let skipped = 0;
                for (const id of targetIds) {
                    try {
                        await session.bot.internal.deleteMsg(id);
                        success++;
                    } catch (error) {
                        ctx.logger('tools').debug(
                            `撤回 ${id} 失败（可能已撤回）：${describeRecallError(error)}`
                        );
                        skipped++;
                    }
                }
                if (skipped === 0) {
                    results.push(`已撤回 ${success} 条消息。`);
                } else {
                    results.push(
                        `已撤回 ${success} 条消息（另有 ${skipped} 条可能已撤回，已跳过）。`
                    );
                }
            }
        }
    }

    // ── 发空格阶段 ──
    if (needSpace) {
        const sent = await sendSpaceMessages(ctx, session, spaceCount, spaceLines);
        if (sent > 0) {
            results.push(`已发送 ${sent} 条空行消息。`);
        } else {
            results.push('发送空行消息失败。');
        }
    }

    return results.join(' ') || '清屏操作完成。';
}

export interface Config {
    /**
     * 使用「清屏」指令所需的最低用户权限等级。
     * Koishi 默认权限等级：0 未授权，1 普通用户，2 管理员，3 超管，4+ 自定义。
     * 清屏会撤回群内消息，影响较大，默认要求管理员（2）。
     * 实际能否撤回仍由「机器人是否群主」与 OneBot 侧校验决定。
     */
    minAuthority: number;
    /** 默认清屏模式：recall（撤回）/ space（发空格）/ both（混合）。 */
    mode: CleanMode;
    /** 不传参时撤回的消息条数。 */
    count: number;
    /** 单次清屏允许撤回的最大条数，防止滥用。 */
    maxCount: number;
    /** 发空格模式下一次发送的空行消息条数。 */
    spaceCount: number;
    /** 每条空行消息包含的换行数。 */
    spaceLines: number;
}

export const Config: Schema<Config> = Schema.object({
    minAuthority: Schema.number()
        .default(2)
        .min(0)
        .max(5)
        .step(1)
        .description('使用「清屏」指令所需的最低用户权限等级（0-5）。默认 2。'),
    mode: Schema.union(['recall', 'space', 'both'] as const)
        .default('recall')
        .description('默认清屏模式：recall（撤回）/ space（发空格）/ both（混合）。'),
    count: Schema.number()
        .default(20)
        .min(1)
        .max(500)
        .step(1)
        .description('不传参时撤回的消息条数。默认 20。'),
    maxCount: Schema.number()
        .default(50)
        .min(1)
        .max(1000)
        .step(1)
        .description('单次清屏允许撤回的最大条数，防止滥用。默认 50。'),
    spaceCount: Schema.number()
        .default(10)
        .min(1)
        .max(50)
        .step(1)
        .description('发空格模式下一次发送的空行消息条数。默认 10。'),
    spaceLines: Schema.number()
        .default(30)
        .min(5)
        .max(100)
        .step(1)
        .description('每条空行消息包含的换行数。默认 30。'),
});

export function apply(ctx: Context, config: Config) {
    const authority = config.minAuthority;

    /**
     * 解析用户输入的清屏类型字符串。
     * 支持中文/英文别名：
     * - 空格 / space
     * - 撤回 / recall
     * - 混合 / both
     * 无法识别时返回 undefined。
     */
    function resolveMode(raw: string | undefined): CleanMode | undefined {
        if (!raw) return undefined;
        const v = raw.trim().toLowerCase();
        if (v === '空格' || v === 'space') return 'space';
        if (v === '撤回' || v === 'recall') return 'recall';
        if (v === '混合' || v === 'both') return 'both';
        return undefined;
    }

    ctx.command(
        '清屏 <type:string> [count:number]',
        '撤回最近若干条消息或发送空行清屏（仅 OneBot，撤回需群主）',
        { authority }
    )
        .alias('cleanscreen')
        .usage('类型支持：空格(space)、撤回(recall)、混合(both)；不传数量则使用默认值')
        .example('清屏 空格       发空行消息顶屏')
        .example('清屏 撤回 30    撤回最近 30 条消息')
        .example('清屏 混合 20    先撤回 20 条再发空行')
        .action(async (argv, type, count) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';

            const mode = resolveMode(type) ?? config.mode;

            const requested =
                typeof count === 'number' && !Number.isNaN(count)
                    ? Math.floor(count)
                    : config.count;
            const clamped = Math.max(1, Math.min(requested, config.maxCount));

            return doCleanScreen(ctx, session, mode, clamped, config.spaceCount, config.spaceLines);
        });

    ctx.logger('tools').info('CleanScreen 插件已加载');
}
