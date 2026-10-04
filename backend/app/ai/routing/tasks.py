from enum import StrEnum


class AITask(StrEnum):
    JOB_CLASSIFICATION = "job_classification"
    JOB_EXTRACTION = "job_extraction"
    JOB_MATCHING = "job_matching"
    CV_ANALYSIS = "cv_analysis"
    CV_OPTIMIZATION = "cv_optimization"
    COVER_LETTER = "cover_letter"
    EMAIL = "email"
    LINKEDIN_OPTIMIZATION = "linkedin_optimization"
    LINKEDIN_POST = "linkedin_post"
    CAREER_PLANNING = "career_planning"
    AGENT_REASONING = "agent_reasoning"


class ModelTier(StrEnum):
    FAST = "fast"
    BALANCED = "balanced"
    REASONING = "reasoning"


TIER_BY_TASK: dict[AITask, ModelTier] = {
    AITask.JOB_CLASSIFICATION: ModelTier.FAST,
    AITask.JOB_EXTRACTION: ModelTier.FAST,
    AITask.EMAIL: ModelTier.FAST,
    AITask.JOB_MATCHING: ModelTier.BALANCED,
    AITask.CV_ANALYSIS: ModelTier.BALANCED,
    AITask.CV_OPTIMIZATION: ModelTier.BALANCED,
    AITask.COVER_LETTER: ModelTier.BALANCED,
    AITask.LINKEDIN_OPTIMIZATION: ModelTier.BALANCED,
    AITask.LINKEDIN_POST: ModelTier.BALANCED,
    AITask.CAREER_PLANNING: ModelTier.REASONING,
    AITask.AGENT_REASONING: ModelTier.REASONING,
}
