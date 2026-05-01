# DuitFam API - Postman Collection Guide

## Cara Import ke Postman

1. Buka Postman
2. Klik **Import** → paste URL atau upload file
3. Atau手动 buat satu-satu mengikuti liste di bawah

---

##Liste Endpoint

### 1. Auth

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/login` | Login | `{"email": "test@test.com", "password": "password"}` |
| POST | `/api/auth/register` | Register | `{"username": "user", "email": "user@test.com", "password": "Password123"}` |
| POST | `/api/auth/logout` | Logout | - |

### 2. Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/utilities/categories` | Get all categories |

### 3. Reports

| Method | Endpoint | Description | Query |
|--------|----------|-------------|-------|
| GET | `/api/reports/summary` | Get monthly summary | `?month=2026-04` |
| GET | `/api/reports/history` | Get transaction history | - |
| GET | `/api/reports/analysis` | Get analysis | `?month=2026-04` |
| GET | `/api/reports/historical` | Get historical data | - |
| GET | `/api/reports/family/summary` | Get family summary | `?month=2026-04` |
| GET | `/api/reports/family/historical` | Get family historical | - |
| GET | `/api/reports/family/history` | Get family history | - |
| GET | `/api/reports/family/analysis` | Get family analysis | - |

### 4. Targets

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/targets` | Get all targets | - |
| POST | `/api/targets` | Create target | `{"nama_target": "Beli Sepatu", "target_jumlah": 500000, "tanggal_target": "2026-06-30"}` |
| PUT | `/api/targets/{id}` | Update target | - |
| DELETE | `/api/targets/{id}` | Delete target | - |
| POST | `/api/targets/contribute` | Contribute to target | `{"id_target": "...", "jumlah": 50000}` |
| POST | `/api/targets/withdraw` | Withdraw from target | `{"id_target": "...", "jumlah": 10000}` |

### 5. Transactions

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/transactions` | Create transaction | `{"jenis": "pengeluaran", "jumlah": 25000, "keterangan": "Makan", "tanggal": "2026-04-28", "id_kategori": "..."}` |
| POST | `/api/transactions/deposit` | Deposit to child (parent only) | `{"child_id": "...", "amount": 10000}` |

### 6. Withdrawals / Approvals

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/transactions/withdrawals` | Get withdrawal requests | - |
| POST | `/api/transactions/withdrawals` | Create withdrawal request (child) | `{"amount": 10000, "reason": "Butuh uang"}` |
| PATCH | `/api/transactions/withdrawals/{id}` | Approve/reject (parent) | `{"action": "approved", "reason": "OK"}` |

### 7. Users

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/users/children` | Get children (parent only) | - |
| GET | `/api/users/children/balances` | Get children balances | - |
| POST | `/api/users/children/create` | Create child account | `{"username": "anak1", "email": "anak1@test.com", "password": "Password123"}` |
| POST | `/api/users/children/{id}/reset-password` | Reset child password | `{"password": "Password123"}` |
| PUT | `/api/users/profile` | Update profile | `{"username": "newusername"}` |
| PUT | `/api/users/password` | Update password | `{"currentPassword": "old", "newPassword": "new"}` |

### 8. Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| PATCH | `/api/notifications/{id}/read` | Mark as read |

---

## Cara Menggunakan

### 1. Setup Token
1. Login dapat token
2. Di Postman, klik collection → Variables
3. Isi `token` dengan token yang dapat

### 2. Test Endpoint
1. Klik endpoint di collection
2. Klik Send
3. Lihat response time di bawah response

### 3. Catat Hasil

| Endpoint | Response Time (ms) |
|----------|-------------------|
| Login | |
| Logout | |
| Categories | |
| Reports Summary | |
| Reports History | |
| Reports Analysis | |
| Targets | |
| Notifications | |

---

## Cara Test Frontend

### 1. Buka Browser DevTools
- Chrome: F12 atau Ctrl+Shift+I
- Tab **Network**

### 2. Login di Frontend
- Refresh page
- Klik endpoint yang mau di-test
- Di Network tab, klik request
- Lihat **Timing** → **Waiting (TTFB)**

### 3. Bandingkan

| Endpoint | Postman (ms) | Frontend TTFB (ms) |
|----------|--------------|-------------------|
| Login | | |
| Categories | | |
| Reports Summary | | |
| ... | | |

---

## Notes

- Database: MongoDB (`duitfam`)
- Backend: Laravel (`localhost:8000`)
- Frontend: React (`localhost:5173`)