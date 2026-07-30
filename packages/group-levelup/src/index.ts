import { type Context, Schema } from 'koishi';
import type {} from 'koishi-plugin-cron-fix';
import 'koishi-plugin-adapter-onebot';

export const name = 'group-levelup';

export const usage = `

▶ 你可以在插件上方使用过滤器来指定哪些机器人在哪些群组启用此插件。

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
  <p>🗑️ 本插件仅支持Onebot平台</p>
  <p>🗑️ 本插件通过群打卡和冒泡、续火来快速升级群等级</p>
  <p>⚠️ 可能会被群管理 <strong>制裁</strong> ，谨慎使用！</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">💬 交流与反馈</h2>
  <p>🌟 喜欢这个插件？欢迎加入 QQ 群 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;"><strong>1071284605</strong></a>【晓基地插件工坊】进行交流</p>
  <p>🐛 遇到问题？欢迎在群内反馈，或点击 <a href="https://qm.qq.com/q/WngX4RQoca" style="color:#4a6ee0;text-decoration:none;">此链接</a> 加入群聊</p>
</div>
`;

export interface Config {
    /** 是否启用每日群打卡签到 */
    signIn: boolean;
    /** 群打卡的 Cron 表达式 */
    signInCron?: string;
    /** 是否启用每日随机冒泡 */
    bubble: boolean;
    /** 每日冒泡次数 */
    bubbleCount?: number;
    /** 冒泡文本列表，每次随机选择一条 */
    bubbleTexts?: string[];
}

export const Config: Schema<Config> = Schema.intersect([
    // 群打卡配置块
    Schema.intersect([
        Schema.object({
            signIn: Schema.boolean().default(true).description('是否启用每日群打卡签到'),
        }).description('群打卡'),
        Schema.union([
            Schema.object({
                signIn: Schema.const(true).required(),
                signInCron: Schema.string()
                    .default('0 0 * * *')
                    .required()
                    .description('群打卡的 Cron 表达式，默认为每日 0 点'),
            }),
            Schema.object({}),
        ]),
    ]),
    // 随机冒泡配置块
    Schema.intersect([
        Schema.object({
            bubble: Schema.boolean().default(true).description('是否启用每日随机冒泡'),
        }).description('随机冒泡'),
        Schema.union([
            Schema.object({
                bubble: Schema.const(true).required(),
                bubbleCount: Schema.number()
                    .default(1)
                    .min(1)
                    .step(1)
                    .required()
                    .description('每日冒泡次数 (1-10)'),
                bubbleTexts: Schema.array(Schema.string())
                    .default(['冒泡'])
                    .description('冒泡文本列表，每次随机选择一条发送'),
            }),
            Schema.object({}),
        ]),
    ]),
]);

export const inject = {
    required: ['cron'],
};

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function scheduleBubble(ctx: Context, config: Config, logger: ReturnType<typeof ctx.logger>) {
    const count = config.bubbleCount ?? 1;
    const dayMs = 24 * 60 * 60 * 1000;
    // 将一天分成 count 段，每段内随机取一个时间点
    const segmentMs = dayMs / count;

    for (let i = 0; i < count; i++) {
        const base = i * segmentMs;
        const randomOffset = Math.random() * segmentMs;
        const delay = base + randomOffset;

        ctx.setTimeout(async () => {
            if (!config.bubble) return;

            const texts = config.bubbleTexts ?? ['冒泡'];
            const text = pickRandom(texts);
            const bots = ctx.bots;

            for (const bot of bots) {
                if (bot.platform !== 'onebot') continue;

                try {
                    const guildList = await bot.getGuildList();
                    for (const guild of guildList.data) {
                        try {
                            await bot.sendMessage(guild.id, text);
                            logger.info(`群 ${guild.id}(${guild.name}) 冒泡: ${text}`);
                        } catch (e) {
                            logger.warn(`群 ${guild.id}(${guild.name}) 冒泡异常: ${e}`);
                        }
                    }
                } catch (e) {
                    logger.error(`获取群列表失败: ${e}`);
                }
            }
        }, delay);
    }

    // 下一天的这一时刻重新安排
    ctx.setTimeout(() => {
        scheduleBubble(ctx, config, logger);
    }, dayMs);
}

export function apply(ctx: Context, config: Config) {
    const logger = ctx.logger('group-levelup');

    // 群打卡
    if (config.signIn) {
        ctx.cron(config.signInCron ?? '0 0 * * *', async () => {
            const bots = ctx.bots;
            for (const bot of bots) {
                if (bot.platform !== 'onebot') continue;

                try {
                    const guildList = await bot.getGuildList();

                    for (const guild of guildList.data) {
                        const groupId = guild.id;

                        try {
                            const response = await bot.internal._request?.('send_group_sign', {
                                group_id: Number(groupId),
                            });

                            if (response?.retcode === 0) {
                                logger.info(`群 ${groupId}(${guild.name}) 签到成功`);
                            } else {
                                logger.warn(
                                    `群 ${groupId}(${guild.name}) 签到失败: retcode=${response?.retcode ?? 'unknown'}`
                                );
                            }
                        } catch (e) {
                            logger.warn(`群 ${groupId}(${guild.name}) 签到异常: ${e}`);
                        }
                    }
                } catch (e) {
                    logger.error(`获取群列表失败: ${e}`);
                }
            }
        });
    }

    // 每日随机冒泡
    if (config.bubble) {
        scheduleBubble(ctx, config, logger);
    }
}
