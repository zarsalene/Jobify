from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base for client-facing schemas: snake_case in Python, camelCase on the wire.

    Auth schemas predate this and stay snake_case, matching the existing mobile client.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
