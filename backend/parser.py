import csv
import io
import re
import zipfile
import xml.etree.ElementTree as ET
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


def _trailing_number(header: str) -> str | None:
    match = re.search(r"(\d+)$", header)
    return match.group(1) if match else None


def _uses_forms_repeat_suffix(headers: list[str]) -> bool:
    # Microsoft Forms numbers repeated questions from 1 on the second copy:
    # member 1 has no suffix, member 2 ends in 1, member 3 ends in 2, and so on.
    for header in headers:
        lower = header.lower()
        if "rate" in lower and "participation" in lower and _trailing_number(header) == "1":
            return True
    return False


def _column_for(headers: list[str], label: str, kind: str, suffix: str | None) -> str | None:
    for header in headers:
        lower = header.lower()
        if label not in lower or kind not in lower:
            continue
        if _trailing_number(header) == suffix:
            return header
    return None


def _member_block_columns(headers: list[str], member_index: int, forms_style: bool) -> dict[str, str | None]:
    if member_index == 1:
        suffix = None
    elif forms_style:
        suffix = str(member_index - 1)
    else:
        suffix = str(member_index)

    zid_pattern = re.compile(rf"team member {member_index}(?!\d)", re.IGNORECASE)
    zid_col = next((header for header in headers if zid_pattern.search(header)), None)
    if not zid_col:
        return {}

    result: dict[str, str | None] = {"zid": zid_col}
    for key, label in CRITERIA:
        result[f"{key}_rating"] = _column_for(headers, label, "rate", suffix)
        result[f"{key}_comment"] = _column_for(headers, label, "comment", suffix)
    return result


def _decode_csv(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("latin-1", errors="replace")


def _csv_reader(text: str) -> csv.DictReader:
    # newline="" lets the csv module handle CR, LF, and CRLF itself.
    # StringIO's default splits only on LF, so a Mac/Excel CR-only export
    # raises "new-line character seen in unquoted field".
    return csv.DictReader(io.StringIO(text, newline=""))


def _clean_header(value: str | None) -> str:
    if not value:
        return ""
    return value.replace("\xa0", " ").replace("\u200b", "").strip()


def _is_xlsx(content: bytes) -> bool:
    return content[:2] == b"PK"


_XLSX_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_XLSX_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def _shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings: list[str] = []
    for item in root.findall(f"{_XLSX_NS}si"):
        direct = item.find(f"{_XLSX_NS}t")
        if direct is not None:
            strings.append(direct.text or "")
            continue
        parts = []
        for run in item.findall(f"{_XLSX_NS}r"):
            text = run.find(f"{_XLSX_NS}t")
            if text is not None and text.text:
                parts.append(text.text)
        strings.append("".join(parts))
    return strings


def _column_index(cell_ref: str) -> int:
    index = 0
    for char in cell_ref:
        if char.isdigit():
            break
        index = index * 26 + (ord(char.upper()) - 64)
    return index - 1


def _excel_number(raw: str) -> str:
    if re.fullmatch(r"-?\d+", raw):
        return raw
    if re.fullmatch(r"-?\d+\.0+", raw):
        return str(int(float(raw)))
    return raw


def _cell_value(cell: ET.Element, strings: list[str]) -> str | None:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        parts = [node.text or "" for node in cell.iter(f"{_XLSX_NS}t")]
        return "".join(parts) or None
    value = cell.find(f"{_XLSX_NS}v")
    if value is None or value.text is None:
        return None
    raw = value.text
    if cell_type == "s":
        index = int(raw)
        return strings[index] if 0 <= index < len(strings) else raw
    if cell_type == "b":
        return "TRUE" if raw == "1" else "FALSE"
    if cell_type in (None, "n"):
        return _excel_number(raw)
    return raw


def _first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    sheet = workbook.find(f"{_XLSX_NS}sheets/{_XLSX_NS}sheet")
    if sheet is None:
        raise ValueError("The Excel file has no sheets.")
    rel_id = sheet.attrib.get(f"{_XLSX_REL_NS}id")
    if rel_id and "xl/_rels/workbook.xml.rels" in archive.namelist():
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        for rel in rels:
            if rel.attrib.get("Id") != rel_id:
                continue
            target = rel.attrib.get("Target", "")
            target = target.lstrip("/")
            if target.startswith("xl/"):
                return target
            return f"xl/{target}"
    return "xl/worksheets/sheet1.xml"


def _read_xlsx(content: bytes) -> tuple[list[str], list[dict[str, str | None]]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise ValueError("Could not read the Excel file.") from exc

    strings = _shared_strings(archive)
    try:
        sheet_xml = archive.read(_first_sheet_path(archive))
    except KeyError as exc:
        raise ValueError("The Excel file has no worksheet.") from exc

    sheet = ET.fromstring(sheet_xml)
    grid: list[dict[int, str | None]] = []
    for row in sheet.iter(f"{_XLSX_NS}row"):
        cells: dict[int, str | None] = {}
        for cell in row.findall(f"{_XLSX_NS}c"):
            cells[_column_index(cell.attrib.get("r", "A"))] = _cell_value(cell, strings)
        if any(value not in (None, "") for value in cells.values()):
            grid.append(cells)
    if not grid:
        raise ValueError("The Excel file is empty.")

    width = max(grid[0])
    headers = [_clean_header(grid[0].get(index)) for index in range(width + 1)]
    rows: list[dict[str, str | None]] = []
    for cells in grid[1:]:
        record: dict[str, str | None] = {}
        for index, header in enumerate(headers):
            if header and header not in record:
                record[header] = cells.get(index)
        rows.append(record)
    return [header for header in headers if header], rows


def _read_csv_table(content: bytes) -> tuple[list[str], list[dict[str, str | None]]]:
    reader = _csv_reader(_decode_csv(content))
    raw_headers = list(reader.fieldnames or [])
    headers = [_clean_header(header) for header in raw_headers]
    rows: list[dict[str, str | None]] = []
    for source in reader:
        record: dict[str, str | None] = {}
        for raw_header, header in zip(raw_headers, headers):
            if header and header not in record:
                record[header] = source.get(raw_header)
        rows.append(record)
    unique_headers = []
    for header in headers:
        if header and header not in unique_headers:
            unique_headers.append(header)
    return unique_headers, rows


def _read_table(content: bytes) -> tuple[list[str], list[dict[str, str | None]]]:
    if _is_xlsx(content):
        return _read_xlsx(content)
    return _read_csv_table(content)


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
    headers, rows = _read_table(content)

    zid_col = _find_column(headers, "zid")
    first_col = _find_column(headers, "first name")
    last_col = _find_column(headers, "last name")
    email_col = _find_column(headers, "email address", "email")
    group_col = _find_column(headers, "current group")

    if not zid_col or not group_col:
        raise ValueError("Master list is missing required columns: zID or Current Group.")

    zid_to_student: dict[str, dict] = {}
    groups: dict[str, dict] = {}

    for row in rows:
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
    headers, rows = _read_table(peer_content)
    forms_style = _uses_forms_repeat_suffix(headers)
    member_blocks = [_member_block_columns(headers, i, forms_style) for i in range(1, 6)]

    zid_col = _find_column(headers, "what is your zid", "zid")
    name_col = _find_column(headers, "name")

    if not zid_col:
        raise ValueError("Peer evaluation CSV is missing the reviewer zID column.")

    parsed = ParsedData(groups=groups, peer_filename=peer_filename)
    unmatched = 0

    for row in rows:
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
