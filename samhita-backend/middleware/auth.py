"""
Authentication middleware.
For hackathon demo: auth is disabled — all requests pass through.
"""
import os
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = "dev-user"
        return await call_next(request)
