import ipaddress
import socket
import time
from threading import Lock
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx


class WebFetchError(ValueError):
    pass


MAX_PAGE_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 3
USER_AGENT = "ResearchIntelligenceAgent/0.1 (+public-web-ingestion)"
_domain_lock = Lock()
_domain_locks: dict[str, Lock] = {}
_domain_last_request: dict[str, float] = {}


def _wait_for_domain(url: str) -> None:
    from app.settings import settings

    host = urlsplit(url).hostname or ""
    with _domain_lock:
        host_lock = _domain_locks.setdefault(host, Lock())
    with host_lock:
        delay = settings.domain_min_interval_seconds - (
            time.monotonic() - _domain_last_request.get(host, 0)
        )
        if delay > 0:
            time.sleep(delay)
        _domain_last_request[host] = time.monotonic()


def validate_public_url(url: str) -> str:
    if len(url) > 2048:
        raise WebFetchError("The URL is too long.")
    parsed = urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise WebFetchError("Only public HTTP and HTTPS URLs are supported.")
    if parsed.username or parsed.password:
        raise WebFetchError("URLs containing credentials are not allowed.")
    host = parsed.hostname.rstrip(".").lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".localhost"):
        raise WebFetchError("Private and local network addresses are not allowed.")
    try:
        addresses = {
            ipaddress.ip_address(item[4][0].split("%", 1)[0])
            for item in socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
        }
    except (OSError, ValueError) as exc:
        raise WebFetchError("The URL host could not be resolved.") from exc
    if not addresses or any(not address.is_global for address in addresses):
        raise WebFetchError("Private and local network addresses are not allowed.")
    normalized = parsed._replace(fragment="")
    return urlunsplit(normalized)


def _read_public_response(url: str) -> tuple[int, str, bytes, str]:
    current_url = url
    timeout = httpx.Timeout(12.0, connect=5.0)
    with httpx.Client(
        timeout=timeout,
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT},
        trust_env=False,
    ) as client:
        for redirect_count in range(MAX_REDIRECTS + 1):
            current_url = validate_public_url(current_url)
            _wait_for_domain(current_url)
            with client.stream("GET", current_url) as response:
                if response.is_redirect:
                    if redirect_count == MAX_REDIRECTS:
                        raise WebFetchError("The page redirected too many times.")
                    location = response.headers.get("location")
                    if not location:
                        raise WebFetchError("The page returned an invalid redirect.")
                    current_url = urljoin(current_url, location)
                    continue
                content_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                content_length = response.headers.get("content-length")
                if content_length:
                    try:
                        declared_size = int(content_length)
                    except ValueError as exc:
                        raise WebFetchError("The page returned an invalid content length.") from exc
                    if declared_size > MAX_PAGE_BYTES:
                        raise WebFetchError("The page is larger than the allowed limit.")
                body = bytearray()
                for part in response.iter_bytes():
                    if len(body) + len(part) > MAX_PAGE_BYTES:
                        raise WebFetchError("The page is larger than the allowed limit.")
                    body.extend(part)
                return response.status_code, content_type, bytes(body), str(response.url)
    raise WebFetchError("The page could not be fetched.")


def fetch_public_page(url: str) -> tuple[str, str, str, str]:
    safe_url = validate_public_url(url)
    parsed = urlsplit(safe_url)
    robots_url = urlunsplit((parsed.scheme, parsed.netloc, "/robots.txt", "", ""))
    try:
        robots_status, robots_type, robots_body, robots_final_url = _read_public_response(robots_url)
    except (httpx.RequestError, WebFetchError) as exc:
        raise WebFetchError("Could not verify this website's public access policy.") from exc
    if robots_status in {401, 403}:
        raise WebFetchError("This website does not permit automated access.")
    if robots_status not in {200, 404}:
        raise WebFetchError("Could not verify this website's public access policy.")
    if robots_status == 200 and robots_type not in {"text/plain", "application/octet-stream"}:
        raise WebFetchError("Could not verify this website's public access policy.")
    if robots_status == 200:
        robots = RobotFileParser()
        robots.set_url(robots_final_url)
        robots.parse(robots_body.decode("utf-8", errors="replace").splitlines())
        if not robots.can_fetch(USER_AGENT, safe_url):
            raise WebFetchError("This website does not permit automated access to this page.")
    status, content_type, body, final_url = _read_public_response(safe_url)
    if status in {401, 403, 407}:
        raise WebFetchError("The page is not publicly accessible.")
    if status < 200 or status >= 300:
        raise WebFetchError(f"The page returned HTTP {status}.")
    if content_type not in {"text/html", "application/xhtml+xml", "text/plain"}:
        raise WebFetchError("This URL does not point to a supported text page.")
    return content_type, body, final_url, safe_url
