import io

from docx import Document

from tests.conftest import Env
from tests.helpers import SETUP, signup


def docx_bytes(*paragraphs: str) -> bytes:
    document = Document()
    for text in paragraphs:
        document.add_paragraph(text)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


async def test_setup_roundtrip_and_validation(env: Env) -> None:
    headers = await signup(env.client)
    saved = await env.client.put("/api/v1/profile/setup", json=SETUP, headers=headers)
    assert saved.status_code == 200
    assert saved.json() == SETUP

    no_currency = {**SETUP, "currency": None}
    bad = await env.client.put("/api/v1/profile/setup", json=no_currency, headers=headers)
    assert bad.status_code == 422

    profile = (await env.client.get("/api/v1/profile", headers=headers)).json()
    assert profile["setup"]["salaryPeriod"] == "month"
    assert profile["missing"] == ["CV", "Confirmed skills", "Experience"]
    assert profile["completeness"] == 40


async def test_cv_upload_finds_skills_as_pending(env: Env) -> None:
    headers = await signup(env.client)
    data = docx_bytes("Product designer", "Skills: Figma, prototyping, user research, Arabic")
    response = await env.client.post(
        "/api/v1/profile/cv",
        files={"file": ("../../My CV.docx", data, "application/octet-stream")},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["method"] == "basic"
    assert body["file"]["fileName"] == "My CV.docx"
    labels = {i["label"] for i in body["items"]}
    assert {"Figma", "Prototyping", "User research", "Arabic"} <= labels
    assert all(i["status"] == "pending" and i["confidence"] < 0.7 for i in body["items"])
    assert any("aren't read automatically" in n for n in body["notes"])


async def test_reupload_replaces_unconfirmed_but_keeps_confirmed(env: Env) -> None:
    headers = await signup(env.client)
    first = await env.client.post(
        "/api/v1/profile/cv",
        files={"file": ("cv.docx", docx_bytes("Figma and SQL"), "application/pdf")},
        headers=headers,
    )
    figma = next(i for i in first.json()["items"] if i["label"] == "Figma")
    await env.client.patch(
        f"/api/v1/profile/cv/items/{figma['id']}", json={"status": "confirmed"}, headers=headers
    )
    second = await env.client.post(
        "/api/v1/profile/cv",
        files={"file": ("cv2.docx", docx_bytes("Figma and Python"), "application/pdf")},
        headers=headers,
    )
    assert [i["label"] for i in second.json()["items"]] == ["Python"]
    items = (await env.client.get("/api/v1/profile", headers=headers)).json()["items"]
    assert sorted((i["label"], i["status"]) for i in items) == [
        ("Figma", "confirmed"),
        ("Python", "pending"),
    ]


async def test_cv_upload_rejects_wrong_type_and_empty_file(env: Env) -> None:
    headers = await signup(env.client)
    fake_pdf = await env.client.post(
        "/api/v1/profile/cv",
        files={"file": ("cv.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")},
        headers=headers,
    )
    assert fake_pdf.status_code == 422
    assert fake_pdf.json()["error"]["code"] == "unsupported_file"
    empty = await env.client.post(
        "/api/v1/profile/cv", files={"file": ("cv.pdf", b"", "application/pdf")}, headers=headers
    )
    assert empty.json()["error"]["code"] == "empty_file"


async def test_manual_items_edit_and_delete(env: Env) -> None:
    headers = await signup(env.client)
    created = await env.client.post(
        "/api/v1/profile/cv/items",
        json={"section": "experience", "label": "UX Designer", "detail": "Fieldnote, 2023–now"},
        headers=headers,
    )
    assert created.status_code == 201
    item = created.json()
    assert item["status"] == "confirmed" and item["origin"] == "manual"

    edited = await env.client.patch(
        f"/api/v1/profile/cv/items/{item['id']}", json={"detail": None}, headers=headers
    )
    assert edited.json()["detail"] is None

    gone = await env.client.delete(f"/api/v1/profile/cv/items/{item['id']}", headers=headers)
    assert gone.status_code == 204
    again = await env.client.delete(f"/api/v1/profile/cv/items/{item['id']}", headers=headers)
    assert again.status_code == 404


async def test_items_are_private_to_their_owner(env: Env) -> None:
    owner = await signup(env.client)
    other = await signup(env.client, "other@example.com")
    item = (
        await env.client.post(
            "/api/v1/profile/cv/items", json={"section": "skills", "label": "Figma"}, headers=owner
        )
    ).json()
    response = await env.client.patch(
        f"/api/v1/profile/cv/items/{item['id']}", json={"label": "Hacked"}, headers=other
    )
    assert response.status_code == 404


async def test_profile_requires_login(env: Env) -> None:
    assert (await env.client.get("/api/v1/profile")).status_code == 401
