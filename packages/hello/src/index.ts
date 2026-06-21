import { Context, Schema } from 'koishi'

export const name = 'toolbox-hello'

export interface Config {
    message: string
}

export const Config: Schema<Config> = Schema.object({
    message: Schema.string()
        .default('Hello from toolbox!')
        .description('要发送的问候消息'),
})

export function apply(ctx: Context, config: Config) {
    ctx.command('hello', '打招呼')
        .action(() => {
            return config.message
        })
}
