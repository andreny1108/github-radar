/**
 * 分类体系与规则打分。
 *
 * 分类维度是**应用场景**（这东西能干什么活），不是技术架构。
 * 所以「视频生成模型」和「视频剪辑工具」都进"AI 视频"，
 * 而不是一个进"多模态"、一个进"开发者工具"。
 *
 * 设计原则：规则是纯数据，打分是一个通用函数。
 * 以后调分类只改下面的关键词表，不用动任何逻辑。
 */

/** 分类定义。顺序决定前端侧边栏的显示顺序：场景类在前，开发者向的兜底类在后。 */
export const CATEGORIES = [
  { id: 'self-media', name: 'AI 自媒体 / 内容创作', emoji: '🎬' },
  { id: 'video',      name: 'AI 视频',              emoji: '🎞️' },
  { id: 'image',      name: 'AI 绘画 / 设计',       emoji: '🎨' },
  { id: 'audio',      name: 'AI 音频 / 配音',       emoji: '🎤' },
  { id: 'writing',    name: 'AI 写作 / 办公',       emoji: '✍️' },
  { id: 'marketing',  name: 'AI 营销 / 电商',       emoji: '📈' },
  { id: 'chat',       name: 'AI 聊天 / 助手',       emoji: '💬' },
  { id: 'coding',     name: 'AI 编程',              emoji: '💻' },
  { id: 'knowledge',  name: 'AI 知识库 / 搜索',     emoji: '📚' },
  { id: 'agent',      name: 'AI Agent / 自动化',    emoji: '🤖' },
  { id: 'devkit',     name: '开发框架 / 工具',      emoji: '🛠️' },
  { id: 'model',      name: '模型 / 本地部署',      emoji: '⚙️' },
  { id: 'other',      name: '其他',                 emoji: '📦' },
]

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

/** 供大模型兜底分类时拼进 prompt。带上说明，否则模型会按字面意思乱猜。 */
export const CATEGORY_MENU = [
  'self-media = AI 自媒体/内容创作：帮人做短视频、公众号、小红书、播客等内容的工具，比如批量生成文案脚本、一键成片、选题助手',
  'video      = AI 视频：视频生成、剪辑、字幕、数字人、换脸、抠像',
  'image      = AI 绘画/设计：图像生成、修图、抠图、设计稿、UI 生成、换装',
  'audio      = AI 音频/配音：语音合成、声音克隆、音乐生成、语音识别转文字',
  'writing    = AI 写作/办公：文档写作、翻译、总结、PPT/表格生成、简历、论文',
  'marketing  = AI 营销/电商：广告投放、选品、智能客服、SEO、评论分析、销售数据',
  'chat       = AI 聊天/助手：对话界面、角色扮演、陪伴、个人助理类应用',
  'coding     = AI 编程：写代码、审代码、补全、IDE 插件、自动修 bug 的编程智能体',
  'knowledge  = AI 知识库/搜索：文档问答、RAG、笔记管理、语义搜索、第二大脑',
  'agent      = AI Agent/自动化：通用智能体框架、工作流编排、操作浏览器或电脑完成任务',
  'devkit     = 开发框架/工具：给程序员用的库和框架、MCP 服务、命令行工具、SDK、向量数据库',
  'model      = 模型/本地部署：模型权重本身、推理引擎、量化、微调训练、本地跑大模型',
].join('\n')

/**
 * 关键词规则表。
 *
 * topics — 命中 GitHub topic，权重 3（最可信，作者自己打的标签）
 * name   — 命中仓库名，权重 2
 * desc   — 命中描述/README 摘要，权重 1（最弱，容易误伤）
 *
 * 全部小写匹配。单词类的 desc 用词边界匹配，避免 "rag" 命中 "storage"。
 *
 * 注意：self-media 和 marketing 这两类靠关键词很难判准——项目的 topic
 * 写的是 text-to-video，没人会打"自媒体"标签。这两类主要靠大模型兜底，
 * 这里的规则只捞那些标题里直接写了小红书/抖音的明显案例。
 */
