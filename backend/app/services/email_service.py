import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings


def _send(to: str, subject: str, html: str) -> bool:
    if not settings.smtp_host or not settings.smtp_user:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as srv:
            srv.ehlo()
            if settings.smtp_port != 465:
                srv.starttls()
            srv.login(settings.smtp_user, settings.smtp_pass)
            srv.sendmail(settings.smtp_from, [to], msg.as_string())
        return True
    except Exception:
        return False


def _send_async(to: str, subject: str, html: str) -> None:
    """Dispatch to Celery when Redis is available, fall back to a thread."""
    try:
        from app.tasks.notifications import send_email_task
        send_email_task.delay(to, subject, html)
    except Exception:
        threading.Thread(target=_send, args=(to, subject, html), daemon=True).start()


def send_verification_email(to: str, token: str) -> None:
    url = f"{settings.app_url}/verify-email?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a5f">Verify your SentryXDR email</h2>
      <p>Thanks for signing up! Click the button below to verify your email address.</p>
      <a href="{url}" style="display:inline-block;margin:16px 0;padding:12px 24px;
         background:#3366cc;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
        Verify Email
      </a>
      <p style="color:#888;font-size:13px">Link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      <p style="color:#bbb;font-size:12px">Or paste: {url}</p>
    </div>
    """
    _send_async(to, "Verify your SentryXDR email", html)


def send_password_reset_email(to: str, token: str) -> None:
    url = f"{settings.app_url}/reset-password?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a5f">Reset your password</h2>
      <p>We received a request to reset your SentryXDR password.</p>
      <a href="{url}" style="display:inline-block;margin:16px 0;padding:12px 24px;
         background:#3366cc;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">
        Reset Password
      </a>
      <p style="color:#888;font-size:13px">Link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      <p style="color:#bbb;font-size:12px">Or paste: {url}</p>
    </div>
    """
    _send_async(to, "Reset your SentryXDR password", html)
