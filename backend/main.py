import uuid
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from models import GroupDetail, GroupSummary, MemberFeedback, MemberInfo, UploadResponse
from parser import parse_csv_content

app = FastAPI(title="Feedback Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, Any] = {}


def _get_session(session_id: str) -> dict[str, Any]:
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please upload the CSV again.")
    return session


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        parsed = parse_csv_content(content, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}") from exc

    if not parsed.groups:
        raise HTTPException(status_code=400, detail="No valid group data found in the CSV.")

    session_id = str(uuid.uuid4())
    submission_count = sum(
        1
        for group in parsed.groups.values()
        for member in group["members"].values()
        if member["submitted"]
    )
    SESSIONS[session_id] = {
        "filename": parsed.filename,
        "groups": parsed.groups,
    }

    return UploadResponse(
        session_id=session_id,
        group_count=len(parsed.groups),
        submission_count=submission_count,
        filename=parsed.filename,
    )


@app.get("/api/sessions/{session_id}/groups", response_model=list[GroupSummary])
def list_groups(session_id: str):
    session = _get_session(session_id)
    summaries: list[GroupSummary] = []
    for name, group in sorted(session["groups"].items()):
        members = group["members"].values()
        summaries.append(
            GroupSummary(
                name=name,
                member_count=len(list(members)),
                submitted_count=sum(1 for member in members if member["submitted"]),
            )
        )
    return summaries


@app.get("/api/sessions/{session_id}/groups/{group_name}", response_model=GroupDetail)
def get_group(session_id: str, group_name: str):
    session = _get_session(session_id)
    group = session["groups"].get(group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    members = [
        MemberInfo(**member)
        for member in sorted(
            group["members"].values(),
            key=lambda item: (
                not item["submitted"],
                item.get("name") or "",
                item["zid"],
            ),
        )
    ]
    return GroupDetail(name=group_name, members=members)


@app.get(
    "/api/sessions/{session_id}/groups/{group_name}/members/{zid}/feedback",
    response_model=MemberFeedback,
)
def get_member_feedback(session_id: str, group_name: str, zid: str):
    session = _get_session(session_id)
    group = session["groups"].get(group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    member = group["members"].get(zid)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this group.")

    reviews = group["feedback_received"].get(zid, [])
    given_reviews = group["feedback_given"].get(zid)
    enriched_given = None
    if member.get("submitted") and given_reviews is not None:
        enriched_given = []
        for review in given_reviews:
            target = group["members"].get(review["target_zid"], {})
            enriched_given.append(
                {
                    **review,
                    "target_name": target.get("name"),
                }
            )

    return MemberFeedback(
        zid=zid,
        name=member.get("name"),
        email=member.get("email"),
        submitted=member.get("submitted", False),
        reviews=reviews,
        given_reviews=enriched_given,
    )