const RULES = {
  /**
   * ⚠️ 这一类的规则刻意写得很保守，只认"意图"不认"平台"。
   *
   * 踩过的坑：最初把 wechat / youtube / instagram 这些平台 topic 当成权重 3 的
   * 判定依据，结果 Tencent/weui（微信 UI 组件库）、WxJava（微信开发 SDK）、
   * FreeTube（YouTube 客户端）全被归到了"AI 自媒体"——它们确实和微信/YouTube
   * 有关，但那是给程序员用的库，不是给做号的人用的工具。
   *
   * 结论：平台名适合用在 fetch-github.mjs 的搜索列表里（发现项目），
   * 不适合当分类依据。分类要看"是不是在帮人生产内容"。
   * 判不准的交给大模型，别让规则硬猜。
   */
  'self-media': {
    topics: ['content-creation', 'copywriting', 'self-media', 'short-video',
             'ai-video-generator', 'social-media-automation', 'content-generation'],
    name: ['xhs', 'xiaohongshu', 'douyin', 'moneyprinter', 'copywrit'],
    desc: ['小红书文案', '抖音文案', '公众号文章', '自媒体', '短视频文案', '爆款文案',
           '一键成片', '内容创作', '批量生成视频', '选题',
           'content creation', 'content creator', 'short video generat',
           'copywriting', 'auto-publish', 'video script', 'podcast generat',
           'generate videos from', 'faceless video'],
  },
  video: {
    topics: ['text-to-video', 'video-generation', 'video-editing', 'video', 'talking-head',
             'digital-human', 'lip-sync', 'deepfake', 'face-swap', 'subtitle', 'subtitles',
             'video-processing', 'animation', 'image-to-video', 'avatar', 'motion-capture'],
    name: ['video', 'vid', 'clip', 'subtitle', 'avatar', 'sora', 'wan'],
    desc: ['text-to-video', 'video generation', 'video editing', 'digital human', 'talking head',
           'lip sync', 'face swap', 'subtitle', '数字人', '视频剪辑', '视频生成', '字幕'],
  },
  image: {
    topics: ['text-to-image', 'stable-diffusion', 'image-generation', 'image-editing',
             'diffusion-models', 'comfyui', 'midjourney', 'flux', 'inpainting',
             'background-removal', 'upscaling', 'design', 'ui-design', 'photo', 'controlnet'],
    name: ['diffusion', 'comfyui', 'image', 'img', 'photo', 'draw', 'paint', 'flux', 'sd-'],
    desc: ['text-to-image', 'image generation', 'image editing', 'remove background',
           'upscale', 'inpainting', 'ai art', '文生图', '图像生成', '抠图', '设计稿'],
  },
  audio: {
    topics: ['text-to-speech', 'speech-to-text', 'tts', 'asr', 'voice-cloning', 'speech',
             'audio', 'music-generation', 'voice', 'whisper', 'speech-recognition',
             'audio-processing', 'voice-conversion', 'singing-voice'],
    name: ['tts', 'asr', 'whisper', 'voice', 'audio', 'speech', 'sound', 'music'],
    desc: ['text-to-speech', 'speech recognition', 'voice clon', 'voice convers',
           'music generation', 'transcrib', '语音合成', '声音克隆', '语音识别', '配音'],
  },
  writing: {
    topics: ['writing', 'translation', 'translator', 'summarization', 'document',
             'markdown', 'latex', 'resume', 'presentation', 'office', 'pdf', 'ocr',
             'grammar', 'proofreading', 'note-taking'],
    name: ['write', 'translat', 'summar', 'resume', 'doc', 'ppt', 'slide', 'paper'],
    desc: ['ai writing', 'translation tool', 'summarize', 'generate presentation',
           'resume builder', 'proofread', 'document conversion', '翻译', '写作助手',
           '文档生成', '简历', '论文'],
  },
  marketing: {
    topics: ['ecommerce', 'e-commerce', 'marketing', 'seo', 'advertising', 'crm',
             'customer-service', 'chatbot-customer-support', 'shopify', 'analytics',
             'sales', 'lead-generation', 'growth'],
    name: ['shop', 'ecommerce', 'crm', 'seo', 'ads', 'market', 'sales'],
    desc: ['e-commerce', 'ecommerce', 'customer service', 'customer support', 'seo tool',
           'ad campaign', 'lead generation', 'sales automation', '电商', '选品', '智能客服',
           '广告投放', '营销'],
  },
  chat: {
    topics: ['chatbot', 'chatgpt', 'chat', 'conversational-ai', 'roleplay', 'companion',
             'chatgpt-app', 'chat-ui', 'personal-assistant', 'character-ai', 'telegram-bot',
             'discord-bot', 'wechat-bot'],
    name: ['chat', 'bot', 'gpt-', 'assistant', 'companion', 'character'],
    desc: ['chat interface', 'chat ui', 'chatbot', 'conversational', 'role-play', 'roleplay',
           'ai companion', 'personal assistant', '聊天界面', '角色扮演', '陪伴'],
  },
  coding: {
    topics: ['ai-coding', 'code-generation', 'copilot', 'coding-assistant', 'code-review',
             'code-completion', 'developer-productivity', 'swe-agent', 'code-assistant',
             'codegen', 'pair-programming', 'vscode-extension', 'ide'],
    name: ['copilot', 'coder', 'codegen', 'cursor', 'aider', 'cline', 'continue', 'devin'],
    desc: ['coding assistant', 'ai pair programm', 'code generation', 'ai code review',
           'coding agent', 'software engineer agent', 'code completion', 'writes code',
           '写代码', '代码审查', '编程助手'],
  },
  knowledge: {
    topics: ['rag', 'retrieval-augmented-generation', 'semantic-search', 'knowledge-base',
             'document-qa', 'knowledge-graph', 'graphrag', 'note-taking', 'second-brain',
             'obsidian', 'search-engine', 'wiki', 'documentation'],
    name: ['rag', 'graphrag', 'knowledge', 'notes', 'wiki', 'search', 'brain'],
    desc: ['retrieval augmented', 'retrieval-augmented', 'rag pipeline', 'knowledge base',
           'chat with your documents', 'question answering over', 'semantic search',
           'second brain', '知识库', '文档问答', '语义搜索'],
  },
  agent: {
    topics: ['ai-agent', 'ai-agents', 'agent', 'agents', 'autonomous-agents', 'agentic',
             'multi-agent', 'agent-framework', 'browser-automation', 'computer-use',
             'workflow-automation', 'automation', 'rpa', 'agentic-workflow'],
    name: ['agent', 'autogpt', 'crew', 'swarm', 'automa', 'workflow'],
    desc: ['ai agent', 'autonomous agent', 'agentic', 'multi-agent', 'agent framework',
           'computer use', 'browser agent', 'automate tasks', 'workflow automation',
           '智能体', '自动化工作流'],
  },
  devkit: {
    topics: ['mcp', 'model-context-protocol', 'mcp-server', 'sdk', 'framework', 'library',
             'cli', 'developer-tools', 'devtools', 'terminal', 'vector-database', 'vectordb',
             'llmops', 'langchain', 'llamaindex', 'observability', 'api', 'kubernetes',
             'docker', 'devops', 'database', 'prompt-engineering', 'function-calling'],
    name: ['mcp', 'sdk', 'cli', 'kit', 'lib', 'server', 'proxy', 'gateway', 'router'],
    desc: ['model context protocol', 'mcp server', 'developer tool', 'command line tool',
           'cli tool', 'vector database', 'framework for building', 'sdk for',
           'library for', 'api gateway', 'observability'],
  },
  model: {
    topics: ['llm', 'inference', 'inference-engine', 'llm-inference', 'model-serving',
             'quantization', 'fine-tuning', 'finetuning', 'lora', 'peft', 'transformers',
             'pytorch', 'llm-training', 'gguf', 'llama', 'local-llm', 'cuda', 'model'],
    name: ['llama.cpp', 'vllm', 'sglang', 'tensorrt', 'onnx', 'ollama', 'llamafile',
           'unsloth', 'axolotl'],
    desc: ['inference engine', 'serving llms', 'model serving', 'fine-tune', 'fine tuning',
           'quantization', 'run llms locally', 'training framework', 'model weights',
           'high-throughput inference', '本地部署', '推理引擎', '微调'],
  },
}

