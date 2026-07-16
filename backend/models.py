from pydantic import BaseModel


class MemberInfo(BaseModel):
    zid: str
    name: str | None = None
    email: str | None = None
    submitted: bool = False


class CriterionFeedback(BaseModel):
    rating: str | None = None
    comment: str | None = None


class ReviewEntry(BaseModel):
    reviewer_zid: str
    reviewer_name: str | None = None
    participation: CriterionFeedback
    dependability: CriterionFeedback
    wellbeing: CriterionFeedback
    work_contribution: CriterionFeedback


class MemberFeedback(BaseModel):
    zid: str
    name: str | None = None
    email: str | None = None
    submitted: bool
    reviews: list[ReviewEntry]
    given_reviews: list[dict] | None = None


class GroupSummary(BaseModel):
    name: str
    member_count: int
    submitted_count: int


class GroupDetail(BaseModel):
    name: str
    members: list[MemberInfo]


class UploadResponse(BaseModel):
    session_id: str
    group_count: int
    submission_count: int
    filename: str
