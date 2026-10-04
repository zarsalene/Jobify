import time
from typing import Any

import httpx

from app.ai.providers.base import AIRequest, AIResponse, ProviderError


class OpenRouterProvider:
    """OpenRouter chat-completions adapter. The API key never leaves the backend.

    Error messages carry only a short code, never the response body, because bodies can echo
    prompts that contain personal data.
    """

    name = "openrouter"

    def __init__(
        self,
        api_key: str | None,
        base_url: str = "https://openrouter.ai/api/v1",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._client = client

    async def generate(self, request: AIRequest) -> AIResponse:
        if not self._api_key:
            raise ProviderError("not_configured", retryable=False)

        payload: dict[str, Any] = {
            "model": request.model,
            "messages": [{"role": m.role, "content": m.content} for m in request.messages],
            "max_tokens": request.max_output_tokens,
            "temperature": request.temperature,
        }
        if request.json_mode:
            payload["response_format"] = {"type": "json_object"}

        started = time.perf_counter()
        try:
            response = await self._post(payload, request.timeout_seconds)
        except httpx.TimeoutException as exc:
            raise ProviderError("timeout", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise ProviderError("network_error", retryable=True) from exc

        if response.status_code == 429 or response.status_code >= 500:
            raise ProviderError(f"http_{response.status_code}", retryable=True)
        if response.status_code >= 400:
            raise ProviderError(f"http_{response.status_code}", retryable=False)

        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderError("invalid_response", retryable=True) from exc
        # OpenRouter can answer 200 with an error object when the upstream model fails.
        if "error" in data or not data.get("choices"):
            raise ProviderError("upstream_error", retryable=True)

        content = data["choices"][0].get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            raise ProviderError("empty_response", retryable=True)

        usage = data.get("usage") or {}
        return AIResponse(
            text=content,
            provider=self.name,
            model=str(data.get("model") or request.model),
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
            latency_ms=int((time.perf_counter() - started) * 1000),
            estimated_cost=float(usage.get("cost") or 0.0),
        )

    async def _post(self, payload: dict[str, Any], limit_seconds: float) -> httpx.Response:
        headers = {"Authorization": f"Bearer {self._api_key}"}
        url = f"{self._base_url}/chat/completions"
        if self._client is not None:
            return await self._client.post(
                url, json=payload, headers=headers, timeout=limit_seconds
            )
        async with httpx.AsyncClient() as client:
            return await client.post(url, json=payload, headers=headers, timeout=limit_seconds)
