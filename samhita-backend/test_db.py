import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
import socket
from urllib.parse import urlparse

# Load env variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL is missing from .env")
    sys.exit(1)

print(f"🔍 Testing connection to Supabase...")
print(f"Host: {DATABASE_URL.split('@')[-1]}")

_connect_args = {"connect_timeout": 10} # 10 second timeout

# Pre-resolve to avoid IPv6 issues (same logic used in your app)
try:
    parsed = urlparse(DATABASE_URL)
    if parsed.hostname:
        ipv4 = socket.getaddrinfo(parsed.hostname, parsed.port or 5432, socket.AF_INET)[0][4][0]
        _connect_args["hostaddr"] = ipv4
        print(f"✓ Resolved hostname to IPv4: {ipv4}")
except Exception as e:
    print(f"⚠️ Hostname resolution warning: {e}")

try:
    engine = create_engine(
        DATABASE_URL,
        connect_args=_connect_args
    )
    
    # Attempt to connect
    with engine.connect() as conn:
        print("✅ SUCCESS! Successfully connected to Supabase PostgreSQL.")
        
except Exception as e:
    print(f"\n❌ CONNECTION FAILED:")
    print(str(e))
