import { type Context, Schema, type Session } from 'koishi';
import 'koishi-plugin-adapter-onebot';

export const name = 'clean-screen';

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>✨ 极致精简，开箱即用，零配置</p>
  <p>🎯 在群聊中撤回最近的若干条消息，达到「清屏」效果</p>
  <p>⚠️ 仅适用于 <strong>OneBot</strong> 平台，机器人需为 <strong>群主</strong> 才能撤回他人消息</p>
  <p>⏳ 受 QQ 限制，超过 <strong>2 分钟</strong> 的消息无法撤回</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">⚡ 命令</h2>
  <ul>
    <li><code>清屏</code> — 撤回最近 <code>count</code> 条消息（默认 20）</li>
    <li><code>清屏 &lt;条数&gt;</code> — 撤回指定条数的最近消息（受 <code>maxCount</code> 限制）</li>
    <li><code>clear</code> — 同上（英文别名）</li>
    <li><code>clear &lt;条数&gt;</code> — 同上（英文别名）</li>
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
 * 翻页收集本群最近 count 条消息的 message_id（按时间从新到旧）。
 *
 * OneBot 的 getGroupMsgHistory 一次只返回有限条数（napcat 通常 20 条），
 * 因此以「本批最旧消息的 message_seq」作为下一次查询的游标向前翻页，
 * 直到收够 count 条、没有更早消息、或翻页次数达到上限为止。
 *
 * 用 message_id 去重防止翻页边界重复，并跳过机器人自身发送的消息。
 */
async function collectRecentMessageIds(
    ctx: Context,
    session: Session,
    groupId: string,
    count: number
): Promise<number[]> {
    const selfId = session.bot.selfId;
    const targetIds: number[] = [];
    const seen = new Set<number>();
    let seq: number | undefined;
    const MAX_PAGES = 20; // 翻页保护，避免异常情况下无限循环

    for (let page = 0; page < MAX_PAGES && targetIds.length < count; page++) {
        let messages: {
            message_id: number;
            message_seq: number;
            sender?: { user_id?: number };
        }[];
        try {
            const res = await session.bot.internal.getGroupMsgHistory(groupId, seq);
            messages = (res?.messages ?? []) as typeof messages;
        } catch (error) {
            ctx.logger('tools').error('获取群历史消息失败：', error);
            break;
        }
        if (!messages.length) break;

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

        // 用本批最旧消息的 seq 继续向前翻页；seq 未变说明没有更早消息了
        const oldestSeq = messages[0].message_seq;
        if (oldestSeq === seq) break;
        seq = oldestSeq;
    }

    return targetIds;
}

/**
 * 校验平台/群聊环境、机器人是否群主，并撤回最近 count 条消息。
 * 返回面向用户的结果文案。
 */
async function doCleanScreen(ctx: Context, session: Session, count: number): Promise<string> {
    if (session.platform !== 'onebot') return '该指令仅支持 OneBot 平台。';
    const groupId = session.guildId;
    if (!groupId) return '请在群聊中使用该指令。';

    // 校验机器人为群主：只有群主能撤回群内他人消息
    try {
        const selfInfo = await session.bot.internal.getGroupMemberInfo(groupId, session.bot.selfId);
        if ((selfInfo as { role?: string })?.role !== 'owner') {
            return '清屏失败：机器人需为本群群主才能撤回他人消息。';
        }
    } catch (error) {
        ctx.logger('tools').error('查询机器人群成员信息失败：', error);
        return '无法获取机器人在本群的成员信息，请确认机器人在本群内。';
    }

    const targetIds = await collectRecentMessageIds(ctx, session, groupId, count);
    if (!targetIds.length) {
        return '没有可撤回的消息。';
    }

    // 逐条撤回，单条失败（如超过 2 分钟）不中断后续，统计成功数
    let success = 0;
    for (const id of targetIds) {
        try {
            await session.bot.internal.deleteMsg(id);
            success++;
        } catch (error) {
            ctx.logger('tools').warn(`撤回消息 ${id} 失败：`, error);
        }
    }

    return success === targetIds.length
        ? `已清屏：撤回 ${success} 条消息。`
        : `已撤回 ${success}/${targetIds.length} 条消息（部分消息可能超过 2 分钟无法撤回）。`;
}

export interface Config {
    /**
     * 使用「清屏」指令所需的最低用户权限等级。
     * Koishi 默认权限等级：0 未授权，1 普通用户，2 管理员，3 超管，4+ 自定义。
     * 清屏会撤回群内消息，影响较大，默认要求管理员（2）。
     * 实际能否撤回仍由「机器人是否群主」与 OneBot 侧校验决定。
     */
    minAuthority: number;
    /** 不传参时撤回的消息条数。 */
    count: number;
    /** 单次清屏允许撤回的最大条数，防止滥用。 */
    maxCount: number;
}

export const Config: Schema<Config> = Schema.object({
    minAuthority: Schema.number()
        .default(2)
        .min(0)
        .max(5)
        .step(1)
        .description('使用「清屏」指令所需的最低用户权限等级（0-5）。默认 2。'),
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
});

export function apply(ctx: Context, config: Config) {
    const authority = config.minAuthority;

    ctx.command('清屏 [count:number]', '撤回最近若干条消息（仅 OneBot，需群主）', { authority })
        .alias('clear')
        .action(async (argv, count) => {
            const { session } = argv;
            if (!session) return '无法获取会话信息。';

            const requested =
                typeof count === 'number' && !Number.isNaN(count)
                    ? Math.floor(count)
                    : config.count;
            const clamped = Math.max(1, Math.min(requested, config.maxCount));
            return doCleanScreen(ctx, session, clamped);
        });

    ctx.logger('tools').info('CleanScreen 插件已加载');
}
