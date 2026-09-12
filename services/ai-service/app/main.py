from fastapi import FastAPI

app = FastAPI(title="OpsPilot AI Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "opspilot-ai-service"}
