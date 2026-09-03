# Chrome Tabs

在 Alfred 中快速搜索和管理 Google Chrome 标签页、标签组与浏览历史。

[English](README.md) · **简体中文**

## 使用方法

### 同时搜索标签页、标签组和历史

输入 `c0` 列出已打开的标签页和标签组。继续输入关键词后，会同时匹配这三类来源，历史记录只在有关键词时出现。结果副标题用 `Tab`、`Group`、`History` 区分类型。前缀 `t:` / `g:` / `h:`（或 `tab:` / `group:` / `history:`）可以只搜一类。

回车聚焦标签页或标签组，或打开历史页面。`c2` 的标签组组合键在 `c0` 里同样有效。

需要固定只搜一类时，仍可使用 `c1`、`c2`、`c3`。

### 搜索 Chrome 标签页

输入 `c1` 列出全部已打开的 Chrome 标签页，继续输入标题或网址即可过滤，按回车聚焦所选标签页。

![使用 c1 搜索 Chrome 标签页](docs/images/c1-tabs.png)

### 管理 Chrome 标签组

输入 `c2` 列出 Chrome 标签组。已有标签组始终排列在管理指令之前。

![使用 c2 管理 Chrome 标签组](docs/images/c2-groups.png)

### 搜索 Chrome 浏览历史

先打开 Chrome 扩展 popup，点击一次 **Enable** 开启 History Search 权限。之后输入 `c3` 浏览最近访问页面，或输入 `c3 <关键词>` 搜索标题和 URL。回车会优先聚焦已经打开的相同页面，否则新建标签页；Command-回车始终新建 Chrome 标签页。

| 指令 | 功能 |
| --- | --- |
| `c0` | 同时搜索已打开的标签页、标签组和历史 |
| `c0 t:<关键词>` | 统一搜索中只显示标签页 |
| `c0 g:<关键词>` | 统一搜索中只显示标签组 |
| `c0 h:<关键词>` | 统一搜索中只显示历史 |
| `c1` | 搜索并聚焦已打开的 Chrome 标签页 |
| `c2` | 搜索并聚焦 Chrome 标签组 |
| `c2 new` | 选择颜色，并用当前标签页创建标签组 |
| `c2 new <名称>` | 创建灰色标签组 |
| `c2 new <颜色> <名称>` | 使用指定颜色创建标签组 |
| `c2 color` | 选择已有标签组并修改颜色 |
| `c3` | 浏览和搜索最近一年的 Chrome 历史记录 |

标签组结果支持以下组合键：

| 快捷键 | 功能 |
| --- | --- |
| `⌥↩` | 折叠或展开标签组 |
| `⇧↩` | 将当前 Chrome 标签页加入标签组 |
| `⌃↩` | 解散标签组，但不关闭标签页 |
| `⌘↩` | 关闭标签组内全部标签页 |

### 查看 Bridge 状态

点击 Chrome 工具栏中的扩展图标，可以查看版本和 Native Messaging Bridge 的实时连接状态。
Popup 还可以按需开启 History Search 权限，并打开项目文档。

![Chrome Tabs Bridge 已连接且 History Search 已启用](docs/images/bridge-popup.svg)

## 安装

- [下载 Alfred Workflow](https://github.com/wilsonyiyi/alfred-chrome-tabs/releases/latest/download/Chrome-Tabs.alfredworkflow)
- [下载 Chrome Tabs Bridge](https://github.com/wilsonyiyi/alfred-chrome-tabs/releases/latest/download/Chrome-Tabs-Bridge.zip)

先安装 Alfred Workflow，然后：

1. 将 `Chrome-Tabs-Bridge.zip` 解压到一个固定目录。
2. 运行 `install-native-host.command`。
3. 在 Chrome 中打开 `chrome://extensions`。
4. 开启“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压目录中的 `extension` 文件夹。

请保留该 `extension` 目录，Chrome 会持续从这里加载扩展。

## 工作原理

`c0` 通过 Chrome Extension Bridge 一次取回标签页、标签组，以及（有关键词时）历史记录。Bridge 不可用时，会回退到 JXA 只列出标签页。

`c1` 使用轻量的 JXA 快速通道：一次性批量读取全部 Chrome 标签页，再交给 Alfred 在内存中完成过滤，因此不依赖 Chrome Extension Bridge。

Chrome 的 Apple Events 接口没有开放所需 API，因此 `c2` 和 `c3` 通过独立 Bridge 管理标签组与浏览历史：

```text
Alfred c0 / c2 / c3 指令
  -> 本地 Unix Socket
  -> Chrome Native Messaging Host
  -> Manifest V3 扩展
  -> chrome.tabs / chrome.tabGroups / chrome.history API
```

正常连接时，Native Messaging Port 会保持 Manifest V3 Service Worker 活跃。如果 Host 退出，扩展会立即重连；若连续失败，Chrome Alarm 看门狗会在 Service Worker 休眠后继续唤醒并恢复连接。打开 popup 时也会主动检查连接。

Native Host 由 Chrome 管理，不需要额外安装 launch daemon。Chrome 会在扩展建立 Native Messaging 连接时启动它，并在连接结束时关闭它。

## 环境要求

- macOS
- Alfred 4+ 和 Powerpack
- Google Chrome 120+
- Node.js 20+

## 本地开发

```sh
npm install
npm run bridge:install
npm run bridge:doctor
npm run dev
```

运行完整检查与发布包构建：

```sh
npm run check
npm run package:release
```

开发源码使用 Bundle ID `com.wilsonyiyi.alfred-chrome-tabs.dev`；正式发布包使用 `com.wilsonyiyi.alfred-chrome-tabs`。

代码推送到 `main` 后，CI 会先完成测试与发布资产校验。semantic-release 随后根据 Conventional Commit 自动决定版本（`fix` → patch、`feat` → minor、breaking change → major），同步更新 `package.json`、`package-lock.json`、`info.plist` 与 Chrome 扩展 manifest，重新构建两个安装资源，创建 Git tag 和 GitHub Release，并把版本文件提交回 `main`。

每个 GitHub Release 都包含 `Chrome-Tabs.alfredworkflow` 和 `Chrome-Tabs-Bridge.zip`，不再需要手工修改版本或推送 tag。

## 许可证

MIT
