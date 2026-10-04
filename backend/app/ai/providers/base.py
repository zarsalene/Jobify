"""The provider boundary. The rest of the app depends on AIProvider, never on a vendor SDK.

Implementations: OpenRouterProvider today; a local LLM or other vendors can be added later.
The ai package must not import from app.api: it stays independent of the HTTP layer.
"""

from dataclasses import dataclass
from typing import Literal, Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True)
class AIRequest:
    model: str
    messages: tuple[ChatMessage, ...]
    json_mode: bool = False
    max_output_tokens: int = 1024
    temperature: float = 0.2
    timeout_seconds: float = 60.0


@dataclass(frozen=True)
class AIResponse:
    text: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    latency_ms: int
    estimated_cost: float = 0.0


class ProviderError(Exception):
    """A provider call failed. `code` is safe to store and show; never carries prompt content."""

    def __init__(self, code: str, *, retryable: bool) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable


class AIProvider(Protocol):
    name: str

    async def generate(self, request: AIRequest) -> AIResponse: ...
