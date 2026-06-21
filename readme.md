# koishi-plugin-toolbox

Koishi 工具箱插件集合，单仓多包管理。

## 子包列表

| 包名 | 路径 | 说明 |
|------|------|------|
| koishi-plugin-toolbox-hello | packages/hello | 示例插件 |

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有子包
pnpm build

# 创建变更记录
pnpm changeset

# 发布
pnpm release
```

## 添加新子包

```bash
# 1. 在 packages/ 下创建新目录
mkdir packages/my-tool

# 2. 参照 packages/hello/ 的结构创建 package.json 和 tsconfig.json

# 3. 在根 tsconfig.json 的 references 中添加新包引用
```
