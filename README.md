# Feedback Analyzer

A React + FastAPI web app for tutors to explore university peer evaluation CSV exports.

## Features

- Upload Microsoft Forms peer evaluation CSV files
- Browse groups and team members
- View feedback received by each student across participation, dependability, wellbeing, and work contribution
- Color-coded ratings for quick scanning
- Handles students who did not submit the form (shows "Not found" for missing details)
- Fast in-memory parsing with indexed lookups

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API runs at `http://127.0.0.1:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## Usage flow

1. Open the upload page and select a CSV file.
2. Click **Feedback** to go to the group overview page.
3. Choose a group from the dropdown.
4. Click a student name to view feedback they received.
5. Click another student name on the feedback page to navigate between members.
6. Use **Back** buttons to return to Groups or Upload.

## Notes

- CSV files are parsed using Latin-1 encoding (common for Microsoft Forms exports).
- Uploaded data is stored in server memory for the current session. Restarting the backend clears sessions.
