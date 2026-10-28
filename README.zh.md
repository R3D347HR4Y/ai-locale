# ai-locale 翻译 CLI

一个使用 OpenAI API 验证和翻译本地化文件的命令行工具。支持多种文件格式，使用 `#locale` 占位符进行智能路径匹配。

## 🌍 多语言文档

- 🇺🇸 [English](README.md) (原始)
- 🇫🇷 [Français](README.fr.md)
- 🇪🇸 [Español](README.es.md)
- 🇨🇳 [中文](README.zh.md) (当前)

## 🎯 支持的文件格式

CLI 支持广泛的本地化文件格式：

### 📱 **iOS .strings 文件**

```strings
/* Localizable.strings */
"SAVE_BUTTON" = "保存";
"CANCEL_BUTTON" = "取消";
"ERROR_MESSAGE" = "发生错误：{error}";
```

### 📄 **Android XML 字符串**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="save_button">保存</string>
    <string name="cancel_button">取消</string>
    <string name="error_message">发生错误：%1$s</string>
</resources>
```

### 📦 **JSON 文件**

```json
{
  "save_button": "保存",
  "cancel_button": "取消",
  "error_message": "发生错误：{error}"
}
```

### 🔧 **TypeScript/JavaScript 导出对象**

```typescript
export default {
  save_button: "保存",
  cancel_button: "取消",
  error_message: "发生错误：{error}",
} as const;
```

## 🗂️ 使用 `#locale` 进行路径匹配

CLI 使用 `#locale` 占位符进行智能文件发现和语言检测：

### **`#locale` 工作原理**

`#locale` 占位符会自动替换为从文件结构中检测到的语言代码：

```bash
# 模式：locales/#locale/messages.json
# 匹配：locales/en/messages.json, locales/fr/messages.json, locales/es/messages.json
# 检测到的语言：en, fr, es

ai-locale translate 'locales/#locale/messages.json'
```

### **常用 `#locale` 模式**

```bash
# iOS/Android 结构
'locales/#locale/Localizable.strings'
'locales/#locale/strings.xml'

# JSON 结构
'locales/#locale/messages.json'
'i18n/#locale/translations.json'

# TypeScript 结构
'src/locales/#locale/index.ts'
'locales/#locale/translation.ts'

# 混合格式
'locales/#locale/strings.xml'
'locales/#locale/messages.json'
```

### **语言检测**

CLI 自动从以下位置检测语言：

- **目录名称**：`locales/en/`, `locales/fr/`
- **文件名称**：`en.json`, `fr.json`, `en.ts`
- **文件路径**：`locales/en/messages.json`

## 功能特性

- ✅ **多格式支持**：处理 iOS `.strings`、Android XML、JSON 和 TypeScript/JavaScript 文件
- ✅ **智能路径匹配**：使用 `#locale` 占位符进行智能文件发现
- ✅ **缺失键检测**：自动识别语言文件中缺失的翻译
- ✅ **AI 驱动翻译**：使用 OpenAI 的 GPT-4o-mini 进行高质量翻译
- ✅ **成本优化**：并行批处理翻译，提供成本估算
- ✅ **上下文感知**：使用所有现有翻译作为上下文，确保最大准确性
- ✅ **交互式 CLI**：美观的终端界面，带有进度指示器
- ✅ **备份支持**：翻译前自动创建备份文件
- ✅ **试运行模式**：预览翻译而不进行实际更改
- ✅ **批处理控制**：可配置的批处理大小和延迟，用于速率限制管理

## 安装

### 全局安装

```bash
npm install -g ai-locale-cli
```

### 本地安装

```bash
git clone <repository-url>
cd iara-worldwide
npm install
```

## 快速开始

### 1. 设置 API 密钥

在项目根目录创建 `.env` 文件：

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

或使用 `--api-key` 选项：

```bash
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key
```

### 2. 翻译文件

