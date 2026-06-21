import type { Context, Session, Tables } from 'koishi';
import { getTableNames } from './checktable';
import type { Config } from './types';

type PendingDelete = {
    table: string;
    step: number;
    expiresAt: number;
    timer?: ReturnType<typeof setTimeout>;
};

const t = (session: Session | undefined, key: string, params?: unknown[]) => {
    return session?.text(key, params) ?? '';
};

export function deltable(ctx: Context, config: Config) {
    const pendingMap: Record<string, PendingDelete> = {};
    const timeoutMs = config.confirmWaitingTime * 1000;
    const requiredSteps = config.confirmMode === 'three-step' ? 3 : 2;

    const clearPending = (userId: string) => {
        const pending = pendingMap[userId];
        if (pending?.timer) clearTimeout(pending.timer);
        delete pendingMap[userId];
    };

    const scheduleExpireNotice = (
        userId: string,
        target: string,
        expiresAt: number,
        notify: (message: string) => void,
        session: Session
    ) => {
        const pending = pendingMap[userId];
        if (!pending) return;
        if (pending.timer) clearTimeout(pending.timer);

        pending.timer = setTimeout(() => {
            if (pendingMap[userId]?.expiresAt === expiresAt) {
                clearPending(userId);
                notify(t(session, 'commands.删除表.messages.timeout', [target]));
            }
        }, timeoutMs);
    };

    const buildConfirmMessage = (session: Session, target: string, currentStep: number) => {
        const remain = requiredSteps - currentStep;
        return t(session, 'commands.删除表.messages.confirm', [
            target,
            currentStep,
            requiredSteps,
            config.confirmWaitingTime,
            remain,
        ]);
    };

    ctx.command('删除表 [target:string]', { authority: 4 }).action(async ({ session }, target) => {
        try {
            if (!session?.userId)
                return t(session, 'commands.删除表.messages.noUser') || '无法获取用户信息';
            if (!target)
                return t(session, 'commands.删除表.messages.noTarget') || '请输入要删除的表名';

            const userId = session.userId;
            const input = target.trim();
            const tableNames = getTableNames(ctx);
            const notifyTimeout = (message: string) => {
                session.send(message).catch((err) => console.warn('发送超时通知失败：', err));
            };

            if (!tableNames.includes(input)) {
                return t(session, 'commands.删除表.messages.tableNotFound', [
                    input,
                    tableNames.join(', '),
                ]);
            }

            const now = Date.now();
            const existing = pendingMap[userId];
            const isValidExisting =
                !!existing && existing.expiresAt > now && existing.table === input;

            if (!isValidExisting) {
                clearPending(userId);
                const expiresAt = now + timeoutMs;
                pendingMap[userId] = { table: input, step: 1, expiresAt };
                scheduleExpireNotice(userId, input, expiresAt, notifyTimeout, session);
                return buildConfirmMessage(session, input, 1);
            }

            const nextStep = existing.step + 1;

            if (nextStep >= requiredSteps) {
                clearPending(userId);
                const table = input as keyof Tables;
                await ctx.database.drop(table);
                console.log(`用户 ${userId} 已重置表 ${input} 数据`);
                return t(session, 'commands.删除表.messages.success', [input]);
            }

            existing.step = nextStep;
            existing.expiresAt = now + timeoutMs;
            scheduleExpireNotice(userId, input, existing.expiresAt, notifyTimeout, session);

            return buildConfirmMessage(session, input, nextStep);
        } catch (error) {
            return (error as Error).message;
        }
    });
}
