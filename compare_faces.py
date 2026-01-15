#compare_faces.py
import sys
import json
import face_recognition
from PIL import Image, ImageFilter # pip install Pillow

def process_image(gate_image_path, database_image_path):
    try:
        # img = Image.open(image_path)
        database_image = face_recognition.load_image_file(database_image_path)
        gate_image = face_recognition.load_image_file(gate_image_path)

        database_encoding = face_recognition.face_encodings(database_image)[0]
        gate_encoding = face_recognition.face_encodings(gate_image)[0]

        recognition_results = face_recognition.compare_faces([database_encoding], gate_encoding)
        # print(recognition_results)

        matches = bool(recognition_results[0])

        if matches:
            result = {
                "status": True,
                "message": "Faces are matching, access granted"
            }
        else:
            result = {
                "status": False,
                "message": "Faces are mismatched, no access"
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
    if len(sys.argv) > 2:
        process_image(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({"error": "Not enough image paths provided"}))