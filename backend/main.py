import os
import uuid
from typing import Annotated, Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from models import (
    GroupDetail,
    GroupSummary,
    MemberFeedback,
    MemberInfo,
    RatingAverages,
    StudentSummary,
    UploadResponse,
)
from parser import parse_with_master_list

CRITERIA_KEYS = ("participation", "dependability", "wellbeing", "work_contribution")


def _score_from_rating(rating: str | None) -> float | None:
    if not rating:
        return None
    digits = []
    for char in rating.strip():
        if char.isdigit():
            digits.append(char)
        else:
            break
    if not digits:
        return None
    return float("".join(digits))


def _compute_averages(reviews: list[dict]) -> RatingAverages:
    buckets: dict[str, list[float]] = {key: [] for key in CRITERIA_KEYS}
    for review in reviews:
        for key in CRITERIA_KEYS:
            criterion = review.get(key) or {}
            score = _score_from_rating(criterion.get("rating"))
            if score is not None:
                buckets[key].append(score)

    averages: dict[str, float | None] = {}
    collected: list[float] = []
    for key in CRITERIA_KEYS:
        values = buckets[key]
        if values:
            avg = round(sum(values) / len(values), 2)
            averages[key] = avg
            collected.append(avg)
        else:
            averages[key] = None

    overall = round(sum(collected) / len(collected), 2) if collected else None
    return RatingAverages(
        participation=averages["participation"],
        dependability=averages["dependability"],
        wellbeing=averages["wellbeing"],
        work_contribution=averages["work_contribution"],
        overall=overall,
        review_count=len(reviews),
    )

app = FastAPI()

_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_extra_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
ALLOWED_ORIGINS = _DEFAULT_ORIGINS + _extra_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, Any] = {}


def _get_session(session_id: str) -> dict[str, Any]:
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Please upload the CSV files again.")
    return session


def _require_csv(file: UploadFile, label: str) -> None:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail=f"Please upload a CSV file for {label}.")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_csv(
    peer_file: Annotated[UploadFile, File()],
    master_file: Annotated[UploadFile, File()],
):
    _require_csv(peer_file, "peer evaluation")
    _require_csv(master_file, "master list")

    peer_content = await peer_file.read()
    master_content = await master_file.read()
    if not peer_content:
        raise HTTPException(status_code=400, detail="The peer evaluation file is empty.")
    if not master_content:
        raise HTTPException(status_code=400, detail="The master list file is empty.")

    try:
        parsed = parse_with_master_list(
            peer_content,
            master_content,
            peer_filename=peer_file.filename or "peer.csv",
            master_filename=master_file.filename or "master.csv",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV files: {exc}") from exc

    if not parsed.groups:
        raise HTTPException(status_code=400, detail="No valid group data found.")

    session_id = str(uuid.uuid4())
    submission_count = sum(
        1
        for group in parsed.groups.values()
        for member in group["members"].values()
        if member["submitted"]
    )
    display_name = f"{parsed.peer_filename} + {parsed.master_filename}"

    SESSIONS[session_id] = {
        "filename": display_name,
        "peer_filename": parsed.peer_filename,
        "master_filename": parsed.master_filename,
        "groups": parsed.groups,
    }

    return UploadResponse(
        session_id=session_id,
        group_count=len(parsed.groups),
        submission_count=submission_count,
        filename=display_name,
        master_filename=parsed.master_filename,
        unmatched_reviewers=parsed.unmatched_reviewers,
    )


@app.get("/api/sessions/{session_id}/groups", response_model=list[GroupSummary])
def list_groups(session_id: str):
    session = _get_session(session_id)
    summaries: list[GroupSummary] = []
    for name, group in sorted(session["groups"].items()):
        members = list(group["members"].values())
        summaries.append(
            GroupSummary(
                name=name,
                member_count=len(members),
                submitted_count=sum(1 for member in members if member["submitted"]),
                unidentified_count=len(group.get("unidentified_members", {})),
            )
        )
    return summaries


@app.get("/api/sessions/{session_id}/students", response_model=list[StudentSummary])
def list_students(session_id: str):
    session = _get_session(session_id)
    students: list[StudentSummary] = []
    for group_name, group in session["groups"].items():
        for member in group["members"].values():
            students.append(
                StudentSummary(
                    zid=member["zid"],
                    name=member.get("name"),
                    email=member.get("email"),
                    group=group_name,
                    submitted=member.get("submitted", False),
                )
            )
    students.sort(key=lambda item: ((item.name or "").lower(), item.zid))
    return students


@app.get("/api/sessions/{session_id}/groups/{group_name}", response_model=GroupDetail)
def get_group(session_id: str, group_name: str):
    session = _get_session(session_id)
    group = session["groups"].get(group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    member_rows: list[MemberInfo] = []
    for member in group["members"].values():
        reviews = group["feedback_received"].get(member["zid"], [])
        averages = _compute_averages(reviews)
        member_rows.append(
            MemberInfo(
                zid=member["zid"],
                name=member.get("name"),
                email=member.get("email"),
                submitted=member.get("submitted", False),
                averages=averages,
            )
        )

    member_rows.sort(
        key=lambda item: (
            item.averages.overall is None,
            -(item.averages.overall or 0),
            item.name or "",
            item.zid,
        )
    )

    unidentified = [
        MemberInfo(
            zid=member["zid"],
            name=member.get("name"),
            email=member.get("email"),
            submitted=False,
            noted_by=member.get("noted_by"),
            averages=_compute_averages(group["feedback_received"].get(member["zid"], [])),
        )
        for member in sorted(
            group.get("unidentified_members", {}).values(),
            key=lambda item: item["zid"],
        )
    ]
    return GroupDetail(name=group_name, members=member_rows, unidentified_members=unidentified)


@app.get(
    "/api/sessions/{session_id}/groups/{group_name}/members/{zid}/feedback",
    response_model=MemberFeedback,
)
def get_member_feedback(session_id: str, group_name: str, zid: str):
    session = _get_session(session_id)
    group = session["groups"].get(group_name)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found.")

    unidentified = False
    member = group["members"].get(zid)
    if not member:
        member = group.get("unidentified_members", {}).get(zid)
        unidentified = True
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this group.")

    reviews = group["feedback_received"].get(zid, [])
    given_reviews = None
    raw_given = group["feedback_given"].get(zid)
    if member.get("submitted") and raw_given is not None:
        given_reviews = []
        for review in raw_given:
            target = group["members"].get(review["target_zid"]) or group.get(
                "unidentified_members", {}
            ).get(review["target_zid"], {})
            given_reviews.append({**review, "target_name": target.get("name")})

    return MemberFeedback(
        zid=zid,
        name=member.get("name"),
        email=member.get("email"),
        submitted=member.get("submitted", False),
        unidentified=unidentified,
        reviews=reviews,
        given_reviews=given_reviews,
    )
