import torch
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration

# 加载 BLIP 模型
device = "cuda" if torch.cuda.is_available() else "cpu"
processor = BlipProcessor.from_pretrained("./blip-image-captioning-base")  # Salesforce/blip-image-captioning-base
model = BlipForConditionalGeneration.from_pretrained("./blip-image-captioning-base").to(
    device)  # Salesforce/blip-image-captioning-base


def generate_caption(image_path):
    """输入图片路径，返回图片描述"""
    image = Image.open(image_path).convert("RGB")  # 加载输入图片
    inputs = processor(images=image, return_tensors="pt").to(device)  # 处理图像输入
    output = model.generate(**inputs, max_new_tokens=50)  # 生成图片描述
    caption = processor.batch_decode(output, skip_special_tokens=True)[0]  # 解码生成的文本
    return caption
