# 已保存标签组：调研与显式保存方案

- 日期：2026-09-03
- 状态：已实现（工作区未提交）
- 相关入口：`c2` / `c0`、`extension/saved-groups.js`、`⌘⌥↩` 保存

## 1. 背景

Chrome 原生「已保存标签组」（Saved / Pinned Tab Groups）关闭后仍可能出现在书签栏，但扩展侧的 `chrome.tabGroups.query()` **只返回当前已实例化的组**。工作流若希望「关掉后还能从 Alfred 重新打开」，必须自己持久化一份数据。

此前工作区出现过一套「快照缓存」实现（`extension/group-snapshots.js`）：在每次 `listGroups` 读路径上对比前后两次结果，把「本次查不到」的组推断为已关闭并写入 `chrome.storage.local`。该做法会引发同步问题，已整段回退，改为本文的显式保存方案。

## 2. 被否决的做法：读路径推断快照

### 2.1 做法摘要

1. 每次 `listGroups`：读 storage → 与当前 live 组按指纹合并 → 再写回 storage。
2. 身份指纹：`title.trim().toLowerCase() + '\0' + color`。
3. 仅在 `ungroupGroup` 时 `forget`；`closeGroup` 等路径不清理。
4. Alfred 侧把 `open === false` 的条目标成 `Saved · Closed`，回车调用 `openSavedGroup({title, color, urls})`。

### 2.2 主要问题

| 问题 | 说明 |
| --- | --- |
| 改名/改色产生幽灵组 | 指纹变了之后，旧指纹对不上 live 集合，被标成「已关闭已保存组」；`c2 color` 即可稳定复现 |
| 同名同色冲突 | 不同窗口的同名同色组合并成一条；全部无标题组共用一个指纹 |
| 读路径写磁盘 | `c0` 每键触发 `searchAll` → `listGroups`，高频 get/set；无锁读-改-写，并发会丢更新 |
| `updatedAt` 被盖写 | 合并时每次把存量记录时间戳刷新成「现在」，无法做 LRU/过期 |
| 「查不到」≠「用户关掉」 | 启动未完成会话恢复、关窗口、在 Chrome UI 里解散组，都会从 `query()` 消失，却留下无人清理的记录 |
| 清理入口不全 | 只有 `ungroupGroup` 会 `forget` |
| Alfred 副作用 | 已保存条目无稳定 `id` → `c2 color @undefined`；无独立 `mods` → `⌘↩` 可能落到默认 arg |

**结论：** 问题不在「要不要 cache」，而在用**推断**维护第二份与 live 数据平行的真相源。只要「实时集合」和「存量集合」必须自动保持一致，改名、改色、关窗、恢复会话都会制造漂移。

## 3. API 调研

### 3.1 `chrome.tabGroups`

- 可读可写的是**当前已打开窗口里的组**。
- 有 `onCreated` / `onUpdated` / `onMoved` / `onRemoved`。
- Chrome 的 `onRemoved` 回调只有 `group`，**没有** Firefox 文档里的 `removeInfo.isWindowClosing`。
- `TabGroup.id` 官方说明：仅在单次浏览器会话内唯一，重启后不可依赖。
- Chrome 137+ 有 `shared` 字段；**没有** `pinned` / saved 状态，也没有 pin/unpin、打开/关闭已保存组的方法。

参考：[chrome.tabGroups](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)

### 3.2 原生「已保存标签组」

