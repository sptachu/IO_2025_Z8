# compare_faces.py
import sys
import json
import face_recognition

def process_image(gate_image_path, database_image_path):
    try:
        # Wczytywanie plików obrazów
        database_image = face_recognition.load_image_file(database_image_path)
        gate_image = face_recognition.load_image_file(gate_image_path)

        # Pobieranie kodowań (encodings) - zwraca listę
        db_encodings = face_recognition.face_encodings(database_image)
        gate_encodings = face_recognition.face_encodings(gate_image)

        # BEZPIECZEŃSTWO: Sprawdzenie czy w bazie jest twarz
        if len(db_encodings) == 0:
            print(json.dumps({"status": False, "message": "Błąd: Brak twarzy we wzorcu bazy danych."}))
            return

        # BEZPIECZEŃSTWO: Sprawdzenie czy na zdjęciu z bramki jest twarz
        if len(gate_encodings) == 0:
            # To rozwiązuje błąd "list index out of range"
            print(json.dumps({"status": False, "message": "Nie wykryto twarzy na zdjęciu z bramki."}))
            return

        # Jeśli twarze istnieją, pobieramy pierwsze znalezione (indeks 0)
        database_encoding = db_encodings[0]
        gate_encoding = gate_encodings[0]

        # Zmniejszenie tolerance do 0.5 zwiększa pewność, że to ta sama osoba
        tolerance = 0.5
        recognition_results = face_recognition.compare_faces([database_encoding], gate_encoding, tolerance=tolerance)
        matches = bool(recognition_results[0])

        if matches:
            result = {
                "status": True,
                "message": "Twarze są zgodne, dostęp przyznany"
            }
        else:
            result = {
                "status": False,
                "message": "Twarze nie pasują do siebie"
            }

        print(json.dumps(result))

    except FileNotFoundError:
        print(json.dumps({"error": "Nie znaleziono pliku obrazu."}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 2:
        process_image(sys.argv[1], sys.argv[2])
    else:
        print(json.dumps({"error": "Brak wymaganych ścieżek do obrazów"}))