```bash
# 使用 #locale 模式（推荐）
ai-locale translate "locales/#locale/messages.json" --source en

# 明确指定目标语言
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de

# 使用传统 glob 模式
ai-locale translate "translations/**/*.strings" --source en --target fr,es

# 试运行查看将要翻译的内容
ai-locale translate "locales/#locale/messages.json" --dry-run
```

### 3. 验证文件

```bash
# 使用 #locale 模式检查缺失的翻译
ai-locale validate "locales/#locale/messages.json" --source en

# 传统 glob 模式
ai-locale validate "translations/**/*.strings" --source en
```

### 4. 查看统计信息

```bash
# 显示翻译完整性统计信息
ai-locale stats "locales/#locale/messages.json"

# 传统 glob 模式
ai-locale stats "translations/**/*.strings"
```

## CLI 命令

### `translate` - 翻译缺失的键

翻译本地化文件中缺失的键。

```bash
ai-locale translate <pattern> [options]
```

**参数：**

- `pattern` - 文件模式（例如 `locales/#locale/messages.json`, `translations/**/*.strings`）

**选项：**

- `-k, --api-key <key>` - OpenAI API 密钥（或设置 OPENAI_API_KEY 环境变量）
- `-s, --source <lang>` - 源语言代码（默认："en"）
- `-t, --target <langs>` - 逗号分隔的目标语言（如果未提供则自动检测）
- `-o, --output <dir>` - 输出目录（默认：覆盖原始文件）
- `-c, --context <text>` - 提供给翻译模型的应用简介（默认为空）
- `--dry-run` - 显示将要翻译的内容而不进行更改
- `--verbose` - 显示详细输出
- `--no-backup` - 不创建备份文件
- `--yes` - 跳过确认提示
- `--batch-size <size>` - 并行处理的翻译数量（默认：5）
- `--batch-delay <ms>` - 批次间延迟（毫秒）（默认：1000）

**示例：**

```bash
# 使用 #locale 模式的基本翻译
ai-locale translate "locales/#locale/messages.json"

# 指定源语言和目标语言
ai-locale translate "locales/#locale/strings.xml" --source en --target fr,es,de,it

# 试运行预览
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose

# 保存到不同目录
ai-locale translate "locales/#locale/messages.json" --output ./translated/

# 使用特定 API 密钥
ai-locale translate "locales/#locale/messages.json" --api-key sk-your-key

# 控制批处理
ai-locale translate "locales/#locale/messages.json" --batch-size 3 --batch-delay 2000
```

### `validate` - 验证翻译文件

检查翻译文件中缺失的键和一致性问题。

```bash
ai-locale validate <pattern> [options]
```

**参数：**

- `pattern` - 要验证的文件模式

**选项：**

- `-s, --source <lang>` - 源语言代码（默认："en"）

**示例：**

```bash
# 使用 #locale 模式验证所有翻译文件
ai-locale validate "locales/#locale/messages.json"

# 使用特定源语言验证
ai-locale validate "locales/#locale/strings.xml" --source en

# 传统 glob 模式
ai-locale validate "translations/**/*.strings" --source en
```

### `stats` - 显示翻译统计信息

显示翻译文件的完整统计信息。

```bash
ai-locale stats <pattern>
```

**参数：**

- `pattern` - 要分析的文件模式

**示例：**

```bash
# 使用 #locale 模式显示所有文件的统计信息
ai-locale stats "locales/#locale/messages.json"

# 显示特定模式的统计信息
ai-locale stats "locales/#locale/strings.xml"

# 传统 glob 模式
ai-locale stats "translations/**/*.strings"
```

### `purge` - 删除过时的键

删除源语言文件中不存在的键。

```bash
ai-locale purge <pattern> [options]
```

**参数：**

- `pattern` - 要清理的文件模式

**选项：**

- `-s, --source <lang>` - 源语言代码（默认："en"）
- `--dry-run` - 显示将要清理的内容而不进行更改
- `--verbose` - 显示详细输出
- `--no-backup` - 不创建备份文件

**示例：**