/** 判定阈值：最高分低于这个值就交给大模型兜底。 */
export const SCORE_THRESHOLD = 3

/** 领先第二名不足这个差距，说明信号矛盾，也交给大模型判。 */
const MARGIN = 1.5

const WEIGHTS = { topics: 3, name: 2, desc: 1 }

/**
 * 具体度加权（小数，只在分数接近时起作用，不会颠覆明显的分差）。
 *
 * 场景越窄的分类，命中时信息量越大，平手时应该胜出。
 * devkit 和 model 是给开发者的兜底桶，给最低分——一个视频生成模型
 * 同时带 pytorch 和 text-to-video 两个 topic 时，应该进"AI 视频"而不是"模型"。
 */
const SPECIFICITY = {
  'self-media': 1.0,
  marketing: 0.9,
  coding: 0.8,
  knowledge: 0.7,
  video: 0.6,
  image: 0.6,
  audio: 0.6,
  writing: 0.5,
  agent: 0.4,
  chat: 0.2,
  model: 0.1,
  devkit: 0.0,
}

/** desc 匹配用词边界，避免 "rag" 命中 "storage"。中文和词组直接子串匹配。 */
function hasWord(haystack, needle) {
  if (/[^\x00-\x7f]/.test(needle) || /[\s\-.]/.test(needle)) {
    return haystack.includes(needle)
  }
  return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, 'i').test(haystack)
}

