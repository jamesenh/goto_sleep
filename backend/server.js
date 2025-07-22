require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// A simple test route
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// Main API route for generating stories with streaming
app.post('/api/generate-story', async (req, res) => {
  try {
    // Get story length from request body
    const { length = 'medium' } = req.body;

    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type'
    });

    // Get length description for message
    const lengthDescriptions = {
      'short': '短篇睡前故事（约3000字）',
      'medium': '中篇睡前故事（约5000字）',
      'long': '长篇睡前故事（约8000字以上）'
    };

    // Send initial message
    res.write(`data: ${JSON.stringify({
      type: 'start',
      message: `开始生成${lengthDescriptions[length] || '睡前故事'}...`
    })}\n\n`);

    // Generate story with streaming
    await generateStoryTextStream(res, length);

    // Send completion message
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: '故事生成完成！'
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Error generating story:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: '故事生成失败，请检查API密钥配置。',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Function to generate story text with streaming using Dashscope Tongyi model via OpenAI compatible API
async function generateStoryTextStream(res, length = 'medium') {
  const client = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  });

  // Generate different prompts based on story length
  const prompts = {
    'short': `请你创作一个温馨、适合哄睡的短篇童话故事，要求如下：
1. 故事长度：大约3000字左右
2. 故事风格：温馨、舒缓、适合睡前聆听
3. 故事结构：简洁明了，有开头、发展和温馨结尾
4. 语言特点：用词优美、节奏缓慢、富有想象力
5. 故事主题：可以是关于友谊、成长、小动物或者温暖的家庭故事
6. 情节发展：情节简单但温馨，让听众能够放松
7. 结尾要求：必须是温馨、安详的结局，有助于入睡

请创作一个符合以上要求的完整短篇睡前故事。`,

    'medium': `请你创作一个详细、温馨、适合哄睡的中篇童话故事，要求如下：
1. 故事长度：大约5000字左右
2. 故事风格：温馨、舒缓、适合睡前聆听
3. 故事结构：要有完整的开头、发展、小高潮和结尾
4. 语言特点：用词优美、节奏缓慢、富有想象力
5. 故事主题：可以是关于友谊、成长、冒险、或者温暖的家庭故事
6. 情节发展：要有适度的细节描述，让听众能够沉浸其中
7. 结尾要求：必须是温馨、安详的结局，有助于入睡

请创作一个符合以上要求的完整中篇睡前故事。`,

    'long': `请你创作一个详细、温馨、适合哄睡的长篇童话故事，要求如下：
1. 故事长度：大约8000字以上
2. 故事风格：温馨、舒缓、适合睡前聆听
3. 故事结构：要有完整的开头、发展、高潮和结尾，可以分为多个章节
4. 语言特点：用词优美、节奏缓慢、富有想象力
5. 故事主题：可以是关于友谊、成长、冒险、或者温暖的家庭故事
6. 情节发展：要有丰富的细节描述，让听众能够完全沉浸其中
7. 结尾要求：必须是温馨、安详的结局，有助于入睡

请创作一个符合以上要求的完整长篇睡前故事。`
  };

  const prompt = prompts[length] || prompts['medium'];

  // Set max_tokens based on story length
  const maxTokensMap = {
    'short': 4000,   // ~3000 words
    'medium': 6000,  // ~5000 words
    'long': 10000    // ~8000+ words
  };

  try {
    const stream = await client.chat.completions.create({
      model: 'qwen-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokensMap[length] || maxTokensMap['medium'],
      temperature: 0.7, // 适中的创造性
      top_p: 0.9, // 保持一定的多样性
      stream: true, // 启用流式输出
    });

    let fullStory = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullStory += content;
        // Send each chunk to the client
        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: content
        })}\n\n`);
      }
    }

    console.log('Generated story length:', fullStory.length);
    return fullStory;

  } catch (error) {
    console.error('Error calling Dashscope API:', error);
    throw new Error('Failed to generate story text from LLM.');
  }
}

// Function to intelligently segment text for TTS processing with optimized first segment
function segmentTextForTTS(text, firstSegmentMaxTokens = 250, regularMaxTokens = 400) {
  // Remove markdown headers and clean up text
  const cleanText = text
    .replace(/#{1,6}\s+/g, '') // Remove markdown headers
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .trim();

  const segments = [];
  const paragraphs = cleanText.split(/\n\n+/);

  let currentSegment = '';
  let isFirstSegment = true;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    // Use smaller limit for first segment to reduce initial waiting time
    const maxTokens = isFirstSegment ? firstSegmentMaxTokens : regularMaxTokens;

    // Rough token estimation (1 token ≈ 0.75 Chinese characters)
    const estimatedTokens = Math.ceil(trimmedParagraph.length * 0.75);
    const currentTokens = Math.ceil(currentSegment.length * 0.75);

    // If adding this paragraph would exceed the limit, save current segment
    if (currentTokens + estimatedTokens > maxTokens && currentSegment) {
      segments.push(currentSegment.trim());
      currentSegment = trimmedParagraph;
      isFirstSegment = false; // After first segment, use regular max tokens
    } else {
      // Add paragraph to current segment
      currentSegment += (currentSegment ? '\n\n' : '') + trimmedParagraph;
    }

    // If single paragraph is too long, split by sentences
    if (Math.ceil(currentSegment.length * 0.75) > maxTokens) {
      const sentences = currentSegment.split(/[。！？]/);
      currentSegment = '';
      let tempSegment = '';

      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;

        const sentenceWithPunctuation = trimmedSentence + (sentences.indexOf(sentence) < sentences.length - 1 ? '。' : '');
        const tempTokens = Math.ceil((tempSegment + sentenceWithPunctuation).length * 0.75);

        if (tempTokens > maxTokens && tempSegment) {
          segments.push(tempSegment.trim());
          tempSegment = sentenceWithPunctuation;
          isFirstSegment = false; // After first segment, use regular max tokens
        } else {
          tempSegment += sentenceWithPunctuation;
        }
      }

      if (tempSegment.trim()) {
        currentSegment = tempSegment;
      }
    }
  }

  // Add the last segment
  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter(segment => segment.length > 0);
}

// Function to convert a single text segment to speech
async function convertSegmentToSpeech(text, voice) {
  const ttsResponse = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    {
      model: 'qwen-tts-latest',
      input: {
        text: text,
        voice: voice
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (ttsResponse.data && ttsResponse.data.output && ttsResponse.data.output.audio) {
    return ttsResponse.data.output.audio.url;
  } else {
    throw new Error('Invalid response from TTS API');
  }
}

// TTS API route for streaming text to speech conversion
app.post('/api/text-to-speech-stream', async (req, res) => {
  try {
    const { text, voice = 'Cherry' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for TTS conversion'
      });
    }

    console.log('Starting streaming TTS conversion for text length:', text.length);

    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type'
    });

    // Segment the text into manageable chunks with optimized first segment
    const segments = segmentTextForTTS(text);
    console.log(`Text segmented into ${segments.length} parts`);

    // Send initial message with segment count
    res.write(`data: ${JSON.stringify({
      type: 'start',
      totalSegments: segments.length,
      message: `开始生成 ${segments.length} 段语音...`
    })}\n\n`);

    let successfulSegments = 0;
    const failedSegments = [];

    // Process segments and stream results
    for (let i = 0; i < segments.length; i++) {
      try {
        console.log(`Processing segment ${i + 1}/${segments.length} (${segments[i].length} chars)`);

        // Send progress update
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          currentSegment: i + 1,
          totalSegments: segments.length,
          message: `正在生成第 ${i + 1}/${segments.length} 段...`
        })}\n\n`);

        const audioUrl = await convertSegmentToSpeech(segments[i], voice);
        successfulSegments++;

        // Send completed segment immediately
        res.write(`data: ${JSON.stringify({
          type: 'segment',
          index: i,
          url: audioUrl,
          text: segments[i].substring(0, 50) + '...', // Preview text
          message: `第 ${i + 1} 段生成完成`
        })}\n\n`);

      } catch (error) {
        console.error(`Failed to convert segment ${i + 1}:`, error.message);
        failedSegments.push(i);

        // Send error for this segment
        res.write(`data: ${JSON.stringify({
          type: 'segment_error',
          index: i,
          error: error.message,
          message: `第 ${i + 1} 段生成失败`
        })}\n\n`);
      }
    }

    // Send completion message
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      totalSegments: segments.length,
      successfulSegments: successfulSegments,
      failedSegments: failedSegments,
      message: failedSegments.length > 0
        ? `语音合成完成！${successfulSegments}/${segments.length} 段成功生成。`
        : '所有语音段生成完成！'
    })}\n\n`);

    res.end();
    console.log(`Streaming TTS conversion completed: ${successfulSegments}/${segments.length} segments successful`);

  } catch (error) {
    console.error('Error in streaming TTS conversion:', error.response?.data || error.message);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: '语音合成失败，请稍后重试。',
      error: error.message
    })}\n\n`);
    res.end();
  }
});

