import re
from typing import Any

SECRET_KEY = re.compile(r"password|passwd|secret|token|authorization|cookie|api[-_]?key|jwt|credential|connection[-_]?string", re.I)
BEARER = re.compile(r"Bearer\s+[A-Za-z0-9._~-]+", re.I)
CONNECTION = re.compile(r"(?:postgres(?:ql)?|redis)://[^\s]+", re.I)
TOKEN = re.compile(r"\b(?:eyJ|sk-)[A-Za-z0-9._~-]+\b")


def sanitize_context(value: Any, key: str = "") -> Any:
    if SECRET_KEY.search(key):
        return "[REDACTED]"
    if isinstance(value, str):
        return TOKEN.sub("[REDACTED_TOKEN]", CONNECTION.sub("[REDACTED_CONNECTION_STRING]", BEARER.sub("Bearer [REDACTED]", value)))[:4000]
    if isinstance(value, list):
        return [sanitize_context(item) for item in value]
    if isinstance(value, dict):
        return {entry_key: sanitize_context(entry_value, entry_key) for entry_key, entry_value in value.items()}
    return value