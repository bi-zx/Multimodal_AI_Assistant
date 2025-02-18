class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioBuffer = [];
    this.energyThreshold = 0.01;
    this.isSpeaking = false;
    this.silenceStartTime = null;
    this.requiredSilenceMs = 500;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const monoInput = new Float32Array(input[0].length);
    for (let i = 0; i < input[0].length; i++) {
      let sum = 0;
      for (let channel = 0; channel < input.length; channel++) {
        sum += input[channel][i];
      }
      monoInput[i] = sum / input.length;
    }

    const energy = this.calculateEnergy(monoInput);

    if (energy > this.energyThreshold) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.audioBuffer = [];
        this.port.postMessage({ type: 'vad', status: 'speech_start' });
      }
      this.audioBuffer.push(...monoInput);
      this.silenceStartTime = null;
    } else if (this.isSpeaking) {
      if (!this.silenceStartTime) {
        this.silenceStartTime = currentTime();
      }

      if (currentTime() - this.silenceStartTime > this.requiredSilenceMs) {
        this.isSpeaking = false;
        this.port.postMessage({
          type: 'vad',
          status: 'speech_end',
          audioData: this.audioBuffer
        });
        this.audioBuffer = [];
      }
    }

    return true;
  }

  calculateEnergy(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return sum / buffer.length;
  }
}

class EchoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.audioBuffer = [];
    this.playbackPosition = 0;
    this.isPlaying = false;
    this.sampleRate = 16000;
    this.isMuted = false;
    this.outputBufferSize = 2048;
    this.outputBuffer = new Float32Array(this.outputBufferSize);
    this.outputBufferPosition = 0;
    this.hasNotifiedQueueEmpty = false;  // Track if we've sent the queue empty notification

    this.port.onmessage = (event) => {
      if (event.data instanceof Float32Array) {
        if (!this.isMuted) {
          const audioData = event.data;
          const newBuffer = new Float32Array(audioData.length);
          newBuffer.set(audioData);

          if (!this.isPlaying) {
            this.audioBuffer = Array.from(newBuffer);
            this.playbackPosition = 0;
            this.outputBufferPosition = 0;
            this.hasNotifiedQueueEmpty = false;  // Reset notification flag when starting new playback
          } else {
            this.audioBuffer.push(...Array.from(newBuffer));
          }

          this.isPlaying = true;
        }
      } else if (event.data.type === 'clear') {
        // Clear the buffer and stop playback
        this.audioBuffer = [];
        this.playbackPosition = 0;
        this.outputBufferPosition = 0;
        this.isPlaying = false;
        this.isMuted = true;
        this.hasNotifiedQueueEmpty = false;
        // Notify that the queue is empty after clearing
        this.port.postMessage({ type: 'queue_empty' });
      } else if (event.data.type === 'unmute') {
        this.isMuted = false;
        this.hasNotifiedQueueEmpty = false;
      } else if (event.data.type === 'mute') {
        this.isMuted = true;
        this.audioBuffer = [];
        this.playbackPosition = 0;
        this.isPlaying = false;
        this.hasNotifiedQueueEmpty = false;
        // Notify that the queue is empty after muting
        this.port.postMessage({ type: 'queue_empty' });
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    // If muted or not playing, output silence
    if (this.isMuted || !this.isPlaying || this.audioBuffer.length === 0) {
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0);
      }

      // Send queue_empty notification if we haven't already
      if (this.isPlaying && !this.hasNotifiedQueueEmpty) {
        this.port.postMessage({ type: 'queue_empty' });
        this.hasNotifiedQueueEmpty = true;
        this.isPlaying = false;
      }

      return true;
    }

    const outputChannel = output[0];
    const bufferSize = outputChannel.length;

    if (this.isPlaying && this.audioBuffer.length > 0) {
      // Fill the output buffer
      for (let i = 0; i < bufferSize; i++) {
        if (this.playbackPosition < this.audioBuffer.length) {
          const sample = this.audioBuffer[this.playbackPosition];
          for (let channel = 0; channel < output.length; channel++) {
            output[channel][i] = sample;
          }
          this.playbackPosition++;
        } else {
          // End of buffer reached
          for (let channel = 0; channel < output.length; channel++) {
            output[channel][i] = 0;
          }

          // If we've played everything, reset and notify
          if (this.playbackPosition >= this.audioBuffer.length && !this.hasNotifiedQueueEmpty) {
            this.isPlaying = false;
            this.playbackPosition = 0;
            this.audioBuffer = [];
            this.port.postMessage({ type: 'queue_empty' });
            this.hasNotifiedQueueEmpty = true;
          }
        }
      }
    } else {
      // Output silence if we're not playing
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0);
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
registerProcessor('echo-processor', EchoProcessor);
