document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('playButton');
    const loadingDiv = document.getElementById('loading');
    const audioPlayer = document.getElementById('audioPlayer');
    const ttsControls = document.getElementById('ttsControls');
    const generateAudioButton = document.getElementById('generateAudioButton');
    const stopAudioButton = document.getElementById('stopAudioButton');
    const audioLoading = document.getElementById('audioLoading');
    const voiceSelect = document.getElementById('voiceSelect');
    const streamingProgress = document.getElementById('streamingProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    let currentStoryText = ''; // Store the generated story text for TTS
    let audioQueue = []; // Queue for segmented audio playback
    let currentAudioIndex = 0; // Current playing audio segment index
    let isPlaying = false; // Track playback state
    let isStreaming = false; // Track if we're receiving streaming audio
    let totalExpectedSegments = 0; // Total segments expected from streaming
    let receivedSegments = 0; // Number of segments received so far

    // Function to play audio segments sequentially with streaming support
    function playNextAudioSegment() {
        // Check if we have segments to play
        if (currentAudioIndex >= audioQueue.length) {
            // If we're still streaming and expecting more segments, wait
            if (isStreaming && receivedSegments < totalExpectedSegments) {
                audioLoading.textContent = `等待第 ${currentAudioIndex + 1} 段生成中...`;
                // Check again in 500ms
                setTimeout(() => {
                    playNextAudioSegment();
                }, 500);
                return;
            }

            // All segments played and streaming is complete
            isPlaying = false;
            isStreaming = false;
            stopAudioButton.classList.add('hidden'); // Hide stop button
            audioLoading.textContent = '所有语音播放完成！';
            setTimeout(() => {
                audioLoading.classList.add('hidden');
            }, 3000);
            return;
        }

        const currentSegment = audioQueue[currentAudioIndex];
        const totalSegments = isStreaming ? totalExpectedSegments : audioQueue.length;
        audioLoading.textContent = `正在播放第 ${currentAudioIndex + 1}/${totalSegments} 段...`;

        // Load and play the current segment
        audioPlayer.src = currentSegment.url;
        audioPlayer.classList.remove('hidden');

        // Set up event listener for when this segment ends
        audioPlayer.onended = () => {
            currentAudioIndex++;
            playNextAudioSegment();
        };

        // Set up error handler
        audioPlayer.onerror = () => {
            console.error(`Error playing segment ${currentAudioIndex + 1}`);
            currentAudioIndex++;
            playNextAudioSegment();
        };

        // Play the segment
        audioPlayer.play().catch(error => {
            console.error('Error playing audio:', error);
            currentAudioIndex++;
            playNextAudioSegment();
        });
    }

    // Function to add a new audio segment to the queue (for streaming)
    function addAudioSegment(segmentData) {
        // Insert segment at correct position to maintain order
        const insertIndex = segmentData.index;
        audioQueue[insertIndex] = segmentData;
        receivedSegments++;

        // If this is the first segment and we're not playing yet, start playing
        if (insertIndex === 0 && !isPlaying) {
            isPlaying = true;
            stopAudioButton.classList.remove('hidden');
            playNextAudioSegment();
        }
    }

    // Function to start sequential playback
    function startSequentialPlayback(audioUrls) {
        audioQueue = audioUrls.sort((a, b) => a.index - b.index); // Ensure correct order
        currentAudioIndex = 0;
        isPlaying = true;
        stopAudioButton.classList.remove('hidden'); // Show stop button
        playNextAudioSegment();
    }

    // Function to stop playback and streaming
    function stopPlayback() {
        isPlaying = false;
        isStreaming = false;
        audioPlayer.pause();
        audioPlayer.src = '';
        audioPlayer.classList.add('hidden');
        stopAudioButton.classList.add('hidden'); // Hide stop button
        streamingProgress.classList.add('hidden'); // Hide progress bar
        currentAudioIndex = 0;
        audioQueue = [];
        totalExpectedSegments = 0;
        receivedSegments = 0;
        audioLoading.classList.add('hidden');
    }

    playButton.addEventListener('click', () => {
        // Get selected story length
        const selectedLength = document.querySelector('input[name="storyLength"]:checked').value;

        loadingDiv.classList.remove('hidden');
        playButton.disabled = true;

        // Stop any current audio playback
        stopPlayback();

        audioPlayer.src = ''; // Clear previous audio
        audioPlayer.classList.add('hidden'); // Hide audio player
        ttsControls.classList.add('hidden'); // Hide TTS controls
        currentStoryText = ''; // Clear stored story text

        // Remove previous story if exists
        const existingStory = document.getElementById('storyText');
        if (existingStory) {
            existingStory.remove();
        }

        // Create story container for streaming content
        const storyDiv = document.createElement('div');
        storyDiv.id = 'storyText';
        storyDiv.style.cssText = `
            margin-top: 20px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 12px;
            text-align: left;
            line-height: 1.8;
            max-height: 500px;
            overflow-y: auto;
            border: 1px solid #e9ecef;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;

        // Get length description for display
        const lengthDescriptions = {
            'short': '短篇故事',
            'medium': '中篇故事',
            'long': '长篇故事'
        };

        storyDiv.innerHTML = `
            <h3 style="color: #495057; margin-bottom: 16px; text-align: center;">✨ AI 生成的${lengthDescriptions[selectedLength]} ✨</h3>
            <div id="storyContent" style="font-size: 16px; color: #495057; white-space: pre-wrap;">
            </div>
            <div id="streamStatus" style="text-align: center; margin-top: 20px; font-style: italic; color: #6c757d; font-size: 14px;">
                正在生成故事...
            </div>
        `;

        document.querySelector('.container').appendChild(storyDiv);

        // Start streaming with selected length
        startStoryStream(selectedLength);
    });

    async function startStoryStream(storyLength) {
        const storyContent = document.getElementById('storyContent');
        const streamStatus = document.getElementById('streamStatus');
        let fullContent = '';

        try {
            const response = await fetch('http://localhost:3000/api/generate-story', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    length: storyLength
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6); // Remove 'data: ' prefix
                            if (jsonStr.trim()) {
                                const data = JSON.parse(jsonStr);

                                switch(data.type) {
                                    case 'start':
                                        streamStatus.textContent = data.message;
                                        break;

                                    case 'content':
                                        fullContent += data.content;
                                        storyContent.textContent = fullContent;
                                        // Auto scroll to bottom
                                        const storyDiv = document.getElementById('storyText');
                                        storyDiv.scrollTop = storyDiv.scrollHeight;
                                        break;

                                    case 'complete':
                                        streamStatus.textContent = data.message;
                                        loadingDiv.classList.add('hidden');
                                        playButton.disabled = false;

                                        // Store the story text and show TTS controls
                                        currentStoryText = fullContent;
                                        ttsControls.classList.remove('hidden');
                                        return;

                                    case 'error':
                                        streamStatus.textContent = data.message;
                                        console.error('Stream error:', data.error);
                                        loadingDiv.classList.add('hidden');
                                        playButton.disabled = false;
                                        return;
                                }
                            }
                        } catch (error) {
                            console.error('Error parsing stream data:', error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fetch stream failed:', error);
            streamStatus.textContent = '连接失败，请重试';
            loadingDiv.classList.add('hidden');
            playButton.disabled = false;
        }
    }

    // TTS functionality with streaming support
    generateAudioButton.addEventListener('click', async () => {
        if (!currentStoryText) {
            alert('请先生成故事文本');
            return;
        }

        // Stop any current playback
        stopPlayback();

        generateAudioButton.disabled = true;
        audioLoading.classList.remove('hidden');
        audioLoading.textContent = `正在使用 ${voiceSelect.options[voiceSelect.selectedIndex].text} 流式生成语音...`;
        audioPlayer.classList.add('hidden');

        // Initialize streaming state
        isStreaming = true;
        totalExpectedSegments = 0;
        receivedSegments = 0;
        audioQueue = [];
        currentAudioIndex = 0;

        // Show progress bar
        streamingProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        progressText.textContent = '准备中...';

        try {
            const selectedVoice = voiceSelect.value;
            const response = await fetch('http://localhost:3000/api/text-to-speech-stream', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: currentStoryText,
                    voice: selectedVoice
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6); // Remove 'data: ' prefix
                            if (jsonStr.trim()) {
                                const data = JSON.parse(jsonStr);

                                switch(data.type) {
                                    case 'start':
                                        totalExpectedSegments = data.totalSegments;
                                        audioLoading.textContent = data.message;
                                        progressText.textContent = `准备生成 ${data.totalSegments} 段语音`;
                                        break;

                                    case 'progress':
                                        audioLoading.textContent = data.message;
                                        const progressPercent = ((data.currentSegment - 1) / data.totalSegments) * 100;
                                        progressFill.style.width = `${progressPercent}%`;
                                        progressText.textContent = `生成中: ${data.currentSegment}/${data.totalSegments}`;
                                        break;

                                    case 'segment':
                                        // Add segment to queue and potentially start playing
                                        addAudioSegment({
                                            index: data.index,
                                            url: data.url,
                                            text: data.text
                                        });

                                        // Update progress
                                        const completedPercent = ((data.index + 1) / totalExpectedSegments) * 100;
                                        progressFill.style.width = `${completedPercent}%`;
                                        progressText.textContent = `已完成: ${data.index + 1}/${totalExpectedSegments}`;
                                        break;

                                    case 'segment_error':
                                        console.error(`Segment ${data.index + 1} failed:`, data.error);
                                        // Continue with other segments
                                        break;

                                    case 'complete':
                                        isStreaming = false;
                                        progressFill.style.width = '100%';
                                        progressText.textContent = data.message;
                                        audioLoading.textContent = data.message;

                                        // Hide progress bar after delay
                                        setTimeout(() => {
                                            streamingProgress.classList.add('hidden');
                                            if (!isPlaying) {
                                                audioLoading.classList.add('hidden');
                                            }
                                        }, 3000);
                                        break;

                                    case 'error':
                                        throw new Error(data.message || '语音生成失败');
                                }
                            }
                        } catch (error) {
                            console.error('Error parsing stream data:', error);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error in streaming TTS:', error);
            alert('语音生成失败：' + error.message);
            audioLoading.classList.add('hidden');
            isStreaming = false;
        } finally {
            generateAudioButton.disabled = false;
        }
    });

    // Stop audio button functionality
    stopAudioButton.addEventListener('click', () => {
        stopPlayback();
    });
});