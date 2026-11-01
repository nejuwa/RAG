import sys
from typing import Any

import httpx

from app.providers import GEMINI_API_BASE, ProviderError
from app.settings import settings


def _generation_model_names(body: dict[str, Any]) -> list[str]:
    result: list[str] = []
    for model in body.get("models", []):
        if not isinstance(model, dict):
            continue
        methods = model.get("supportedGenerationMethods", [])
        name = model.get("name")
        if (
            isinstance(name, str)
            and isinstance(methods, list)
            and "generateContent" in methods
        ):
            result.append(name.removeprefix("models/"))
    return result


def list_generation_models() -> list[str]:
    if not settings.gemini_api_key:
        raise ProviderError("GEMINI_API_KEY is not set in the project-root .env file.")

    model_names: list[str] = []
    page_token: str | None = None
    try:
        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=8.0),
            trust_env=False,
        ) as client:
            while True:
                params: dict[str, str] = {"key": settings.gemini_api_key}
                if page_token:
                    params["pageToken"] = page_token
                response = client.get(f"{GEMINI_API_BASE}/models", params=params)
                response.raise_for_status()
                body: dict[str, Any] = response.json()
                model_names.extend(_generation_model_names(body))
                page_token = body.get("nextPageToken")
                if not page_token:
                    break
    except httpx.TimeoutException as exc:
        raise ProviderError("Timed out while checking Gemini models. Please retry.") from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code in {401, 403}:
            raise ProviderError(
                "Gemini rejected the configured API key. Check GEMINI_API_KEY in .env."
            ) from exc
        raise ProviderError(
            f"Gemini model listing failed with HTTP {status_code}. Check network access and try again."
        ) from exc
    except (httpx.RequestError, ValueError) as exc:
        raise ProviderError(
            "Could not reach Gemini to list models. Check network access and try again."
        ) from exc
    return sorted(set(model_names))


def main() -> int:
    try:
        models = list_generation_models()
    except ProviderError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if not models:
        print("Gemini returned no models supporting generateContent.", file=sys.stderr)
        return 1
    print("Models available to this API key for answer generation:")
    for model in models:
        print(model)
    print("\nSet GEMINI_MODEL in the project-root .env to one of these names.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