/**
 * 给一个仓库打分并判定分类。
 *
 * @param {{ id:string, description?:string, topics?:string[], readme?:string }} repo
 * @returns {{ category:string, guess:string, score:number, scores:object, confident:boolean }}
 */
export function classifyByRules(repo) {
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase())
  const repoName = (repo.id ?? '').split('/').pop()?.toLowerCase() ?? ''
  // README 只取前 1200 字符参与打分：靠后多是安装说明和 badge，噪音大
  const text = `${repo.description ?? ''} ${(repo.readme ?? '').slice(0, 1200)}`.toLowerCase()

  const scores = {}
  for (const [category, rule] of Object.entries(RULES)) {
    let score = 0
    for (const t of rule.topics ?? []) if (topics.includes(t)) score += WEIGHTS.topics
    for (const n of rule.name ?? []) if (repoName.includes(n)) score += WEIGHTS.name
    for (const d of rule.desc ?? []) if (hasWord(text, d)) score += WEIGHTS.desc
    if (score > 0) scores[category] = score + (SPECIFICITY[category] ?? 0)
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topCategory, topScore] = ranked[0] ?? ['other', 0]
  const runnerUpScore = ranked[1]?.[1] ?? 0

  const confident = topScore >= SCORE_THRESHOLD && topScore - runnerUpScore >= MARGIN

  return {
    category: confident ? topCategory : 'other',
    // 即使不够自信也把最优猜测带出去：没有大模型时用它兜底，总比一律丢进"其他"强
    guess: topScore >= SCORE_THRESHOLD ? topCategory : 'other',
    score: Number(topScore.toFixed(1)),
    scores,
    confident,
  }
}
