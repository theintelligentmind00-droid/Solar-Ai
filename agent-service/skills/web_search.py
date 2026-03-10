from __future__ import annotations

import os
import re
from typing import Any

import httpx


async def _search_brave(query: str, max_results: int) -> list[dict[str, Any]]:
    """Search the web via Brave Search API."""
    api_key = os.environ.get("BRAVE_SEARCH_API_KEY", "")
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": api_key,
    }
    params = {"q": query, "count": max_results}
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers=headers,
            params=params,
        )
        response.raise_for_status()
        data = response.json()
    results = data.get("web", {}).get("results", [])
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("description", ""),
        }
        for r in results
    ]


async def _search_tavily(query: str, max_results: int) -> list[dict[str, Any]]:
    """Search the web via Tavily API."""
    api_key = os.environ.get("TAVILY_API_KEY", "")
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": "basic",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://api.tavily.com/search", json=payload
        )
        response.raise_for_status()
        data = response.json()
    results = data.get("results", [])
    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "score": r.get("score", 0.0),
        }
        for r in results
    ]


async def search_web(
    query: str, max_results: int = 5
) -> list[dict[str, Any]]:
    """Search the web, preferring Brave Search API, falling back to Tavily."""
    brave_key = os.environ.get("BRAVE_SEARCH_API_KEY", "")
    tavily_key = os.environ.get("TAVILY_API_KEY", "")

    if not brave_key and not tavily_key:
        return [
            {
                "error": (
                    "No web search API key configured. "
                    "Add BRAVE_SEARCH_API_KEY or TAVILY_API_KEY to .env to enable web search."
                )
            }
        ]

    if brave_key:
        try:
            return await _search_brave(query, max_results)
        except Exception as exc:
            if not tavily_key:
                return [{"error": f"Brave Search failed: {exc}"}]
            # fall through to Tavily

    try:
        return await _search_tavily(query, max_results)
    except Exception as exc:
        return [{"error": f"Web search failed: {exc}"}]


async def fetch_url(url: str) -> str:
    """Fetch and clean text content from a URL."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.text
    except Exception as exc:
        return f"Failed to fetch URL: {exc}"

    text = re.sub(r"<[^>]+>", " ", html_content)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:8000]
