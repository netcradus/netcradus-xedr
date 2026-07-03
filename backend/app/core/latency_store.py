"""
Rolling in-memory store for per-route API latency samples.
Keeps the last 1 000 measurements per route — no external dependency.
"""
import threading
from collections import defaultdict, deque
from typing import Optional

_lock    = threading.Lock()
_samples: dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))


def record(route: str, latency_ms: float) -> None:
    with _lock:
        _samples[route].append(latency_ms)


def get_stats(route: Optional[str] = None) -> list[dict]:
    """
    Return latency stats per route, sorted by avg descending.
    Pass route= to filter to a single route.
    """
    with _lock:
        items = (
            [(route, list(_samples[route]))] if route and route in _samples
            else [(r, list(v)) for r, v in _samples.items()]
        )

    result = []
    for r, vals in items:
        if not vals:
            continue
        lst = sorted(vals)
        n   = len(lst)
        result.append({
            "route":   r,
            "count":   n,
            "avg_ms":  round(sum(lst) / n, 1),
            "p50_ms":  round(lst[n // 2], 1),
            "p95_ms":  round(lst[max(0, int(n * 0.95) - 1)], 1),
            "p99_ms":  round(lst[max(0, int(n * 0.99) - 1)], 1),
            "max_ms":  round(lst[-1], 1),
        })
    return sorted(result, key=lambda x: x["avg_ms"], reverse=True)