// Keep the original non-streaming endpoint for backward compatibility
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text, voice = 'Cherry' } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required for TTS conversion'
      });
    }

    console.log('Starting TTS conversion for text length:', text.length);

    // Segment the text into manageable chunks
    const segments = segmentTextForTTS(text);
    console.log(`Text segmented into ${segments.length} parts`);

    // Convert each segment to speech
    const audioUrls = [];
    const failedSegments = [];

    for (let i = 0; i < segments.length; i++) {
      try {
        console.log(`Processing segment ${i + 1}/${segments.length} (${segments[i].length} chars)`);
        const audioUrl = await convertSegmentToSpeech(segments[i], voice);
        audioUrls.push({
          index: i,
          url: audioUrl,
          text: segments[i].substring(0, 50) + '...' // Preview text
        });
      } catch (error) {
        console.error(`Failed to convert segment ${i + 1}:`, error.message);
        failedSegments.push(i);
      }
    }

    if (audioUrls.length === 0) {
      throw new Error('All segments failed to convert');
    }

    console.log(`TTS conversion completed: ${audioUrls.length}/${segments.length} segments successful`);

    res.json({
      success: true,
      audioUrls: audioUrls,
      totalSegments: segments.length,
      successfulSegments: audioUrls.length,
      failedSegments: failedSegments,
      message: failedSegments.length > 0
        ? `语音合成完成！${audioUrls.length}/${segments.length} 段成功生成。`
        : '语音合成完成！'
    });

  } catch (error) {
    console.error('Error in TTS conversion:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to convert text to speech',
      message: '语音合成失败，请稍后重试。'
    });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});