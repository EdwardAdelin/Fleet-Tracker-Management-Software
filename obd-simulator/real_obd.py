import obd
import requests

# --- CONFIGURARE ---
BASE_URL = "http://localhost:5000/api" # Dacă ești pe alt laptop, pune IP-ul serverului aici (ex: http://192.168.1.5:5000/api)
VEHICLE_ID = "2"                       # ID-ul vehiculului

# Datele de logare în platformă
EMAIL = "radu@transport.ro"
PASSWORD = "parola_secreta123"
# -------------------

def login():
    print("🔐 Autentificare dispozitiv în platformă...")
    response = requests.post(f"{BASE_URL}/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if response.status_code == 200:
        print("✅ Logare reușită! Am primit ecusonul (Token JWT).")
        return response.json().get("token")
    else:
        print(f"❌ Eroare la logare: {response.text}")
        return None

def read_and_send_real_obd(token):
    print("⏳ Mă conectez la adaptorul ELM327 (Bluetooth/USB)...")
    connection = obd.OBD() # Se conectează automat la portul activ
    
    if not connection.is_connected():
        print("❌ Nu m-am putut conecta la mașină. Verifică contactul sau Bluetooth-ul!")
        return

    print("✅ Conectat la mașină! Scanez motorul...")
    response = connection.query(obd.commands.GET_DTC)
    
    if response.is_not_null():
        erori_reale = response.value # Primim un array de tip [("P0300", "Misfire"), ("P0420", "Catalyst")]
        
        if len(erori_reale) > 0:
            print(f"⚠️ Am găsit {len(erori_reale)} erori. Le pregătesc pentru trimitere...")
            
            # Le formatăm exact cum cere backend-ul tău
            formatted_errors = [{"code": code, "description": desc} for code, desc in erori_reale]
            payload = {"errors": formatted_errors}
            
            # Atașăm token-ul de securitate
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Trimitem pachetul către server
            url = f"{BASE_URL}/vehicles/{VEHICLE_ID}/obd"
            try:
                api_resp = requests.post(url, json=payload, headers=headers)
                if api_resp.status_code in [200, 201]:
                    print("🚀 SUCCES! Erorile reale au fost salvate în platforma web.")
                else:
                    print(f"❌ Serverul a respins datele ({api_resp.status_code}): {api_resp.text}")
            except Exception as e:
                print(f"💥 Eroare de rețea (nu am internet?): {e}")
                
        else:
            print("✨ Nu există erori active pe mașină. Totul funcționează perfect!")

if __name__ == "__main__":
    # 1. Facem rost de "ecuson"
    token = login()
    
    # 2. Dacă avem ecuson, citim și trimitem datele
    if token:
        read_and_send_real_obd(token)