```bash
# 使用 #locale 模式删除英语中不存在的键
ai-locale purge "locales/#locale/messages.json" --source en

# 试运行预览将要清理的内容
ai-locale purge "locales/#locale/strings.xml" --dry-run --verbose

# 使用法语作为源语言清理
ai-locale purge "locales/#locale/messages.json" --source fr

# 传统 glob 模式
ai-locale purge "translations/**/*.strings" --source en
```

## Glob 模式示例

CLI 支持强大的 glob 模式进行文件发现：

```bash
# locales 目录中的所有翻译文件
"locales/#locale/messages.json"

# 递归的所有 .strings 文件
"translations/**/*.strings"

# 特定语言文件
"src/locales/en.ts"
"src/locales/fr.ts"

# 多个模式
"locales/#locale/messages.json" "src/i18n/#locale/translations.json"

# 特定命名约定的文件
"**/i18n/#locale/*.ts"
"**/locales/#locale/*.strings"

# 混合格式与 #locale
"locales/#locale/strings.xml"
"locales/#locale/messages.json"
```

## 支持的语言

该工具支持 20+ 种语言，包括：

- 英语 (en)
- 法语 (fr)
- 西班牙语 (es)
- 德语 (de)
- 意大利语 (it)
- 葡萄牙语 (pt)
- 荷兰语 (nl)
- 瑞典语 (sv)
- 丹麦语 (da)
- 挪威语 (no)
- 芬兰语 (fi)
- 波兰语 (pl)
- 俄语 (ru)
- 日语 (ja)
- 韩语 (ko)
- 中文 (zh)
- 阿拉伯语 (ar)
- 印地语 (hi)
- 土耳其语 (tr)
- 泰语 (th)

## 翻译上下文和准确性

CLI 为 OpenAI 提供最大上下文以获得最准确的翻译：

### **智能上下文检测**

- **所有现有翻译**：如果键在英语和法语中存在，两者都包含在提示中
- **源语言优先级**：使用指定的源语言作为主要参考
- **完整上下文**：为每个键提供所有可用的翻译以确保一致性

### **翻译上下文示例**

```
键："common.save"
现有翻译：
- en: "Save"
- fr: "Enregistrer"
- es: "Guardar"

缺失于：de, it

AI 接收："将 'Save' 翻译成德语和意大利语，考虑法语和西班牙语中的现有翻译作为上下文"
```

## 成本优化

CLI 针对成本和速度进行了优化：

- **并行处理**：使用 `Promise.all` 同时翻译多个键
- **可配置批处理**：使用 `--batch-size` 和 `--batch-delay` 选项控制批处理大小和延迟
- **成本估算**：处理前显示估算成本
- **高效模型**：使用 GPT-4o-mini 获得最佳成本/质量比
- **上下文优化**：使用所有现有翻译作为上下文以获得最大准确性
- **速率限制管理**：内置延迟和批处理以遵守 API 限制

### 批处理控制示例

```bash
# 保守方法（较小的批次，较长的延迟）
ai-locale translate "locales/#locale/messages.json" --batch-size 2 --batch-delay 2000

# 激进方法（较大的批次，较短的延迟）
ai-locale translate "locales/#locale/messages.json" --batch-size 10 --batch-delay 500

# 默认设置（平衡）
ai-locale translate "locales/#locale/messages.json" --batch-size 5 --batch-delay 1000
```

### 成本估算示例

对于 3 种语言的 100 个缺失键：

- 估算成本：约 $0.15 USD
- 处理时间：约 2-3 分钟
- 使用的令牌：约 25,000 输入 + 5,000 输出

## 开发

### 本地开发

```bash
# 安装依赖
npm install

# 本地运行 CLI
node src/cli.js translate "examples/*.ts"

# 带自动重载的开发
npm run dev translate "examples/*.ts"

# 运行测试
npm test
```

### 构建可执行文件

```bash
# 构建独立可执行文件
npm run build

# 可执行文件将在 dist/ 目录中
./dist/ai-locale-cli translate "locales/#locale/messages.json"
```

