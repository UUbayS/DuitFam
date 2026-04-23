# 🏠 DuitFam: Solusi Manajemen Keuangan Keluarga Cerdas

**DuitFam** adalah aplikasi manajemen keuangan yang didesain khusus untuk membantu keluarga mengelola dan melacak anggaran secara bersama-sama. Dilengkapi dengan **AI Financial Advisor**, DuitFam membantu memberikan saran keuangan yang cerdas dan personal bagi setiap anggota keluarga.

---

## 🌟 Fitur Utama Aplikasi
1.  **👨‍👩‍👧‍👦 Manajemen Anggota Keluarga**: Kelola peran orang tua dan anak dalam satu ekosistem yang terintegrasi.
2.  **💰 Pencatatan Transaksi**: Lacak pemasukan dan pengeluaran harian keluarga secara real-time.
3.  **🎯 Target Menabung (Sip-Dana)**: Buat tujuan keuangan dan pantau progres tabungan bersama.
4.  **📊 Analisis Keuangan**: Visualisasi data pengeluaran agar lebih mudah dipahami.
5.  **🤖 AI Financial Advisor**: Asisten cerdas yang memberikan saran keuangan otomatis berdasarkan data transaksi Anda (Mendukung mode Cloud & Lokal).
6.  **✅ Sistem Persetujuan**: Orang tua dapat memantau dan memberikan persetujuan untuk target keuangan anak.

---

## 📋 Prasyarat Sistem
Sebelum memulai, pastikan perangkat Anda memiliki:
- **PHP**: v8.2 atau lebih baru
- **Node.js**: v18 atau lebih baru
- **RAM**: Minimal 8GB (Direkomendasikan 16GB+ karena Anda menggunakan Llama 3.1 8B)
- **Ollama**: [Download di sini](https://ollama.com/download)

---

## 🚀 Langkah Instalasi

### 1. Setup Backend (Laravel)
Masuk ke direktori backend dan instal dependensi:
```powershell
cd backend-laravel
composer install
cp .env.example .env
php artisan key:generate
```

### 2. Konfigurasi AI di `.env`
Buka file `.env` dan pastikan variabel berikut sudah terisi:

```env
# AI Priority Mode
AI_PROVIDER=cloud             # Gunakan 'cloud' (Groq) atau 'local' (Ollama)
AI_FALLBACK_TO_LOCAL=true     # Aktifkan failover ke Ollama
AI_FALLBACK_TO_RULE=true      # Aktifkan failover ke logika sistem

# Tier 1: Groq Cloud API (Dapatkan di console.groq.com)
GROQ_API_KEY=gsk_xxxx...      
GROQ_MODEL=llama-3.3-70b-versatile

# Tier 2: Ollama Local API
OLLAMA_API_URL=http://127.0.0.1:11434/v1/chat/completions
OLLAMA_MODEL=llama3.1:8b
```

### 3. Setup Database & Data
Jalankan migrasi agar asisten AI bisa membaca data transaksi Anda:
```powershell
php artisan migrate --seed
```

### 4. Setup Local AI (Ollama)
Pastikan aplikasi Ollama sudah berjalan, lalu jalankan script otomatis yang sudah disediakan:
```powershell
# Versi Windows (PowerShell)
.\setup-local-llm.ps1

# Versi Bash (WSL/Git Bash)
./setup-local-llm.sh
```
*Script ini akan otomatis men-download model **Llama 3.1 8B** ke komputer Anda.*

### 5. Setup Frontend (React)
Masuk ke direktori frontend dan instal dependensi:
```powershell
cd ../frontend
npm install
```

---

## 🛠️ Cara Menjalankan Aplikasi

Anda perlu menjalankan dua terminal secara bersamaan:

**Terminal 1 (Backend):**
```powershell
cd backend-laravel
php artisan serve
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```

---

## 🧪 Cara Menguji Sistem AI
Gunakan script pengetesan yang sudah kami sediakan untuk memastikan Triple-Tier berjalan lancar:
```powershell
cd backend-laravel
./test-alerts.sh
```
Pilih **Opsi 5 (Hybrid AI System Check)**. Script ini akan mengetes apakah AI bisa menjawab dan apakah sistem *fallback* (Cloud -> Local -> Rule) berfungsi jika salah satu provider dimatikan.

---

## 💡 Tips Penggunaan
- **Pre-warming**: Saat pertama kali memanggil AI Lokal setelah komputer nyala, mungkin butuh waktu ~10 detik bagi Ollama untuk memuat model ke RAM. Panggilan selanjutnya akan instan!
- **Mode Privasi**: Jika ingin 100% data tidak keluar ke internet, set `AI_PROVIDER=local` di `.env`.

---

**Selamat Berhemat dengan DuitFam AI!** 💸🚀
