from pydantic import BaseModel


class RatingAverages(BaseModel):
    participation: float | None = None
    dependability: float | None = None
    wellbeing: float | None = None
    work_contribution: float | None = None
    overall: float | None = None
    review_count: int = 0


class MemberInfo(BaseModel):
    zid: str
    name: str | None = None
    email: str | None = None
    submitted: bool = False
    noted_by: list[str] | None = None
    averages: RatingAverages | None = None


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
    unidentified: bool = False
    reviews: list[ReviewEntry]
    given_reviews: list[dict] | None = None


class GroupSummary(BaseModel):
    name: str
    member_count: int
    submitted_count: int
    unidentified_count: int = 0


class StudentSummary(BaseModel):
    zid: str
    name: str | None = None
    email: str | None = None
    group: str
    submitted: bool = False


class GroupDetail(BaseModel):
    name: str
    members: list[MemberInfo]
    unidentified_members: list[MemberInfo] = []


class UploadResponse(BaseModel):
    session_id: str
    group_count: int
    submission_count: int
    filename: str
    master_filename: str | None = None
    unmatched_reviewers: int = 0
