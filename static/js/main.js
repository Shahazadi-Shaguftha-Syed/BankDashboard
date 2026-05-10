let allAccounts = {};
let currentFilter = 'all';
let currentCurrency = 'USD';
let exchangeRates = { USD: 1.0 };
const currencySymbols = { USD: '$', INR: '₹', EUR: '€', GBP: '£', BDT: '৳' };

// Format currency
function formatCurrency(amount) {
    const converted = amount * exchangeRates[currentCurrency];
    const symbol = currencySymbols[currentCurrency] || '$';
    return symbol + converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Account type icons
function getIcon(type) {
    if (type === 'savings') return '💰';
    if (type === 'loans') return '🏦';
    if (type === 'shares') return '📈';
    return '💳';
}

// Load net worth
async function loadNetWorth() {
    const res = await fetch('/api/networth');
    const data = await res.json();

    document.getElementById('nwAssets').textContent = formatCurrency(data.assets.total);
    document.getElementById('nwLiabilities').textContent = formatCurrency(data.liabilities.total);
    document.getElementById('nwTotal').textContent = formatCurrency(data.net_worth);
    document.getElementById('nwSavings').textContent = formatCurrency(data.assets.savings);
    document.getElementById('nwShares').textContent = formatCurrency(data.assets.shares);
    document.getElementById('nwLoans').textContent = formatCurrency(data.liabilities.loans);

    const badge = document.getElementById('nwBadge');
    if (data.net_worth >= 0) {
        badge.textContent = '▲ Positive';
        badge.className = 'nw-badge positive';
    } else {
        badge.textContent = '▼ Negative';
        badge.className = 'nw-badge negative';
    }
}

// Load transactions for an account
async function loadTransactions(accId) {
    const res = await fetch(`/api/account/${accId}/transactions`);
    const txns = await res.json();
    const list = document.getElementById('transactionsList');

    if (txns.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#aaa;padding:20px">No transactions found</p>';
        return;
    }

    list.innerHTML = txns.map(t => `
        <div class="txn-item">
            <div class="txn-icon ${t.type}">${t.type === 'credit' ? '↓' : '↑'}</div>
            <div class="txn-info">
                <div class="txn-desc">${t.description}</div>
                <div class="txn-date">${t.date}</div>
            </div>
            <div class="txn-amount ${t.type}">${t.amount > 0 ? '+' : ''}${formatCurrency(t.amount)}</div>
        </div>
    `).join('');
}

// Switch tabs in detail modal
function switchTab(tab, btn) {
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tabDetails').style.display = tab === 'details' ? 'block' : 'none';
    document.getElementById('tabTransactions').style.display = tab === 'transactions' ? 'block' : 'none';
}


async function loadPocket() {
    try {
        const res = await fetch('/api/pocket');
        const data = await res.json();

        // Update summary
        document.getElementById('totalAssets').textContent = formatCurrency(data.summary.assets_total);
        document.getElementById('savingsTotal').textContent = formatCurrency(data.summary.savings_total);
        document.getElementById('loansTotal').textContent = formatCurrency(data.summary.loans_total);
        document.getElementById('sharesTotal').textContent = formatCurrency(data.summary.shares_total);

        // Count total linked
        const total = Object.values(data.accounts).reduce((sum, arr) => sum + arr.length, 0);
        document.getElementById('accountCount').textContent = `${total} accounts linked`;

        renderAccounts(data.accounts);
        renderChart(data.summary); 
    } catch (err) {
        console.error(err);
    }
    // renderAccounts(data.accounts);
    // renderChart(data.summary); 
}

// Load all accounts (for link modal)
async function loadAllAccounts() {
    const res = await fetch('/api/accounts');
    allAccounts = await res.json();
}

// Render account cards
function renderAccounts(accounts) {
    const grid = document.getElementById('accountsGrid');
    let cards = '';
    let count = 0;

    const types = currentFilter === 'all' ? ['savings', 'loans', 'shares'] : [currentFilter];

    types.forEach(type => {
        (accounts[type] || []).forEach(acc => {
            count++;
            cards += `
            <div class="account-card" onclick="openDetailModal('${type}', ${acc.id})">
                <div class="account-icon ${type}">${getIcon(type)}</div>
                <div class="account-info">
                    <div class="account-name">${acc.productName}</div>
                    <div class="account-no">${acc.accountNo}</div>
                    <div class="account-tags">
                        <span class="tag ${type}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        <span class="tag active">${acc.status}</span>
                    </div>
                </div>
                <div class="account-right">
                    <div class="account-balance">${formatCurrency(acc.balance)}</div>
                    <div class="account-currency">${acc.currency}</div>
                    <button class="btn-delink" onclick="event.stopPropagation(); delinkAccount('${type}', ${acc.id})">Delink</button>
                </div>
            </div>`;
        });
    });

    if (count === 0) {
        cards = `<div class="empty-state">
            <div class="empty-icon">🏦</div>
            <h3>No accounts linked</h3>
            <p>Tap "Link Account" to add accounts to your pocket</p>
        </div>`;
    }

    grid.innerHTML = cards;
    document.getElementById('accountBadge').textContent = count;
}

// Filter accounts
function filterAccounts(type, btn) {
    currentFilter = type;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const label = type === 'all' ? 'Linked Accounts' : type.charAt(0).toUpperCase() + type.slice(1) + ' Accounts';
    document.getElementById('sectionTitle').textContent = label;
    loadPocket();
}

// Delink account
async function delinkAccount(type, id) {
    if (!confirm('Remove this account from your Pocket?')) return;
    const res = await fetch('/api/pocket/delink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type })
    });
    const data = await res.json();
    showToast(data.message);
    loadPocket();
    loadAllAccounts();
}

