#check_face.py
import sys
import json
import face_recognition
from PIL import Image, ImageFilter # pip install Pillow

def process_image(image_path):
    try:
        # img = Image.open(image_path)
        image = face_recognition.load_image_file(image_path)
        face_locations = face_recognition.face_locations(image)
        if len(face_locations) > 0:
            result = {
                "status": True,
                "locations": face_locations,
                "message": "Face found successfully"
            }
        else:
            result = {
                "status": False,
                "locations": face_locations,
                "message": "No faces detected"
            }

        
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