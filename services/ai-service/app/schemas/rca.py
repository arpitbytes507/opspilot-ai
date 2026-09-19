from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


PROMPT_VERSION = "v1"


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["event", "deployment", "history", "metric"]
    id: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=1000)


class Recommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(min_length=1, max_length=1000)
    reason: str = Field(min_length=1, max_length=1000)
    priority: Literal["HIGH", "MEDIUM", "LOW"]


class AlternativeCause(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cause: str = Field(min_length=1, max_length=1000)
    confidence: float = Field(ge=0, le=1)


class IncidentAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysisType: Literal["ROOT_CAUSE"]
    incident: dict[str, Any]
    events: list[dict[str, Any]] = Field(max_length=50)
    deployments: list[dict[str, Any]] = Field(max_length=10)
    history: list[dict[str, Any]] = Field(max_length=20)


class IncidentAnalysisResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysisType: Literal["ROOT_CAUSE"]

    rootCause: str = Field(
        min_length=1,
        max_length=2000,
    )

    confidence: float = Field(
        ge=0,
        le=1,
    )

    summary: str = Field(
        min_length=1,
        max_length=4000,
    )

    evidence: list[Evidence] = Field(
        max_length=20,
    )

    recommendations: list[Recommendation] = Field(
        max_length=20,
    )

    alternativeCauses: list[AlternativeCause] = Field(
        max_length=10,
    )

    model: str = Field(
        min_length=1,
        max_length=200,
    )

    modelVersion: str | None = Field(
        default=None,
        max_length=200,
    )

    promptVersion: str = Field(
        default=PROMPT_VERSION,
        max_length=50,
    )

    inputTokens: int | None = Field(
        default=None,
        ge=0,
    )

    outputTokens: int | None = Field(
        default=None,
        ge=0,
    )

    @field_validator("promptVersion")
    @classmethod
    def require_current_prompt(cls, value: str) -> str:
        if value != PROMPT_VERSION:
            raise ValueError("unsupported prompt version")

        return value