// Open detail modal
let currentAccId = null;
async function openDetailModal(type, id) {
    currentAccId = id;
    const res = await fetch(`/api/account/${type}/${id}`);
    const acc = await res.json();

    document.getElementById('detailProductName').textContent = acc.productName;
    document.getElementById('detailBalance').textContent = formatCurrency(acc.balance);
    document.getElementById('detailCurrency').textContent = acc.currency;
    document.getElementById('detailAccNo').textContent = acc.accountNo;
    document.getElementById('detailType').textContent = type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById('detailProduct').textContent = acc.productName;
    document.getElementById('detailStatus').textContent = acc.status;
    document.getElementById('detailCurrencyRow').textContent = acc.currency;

    // Reset to details tab
    switchTab('details', document.querySelectorAll('.detail-tab')[0]);
    await loadTransactions(id);

    document.getElementById('detailModal').classList.add('open');
}

// Open link modal
function openLinkModal() {
    const list = document.getElementById('unlinkAccountsList');
    let html = '';
    let found = false;

    ['savings', 'loans', 'shares'].forEach(type => {
        (allAccounts[type] || []).forEach(acc => {
            if (!acc.linked) {
                found = true;
                html += `
                <div class="link-account-item">
                    <div class="link-account-info">
                        <div class="name">${getIcon(type)} ${acc.productName}</div>
                        <div class="no">${acc.accountNo} • ${type}</div>
                    </div>
                    <button class="btn-link" onclick="linkAccount('${type}', ${acc.id})">Link</button>
                </div>`;
            }
        });
    });

    if (!found) {
        html = '<p style="text-align:center; color:#aaa; padding: 20px 0;">All accounts are already linked!</p>';
    }

    list.innerHTML = html;
    document.getElementById('linkModal').classList.add('open');
}

// Link account
async function linkAccount(type, id) {
    const res = await fetch('/api/pocket/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type })
    });
    const data = await res.json();
    showToast(data.message);
    closeModal('linkModal');
    loadPocket();
    loadAllAccounts();
    loadNetWorth();
}

// Close modal
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}


async function changeCurrency(currency) {
    currentCurrency = currency;
    if (!exchangeRates[currency]) {
        const res = await fetch('/api/currency/rates');
        exchangeRates = await res.json();
    }
    loadPocket();
    loadNetWorth();
    showToast(`Currency changed to ${currency}`);
}

async function initCurrencyRates() {
    const res = await fetch('/api/currency/rates');
    exchangeRates = await res.json();
}

function renderChart(summary) {
    const bars = document.getElementById('chartBars');
    const legend = document.getElementById('chartLegend');
    const total = summary.assets_total + summary.loans_total;

    document.getElementById('analyticsTotal').textContent = formatCurrency(total) + ' total';

    const data = [
        { label: 'Savings', value: summary.savings_total, color: '#1976D2' },
        { label: 'Shares', value: summary.shares_total, color: '#7B1FA2' },
        { label: 'Loans', value: summary.loans_total, color: '#E53935' },
    ];

    const max = Math.max(...data.map(d => d.value), 1);

    bars.innerHTML = data.map(d => {
        const heightPct = Math.round((d.value / max) * 100);
        return `
        <div class="chart-bar-wrap">
            <div class="chart-bar-value">${formatCurrency(d.value)}</div>
            <div class="chart-bar" style="height:${heightPct}%; background:${d.color};" title="${d.label}: ${formatCurrency(d.value)}"></div>
            <div class="chart-bar-label">${d.label}</div>
        </div>`;
    }).join('');

    legend.innerHTML = data.map(d => `
        <div class="legend-item">
            <div class="legend-dot" style="background:${d.color}"></div>
            ${d.label}
        </div>`).join('');
}

async function setBudget() {
    const limit = parseFloat(document.getElementById('budgetInput').value);
    if (!limit || limit <= 0) { showToast('Enter a valid amount'); return; }
    const res = await fetch('/api/budget/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acc_id: currentAccId, limit })
    });
    const data = await res.json();
    showToast('Budget limit set successfully');
    document.getElementById('budgetInput').value = '';
    checkBudgetAlerts();
}

async function checkBudgetAlerts() {
    const res = await fetch('/api/budget/check');
    const alerts = await res.json();
    const banner = document.getElementById('budgetAlertBanner');
    if (alerts.length === 0) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';
    document.getElementById('budgetAlertText').textContent =
        alerts.map(a => `${a.productName} exceeded limit ($${a.limit.toLocaleString()})`).join(' | ');
}


// Init
loadAllAccounts();
loadPocket();
loadNetWorth();
initCurrencyRates();
checkBudgetAlerts();