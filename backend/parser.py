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
    if cleaned.lower().startswith("z"):
        cleaned = cleaned[1:]
    cleaned = cleaned.strip()
    if not cleaned or cleaned == "0":
        return None
    return cleaned


def _find_column(headers: list[str], *needles: str) -> str | None:
    for needle in needles:
        needle_lower = needle.lower()
        for header in headers:
            if needle_lower in header.lower():
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


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("latin-1", errors="replace")


def _empty_group() -> dict:
    return {
        "members": {},
        "unidentified_members": {},
        "feedback_received": {},
        "feedback_given": {},
    }


@dataclass
class ParsedData:
    groups: dict[str, dict] = field(default_factory=dict)
    peer_filename: str = ""
    master_filename: str = ""
    unmatched_reviewers: int = 0


def parse_master_list(content: bytes) -> tuple[dict[str, dict], dict[str, dict]]:
    text = _decode_csv(content)
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []

    zid_col = _find_column(headers, "zid")
    first_col = _find_column(headers, "first name")
    last_col = _find_column(headers, "last name")
    email_col = _find_column(headers, "email address", "email")
    group_col = _find_column(headers, "current group")

    if not zid_col or not group_col:
        raise ValueError("Master list is missing required columns: zID or Current Group.")

    zid_to_student: dict[str, dict] = {}
    groups: dict[str, dict] = {}

    for row in reader:
        zid = _normalize_zid(row.get(zid_col))
        group_name = _normalize(row.get(group_col))
        if not zid or not group_name:
            continue

        first = _normalize(row.get(first_col)) if first_col else None
        last = _normalize(row.get(last_col)) if last_col else None
        name = " ".join(part for part in (first, last) if part) or None
        email = _normalize(row.get(email_col)) if email_col else None

        student = {
            "zid": zid,
            "name": name,
            "email": email,
            "group": group_name,
        }
        zid_to_student[zid] = student

        if group_name not in groups:
            groups[group_name] = _empty_group()

        groups[group_name]["members"][zid] = {
            "zid": zid,
            "name": name,
            "email": email,
            "submitted": False,
        }

    if not groups:
        raise ValueError("No valid students/groups found in the master list.")

    return zid_to_student, groups


def _build_review(row: dict, block: dict, reviewer_zid: str, reviewer_name: str | None, target_zid: str) -> dict:
    return {
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


def apply_peer_evaluation(
    peer_content: bytes,
    zid_to_student: dict[str, dict],
    groups: dict[str, dict],
    peer_filename: str = "peer.csv",
) -> ParsedData:
    text = _decode_csv(peer_content)
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    member_blocks = [_member_block_columns(headers, i) for i in range(1, 6)]

    zid_col = _find_column(headers, "what is your zid", "zid")
    name_col = _find_column(headers, "name")

    if not zid_col:
        raise ValueError("Peer evaluation CSV is missing the reviewer zID column.")

    parsed = ParsedData(groups=groups, peer_filename=peer_filename)
    unmatched = 0

    for row in reader:
        reviewer_zid = _normalize_zid(row.get(zid_col))
        if not reviewer_zid:
            continue

        master = zid_to_student.get(reviewer_zid)
        if not master:
            unmatched += 1
            continue

        group_name = master["group"]
        group = groups[group_name]
        reviewer_name = master.get("name") or (_normalize(row.get(name_col)) if name_col else None)

        member = group["members"][reviewer_zid]
        member["submitted"] = True
        if reviewer_name:
            member["name"] = reviewer_name
        if master.get("email"):
            member["email"] = master["email"]

        reviews_for_reviewer: list[dict] = []
        official_zids = set(group["members"].keys())

        for block in member_blocks:
            if not block.get("zid"):
                continue
            target_zid = _normalize_zid(row.get(block["zid"]))
            if not target_zid:
                continue

            review = _build_review(row, block, reviewer_zid, reviewer_name, target_zid)

            if target_zid in official_zids:
                group["feedback_received"].setdefault(target_zid, []).append(review)
            else:
                if target_zid not in group["unidentified_members"]:
                    other = zid_to_student.get(target_zid)
                    group["unidentified_members"][target_zid] = {
                        "zid": target_zid,
                        "name": other.get("name") if other else None,
                        "email": other.get("email") if other else None,
                        "submitted": False,
                        "noted_by": [],
                    }
                noted_by = group["unidentified_members"][target_zid].setdefault("noted_by", [])
                if reviewer_zid not in noted_by:
                    noted_by.append(reviewer_zid)
                group["feedback_received"].setdefault(target_zid, []).append(review)

            reviews_for_reviewer.append(review)

        group["feedback_given"][reviewer_zid] = reviews_for_reviewer

    parsed.unmatched_reviewers = unmatched
    return parsed


def parse_with_master_list(
    peer_content: bytes,
    master_content: bytes,
    peer_filename: str = "peer.csv",
    master_filename: str = "master.csv",
) -> ParsedData:
    zid_to_student, groups = parse_master_list(master_content)
    parsed = apply_peer_evaluation(peer_content, zid_to_student, groups, peer_filename)
    parsed.master_filename = master_filename
    return parsed
