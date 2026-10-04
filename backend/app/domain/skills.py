"""A small skills vocabulary used until AI extraction is switched on.

Matching a fixed list is crude but honest: it only reports skills whose names actually appear
in the text, so it can miss things but never invents them.
"""

import re
from functools import lru_cache

# Canonical name -> extra spellings. The canonical name is always matched too.
_VOCABULARY: dict[str, tuple[str, ...]] = {
    # Design and research
    "Figma": (),
    "Sketch": (),
    "Adobe XD": (),
    "Photoshop": (),
    "Illustrator": (),
    "Prototyping": ("prototype", "prototypes"),
    "Wireframing": ("wireframes", "wireframe"),
    "User research": ("ux research", "user interviews"),
    "Usability testing": ("usability tests", "user testing"),
    "Design systems": ("design system",),
    "Interaction design": (),
    "Visual design": (),
    "Accessibility": ("a11y", "wcag"),
    "UX writing": (),
    "Product design": (),
    "Service design": (),
    # Engineering
    "Python": (),
    "JavaScript": ("javascript", "js"),
    "TypeScript": ("typescript",),
    "Java": (),
    "Kotlin": (),
    "Swift": (),
    "Go": ("golang",),
    "Rust": (),
    "C#": (".net", "dotnet"),
    "C++": (),
    "PHP": (),
    "Ruby": ("ruby on rails", "rails"),
    "SQL": (),
    "PostgreSQL": ("postgres",),
    "MySQL": (),
    "MongoDB": (),
    "Redis": (),
    "React": ("react.js", "reactjs"),
    "React Native": (),
    "Next.js": ("nextjs",),
    "Vue": ("vue.js", "vuejs"),
    "Angular": (),
    "Node.js": ("nodejs", "node"),
    "Django": (),
    "FastAPI": (),
    "Flask": (),
    "Spring": ("spring boot",),
    "Laravel": (),
    "Flutter": (),
    "GraphQL": (),
    "REST APIs": ("rest api", "restful"),
    "Docker": (),
    "Kubernetes": ("k8s",),
    "AWS": ("amazon web services",),
    "Azure": (),
    "Google Cloud": ("gcp",),
    "Terraform": (),
    "CI/CD": ("continuous integration",),
    "Git": (),
    "Linux": (),
    "Testing": ("unit testing", "test automation"),
    # Data and AI
    "Machine learning": ("ml",),
    "Deep learning": (),
    "Data analysis": ("data analytics",),
    "Pandas": (),
    "TensorFlow": (),
    "PyTorch": (),
    "Power BI": (),
    "Tableau": (),
    "Excel": ("microsoft excel",),
    "Statistics": (),
    "NLP": ("natural language processing",),
    # Product, business, marketing
    "Product management": (),
    "Agile": ("scrum", "kanban"),
    "Jira": (),
    "Project management": (),
    "Stakeholder management": (),
    "SEO": (),
    "Content marketing": (),
    "Copywriting": (),
    "Social media": (),
    "Google Analytics": (),
    "Salesforce": (),
    "HubSpot": (),
    "Customer support": ("customer service",),
    "Sales": (),
    "Accounting": (),
    "Financial analysis": (),
    # Languages
    "English": (),
    "French": (),
    "Arabic": (),
    "German": (),
    "Spanish": (),
}

# Skills whose name is also a common word; only matched when written exactly as the
# canonical form, to avoid "go" or "node" matching ordinary sentences.
_CASE_SENSITIVE = {"Go", "Git", "Sales", "Testing", "Spring", "Excel", "Rust"}


@lru_cache(maxsize=1)
def _patterns() -> list[tuple[str, re.Pattern[str]]]:
    compiled = []
    for canonical, aliases in _VOCABULARY.items():
        names = [canonical, *aliases]
        alternation = "|".join(re.escape(n) for n in sorted(names, key=len, reverse=True))
        # Word-ish boundaries that also work for names like "C#", "C++" and "Node.js".
        pattern = rf"(?<![\w+#.])(?:{alternation})(?![\w+#])"
        flags = 0 if canonical in _CASE_SENSITIVE else re.IGNORECASE
        compiled.append((canonical, re.compile(pattern, flags)))
    return compiled


def extract_skills(text: str) -> list[str]:
    """Canonical skill names that appear in the text, in vocabulary order, without duplicates."""
    if not text:
        return []
    return [name for name, pattern in _patterns() if pattern.search(text)]


def normalize_skill(name: str) -> str:
    """Comparison key for a skill: canonical name when known, else the trimmed lower-case text."""
    cleaned = " ".join(name.split())
    for canonical, pattern in _patterns():
        if pattern.fullmatch(cleaned):
            return canonical.casefold()
    return cleaned.casefold()
