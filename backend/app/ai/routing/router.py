from app.ai.routing.tasks import TIER_BY_TASK, AITask, ModelTier
from app.core.config import Settings


class ModelRouter:
    """Decides which models to try, in order, for a task. All names come from settings."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def chain(self, task: AITask) -> list[str]:
        s = self._settings
        by_tier = {
            ModelTier.FAST: s.ai_model_fast,
            ModelTier.BALANCED: s.ai_model_balanced,
            ModelTier.REASONING: s.ai_model_reasoning,
        }
        primary = s.ai_task_models.get(task.value) or by_tier[TIER_BY_TASK[task]]
        ordered = [primary, *s.ai_model_fallbacks]
        return list(dict.fromkeys(m for m in ordered if m))
