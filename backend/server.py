import asyncio
import websockets
import json
import base64
import torch
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from io import BytesIO
import logging
import config
from openai import OpenAI

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImageCaptionHandler:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {self.device}")
        
        # 加载模型和处理器
        self.processor = BlipProcessor.from_pretrained(config.MODEL_PATH)
        self.model = BlipForConditionalGeneration.from_pretrained(
            config.MODEL_PATH
        ).to(self.device)
        
    async def generate_caption(self, image_data):
        try:
            # 将 base64 图片数据转换为 PIL Image
            image = Image.open(BytesIO(image_data)).convert('RGB')
            
            # 处理图像
            inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            
            # 生成描述
            output = self.model.generate(**inputs, max_new_tokens=100)
            
            # 解码生成的文本
            caption = self.processor.batch_decode(output, skip_special_tokens=True)[0]
            print(caption)
            return caption
        except Exception as e:
            logger.error(f"Error generating caption: {str(e)}")
            return None

class ConnectionManager:
    def __init__(self):
        self.active_connections = set()
        self.caption_handler = ImageCaptionHandler()
    
    async def connect(self, websocket):
        self.active_connections.add(websocket)
        logger.info("Client connected")
    
    async def disconnect(self, websocket):
        self.active_connections.remove(websocket)
        logger.info("Client disconnected")
    
    async def handle_message(self, websocket, message):
        try:
            if isinstance(message, str):
                data = json.loads(message)
                logger.info(f"Received JSON message: {data}")
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": data.get("timestamp")
                    }))
            else:
                # 处理二进制图片数据
                logger.info(f"Received binary data, size: {len(message)} bytes")
                try:
                    caption = await self.caption_handler.generate_caption(message)
                    logger.info(f"Generated caption: {caption}")
                    
                    if caption:
                        response = {
                            "type": "image_caption",
                            "content": caption,
                            "messageId": str(id(caption))
                        }
                        response_json = json.dumps(response)
                        logger.info(f"Sending response: {response_json}")
                        await websocket.send(response_json)
                    else:
                        logger.error("Caption generation failed")
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "Failed to generate caption"
                        }))
                except Exception as e:
                    logger.error(f"Error processing image: {str(e)}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": f"Error processing image: {str(e)}"
                    }))
        except Exception as e:
            logger.error(f"Error handling message: {str(e)}")
            try:
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": str(e)
                }))
            except:
                logger.error("Failed to send error message to client")

async def websocket_handler(websocket):
    manager = ConnectionManager()
    await manager.connect(websocket)
    try:
        async for message in websocket:
            await manager.handle_message(websocket, message)
    except websockets.exceptions.ConnectionClosed:
        logger.info("Connection closed")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
    finally:
        await manager.disconnect(websocket)

async def main():
    logger.info(f"Starting server on {config.LISTEN_HOST}:{config.LISTEN_PORT}")
    async with websockets.serve(
        websocket_handler,
        config.LISTEN_HOST,
        config.LISTEN_PORT,
        max_size=config.MAX_MESSAGE_SIZE
    ) as server:
        logger.info("Server started")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main()) 