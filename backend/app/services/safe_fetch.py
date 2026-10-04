"""Fetch a user-supplied URL without letting it reach our own network (SSRF protection).

Rules: http or https on the default ports only, every resolved address must be public, each
redirect hop is checked again, and the body is capped in size and time.

Known limit: the address is checked at resolution time and httpx resolves again when it
connects, so a DNS server that changes its answer in between (rebinding) is not fully
blocked. Run the API without access to internal services, as the hosting setup already does.
"""

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpx

from app.core.errors import AppError

MAX_BYTES = 2 * 1024 * 1024
TIMEOUT_SECONDS = 10.0
MAX_REDIRECTS = 4
USER_AGENT = "Mozilla/5.0 (compatible; RolenestJobImport/1.0)"

Resolver = Callable[[str], Awaitable[list[str]]]


class FetchError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(422, code, message)


@dataclass(frozen=True)
class FetchedPage:
    url: str
    text: str


async def resolve_host(host: str) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    return [str(info[4][0]) for info in infos]


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


class UrlFetcher:
    def __init__(
        self,
        resolver: Resolver = resolve_host,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._resolve = resolver
        self._transport = transport

    async def _check(self, url: str) -> None:
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            raise FetchError("invalid_url", "Paste a full link that starts with https://")
        if parts.username or parts.password:
            raise FetchError("invalid_url", "Links with a username or password aren't supported.")
        if parts.port not in (None, 80, 443):
            raise FetchError("invalid_url", "That link uses an unusual port and can't be opened.")
        try:
            addresses = await self._resolve(parts.hostname)
        except (OSError, UnicodeError) as exc:
            raise FetchError("unreachable", "We couldn't find that website.") from exc
        if not addresses or not all(_is_public(a) for a in addresses):
            raise FetchError("invalid_url", "That link points to a private address.")

    async def fetch(self, url: str) -> FetchedPage:
        async with httpx.AsyncClient(
            transport=self._transport,
            timeout=TIMEOUT_SECONDS,
            follow_redirects=False,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        ) as client:
            current = url
            for _ in range(MAX_REDIRECTS + 1):
                await self._check(current)
                try:
                    async with client.stream("GET", current) as response:
                        if response.is_redirect:
                            location = response.headers.get("location")
                            if not location:
                                raise FetchError("unreachable", "The site sent a broken redirect.")
                            current = urljoin(current, location)
                            continue
                        if response.status_code >= 400:
                            raise FetchError(
                                "unreachable",
                                f"The site answered with an error ({response.status_code}). "
                                "The posting may have closed.",
                            )
                        body = bytearray()
                        async for chunk in response.aiter_bytes():
                            body.extend(chunk)
                            if len(body) > MAX_BYTES:
                                raise FetchError("too_large", "That page is too large to read.")
                        encoding = response.encoding or "utf-8"
                        return FetchedPage(url=current, text=body.decode(encoding, "replace"))
                except httpx.TimeoutException as exc:
                    raise FetchError("unreachable", "The site took too long to answer.") from exc
                except httpx.HTTPError as exc:
                    raise FetchError("unreachable", "We couldn't open that link.") from exc
        raise FetchError("unreachable", "The link redirected too many times.")
