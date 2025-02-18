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

backend: blip+llm

## Installation

1. Clone the repository
2. Install backend models: `git clone https://huggingface.co/Salesforce/blip-image-captioning-large`
4. Configure API keys in app.py

## Usage

1. Start the backend server: ` python app.py`
3. Open http://127.0.0.1:5000/ in your browser
4. Click "Start Recording" to begin a conversation

## License

MIT

