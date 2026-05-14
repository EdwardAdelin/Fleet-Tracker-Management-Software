import requests
import random

# --- CONFIGURARE ---
BASE_URL = "http://localhost:5000/api" # Ajustează dacă e nevoie
VEHICLE_ID = "1"  # ID-ul vehiculului

# Datele tale de logare în platformă
EMAIL = "radu@transport.ro" # PUNE AICI EMAIL-UL TĂU REAL
PASSWORD = "parola_secreta123"         # PUNE AICI PAROLA TA REALĂ
# -------------------

DTC_LIBRARY = [
    {"code": "P0300", "description": "Random or Multiple Cylinder Misfire Detected"},
    {"code": "P0104", "description": "Mass Air Flow Circuit Intermittent"},
    {"code": "P0420", "description": "Catalyst System Efficiency Below Threshold"},
    {"code": "P0115", "description": "Engine Coolant Temperature Circuit Malfunction"}
]

def login():
    print("🔐 Autentificare simulator...")
    response = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if response.status_code == 200:
        print("✅ Logare reușită!")
        return response.json().get("token")
    else:
        print(f"❌ Eroare la logare: {response.text}")
        return None

def send_obd_data(token):
    url = f"{BASE_URL}/vehicles/{VEHICLE_ID}/obd"
    errors_to_send = random.sample(DTC_LIBRARY, random.randint(1, 2))
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    try:
        print(f"🚀 Trimitere date OBD pentru vehiculul {VEHICLE_ID}...")
        response = requests.post(url, json={"errors": errors_to_send}, headers=headers)
        
        if response.status_code in [200, 201]:
            print("✅ Succes! Erorile au fost înregistrate în platformă.")
        else:
            print(f"❌ Eroare server ({response.status_code}): {response.text}")
    except Exception as e:
        print(f"💥 Eroare la conectare: {e}")

if __name__ == "__main__":
    token = login()
    if token:
        send_obd_data(token)