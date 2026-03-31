import traceback
with open("C:/Users/aryan/Desktop/SAMHITA/samhita-backend/err2.log", "w") as f:
    try:
        import main
        f.write("Successfully imported main.\n")
    except Exception as e:
        f.write("FAILED to import main:\n")
        traceback.print_exc(file=f)
