# Mifos Pocket Dashboard

A web-based Pocket Dashboard built with Python Flask — inspired by the Mifos Pay Pocket feature (issue #1997).

## What It Does

- View all linked accounts (Savings, Loans, Shares) in a unified dashboard
- See aggregated balance across all linked accounts
- Link new accounts to your pocket
- Delink accounts you no longer want to track
- View individual account details

## Tech Stack

- **Backend**: Python, Flask
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **API**: REST (simulates Apache Fineract /self/pockets endpoints)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pocket` | Get all linked accounts + balance summary |
| GET | `/api/accounts` | Get all accounts (linked + unlinked) |
| POST | `/api/pocket/link` | Link an account to pocket |
| POST | `/api/pocket/delink` | Delink an account from pocket |
| GET | `/api/account/<type>/<id>` | Get individual account detail |

## How to Run

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

Then open: `http://127.0.0.1:5000`

## Note

This is a PoC built to demonstrate understanding of the Mifos Pay Pocket feature before implementing it in the actual KMP codebase.
