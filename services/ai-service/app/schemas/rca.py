from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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

    analysisType: Literal["ROOT_CAUSE", "COPILOT", "POSTMORTEM"]
    incident: dict[str, Any]
    events: list[dict[str, Any]] = Field(max_length=50)
    deployments: list[dict[str, Any]] = Field(max_length=10)
    history: list[dict[str, Any]] = Field(max_length=20)
    message: str | None = Field(default=None, min_length=1, max_length=4000)
    conversation: list[ConversationMessage] = Field(default_factory=list, max_length=10)
    status: Literal["DETECTED", "OPEN", "INVESTIGATING", "MITIGATED", "RESOLVED", "POSTMORTEM"] | None = None
    resolvedAt: str | None = None

    @model_validator(mode="after")
    def validate_analysis_context(self) -> "IncidentAnalysisRequest":
        if self.analysisType == "COPILOT" and self.message is None:
            raise ValueError("message is required for copilot analysis")
        if self.analysisType == "POSTMORTEM" and self.status not in {"RESOLVED", "POSTMORTEM"}:
            raise ValueError("postmortem analysis requires a resolved incident")
        return self


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["USER", "ASSISTANT"]
    content: str = Field(min_length=1, max_length=8000)


class ObservedFact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fact: str = Field(min_length=1, max_length=2000)
    evidenceIds: list[str] = Field(max_length=20)


class Inference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    inference: str = Field(min_length=1, max_length=2000)
    confidence: float = Field(ge=0, le=1)
    evidenceIds: list[str] = Field(max_length=20)


class PostmortemImpact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1, max_length=2000)
    duration: str | None = Field(default=None, max_length=200)


class TimelineEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: str = Field(min_length=1, max_length=50)
    event: str = Field(min_length=1, max_length=500)
    evidenceIds: list[str] = Field(max_length=20)


class PostmortemRootCause(BaseModel):
    model_config = ConfigDict(extra="forbid")

    description: str = Field(min_length=1, max_length=2000)
    confidence: float = Field(ge=0, le=1)
    evidenceIds: list[str] = Field(max_length=20)


class ContributingFactor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    factor: str = Field(min_length=1, max_length=1000)
    evidenceIds: list[str] = Field(max_length=20)


class PreventionRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendation: str = Field(min_length=1, max_length=1000)
    priority: Literal["HIGH", "MEDIUM", "LOW"]


class AnalysisResponseMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=200)
    modelVersion: str | None = Field(default=None, max_length=200)
    promptVersion: str = Field(default=PROMPT_VERSION, max_length=50)
    inputTokens: int | None = Field(default=None, ge=0)
    outputTokens: int | None = Field(default=None, ge=0)

    @field_validator("promptVersion")
    @classmethod
    def require_current_prompt(cls, value: str) -> str:
        if value != PROMPT_VERSION:
            raise ValueError("unsupported prompt version")
        return value


class IncidentAnalysisResponse(AnalysisResponseMetadata):
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

class CopilotAnalysisResponse(AnalysisResponseMetadata):
    analysisType: Literal["COPILOT"]
    answer: str = Field(min_length=1, max_length=8000)
    confidence: float = Field(ge=0, le=1)
    observedFacts: list[ObservedFact] = Field(max_length=20)
    inferences: list[Inference] = Field(max_length=20)
    recommendedActions: list[Recommendation] = Field(max_length=20)
    followUpQuestions: list[str] = Field(max_length=10)


class PostmortemAnalysisResponse(AnalysisResponseMetadata):
    analysisType: Literal["POSTMORTEM"]
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=4000)
    impact: PostmortemImpact
    timeline: list[TimelineEntry] = Field(max_length=40)
    rootCause: PostmortemRootCause
    contributingFactors: list[ContributingFactor] = Field(max_length=20)
    resolution: list[str] = Field(max_length=10)
    prevention: list[PreventionRecommendation] = Field(max_length=20)
    lessonsLearned: list[str] = Field(max_length=10)