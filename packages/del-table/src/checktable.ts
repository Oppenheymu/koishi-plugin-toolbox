import type { Context } from 'koishi';

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function getTableNames(ctx: Context): string[] {
    const model = ctx.model as unknown as {
        tables?: Record<string, unknown>;
        config?: Record<string, unknown> & { tables?: Record<string, unknown> };
    };

    const sources: unknown[] = [model.tables, model.config?.tables, model.config];

    for (const source of sources) {
        if (!isRecord(source)) continue;
        const keys = Object.keys(source);
        if (keys.length) return keys;
    }

    return [];
}

export function checkTable(ctx: Context) {
    ctx.command('检查表')
        .alias('查看表')
        .action(async ({ session }) => {
            try {
                const tableNames = getTableNames(ctx);
                if (tableNames.length) {
                    return (
                        session?.text('commands.检查表.messages.current', [
                            tableNames.join(', '),
                        ]) ?? `当前表：${tableNames.join(', ')}`
                    );
                }
                return session?.text('commands.检查表.messages.empty') ?? '当前没有已注册表。';
            } catch (error) {
                return (error as Error).message;
            }
        });
}
