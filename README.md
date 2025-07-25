# AI 哄睡应用

这是一个使用大语言模型（LLM）和文本转语音（TTS）技术构建的Web应用，可以自动生成并朗读温馨的睡前故事。

## ✨ 功能特性

- **智能故事生成**: 使用阿里云通义千问生成温馨的睡前故事
- **多种故事长度**: 支持短篇(3000字)、中篇(5000字)、长篇(8000字+)
- **流式输出**: 实时显示故事生成过程，无需长时间等待
- **流式语音合成**: 支持实时流式TTS，第一段生成完成即可开始播放
- **智能分段**: 自动将长文本分段处理，突破512 tokens限制
- **多音色选择**: Cherry(温柔女声)、Serena(优雅女声)、Chelsie(甜美女声)、Ethan(温和男声)
- **优化体验**: 第一段优先生成，减少等待时间，后续段落并行处理
- **用户友好**: 简洁易用的Web界面，支持文字阅读和语音播放
- **个性化体验**: 每次生成都是全新的故事内容

## 🛠️ 技术栈

- **后端**:
  - **框架**: Node.js, Express
  - **AI服务**: 阿里云通义千问 (Dashscope)
    - **大语言模型**: `qwen-turbo` - 用于生成故事文本
    - **语音合成**: `qwen-tts` - 将文本转换为语音
  - **主要依赖**: OpenAI SDK (兼容模式), Axios, CORS

- **前端**:
  - HTML5, CSS3, 原生JavaScript
  - Server-Sent Events (流式数据接收)
  - HTML5 Audio API (音频播放)

## 📂 项目结构

```
/
├── backend/         # 后端代码
│   ├── server.js    # Express 服务器
│   ├── package.json # 依赖管理
│   └── .env.example # 环境变量示例
├── frontend/        # 前端代码
│   ├── index.html   # 应用主页面
│   ├── style.css    # 样式文件
│   └── app.js       # 客户端逻辑
└── README.md        # 项目说明
```

## 🚀 安装与运行

### 1. 准备环境

确保你已经安装了 [Node.js](https://nodejs.org/) (建议版本 >= 16.0)。

### 2. 配置后端

1.  进入后端目录：
    ```bash
    cd backend
    ```

2.  根据 `.env.example` 文件创建一个 `.env` 文件。你可以直接复制一份：
    ```bash
    # Windows
    copy .env.example .env

    # macOS / Linux
    cp .env.example .env
    ```

3.  编辑 `.env` 文件，填入你的阿里云 [Dashscope API Key](https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope-and-create-an-api-key)：
    ```
    DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```

### 3. 启动后端服务

1.  在 `backend` 目录下，安装项目依赖：
    ```bash
    npm install
    ```

2.  启动开发服务器：
    ```bash
    npm run dev
    ```
    服务器将在 `http://localhost:3000` 启动，并处于监听状态。

### 4. 运行前端

直接在你的网页浏览器中打开 `frontend/index.html` 文件即可。

## 💡 如何使用

1.  确保后端服务正在运行。
2.  在浏览器中打开 `index.html` 页面。
3.  点击 **“播放故事”** 按钮。
4.  等待片刻，应用会自动生成故事并开始播放语音。

## 🎯 新版本使用指南

### 完整使用流程

1.  **启动服务**: 确保后端服务正在运行 (`npm run dev`)
2.  **打开应用**: 在浏览器中打开 `frontend/index.html` 页面
3.  **选择长度**: 选择您喜欢的故事长度（短篇/中篇/长篇）
4.  **生成故事**: 点击 **"生成故事"** 按钮，观看故事实时生成
5.  **选择音色**: 故事生成完成后，选择喜欢的音色
6.  **播放语音**: 点击 **"🔊 生成语音"** 按钮，享受AI朗读

### 功能特色

- **流式生成**: 故事会逐字逐句实时显示，无需等待
- **多种长度**: 根据您的需求选择合适的故事长度
- **音色选择**: 4种不同音色，适合不同喜好
- **灵活播放**: 可以只看文字、只听语音，或边看边听

## 🔧 故障排除

### 常见问题

1. **端口占用**: 如果3000端口被占用，请修改 `backend/server.js` 中的端口号
2. **API密钥错误**: 确保 `.env` 文件中的 `DASHSCOPE_API_KEY` 正确
3. **跨域问题**: 确保后端服务正在运行，前端通过文件协议访问
4. **语音播放失败**: 某些浏览器可能阻止自动播放，请手动点击播放按钮

## 📝 更新日志

### v2.1.0 (最新)
- ✅ 实现流式TTS语音合成，大幅提升用户体验
- ✅ 智能文本分段，突破512 tokens API限制
- ✅ 优化第一段生成速度，减少初始等待时间
- ✅ 添加实时进度条和状态提示
- ✅ 支持并行音频生成和播放

### v2.0.0
- ✅ 新增TTS语音合成功能
- ✅ 支持多种音色选择 (Cherry/Serena/Chelsie/Ethan)
- ✅ 添加故事长度选择（短篇/中篇/长篇）
- ✅ 实现流式输出，提升用户体验
- ✅ 优化界面设计和用户交互

### v1.0.0
- ✅ 基础AI故事生成功能
- ✅ 简单的Web界面