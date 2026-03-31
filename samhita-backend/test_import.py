import traceback
try:
    import main
    print("Successfully imported main.")
except Exception as e:
    print("FAILED to import main:")
    traceback.print_exc()
