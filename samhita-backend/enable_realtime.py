import os
from dotenv import load_dotenv

# Load .env first
load_dotenv()

from sqlalchemy import text
from models.document import engine

def enable_realtime():
    print("Enabling Supabase Realtime for documents and cases tables...")
    with engine.connect() as conn:
        try:
            # Check if publication exists, though supabase default is 'supabase_realtime'
            conn.execute(text("ALTER PUBLICATION supabase_realtime ADD TABLE documents;"))
            print("Successfully added 'documents' to realtime publication.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("'documents' is already in realtime publication.")
            else:
                print(f"Error for documents: {e}")

        try:
            conn.execute(text("ALTER PUBLICATION supabase_realtime ADD TABLE cases;"))
            print("Successfully added 'cases' to realtime publication.")
        except Exception as e:
            if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                print("'cases' is already in realtime publication.")
            else:
                print(f"Error for cases: {e}")
        
        conn.commit()
    print("Done!")

if __name__ == "__main__":
    enable_realtime()
