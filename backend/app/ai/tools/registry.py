import json
from typing import Any

from pydantic import BaseModel, ValidationError

from app.ai.tools.base import Tool, ToolContext


class ToolArgumentsError(ValueError):
    """The model proposed arguments that do not match the tool's schema."""


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        if tool.name in self._tools:
            raise ValueError(f"tool '{tool.name}' is already registered")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def validate_args(self, tool: Tool, args: dict[str, Any]) -> BaseModel:
        try:
            return tool.args_model.model_validate(args)
        except ValidationError as exc:
            fields = ", ".join(str(e["loc"][0]) for e in exc.errors() if e["loc"])
            raise ToolArgumentsError(f"invalid arguments: {fields or 'see schema'}") from exc

    async def execute(self, tool: Tool, ctx: ToolContext, args: dict[str, Any]) -> dict[str, Any]:
        """The only place a tool handler runs. Callers must have applied the permission policy."""
        return await tool.handler(ctx, self.validate_args(tool, args))

    def describe(self) -> str:
        """Tool list shown to the model: name, permission, description and argument schema."""
        lines = []
        for tool in self._tools.values():
            schema = json.dumps(tool.args_model.model_json_schema().get("properties", {}))
            lines.append(
                f"- {tool.name} [{tool.permission.value}]: {tool.description} args={schema}"
            )
        return "\n".join(lines) or "(no tools available)"
