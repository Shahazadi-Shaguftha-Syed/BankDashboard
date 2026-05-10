from flask import Flask, render_template, jsonify, request
import json
import os
import sqlite3

app = Flask(__name__)


def init_db():
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS linked_accounts
                 (acc_id INTEGER, acc_type TEXT, PRIMARY KEY (acc_id, acc_type))''')
    c.execute('''CREATE TABLE IF NOT EXISTS budget_alerts
                 (acc_id INTEGER PRIMARY KEY, limit_amount REAL)''')
    conn.commit()
    conn.close()

def is_linked(acc_id, acc_type):
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute("SELECT 1 FROM linked_accounts WHERE acc_id=? AND acc_type=?", (acc_id, acc_type))
    result = c.fetchone()
    conn.close()
    return result is not None

init_db()

# Mock database - simulates Fineract API response
accounts_db = {
    "savings": [
        {"id": 1, "accountNo": "SAV-001", "productName": "General Savings", "balance": 12500.75, "currency": "USD", "status": "Active"},
        {"id": 2, "accountNo": "SAV-002", "productName": "Emergency Fund", "balance": 5000.00, "currency": "USD", "status": "Active"},
        {"id": 3, "accountNo": "SAV-003", "productName": "Holiday Savings", "balance": 3200.00, "currency": "USD", "status": "Active"},
    ],
    "loans": [
        {"id": 4, "accountNo": "LON-001", "productName": "Home Loan", "balance": 85000.00, "currency": "USD", "status": "Active"},
        {"id": 5, "accountNo": "LON-002", "productName": "Personal Loan", "balance": 12000.00, "currency": "USD", "status": "Active"},
    ],
    "shares": [
        {"id": 6, "accountNo": "SHR-001", "productName": "Share Account", "balance": 3200.00, "currency": "USD", "status": "Active"},
        {"id": 7, "accountNo": "SHR-002", "productName": "Investment Shares", "balance": 7500.00, "currency": "USD", "status": "Active"},
    ]
}


# Mock transaction history per account
transactions_db = {
    1: [
        {"id": 1, "date": "2026-05-08", "description": "Salary Credit", "amount": 3000.00, "type": "credit"},
        {"id": 2, "date": "2026-05-05", "description": "Grocery Store", "amount": -120.50, "type": "debit"},
        {"id": 3, "date": "2026-05-03", "description": "Netflix Subscription", "amount": -15.99, "type": "debit"},
        {"id": 4, "date": "2026-04-30", "description": "Freelance Payment", "amount": 500.00, "type": "credit"},
        {"id": 5, "date": "2026-04-28", "description": "Electricity Bill", "amount": -85.00, "type": "debit"},
    ],
    2: [
        {"id": 1, "date": "2026-05-01", "description": "Monthly Transfer", "amount": 500.00, "type": "credit"},
        {"id": 2, "date": "2026-04-01", "description": "Monthly Transfer", "amount": 500.00, "type": "credit"},
        {"id": 3, "date": "2026-03-01", "description": "Monthly Transfer", "amount": 500.00, "type": "credit"},
    ],
    4: [
        {"id": 1, "date": "2026-05-01", "description": "EMI Payment", "amount": -15000.00, "type": "debit"},
        {"id": 2, "date": "2026-04-01", "description": "EMI Payment", "amount": -15000.00, "type": "debit"},
        {"id": 3, "date": "2026-03-01", "description": "EMI Payment", "amount": -15000.00, "type": "debit"},
    ],
    6: [
        {"id": 1, "date": "2026-05-07", "description": "Dividend Received", "amount": 120.00, "type": "credit"},
        {"id": 2, "date": "2026-04-15", "description": "Share Purchase", "amount": -500.00, "type": "debit"},
        {"id": 3, "date": "2026-03-20", "description": "Dividend Received", "amount": 95.00, "type": "credit"},
    ],
}


def get_linked_accounts():
    linked = {"savings": [], "loans": [], "shares": []}
    for acc_type, accounts in accounts_db.items():
        for acc in accounts:
            if is_linked(acc["id"], acc_type):
                linked[acc_type].append(acc)
    return linked


@app.route("/api/accounts", methods=["GET"])
def get_all():
    result = {}
    for acc_type, accounts in accounts_db.items():
        result[acc_type] = []
        for acc in accounts:
            a = dict(acc)
            a["linked"] = is_linked(acc["id"], acc_type)
            result[acc_type].append(a)
    return jsonify(result)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/pocket", methods=["GET"])
def get_pocket():
    """Simulates GET /self/pockets"""
    linked = get_linked_accounts()

    savings_total = sum(a["balance"] for a in linked["savings"])
    shares_total = sum(a["balance"] for a in linked["shares"])
    loans_total = sum(a["balance"] for a in linked["loans"])
    assets_total = savings_total + shares_total
    net_total = assets_total - loans_total

    return jsonify({
        "accounts": linked,
        "summary": {
            "savings_total": savings_total,
            "shares_total": shares_total,
            "loans_total": loans_total,
            "assets_total": assets_total,
            "net_total": net_total
        }
    })


@app.route("/api/pocket/link", methods=["POST"])
def link_account():
    data = request.json
    acc_id = data.get("id")
    acc_type = data.get("type")
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute("INSERT OR IGNORE INTO linked_accounts VALUES (?, ?)", (acc_id, acc_type))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Account linked successfully"})


@app.route("/api/pocket/delink", methods=["POST"])
def delink_account():
    data = request.json
    acc_id = data.get("id")
    acc_type = data.get("type")
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute("DELETE FROM linked_accounts WHERE acc_id=? AND acc_type=?", (acc_id, acc_type))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": f"Account delinked successfully"})



@app.route("/api/account/<acc_type>/<int:acc_id>", methods=["GET"])
def get_account_detail(acc_type, acc_id):
    """Returns individual account detail"""
    for acc in accounts_db.get(acc_type, []):
        if acc["id"] == acc_id:
            return jsonify(acc)
    return jsonify({"error": "Account not found"}), 404


@app.route("/api/networth", methods=["GET"])
def get_networth():
    """Returns net worth breakdown: assets - liabilities"""
    linked = get_linked_accounts()
    savings_total = sum(a["balance"] for a in linked["savings"])
    shares_total = sum(a["balance"] for a in linked["shares"])
    loans_total = sum(a["balance"] for a in linked["loans"])
    assets_total = savings_total + shares_total
    net_worth = assets_total - loans_total

    return jsonify({
        "assets": {
            "savings": savings_total,
            "shares": shares_total,
            "total": assets_total
        },
        "liabilities": {
            "loans": loans_total,
            "total": loans_total
        },
        "net_worth": net_worth
    })


@app.route("/api/account/<int:acc_id>/transactions", methods=["GET"])
def get_transactions(acc_id):
    """Returns mock transaction history for an account"""
    txns = transactions_db.get(acc_id, [
        {"id": 1, "date": "2026-05-09", "description": "Opening Balance", "amount": 1000.00, "type": "credit"},
        {"id": 2, "date": "2026-05-08", "description": "Service Charge", "amount": -10.00, "type": "debit"},
    ])
    return jsonify(txns)

@app.route("/api/currency/rates", methods=["GET"])
def get_currency_rates():
    """Mock currency conversion rates based on USD"""
    return jsonify({
        "USD": 1.0,
        "INR": 83.5,
        "EUR": 0.92,
        "GBP": 0.79,
        "BDT": 110.0
    })

@app.route("/api/budget/set", methods=["POST"])
def set_budget():
    data = request.json
    acc_id = data.get("acc_id")
    limit = data.get("limit")
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO budget_alerts VALUES (?, ?)", (acc_id, limit))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Budget limit set"})


@app.route("/api/budget/check", methods=["GET"])
def check_budgets():
    conn = sqlite3.connect('pocket.db')
    c = conn.cursor()
    c.execute("SELECT acc_id, limit_amount FROM budget_alerts")
    limits = {row[0]: row[1] for row in c.fetchall()}
    conn.close()

    alerts = []
    for acc_type, accounts in accounts_db.items():
        for acc in accounts:
            if acc["id"] in limits and acc["balance"] > limits[acc["id"]]:
                alerts.append({
                    "accId": acc["id"],
                    "accountNo": acc["accountNo"],
                    "productName": acc["productName"],
                    "balance": acc["balance"],
                    "limit": limits[acc["id"]],
                    "type": acc_type
                })
    return jsonify(alerts)


if __name__ == "__main__":
    app.run(debug=True)