### 环境变量

| 变量             | 描述            | 默认值      |
| ---------------- | --------------- | ----------- |
| `OPENAI_API_KEY` | OpenAI API 密钥 | 必需        |
| `NODE_ENV`       | 环境            | development |

### 项目结构

```
src/
├── cli.js                    # 主 CLI 入口点
├── services/
│   ├── openaiService.js      # OpenAI 集成
│   └── translationService.js # 翻译逻辑
└── utils/
    ├── fileParser.js         # 文件解析工具
    └── validation.js         # 请求验证
```

## 使用示例

### 示例 1：基本翻译

```bash
# 项目结构：
# locales/
#   ├── en/
#   │   └── messages.json
#   ├── fr/
#   │   └── messages.json (缺少一些键)
#   └── es/
#       └── messages.json (缺少一些键)

ai-locale translate "locales/#locale/messages.json" --source en
```

### 示例 2：iOS Strings 文件

```bash
# 项目结构：
# translations/
#   ├── en/
#   │   └── Localizable.strings
#   ├── fr/
#   │   └── Localizable.strings
#   └── es/
#       └── Localizable.strings

ai-locale translate "translations/#locale/Localizable.strings" --source en
```

### 示例 3：Android XML 文件

```bash
# 项目结构：
# locales/
#   ├── en/
#   │   └── strings.xml
#   ├── fr/
#   │   └── strings.xml
#   └── es/
#       └── strings.xml

ai-locale translate "locales/#locale/strings.xml" --source en
```

### 示例 4：GNU gettext .po 文件

```bash
# 项目结构：
# locale/
#   ├── en/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   ├── fr/
#   │   └── LC_MESSAGES/
#   │       └── messages.po
#   └── es/
#       └── LC_MESSAGES/
#           └── messages.po

ai-locale translate "locale/#locale/LC_MESSAGES/messages.po" --source en
```

### 示例 5：验证和统计信息

```bash
# 检查缺失的内容
ai-locale validate "locales/#locale/messages.json" --source en

# 显示统计信息
ai-locale stats "locales/#locale/messages.json"

# 预览翻译（试运行）
ai-locale translate "locales/#locale/messages.json" --dry-run --verbose
```

### 示例 6：清理过时的键

```bash
# 删除英语中不存在的键
ai-locale purge "locales/#locale/messages.json" --source en

# 预览将要清理的内容
ai-locale purge "translations/#locale/Localizable.strings" --dry-run --verbose

# 使用法语作为源语言清理
ai-locale purge "locales/#locale/messages.json" --source fr
```

## 错误处理

CLI 提供全面的错误处理：

- **文件未找到**：为无效模式提供清晰的错误消息
- **API 错误**：优雅处理 OpenAI API 失败
- **解析错误**：为文件问题提供详细的错误信息
- **验证错误**：为无效请求提供清晰的消息

## 故障排除

### 常见问题

1. **OpenAI API 密钥无效**

   ```
   错误：需要 OpenAI API 密钥
   ```

   解决方案：设置 `OPENAI_API_KEY` 环境变量或使用 `--api-key` 选项

2. **未找到文件**

   ```
   错误：未找到匹配模式的翻译文件
   ```

   解决方案：检查 glob 模式和文件结构

3. **文件解析错误**

   ```
   错误：解析文件 en.ts 失败
   ```

   解决方案：检查文件格式和语法

4. **权限错误**

   ```
   错误：EACCES：权限被拒绝
   ```

   解决方案：检查文件权限或使用适当的权限运行

### 调试模式

启用详细输出进行调试：

```bash
ai-locale translate "locales/#locale/messages.json" --verbose
```

## 贡献

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 添加测试
5. 提交拉取请求

## 许可证

MIT 许可证 - 查看 LICENSE 文件了解详情。

## 支持

对于问题和疑问：

1. 查看故障排除部分
2. 检查日志
3. 创建包含详细信息的 issue
4. 包含文件示例和错误消息
