import csv
import io
import re
from dataclasses import dataclass, field


CRITERIA = (
    ("participation", "participation"),
    ("dependability", "dependability"),
    ("wellbeing", "wellbeing"),
    ("work_contribution", "work contribution"),
)


def _normalize(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _normalize_zid(value: str | None) -> str | None:
    cleaned = _normalize(value)
    if not cleaned or cleaned == "0":
        return None
    return cleaned


def _find_column(headers: list[str], *needles: str) -> str | None:
    lowered = [h.lower() for h in headers]
    for needle in needles:
        needle_lower = needle.lower()
        for header, header_lower in zip(headers, lowered):
            if needle_lower in header_lower:
                return header
    return None


def _member_block_columns(headers: list[str], member_index: int) -> dict[str, str | None]:
    suffix = "" if member_index == 1 else str(member_index)
    zid_needle = f"team member {member_index}"

    zid_col = _find_column(headers, zid_needle)
    if not zid_col:
        return {}

    result: dict[str, str | None] = {"zid": zid_col}
    for key, label in CRITERIA:
        rating_col = None
        comment_col = None
        for header in headers:
            header_lower = header.lower()
            if label in header_lower and "rate" in header_lower:
                if suffix:
                    if header.endswith(suffix) or header_lower.endswith(suffix.lower()):
                        rating_col = header
                elif not re.search(r"\d$", header):
                    rating_col = header
            if label in header_lower and "comment" in header_lower:
                if suffix:
                    if header.endswith(suffix) or header_lower.endswith(suffix.lower()):
                        comment_col = header
                elif not re.search(r"\d$", header):
                    comment_col = header
        result[f"{key}_rating"] = rating_col
        result[f"{key}_comment"] = comment_col
    return result


@dataclass
class ParsedData:
    groups: dict[str, dict] = field(default_factory=dict)
    filename: str = ""


def _normalize_group(value: str | None) -> str | None:
    cleaned = _normalize(value)
    if not cleaned:
        return None
    # Ignore garbage values from incomplete form rows (e.g. "0--")
    if cleaned.startswith("0") and set(cleaned) <= {"0", "-"}:
        return None
    return cleaned


def parse_csv_content(content: bytes, filename: str = "upload.csv") -> ParsedData:
    text = content.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    member_blocks = [_member_block_columns(headers, i) for i in range(1, 6)]

    group_col = _find_column(headers, "select your group")
    zid_col = _find_column(headers, "what is your zid")
    name_col = _find_column(headers, "name")
    email_col = _find_column(headers, "email")

    if not group_col or not zid_col:
        raise ValueError("CSV is missing required columns: group or reviewer zID.")

    parsed = ParsedData(filename=filename)

    for row in reader:
        group_name = _normalize_group(row.get(group_col))
        reviewer_zid = _normalize_zid(row.get(zid_col))
        if not group_name or not reviewer_zid:
            continue

        if group_name not in parsed.groups:
            parsed.groups[group_name] = {
                "members": {},
                "feedback_received": {},
                "feedback_given": {},
            }

        group = parsed.groups[group_name]
        reviewer_name = _normalize(row.get(name_col)) if name_col else None
        reviewer_email = _normalize(row.get(email_col)) if email_col else None

        group["members"][reviewer_zid] = {
            "zid": reviewer_zid,
            "name": reviewer_name,
            "email": reviewer_email,
            "submitted": True,
        }

        reviews_for_reviewer: list[dict] = []
        for block in member_blocks:
            if not block.get("zid"):
                continue
            target_zid = _normalize_zid(row.get(block["zid"]))
            if not target_zid:
                continue

            if target_zid not in group["members"]:
                group["members"][target_zid] = {
                    "zid": target_zid,
                    "name": None,
                    "email": None,
                    "submitted": False,
                }

            review = {
                "reviewer_zid": reviewer_zid,
                "reviewer_name": reviewer_name,
                "target_zid": target_zid,
                "participation": {
                    "rating": _normalize(row.get(block["participation_rating"])),
                    "comment": _normalize(row.get(block["participation_comment"])),
                },
                "dependability": {
                    "rating": _normalize(row.get(block["dependability_rating"])),
                    "comment": _normalize(row.get(block["dependability_comment"])),
                },
                "wellbeing": {
                    "rating": _normalize(row.get(block["wellbeing_rating"])),
                    "comment": _normalize(row.get(block["wellbeing_comment"])),
                },
                "work_contribution": {
                    "rating": _normalize(row.get(block["work_contribution_rating"])),
                    "comment": _normalize(row.get(block["work_contribution_comment"])),
                },
            }

            group["feedback_received"].setdefault(target_zid, []).append(review)
            reviews_for_reviewer.append(review)

        group["feedback_given"][reviewer_zid] = reviews_for_reviewer

    return parsed
