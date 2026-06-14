# 温室营养液配方管理

作物生长期配方、历史版本与复制调整闭环

## 环境要求

- Node.js `^20.19.0 || >=22.12.0`
- npm

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

默认端口：**61302**（已在配置中锁定，避免端口冲突）

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 61302） |
| `npm start` | 同 `npm run dev`，兼容通用启动习惯 |
| `npm run build` | TypeScript 类型检查 + Vite 生产构建 |
| `npm run build:only` | 仅运行 Vite 构建，跳过类型检查 |
| `npm run preview` | 本地预览生产构建产物（端口 61302） |
| `npm run typecheck` | 仅运行 TypeScript 类型检查，不生成产物 |
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm run lint:fix` | 运行 ESLint 并自动修复可修复的问题 |
| `npm run test` | 运行 Vitest 单元测试（单次执行） |
| `npm run test:watch` | 运行 Vitest 单元测试（监听模式） |
| `npm run test:coverage` | 运行单元测试并生成覆盖率报告 |
| `npm run ci` | 一键运行完整质量门禁：lint → typecheck → test → build |

## 工程质量门禁

本地和 GitHub Actions 执行一致的质量检查流程：

```
ESLint → TypeScript → 单元测试 → 生产构建
```

### 本地执行完整门禁

```bash
npm run ci
```

### CI/CD

项目已配置 GitHub Actions，在 `push` 和 `pull_request` 事件时自动执行质量门禁。

工作流文件：[.github/workflows/ci.yml](.github/workflows/ci.yml)

CI 特性：
- npm 依赖缓存（基于 package-lock.json hash）
- 每步骤独立输出分组，失败时日志清晰可读
- 最终步骤汇总所有检查项通过状态
- 构建产物存在性校验

## 核心数据模块与测试覆盖

测试文件位于 `tests/` 目录，覆盖三大核心数据模块：

| 模块 | 测试文件 | 覆盖内容 |
|------|----------|----------|
| [dataImportExport.js](src/dataImportExport.js) | [dataImportExport.test.js](tests/dataImportExport.test.js) | 导入导出格式验证、ID 重映射、多模式合并 |
| [greenhouseManager.js](src/greenhouseManager.js) | [greenhouseManager.test.js](tests/greenhouseManager.test.js) | 版本号分配、跨温室配方复制 |
| [recipeTemplates.js](src/recipeTemplates.js) | [recipeTemplates.test.js](tests/recipeTemplates.test.js) | 内置模板完整性、自定义模板 CRUD、作物选项聚合 |

运行测试并查看覆盖率：

```bash
npm run test:coverage
```

## 稳定性保证

以下关键标识已锁定，工程化改动不会影响：

- **服务端口**：开发/预览均为 `61302`（`vite.config.js` 中 `strictPort: true`）
- **本地存储键**：
  - `hxwl-61302-multi-greenhouse` — 多温室数据
  - `hxwl-61302-custom-recipe-templates` — 自定义配方模板
  - `hxwl-61302-greenhouse-nutrient` 等 legacy 键（用于迁移）
- **导入导出文件格式**：`formatVersion: 3.0`，向后兼容 `2.0` / `3.0`

## 最小闭环

- 新增、筛选、删除业务记录
- 本地存储保存数据
- 状态流转和详情查看
- 场景化统计与分组视图
