# image_script.py
import sys
import json
from PIL import Image, ImageFilter # pip install Pillow

def process_image(image_path):
    try:
        # 1. Open the image file
        img = Image.open(image_path)
        
        # 2. Get basic details
        original_details = {
            "format": img.format,
            "mode": img.mode,
            "width": img.width,
            "height": img.height
        }

        # 3. Perform an operation (e.g., Blur the image)
        # This simulates "doing work" on the image
        blurred_img = img.filter(ImageFilter.GaussianBlur(radius=100))
        
        # We won't save it to keep this simple, but we proved we could process it.
        
        # 4. Prepare the result
        result = {
            "status": "Image loaded successfully",
            "details": original_details,
            "message": "Image was processed and blurred in memory."
        }
        
        # 5. Print JSON to stdout
        print(json.dumps(result))
        
    except FileNotFoundError:
        # Handle case where file doesn't exist
        error = {"error": "File not found. Please check the path."}
        print(json.dumps(error))
    except Exception as e:
        # Handle other errors
        error = {"error": str(e)}
        print(json.dumps(error))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        process_image(sys.argv[1])
    else:
        print(json.dumps({"error": "No image path provided"}))