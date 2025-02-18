def combine_results(image_caption, speech_text):
    """合并图片描述和语音识别结果"""
    print(image_caption)
    print(speech_text)
    combined_text = f"图片描述: {image_caption}\n语音输入: {speech_text}"
    return combined_text 