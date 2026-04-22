# 🧪 Testing AI Chat & Alerts - Quick Guide

## 📋 Prerequisites

1. **Start Laravel Backend:**
   ```bash
   cd /home/max/Gawe/DuitFam/backend-laravel
   php artisan serve
   ```

2. **Start React Frontend:**
   ```bash
   cd /home/max/Gawe/DuitFam/frontend
   npm run dev
   ```

3. **Login to the app** at `http://localhost:5173`

---

## 🧪 Testing Methods

### **Method 1: Using Test Script (Recommended)**

```bash
cd /home/max/Gawe/DuitFam/backend-laravel
./test-alerts.sh
```

The script will:
- Ask for your auth token (get from browser localStorage)
- Let you choose which alert to test
- Create test transactions automatically

---

### **Method 2: Manual cURL Commands**

**Get your auth token:**
1. Login to the app
2. Open browser DevTools (F12)
3. Go to Application tab → Local Storage
4. Copy the `token` value

#### 🚨 Test 1: Expenses Exceed Income (HIGH SEVERITY)

```bash
# Step 1: Create income
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "jenis": "pemasukan",
    "jumlah": 1000000,
    "tanggal": "2026-04-13",
    "keterangan": "Test income",
    "id_kategori": null
  }'

# Step 2: Create expenses (more than income)
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "jenis": "pengeluaran",
    "jumlah": 1200000,
    "tanggal": "2026-04-13",
    "keterangan": "Test expense",
    "id_kategori": null
  }'
```

**Expected Result:** 🚨 Red alert banner on dashboard saying "Pengeluaran Melebihi Pemasukan!"

---

#### ⚠️ Test 2: Almost Exceeded Budget (>90%)

```bash
# Income: 1,000,000
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"jenis": "pemasukan", "jumlah": 1000000, "tanggal": "2026-04-13", "keterangan": "Test", "id_kategori": null}'

# Expense: 950,000 (95%)
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"jenis": "pengeluaran", "jumlah": 950000, "tanggal": "2026-04-13", "keterangan": "Test", "id_kategori": null}'
```

**Expected Result:** ⚠️ Yellow warning "Pengeluaran Hampir Melebihi Pemasukan"

---

#### ✅ Test 3: Healthy Finances (<70%)

```bash
# Income: 1,000,000
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"jenis": "pemasukan", "jumlah": 1000000, "tanggal": "2026-04-13", "keterangan": "Test", "id_kategori": null}'

# Expense: 500,000 (50% - healthy!)
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"jenis": "pengeluaran", "jumlah": 500000, "tanggal": "2026-04-13", "keterangan": "Test", "id_kategori": null}'
```

**Expected Result:** ✅ Green success "Keuangan Sehat!"

---

#### 🤖 Test 4: AI Chat

```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Bagaimana pengeluaran saya bulan ini?"
  }'
```

**Expected Result:** JSON response with AI-generated financial advice in Indonesian

---

#### 🔔 Test 5: Get Alerts Directly

```bash
curl http://localhost:8000/api/ai/alerts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Result:** JSON array of current alerts based on your transactions

---

### **Method 3: Using the App UI**

1. **Create transactions** through the app's normal transaction form
2. **Go to Dashboard** - alerts should appear automatically at the top
3. **Click chat icon** (bottom-right) - AI assistant opens with financial summary
4. **Ask questions** like:
   - "Bagaimana pengeluaran saya?"
   - "Berapa budget tersedia?"
   - "Saran menabung"
   - "Tips hemat"

---

## 🎯 Expected Alert Behaviors

| Scenario | Alert Type | Color | Severity |
|----------|-----------|-------|----------|
| Expenses > Income | 🚨 Warning | Red | High |
| Expenses > 90% Income | ⚠️ Warning | Yellow | High |
| Single Category > 30% | 📊 Warning | Yellow | Medium |
| Weekly Spending > 25% | 🛑 Warning | Orange | Medium |
| Expenses < 70% Income | ✅ Success | Green | Low |

---

## 🐛 Troubleshooting

**No alerts showing?**
- Check if you have transactions for the current month
- Verify Laravel server is running on port 8000
- Check browser console for errors

**AI chat not responding?**
- Verify Groq API key in `.env` file
- Check Laravel logs: `storage/logs/laravel.log`
- Test Groq API directly: `curl https://api.groq.com/openai/v1/chat/completions`

**401 Unauthorized?**
- Token expired - login again
- Token format wrong - should be: `Bearer YOUR_TOKEN`

---

## 🎬 Quick Demo Flow

```
1. Login → Dashboard (see alerts if data exists)
2. Open chat → See financial summary + suggestions
3. Ask "Bagaimana pengeluaran saya?" → AI analyzes & responds
4. Click suggestion cards → Get detailed breakdown
5. Create more transactions → Alerts update on refresh
```

---

**That's it! Your AI-powered financial alert system is ready to test! 🚀**
