"""Thin wrapper around the Anthropic SDK for the digest pipeline.

Every call asks for JSON that matches a schema (structured outputs), opts into
server-side refusal fallbacks, and caches the stable system prompt.
"""

from __future__ import annotations

import json
import os
import sys

try:
    import anthropic
except ImportError:  # the pipeline still runs with heuristic scoring
    anthropic = None

FALLBACK_BETA = "server-side-fallback-2026-07-01"
_client = None


def available() -> bool:
    return anthropic is not None and bool(
        os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def ask_json(*, model: str, system: str, prompt: str, schema: dict, effort: str | None = None,
             web_search: int = 0, max_tokens: int = 16000) -> dict | None:
    """Return parsed JSON matching ``schema``, or None if the call fails or is refused."""
    kwargs = dict(
        model=model,
        max_tokens=max_tokens,
        betas=[FALLBACK_BETA],
        fallbacks="default",
        cache_control={"type": "ephemeral"},
        thinking={"type": "adaptive"},
        system=system,
        messages=[{"role": "user", "content": prompt}],
        output_config={"format": {"type": "json_schema", "schema": schema}},
    )
    if effort:
        kwargs["output_config"]["effort"] = effort
    if web_search:
        kwargs["tools"] = [{"type": "web_search_20260209", "name": "web_search", "max_uses": web_search}]

    base_messages = kwargs["messages"]
    paused: list = []
    try:
        for _ in range(4):  # server tools (web search) may pause a long turn; resume it
            with client().beta.messages.stream(**kwargs) as stream:
                response = stream.get_final_message()
            if response.stop_reason != "pause_turn":
                break
            paused = paused + list(response.content)
            kwargs["messages"] = base_messages + [{"role": "assistant", "content": paused}]
    except anthropic.RateLimitError as e:
        print(f"  claude: rate limited ({e.message})", file=sys.stderr)
        return None
    except anthropic.APIStatusError as e:
        print(f"  claude: API error {e.status_code}: {e.message}", file=sys.stderr)
        return None
    except anthropic.APIConnectionError as e:
        print(f"  claude: connection error: {e}", file=sys.stderr)
        return None

    if response.stop_reason == "refusal":
        category = response.stop_details.category if response.stop_details else None
        print(f"  claude: request declined (category={category})", file=sys.stderr)
        return None
    if response.stop_reason == "max_tokens":
        print("  claude: response hit max_tokens; skipping", file=sys.stderr)
        return None

    # With server tools the final text block holds the JSON answer.
    texts = [b.text for b in response.content if b.type == "text"]
    if not texts:
        return None
    try:
        return json.loads(texts[-1])
    except json.JSONDecodeError:
        print("  claude: could not parse JSON response", file=sys.stderr)
        return None
