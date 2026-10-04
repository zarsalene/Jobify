import re
from dataclasses import dataclass
from pathlib import Path
from string import Template

_PROMPTS_DIR = Path(__file__).parent
_VERSION_FILE = re.compile(r"^v(\d+)\.txt$")


@dataclass(frozen=True)
class Prompt:
    """A versioned prompt. name and version are recorded with every AI request."""

    name: str
    version: int
    template: str

    def render(self, **values: str) -> str:
        return Template(self.template).substitute(values)


def load_prompt(name: str, version: int | None = None) -> Prompt:
    """Load prompts/<name>/v<version>.txt, or the highest version when none is given."""
    folder = _PROMPTS_DIR / name
    available = {
        int(match.group(1)): path
        for path in folder.glob("v*.txt")
        if (match := _VERSION_FILE.match(path.name))
    }
    if not available:
        raise FileNotFoundError(f"no prompt versions for '{name}'")
    chosen = version if version is not None else max(available)
    return Prompt(name=name, version=chosen, template=available[chosen].read_text("utf-8"))
