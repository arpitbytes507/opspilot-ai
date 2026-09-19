# import asyncio
# import json
# import os
# from abc import ABC, abstractmethod
# from typing import Any
# from urllib import error, request

# from app.prompts.rca import SYSTEM_PROMPT, build_prompt



# class ProviderError(Exception):
#     pass


# class LLMProvider(ABC):
#     @abstractmethod
#     async def analyze(self, context: dict[str, Any]) -> tuple[dict[str, Any], int | None, int | None]:
#         raise NotImplementedError


# class OpenAIProvider(LLMProvider):
#     def __init__(self) -> None:
#         self.api_key = os.getenv("LLM_API_KEY", "")
#         self.model = os.getenv("LLM_MODEL", "")
#         self.base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
#         self.timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))

#     async def analyze(self, context: dict[str, Any]) -> tuple[dict[str, Any], int | None, int | None]:
#         if not self.api_key or not self.model:
#             raise ProviderError("LLM provider is not configured")
#         payload = json.dumps({
#             "model": self.model,
#             "temperature": 0,
#             "response_format": {"type": "json_object"},
#             "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": build_prompt(context)}],
#         }).encode()
#         headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

#         def send() -> dict[str, Any]:
#             try:
#                 with request.urlopen(request.Request(f"{self.base_url}/chat/completions", data=payload, headers=headers, method="POST"), timeout=self.timeout) as response:
#                     return json.loads(response.read().decode())
#             except (error.URLError, TimeoutError, json.JSONDecodeError) as exc:
#                 raise ProviderError("LLM provider request failed") from exc

#         response = await asyncio.to_thread(send)
#         choices = response.get("choices", [])
#         if not choices or not isinstance(choices[0].get("message", {}).get("content"), str):
#             raise ProviderError("LLM provider returned no content")
#         try:
#             result = json.loads(choices[0]["message"]["content"])
#         except json.JSONDecodeError as exc:
#             raise ProviderError("LLM provider returned malformed JSON") from exc
#         usage = response.get("usage", {})
#         return result, usage.get("prompt_tokens"), usage.get("completion_tokens")


# def get_provider() -> LLMProvider:
#     provider = os.getenv("LLM_PROVIDER", "").lower()
#     if provider == "openai":
#         return OpenAIProvider()
#     raise ProviderError("LLM provider is not configured")


import asyncio
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Any
from urllib import error, request

from app.prompts.rca import SYSTEM_PROMPT, build_prompt


logger = logging.getLogger(__name__)


class ProviderError(Exception):
    pass


class LLMProvider(ABC):

    @abstractmethod
    async def analyze(
        self,
        context: dict[str, Any],
    ) -> tuple[
        dict[str, Any],
        int | None,
        int | None,
    ]:
        raise NotImplementedError


class GeminiProvider(LLMProvider):

    def __init__(self) -> None:

        self.api_key = os.getenv(
            "LLM_API_KEY",
            "",
        ).strip()

        self.model = os.getenv(
            "LLM_MODEL",
            "gemini-2.5-flash",
        ).strip()

        self.timeout = float(
            os.getenv(
                "LLM_TIMEOUT_SECONDS",
                "60",
            )
        )

        logger.info(
            "Gemini configuration: "
            "model=%s timeout=%ss api_key_present=%s",
            self.model,
            self.timeout,
            bool(self.api_key),
        )

        if not self.api_key:
            raise ProviderError(
                "Gemini API key is missing"
            )

    async def analyze(
        self,
        context: dict[str, Any],
    ) -> tuple[
        dict[str, Any],
        int | None,
        int | None,
    ]:

        user_prompt = build_prompt(context)

        payload = {
            "system_instruction": {
                "parts": [
                    {
                        "text": SYSTEM_PROMPT,
                    }
                ],
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": user_prompt,
                        }
                    ],
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
            },
        }

        payload_bytes = json.dumps(
            payload
        ).encode("utf-8")

        url = (
            "https://generativelanguage.googleapis.com"
            "/v1beta/models/"
            f"{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        headers = {
            "Content-Type": "application/json",
        }

        logger.info(
            "Sending incident analysis request to Gemini: "
            "model=%s",
            self.model,
        )

        def send() -> dict[str, Any]:

            try:
                req = request.Request(
                    url,
                    data=payload_bytes,
                    headers=headers,
                    method="POST",
                )

                with request.urlopen(
                    req,
                    timeout=self.timeout,
                ) as response:

                    body = response.read().decode(
                        "utf-8"
                    )

                    return json.loads(body)

            except error.HTTPError as exc:

                body = exc.read().decode(
                    "utf-8",
                    errors="replace",
                )

                logger.error(
                    "Gemini HTTP error: "
                    "status=%s reason=%s body=%s",
                    exc.code,
                    exc.reason,
                    body,
                )

                raise ProviderError(
                    f"Gemini API returned HTTP {exc.code}: "
                    f"{body}"
                ) from exc

            except error.URLError as exc:

                logger.error(
                    "Gemini network error: %s",
                    exc,
                )

                raise ProviderError(
                    "Unable to connect to Gemini API"
                ) from exc

            except TimeoutError as exc:

                logger.error(
                    "Gemini request timed out"
                )

                raise ProviderError(
                    "Gemini API request timed out"
                ) from exc

            except json.JSONDecodeError as exc:

                logger.error(
                    "Gemini returned invalid HTTP JSON"
                )

                raise ProviderError(
                    "Gemini returned invalid JSON"
                ) from exc

        response = await asyncio.to_thread(
            send
        )

        candidates = response.get(
            "candidates",
            [],
        )

        if not candidates:
            logger.error(
                "Gemini returned no candidates: %s",
                response,
            )

            raise ProviderError(
                "Gemini returned no candidates"
            )

        candidate = candidates[0]

        finish_reason = candidate.get(
            "finishReason"
        )

        if finish_reason:
            logger.info(
                "Gemini finish reason: %s",
                finish_reason,
            )

        content = candidate.get(
            "content",
            {},
        )

        parts = content.get(
            "parts",
            [],
        )

        if not parts:
            logger.error(
                "Gemini returned no content parts: %s",
                response,
            )

            raise ProviderError(
                "Gemini returned no content"
            )

        text_content = None

        for part in parts:
            if isinstance(part, dict):
                text_value = part.get("text")

                if isinstance(text_value, str):
                    text_content = text_value
                    break

        if not text_content:
            raise ProviderError(
                "Gemini returned no text content"
            )

        logger.info(
            "Gemini response received successfully"
        )

        try:
            result = json.loads(
                text_content
            )

        except json.JSONDecodeError as exc:

            logger.error(
                "Gemini returned invalid JSON: %s",
                text_content,
            )

            raise ProviderError(
                "Gemini returned invalid JSON"
            ) from exc

        if not isinstance(result, dict):
            raise ProviderError(
                "Gemini response JSON must be an object"
            )

        usage = response.get(
            "usageMetadata",
            {},
        )

        input_tokens = usage.get(
            "promptTokenCount"
        )

        output_tokens = usage.get(
            "candidatesTokenCount"
        )

        return (
            result,
            input_tokens,
            output_tokens,
        )


