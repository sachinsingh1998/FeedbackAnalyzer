# Feedback Analyzer

Small web app for looking through interim peer evaluation CSV exports.

Stack: React frontend, FastAPI backend.

## Setup

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs on [http://127.0.0.1:8000](http://127.0.0.1:8000)

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Runs on [http://localhost:5173](http://localhost:5173)

## How to use

1. Upload the peer evaluation CSV and the master list CSV (needs a `Current Group` column).
2. Open a group from the list.
3. Click a student to see feedback they received (and given, if they submitted).
4. Wrong zIDs show up under unidentified members.

Groups come from the master list, and the feedbacks from the peer form.