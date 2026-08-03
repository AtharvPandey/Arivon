"""
A minimal in-process domain event bus. This is deliberately NOT a
message queue or external broker (Kafka/SQS/etc.) — the whole app runs
as one process today, so a synchronous in-process dispatcher is the
right-sized tool. The point isn't distributed messaging; it's
decoupling: Admissions shouldn't need to know that Transport, Library,
Hostel, RFID, Smart Card, Biometric, or LMS modules exist, or ever
import their code. It just publishes what happened.

Usage:
    from app.core.events import publish, subscribe

    # A future module registers interest, once, at import time:
    subscribe("student_enrolled", my_handler_function)

    # Admissions just announces the fact, with no knowledge of who's listening:
    publish("student_enrolled", {"student_id": 42, ...})

Every publish is also durably logged to the domain_events table (see
DomainEvent in models.py) — this gives an audit trail ("what happened
and when") independent of whether any handler was registered for it at
the time, and lets a future module backfill from history if it's stood
up after some students were already enrolled.
"""

import json
import logging
from collections import defaultdict
from datetime import datetime

logger = logging.getLogger("events")

_subscribers = defaultdict(list)


def subscribe(event_name: str, handler) -> None:
    """Register a function to be called whenever `event_name` is
    published. Handlers receive one argument: the event payload dict.
    A handler that raises is logged and swallowed — one broken future
    subscriber should never be able to break the Admissions flow that
    triggered it."""
    _subscribers[event_name].append(handler)


def publish(event_name: str, payload: dict, db=None) -> None:
    """Announce that something happened. Runs every registered handler
    synchronously, then always persists the event to the durable log
    (if a db session is provided) regardless of handler outcomes."""
    for handler in _subscribers[event_name]:
        try:
            handler(payload)
        except Exception:
            logger.exception("Event handler for '%s' failed", event_name)

    if db is not None:
        from app import models
        db.add(models.DomainEvent(
            event_name=event_name,
            payload_json=json.dumps(payload, default=str),
            occurred_at=datetime.utcnow(),
        ))
        db.commit()
