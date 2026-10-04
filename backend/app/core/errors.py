from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Domain error carrying an HTTP status and a stable machine-readable code."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class ConflictError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(409, code, message)


class NotFoundError(AppError):
    def __init__(self, code: str = "not_found", message: str = "Not found") -> None:
        super().__init__(404, code, message)


class UnauthorizedError(AppError):
    def __init__(self, code: str = "unauthorized", message: str = "Not authenticated") -> None:
        super().__init__(401, code, message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
