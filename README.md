# 🛰️ GitHub Radar

每天自动收录 GitHub 上值得关注的 AI 项目，**按"这东西能帮人干什么活"分类**，带 star 趋势和中文介绍。

**在线地址**：https://andreny1108.github.io/github-radar/

## 分类是按场景分的，不是按技术分的

这是这个站和别的 GitHub 榜单最不一样的地方。一个视频生成模型，别处会归到"多模态/深度学习"，这里归到 **AI 视频**——因为你找它是为了做视频，不是为了研究架构。

| 分类 | 收什么 |
|---|---|
| 🎬 AI 自媒体 / 内容创作 | 做短视频、公众号、小红书、播客的工具：批量文案、一键成片、选题助手 |
| 🎞️ AI 视频 | 视频生成、剪辑、字幕、数字人、换脸、抠像 |
| 🎨 AI 绘画 / 设计 | 图像生成、修图、抠图、设计稿、UI 生成 |
| 🎤 AI 音频 / 配音 | 语音合成、声音克隆、音乐生成、语音转文字 |
| ✍️ AI 写作 / 办公 | 文档、翻译、总结、PPT / 表格、简历 |
| 📈 AI 营销 / 电商 | 广告、选品、智能客服、SEO、评论分析 |
| 💬 AI 聊天 / 助手 | 对话界面、角色扮演、个人助理 |
| 💻 AI 编程 | 写代码、审代码、IDE 插件、编程智能体 |
| 📚 AI 知识库 / 搜索 | 文档问答、RAG、笔记、语义搜索 |
| 🤖 AI Agent / 自动化 | 通用智能体、工作流编排、操作浏览器 |
| 🛠️ 开发框架 / 工具 | 给程序员的库、框架、MCP、命令行、向量库 |
| ⚙️ 模型 / 本地部署 | 模型权重、推理引擎、量化、微调 |

## 本地跑起来

双击 **`start.bat`**。首次会自动装依赖、抓数据、启动页面（第一次抓数据约 8-15 分钟，之后是增量更新，很快）。

手动方式：

```bash
npm install
npm run update    # 抓取 → 分类 → 生成数据
npm run dev       # http://localhost:5173
```

单步执行：

```bash
npm run fetch     # ① 抓 GitHub 数据 → data/repos.json
npm run classify  # ② 大模型场景分类 + 中文摘要 → data/ai-cache.json
npm run data      # ③ 生成前端数据 → public/data/repos.json
```

## 密钥配置

编辑项目根目录的 `.env`（已在 `.gitignore` 里，不会被提交）：

```env
GH_API_TOKEN=github_pat_xxxxx

LLM_PROVIDER=deepseek       # deepseek / volcengine / qwen / zhipu / moonshot
LLM_API_KEY=xxxxx
# LLM_MODEL=               # 不填用各家默认型号
```

| 变量 | 必需 | 说明 |
|---|---|---|
| `GH_API_TOKEN` | 强烈建议 | GitHub fine-grained PAT，权限只要 **Public repositories (read-only)**。没有它每小时只能查 60 次，不够抓几千个项目 |
| `LLM_PROVIDER` | — | 大模型厂商，默认 `deepseek` |
| `LLM_API_KEY` | 场景分类需要 | 见下方说明 |
| `LLM_MODEL` | — | 覆盖默认型号。各家会更新型号，报 404 就是这里要改 |

**为什么大模型几乎是必需的**：场景分类没法只靠关键词。项目的 topic 写的是 `text-to-video`、`tts` 这些技术词，没人会给自己打「自媒体」标签——这层意图判断只有大模型能做。规则引擎能覆盖大约 75%（视频、绘画、音频、编程这些技术特征明显的），剩下的 25%（尤其是自媒体、营销这两类）全靠大模型。

不配 key 也能跑，站点功能完整，只是这 25% 会落到"其他"、卡片上显示英文原描述。

**走的是 OpenAI 兼容协议**，所以换厂商只改 `.env` 两行，代码一行不用动。各家申请地址：

- 火山方舟 https://console.volcengine.com/ark （`LLM_MODEL` 也接受 `ep-` 开头的推理接入点 ID）
- DeepSeek https://platform.deepseek.com/api_keys
- 通义千问 https://bailian.console.aliyun.com/
- 智谱 GLM https://bigmodel.cn/usercenter/apikeys
- Moonshot https://platform.moonshot.cn/console/api-keys

线上由 GitHub Actions 提供：`LLM_API_KEY` 放 Secrets，`LLM_PROVIDER` / `LLM_MODEL` 放 Variables（Settings → Secrets and variables → Actions）。

## 它是怎么工作的

```
      ┌─ Topic 搜索（56 个 topic，覆盖每一个场景分类，按 star 取前 100）
发现 ─┼─ 新星搜索（近 180 天新建的高星项目，防止榜单被老项目板结）
      └─ Trending 页（短期爆发、搜索按 star 排不出来的）
                    ↓
              合并去重 → 数千个候选
                    ↓
分类 ─┬─ 规则引擎（topics/仓库名/README 关键词加权打分，覆盖约 75%）
      └─ 大模型兜底（判不准的 + 全部中文摘要）
                    ↓
         data/repos.json（进 git，同时是 star 历史基线）
                    ↓
         public/data/repos.json → 纯静态前端
```