- 扩展**无法**枚举、打开或修改 Chrome 书签栏上的 saved/pinned 组。
- 相关诉求仍在跟踪：[w3c/webextensions#715](https://github.com/w3c/webextensions/issues/715)；Chromium 扩展讨论组也确认无 API 可见性。

### 3.3 `chrome.sessions`

- `getRecentlyClosed` / `restore` 的条目只有 `tab` 或 `window`，**没有组级 session**。
- `MAX_SESSION_RESULTS` 为 25，且主要覆盖当前会话近期关闭项。
- 不适合作为「按组重开」的持久层。

参考：[chrome.sessions](https://developer.chrome.com/docs/extensions/reference/api/sessions)

### 3.4 可行持久化手段对比

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 读路径推断快照 | 自动「捕获」关闭组 | 见 §2.2 | 否决 |
| `tabGroups.onRemoved` 自动写入 | 写不在读路径 | 仍难区分关窗/解散；无 `isWindowClosing`；与用户意图脱节 | 备选，未采用 |
| **显式保存 + UUID** | 第二真相源由用户创建；读只读；改名改色不漂移 | 需用户按一次键；非 Chrome 原生 saved 组 | **采用** |
| `chrome.sessions` | 系统恢复语义 | 无组级 API | 否决作为组持久层 |
| Bookmarks 文件夹 | 可随书签同步 | 需 `bookmarks` 权限；模型与组不完全同构 | 未采用，可作后续 |

生态里同类能力（会话管理、按项目恢复组）普遍也是 **`chrome.storage.local` + 显式或事件驱动保存**，无法挂接原生 Saved Tab Groups。

## 4. 采用方案：显式保存

### 4.1 原则

1. **记录只因用户明确操作而存在**（保存 / 删除），系统不推断「这个组被关掉了」。
2. **身份用自建 UUID**，不以 `title + color` 当主键。
3. **读路径纯只读**：`listGroups` 不写 storage；`listSavedGroups` 只 `get`。
4. Live 组与 Saved 组是两套列表：打开的组照常操作；已保存组另有打开 / 删除动作。

### 4.2 存储模型

- 权限：`storage`
- Key：`savedGroups`
- 上限：200 条（写入时 `slice`）
- 条目大致形状：

```js
{
  id: string,          // crypto.randomUUID()
  title: string,
  color: string,       // Chrome tab group color
  savedAt: number,     // ms
  tabs: [{ title, url }]  // 按 tab.index 排序；url 取 url || pendingUrl
}
```

同名同色再次保存：替换已有条目并**保留原 `id`**，避免堆积重复；这是「更新同一保存目标」的便捷规则，不是主键。

### 4.3 Bridge 方法

| Method | 行为 |
| --- | --- |
| `listSavedGroups` | 按 `savedAt` 降序返回；不写 storage |
| `saveGroup({ groupId })` | 读 live 组与 tabs → 写入 / 替换 |
| `openSavedGroup({ savedGroupId })` | 按 URL 建标签 → `tabs.group` → 设 title/color → 聚焦 |
| `deleteSavedGroup({ savedGroupId })` | 按 id 删除 |

实现文件：`extension/saved-groups.js`；在 `extension/service-worker.js` 注册。  
`searchAll` 并行拉取 `tabs` / `listGroups` / `listSavedGroups`（及可选 history），**不**在搜索路径写 storage。

### 4.4 Alfred UX

| 场景 | 行为 |
| --- | --- |
| Live 组 `⌘⌥↩` | `saveGroup` |
| Live 组原有修饰键 | 不变（折叠 / 加当前标签 / 解散 / 关闭） |
| Saved 组回车 | `openSavedGroup` |
| Saved 组 `⌘↩` | `deleteSavedGroup` |
| `c2` 列表顺序 | live 组 → saved 组 → `new` / `color` 命令 |
| `c2 color` | **仅** live 组，避免 `@undefined` |
| `c0` | 组 scope 内 live 在前、saved 在后；副标题带 `Group ·` / `Saved` |

CLI（`npm run tabgroup`）：`save` / `saved` / `reopen` / `forget`。

### 4.5 与旧快照方案的对照

| | 推断快照（否决） | 显式保存（采用） |
| --- | --- | --- |
| 写入时机 | 每次 list | 仅 save / delete |
| 身份 | title+color | UUID |
| 改色后 | 易出幽灵组 | 无自动条目；旧保存仍独立存在直至用户删除或同名同色覆盖更新 |
| 关窗 / 启动 | 易误标 closed | 不推断；已保存列表不变 |
| `c0` 按键 | 反复写 storage | 只读 |

## 5. 测试与校验

- `test/saved-groups.test.js`：list 只读、save 顺序与 pendingUrl、同名同色替换、无可保存 URL 拒绝、delete / open / 未知 id。
- `test/group-items.test.js`：`cmd+alt` 保存、saved 项 arg/mods、`c2` 排序、`color` 不含 saved。
- `test/search-items.test.js` / `test/search-handlers.test.js`：统一搜索中的 saved 组。
- `scripts/validate-workflow.js`：要求 manifest 含 `storage`，service worker 注册 `createSavedGroupHandlers`。

## 6. 后续可选

- `c0 g:new` / `c0 g:color` 管理命令平替（与本次无关）。
- 若产品坚持「关闭即自动进列表」：仅可考虑 `onRemoved` 事件写入 + 读只读，并接受关窗误捕获；仍应用 UUID，禁止 title+color 主键。
- Bookmarks 作跨设备同步层需单独评估权限与冲突策略。
- Chrome 一旦开放 Saved Tab Groups API，应优先改为调用原生能力，本 storage 列表可作迁移或只读备份。

## 7. 参考链接

- [chrome.tabGroups](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)
- [chrome.sessions](https://developer.chrome.com/docs/extensions/reference/api/sessions)
- [w3c/webextensions#715 — pin/saved tab groups API](https://github.com/w3c/webextensions/issues/715)
- [Chromium Extensions：saved/pinning 与 API 缺口讨论](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/rypFJOkAlz8)
