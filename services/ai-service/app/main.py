import logging
import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Header, HTTPException

from app.schemas.rca import (
    IncidentAnalysisRequest,
    IncidentAnalysisResponse,
    PROMPT_VERSION,
)
from app.services.provider import ProviderError, get_provider
from app.utils.sanitization import sanitize_context


logging.basicConfig(
    level=logging.INFO,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="OpsPilot AI Service",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "opspilot-ai-service",
    }


@app.post(
    "/analyze/incident",
    response_model=IncidentAnalysisResponse,
)
async def analyze_incident(
    payload: IncidentAnalysisRequest,
    x_ai_service_key: str | None = Header(default=None),
) -> IncidentAnalysisResponse:

    expected_key = os.getenv(
        "AI_SERVICE_SECRET",
        "",
    )

    if not expected_key or x_ai_service_key != expected_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid internal service credentials",
        )

    try:
        logger.info(
            "Starting incident analysis"
        )

        provider = get_provider()

        logger.info(
            "Provider selected: %s",
            type(provider).__name__,
        )

        context = sanitize_context(
            payload.model_dump(
                exclude={"analysisType"}
            )
        )

        result, input_tokens, output_tokens = (
            await provider.analyze(context)
        )

        if not isinstance(result, dict):
            raise ValueError(
                "AI provider returned a non-object response"
            )

        result.update(
            {
                "analysisType": "ROOT_CAUSE",
                "promptVersion": PROMPT_VERSION,
                "model": result.get(
                    "model",
                    os.getenv(
                        "LLM_MODEL",
                        "configured-provider",
                    ),
                ),
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
            }
        )

        logger.info(
            "Incident analysis completed successfully"
        )
        
        logger.info("FINAL AI RESPONSE: %s", result)

        return IncidentAnalysisResponse.model_validate(
            result
        )

    except ProviderError as exc:
        logger.exception(
            "AI provider error: %s",
            exc,
        )

        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    except ValueError as exc:
        logger.exception(
            "AI analysis returned invalid response: %s",
            exc,
        )

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception(
            "Unexpected AI service error: %s",
            exc,
        )

        raise HTTPException(
            status_code=500,
            detail="Unexpected AI service error",
        ) from exc