class OpenAIProvider(LLMProvider):

    def __init__(self) -> None:

        self.api_key = os.getenv(
            "LLM_API_KEY",
            "",
        ).strip()

        self.model = os.getenv(
            "LLM_MODEL",
            "",
        ).strip()

        self.base_url = os.getenv(
            "LLM_BASE_URL",
            "https://api.openai.com/v1",
        ).rstrip("/")

        self.timeout = float(
            os.getenv(
                "LLM_TIMEOUT_SECONDS",
                "60",
            )
        )

        logger.info(
            "OpenAI configuration: "
            "model=%s base_url=%s api_key_present=%s",
            self.model,
            self.base_url,
            bool(self.api_key),
        )

    async def analyze(
        self,
        context: dict[str, Any],
    ) -> tuple[
        dict[str, Any],
        int | None,
        int | None,
    ]:

        if not self.api_key:
            raise ProviderError(
                "OpenAI API key is missing"
            )

        if not self.model:
            raise ProviderError(
                "OpenAI model is missing"
            )

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": build_prompt(context),
                },
            ],
        }

        payload_bytes = json.dumps(
            payload
        ).encode("utf-8")

        headers = {
            "Authorization": (
                f"Bearer {self.api_key}"
            ),
            "Content-Type": "application/json",
        }

        logger.info(
            "Sending incident analysis request "
            "to OpenAI: model=%s",
            self.model,
        )

        def send() -> dict[str, Any]:

            try:

                req = request.Request(
                    f"{self.base_url}/chat/completions",
                    data=payload_bytes,
                    headers=headers,
                    method="POST",
                )

                with request.urlopen(
                    req,
                    timeout=self.timeout,
                ) as response:

                    return json.loads(
                        response.read().decode()
                    )

            except error.HTTPError as exc:

                body = exc.read().decode(
                    "utf-8",
                    errors="replace",
                )

                logger.error(
                    "OpenAI HTTP error: "
                    "status=%s reason=%s body=%s",
                    exc.code,
                    exc.reason,
                    body,
                )

                raise ProviderError(
                    f"OpenAI API returned HTTP {exc.code}"
                ) from exc

            except (
                error.URLError,
                TimeoutError,
            ) as exc:

                logger.error(
                    "OpenAI request failed: %s",
                    exc,
                )

                raise ProviderError(
                    "OpenAI provider request failed"
                ) from exc

            except json.JSONDecodeError as exc:

                raise ProviderError(
                    "OpenAI returned invalid JSON"
                ) from exc

        response = await asyncio.to_thread(
            send
        )

        choices = response.get(
            "choices",
            [],
        )

        if not choices:
            raise ProviderError(
                "OpenAI provider returned no choices"
            )

        message = choices[0].get(
            "message",
            {},
        )

        content = message.get(
            "content"
        )

        if not isinstance(content, str):
            raise ProviderError(
                "OpenAI provider returned no content"
            )

        try:
            result = json.loads(content)

        except json.JSONDecodeError:

            result = {
                "raw_output": content
            }

        usage = response.get(
            "usage",
            {},
        )

        return (
            result,
            usage.get("prompt_tokens"),
            usage.get("completion_tokens"),
        )


def get_provider() -> LLMProvider:

    provider = os.getenv(
        "LLM_PROVIDER",
        "",
    ).strip().lower()

    logger.info(
        "Selecting LLM provider: provider=%r",
        provider,
    )

    if provider == "gemini":
        logger.info(
            "Creating GeminiProvider"
        )
        return GeminiProvider()

    if provider == "openai":
        logger.info(
            "Creating OpenAIProvider"
        )
        return OpenAIProvider()

    raise ProviderError(
        f"Unsupported LLM provider: {provider}"
    )
