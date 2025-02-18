from flask import Flask, render_template, Response, jsonify, request
import cv2
import os
from datetime import datetime
from image_caption import generate_caption
import base64
from PIL import Image
import io
from openai import OpenAI
import re

app = Flask(__name__)

# 全局变量存储固定的图片路径
IMAGE_PATH = 'static/captures/current.jpg'


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/process_image', methods=['POST'])
def process_image():
    # 接收base64图像数据
    image_data = request.json['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)

    # 保存图片，始终覆盖同一个文件
    img = Image.open(io.BytesIO(image_bytes))
    os.makedirs('static/captures', exist_ok=True)
    img.save(IMAGE_PATH)

    # 生成图片描述
    caption = generate_caption(IMAGE_PATH)
    return jsonify({'caption': caption})


@app.route('/process_speech', methods=['POST'])
def process_speech():
    speech_text = request.json['speech_text']
    caption = generate_caption(IMAGE_PATH) if os.path.exists(IMAGE_PATH) else ""
    response_text = generate_response(speech_text, caption)
    return jsonify({'response': response_text})


def generate_response(speech_text: str, caption: str):
    prompt = (f"你可以听到用户说：{speech_text}\n"
              f"你可以看到用户的画面，画面的内容可以描述如下：{caption}\n"
              f"基于用户的语音和图像内容，请用中文生成一个合理的回答。")
    print(prompt)
    client = OpenAI(
        api_key="<API_Key>",
        base_url="https://api.deepseek.com",
    )
    # client = OpenAI(api_key="lm-studio", base_url="http://localhost:1234/v1")

    completion = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "system", "content": "你是一个热情、善解人意的聊天助手"},
                  {"role": "user", "content": prompt}],
        max_tokens=3000,
        n=1,
        stop=None,
        temperature=0.7
    )
    # 使用正则表达式匹配 <think> 和 </think> 之间的内容，并将其替换为空字符串
    cleaned_text = re.sub(r'<think>.*?</think>', '', completion.choices[0].message.content, flags=re.DOTALL)
    return cleaned_text


if __name__ == '__main__':
    app.run(debug=True)
