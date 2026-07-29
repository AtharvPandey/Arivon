"""
WhatsApp notifications via Twilio's WhatsApp API.

Design choice: this NEVER raises an exception that could break the calling
feature (e.g. attendance marking). A failed WhatsApp message is a real
problem worth logging, but it should never cause a teacher's attendance
save to fail — the two concerns are decoupled on purpose.
"""

import requests
from app.core.config import settings


def format_phone_for_whatsapp(phone: str) -> str:
    """
    Takes a raw 10-digit Indian number (e.g. "9876543210") and formats it
    the way Twilio's WhatsApp API expects: "whatsapp:+919876543210".
    If the number already includes a country code, it's left as is.
    """
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = "91" + digits  # assume India for now — matches our target market
    return f"whatsapp:+{digits}"


def send_whatsapp_message(to_phone: str, body: str) -> dict:
    if not settings.whatsapp_enabled or not settings.twilio_account_sid:
        # Dry-run mode: no Twilio account needed yet, but you can see
        # exactly what WOULD have been sent, and to whom.
        print(f"[WhatsApp DRY RUN] To {to_phone}: {body}")
        return {"status": "dry_run", "to": to_phone, "body": body}

    to = format_phone_for_whatsapp(to_phone)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"

    try:
        response = requests.post(
            url,
            data={
                "From": settings.twilio_whatsapp_number,
                "To": to,
                "Body": body,
            },
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[WhatsApp ERROR] Failed to send to {to_phone}: {e}")
        return {"status": "error", "error": str(e)}
