# Live Voice Chat Demo

A real-time voice chat demo featuring speech-to-text, AI conversation, and text-to-speech capabilities. The application supports multiple languages and provides a seamless conversational experience with minimal latency.

## Features

- 🎤 Real-time voice input with Voice Activity Detection (VAD)
- 🤖 AI-powered conversations using LLaMA model
- 🔊 Text-to-speech synthesis
- ⚡ Low-latency audio streaming
- 📊 Real-time latency monitoring and logging
- 🎯 WebSocket-based communication

## Project Structure

frontend: flask

backend: janus

## Installation

1. Clone the repository

2. Install the model: `git clone https://huggingface.co/deepseek-ai/Janus-Pro-1B`

3. On the basis of `Python >= 3.8` environment which `torch.cuda.is_available()==True`, install the necessary dependencies by running the following command:

   ```bash
   pip install -r ./requirements.txt
   ```

   

## Usage

1. Start the backend server: ` python app.py`
3. Open http://127.0.0.1:5000/ in your browser
4. Open your camera and begin a conversation!

## License

MIT

