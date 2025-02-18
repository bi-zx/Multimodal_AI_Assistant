from flask import Flask, render_template, request, jsonify
import os
from image_caption import generate_caption
from text_processor import combine_results
import time

app = Flask(__name__)

# 临时文件目录
TEMP_FOLDER = "temp/"
os.makedirs(TEMP_FOLDER, exist_ok=True)
app.config["TEMP_FOLDER"] = TEMP_FOLDER

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if 'speech' in request.json:
            # 处理语音识别结果
            speech_text = request.json['speech']
            return jsonify({"speech_text": speech_text})
            
        if "file" in request.files:
            file = request.files["file"]
            
            # 使用时间戳保存临时文件
            timestamp = str(int(time.time()))
            image_path = os.path.join(app.config["TEMP_FOLDER"], f"capture_{timestamp}.jpg")
            file.save(image_path)

            # 生成描述并删除临时文件
            caption = generate_caption(image_path)
            os.remove(image_path)
            
            return jsonify({"caption": caption})

    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