**卡片上的曲线画的是什么**：近 26 周每周的提交数，不是 star 走势。

原设计稿画的是 star 曲线，但 GitHub 拿不到这个数据——stargazers 接口深翻页直接返回 403，
历史 star 的时间线要不到；自己按天记快照又要攒很久才有形状。而 `stats/commit_activity`
一次请求就能拿到一年的真实数据，且"这项目还有没有人在维护"本身就比几天的 star 波动更有用。
最近半年没提交的画成灰色，一眼能认出烂尾项目。

活跃度数据缓存 7 天刷一次（提交数按周聚合，天天抓也不会变），存在 `data/activity.json`。

**为什么数据要提交进 git**：算"本周新增 star"必须有昨天的快照可比。git 天然提供这个能力，不用额外的数据库。

**为什么大模型结果要永久缓存**：每个仓库只在首次收录时算一次，结果按 repo id 存进 `data/ai-cache.json`。之后每天的更新只刷 star 数，不产生 token 成本。稳态下每天新增几十个项目，一天几分钱。

## 目录结构

```
scripts/
  fetch-github.mjs   ① 发现 + 抓元数据 + 合并主库
  taxonomy.mjs       分类体系与规则关键词表（纯数据，调分类只改这里）
  classify-llm.mjs   ② 大模型场景分类 + 中文摘要（OpenAI 兼容协议）
  build-data.mjs     ③ 产出前端数据
  lib/               GitHub 客户端、并发池、star 历史、环境变量
src/
  lib/filter.js      筛选/搜索/排序的纯函数（组件只管渲染）
  components/        Sidebar / Toolbar / RepoGrid / RepoCard
data/                主库 + 大模型结果缓存（进 git）
.github/workflows/   每日定时抓取 + 构建 + 部署
```

## 想改分类怎么办

**关键：分类体系和搜索列表是绑定的。** 加了新分类却没加对应的搜索 topic，那个分类会永远是空的——不是分错了，是池子里压根没有。

正确顺序：

1. `scripts/fetch-github.mjs` 的 `TOPICS` 里补上这个场景对应的 GitHub topic
2. `scripts/taxonomy.mjs` 的 `CATEGORIES` 加分类、`CATEGORY_MENU` 写一句给大模型看的说明
3. 同文件的 `RULES` 里补关键词（`topics` 权重 3、`name` 权重 2、`desc` 权重 1）
4. 如果新分类总被泛化分类抢走项目，调 `SPECIFICITY` 里的具体度加权

```bash
npm run fetch      # 只有第 1 步改了才需要跑
npm run classify   # 会自动检测分类体系变更，用新规则重判全部项目
npm run data
```

`classify` 有自愈逻辑：发现某个项目的分类在新体系里不存在了，会用存下来的 README 摘要重跑规则引擎。**所以调分类体系永远不需要重新抓数据。**

两个手动开关：

```bash
node scripts/classify-llm.mjs --rules       # 只调了关键词权重（分类 id 没变）时，强制全量重判
node scripts/classify-llm.mjs --summaries   # 给规则判好分类但还没中文摘要的项目补摘要
```

`--rules` 只重判规则判的，大模型判过的保留（那是花过钱的结果）。
`--summaries` 单独存在是因为：规则命中率越高，走大模型的项目越少，没补摘要的话
那部分卡片会显示英文原描述——首次建站要跑一次，之后每天的新项目由日常流程覆盖。

## 已知的坑

1. **搜索接口限流是 30 次/分钟**，比核心接口的 5000 次/小时严得多。脚本在搜索之间强制 sleep 2.2 秒，所以发现阶段要跑两分多钟，这是正常的。

2. **README 抓取是 6 路并发**。串行跑 2000+ 个要 45 分钟，并发后 7 分钟。不要调太高，GitHub 有"次级限流"会对请求突发做惩罚。

3. **Vite 的 `base` 路径**。仓库名不是 `<用户名>.github.io` 时，`vite.config.js` 必须设 `base: '/github-radar/'`，否则 Pages 上 JS/CSS 全 404、页面白屏。换仓库名记得同步改。

4. **定时任务会被 GitHub 自动停用**：仓库 60 天无人工活动就停（机器人的自动提交不算）。workflow 里已加提前 10 天开 issue 提醒；收到后去 Actions 页面点一次 "Run workflow" 即可。

5. **第一天没有 star 增量**——没有昨天的快照就算不出来，前端显示 `—`，排序自动切到"Star 最多"。第二天起恢复正常。

6. **Actions 的自动提交不会触发 workflow**（GitHub 防死循环机制），所以抓取、构建、部署必须在同一个 workflow 里串行完成。

7. **大模型返回的 JSON 不一定干净**。有些厂商即使指定了 `json_object` 也会用 ```` ```json ```` 包裹或加一句说明，解析器做了三层兜底。分类值也会校验是否在合法枚举内——模型偶尔会自创分类名。
