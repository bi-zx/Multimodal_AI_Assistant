from flask import Flask, render_template, Response, jsonify, request
import os
from model import process_image_and_question
import base64
from PIL import Image
import io

app = Flask(__name__)

# 全局变量存储固定的图片路径
IMAGE_PATH = 'static/captures/current.jpg'


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/save_image', methods=['POST'])
def save_image():
    # 接收base64图像数据
    image_data = request.json['image'].split(',')[1]
    image_bytes = base64.b64decode(image_data)

    # 保存图片，始终覆盖同一个文件
    img = Image.open(io.BytesIO(image_bytes))
    os.makedirs('static/captures', exist_ok=True)
    img.save(IMAGE_PATH)

    return jsonify({})


@app.route('/process_speech', methods=['POST'])
def process_speech():
    speech_text = "请使用中文回复。" + request.json['speech_text']
    response_text = process_image_and_question(IMAGE_PATH, speech_text) if os.path.exists(IMAGE_PATH) else ""
    return jsonify({'response': response_text})


if __name__ == '__main__':
    app.run(debug=True)
