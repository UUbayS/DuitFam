# DuitFam Backend (Laravel)
 
Backend API untuk aplikasi DuitFam, dibangun menggunakan Laravel dan MongoDB.
 
## 🚀 Persiapan
 
1.  **Install Dependensi**:
    ```bash
    composer install
    ```
2.  **Environment Setup**:
    ```bash
    cp .env.example .env
    php artisan key:generate
    ```
3.  **Database & Seeding**:
    - Untuk instalasi pertama kali:
      ```bash
      php artisan migrate --seed
      ```
    - Untuk memperbarui data kategori atau role saja:
      ```bash
      php artisan db:seed
      ```
 
## 🛠️ Fitur Backend
- **Authentication**: Menggunakan API Token.
- **Transactions**: Pencatatan pemasukan dan pengeluaran.
- **Saving Goals**: Manajemen target menabung.
- **AI Advisor**: Integrasi dengan Groq (Cloud) dan Ollama (Local).
- **Audit Logs**: Pencatatan aktivitas sensitif ke MongoDB.
 
## 🧪 Testing AI
Gunakan script `test-alerts.sh` untuk menguji sistem Triple-Tier AI.
