import { type Context, Schema } from 'koishi';
import type {} from 'koishi-plugin-cron-fix';
import 'koishi-plugin-adapter-onebot';

export const name = 'group-levelup';

export const usage = `

▶ 你可以在插件上方使用过滤器来指定哪些机器人在哪些群组启用此插件。

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📖 使用说明</h2>
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
    /** 需要签到的群号列表，留空则对所有已加入的群进行签到 */
    groups: string[];
    /** 定时签到的 Cron 表达式，默认为每日 0 点 */
    cronTime: string;
}

export const Config: Schema<Config> = Schema.object({
    groups: Schema.array(Schema.string())
        .default([])
        .description('需要签到的群号列表，留空则对所有已加入的群进行签到'),
    cronTime: Schema.string()
        .default('0 0 * * *')
        .description('定时签到的 Cron 表达式，默认为每日 0 点'),
});

export const inject = {
    required: ['cron'],
};

export function apply(ctx: Context, config: Config) {
    ctx.cron(config.cronTime, async () => {
        const bots = ctx.bots;
        for (const bot of bots) {
            // 仅 OneBot/NapCat 平台支持群签到
            if (bot.platform !== 'onebot') continue;

            try {
                const guildList = await bot.getGuildList();
                const configured = new Set(config.groups);

                for (const guild of guildList.data) {
                    const groupId = guild.id;

                    // 如果配置了指定群号，则只签到配置的群
                    if (config.groups.length > 0 && !configured.has(groupId)) {
                        continue;
                    }

                    try {
                        const response = await bot.internal._request?.('send_group_sign', {
                            group_id: Number(groupId),
                        });

                        if (response?.retcode === 0) {
                            ctx.logger('group-levelup').info(
                                `群 ${groupId}(${guild.name}) 签到成功`
                            );
                        } else {
                            ctx.logger('group-levelup').warn(
                                `群 ${groupId}(${guild.name}) 签到失败: retcode=${response?.retcode ?? 'unknown'}`
                            );
                        }
                    } catch (e) {
                        ctx.logger('group-levelup').warn(
                            `群 ${groupId}(${guild.name}) 签到异常: ${e}`
                        );
                    }
                }
            } catch (e) {
                ctx.logger('group-levelup').error(`获取群列表失败: ${e}`);
            }
        }
    });
}
