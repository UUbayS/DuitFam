# 🤖 DuitFam Hybrid AI Setup Guide (Llama 3.1 8B)

## 🌟 Triple-Tier Hybrid Strategy
DuitFam menggunakan sistem AI yang tangguh dengan 3 lapis pertahanan:
1. **Lapis 1 (Cloud)**: Groq API (Llama 3.3 70B) - Performa tinggi & analisis tajam.
2. **Lapis 2 (Local)**: Ollama (Llama 3.1 8B) - Model paling cerdas dan stabil untuk lokal.
3. **Lapis 3 (Rule-Based)**: Fallback otomatis berbasis logika cerdas jika AI tidak tersedia.

---

## 📋 Prerequisites

- OS: Linux/Mac/Windows (via WSL2 or Desktop App)
- RAM: 16GB+ (Llama 3.1 8B butuh ~5GB VRAM/RAM)
- Disk space: ~5GB untuk model

---

## 🚀 Quick Setup

### Option 1: Automatic Setup

```bash
cd backend-laravel
chmod +x setup-local-llm.sh
./setup-local-llm.sh
```

This will:
1. Install Ollama (jika belum ada)
2. Download model **Llama 3.1 8B** (Most Intelligent)
3. Memastikan Ollama service aktif
4. Mengetes koneksi local LLM

---

### Option 2: Manual Setup

#### 1. Install Ollama
Download dan install dari: https://ollama.com/download

#### 2. Download Llama 3.1 8B
```bash
# Model configuration
MODEL="gemma4:e2b"

echo "📥 Downloading Llama 3.1 8b model (4.7GB)..."
ollama pull $MODEL
```

#### 3. Start Ollama Service
Pastikan aplikasi Ollama sedang berjalan di background.

#### 4. Test It Works
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Halo, siapa kamu?"}],
    "max_tokens": 50
  }'
```

---

## 🔧 Configuration (.env)

Pastikan variabel berikut ada di `.env` anda:

```env
# AI Provider Priority
AI_PROVIDER=cloud             # Opsi: cloud, local
AI_FALLBACK_TO_LOCAL=true     # Fallback ke Ollama jika Groq gagal
AI_FALLBACK_TO_RULE=true      # Fallback ke Rule-based jika AI gagal

# Groq (Cloud)
GROQ_API_KEY=gsk_your_key_here

# Ollama (Local)
OLLAMA_API_URL=http://localhost:11434/v1/chat/completions
OLLAMA_MODEL=llama3.1:8b
```

---

## 🧪 Verify Setup

```bash
# Cek model yang tersedia
ollama list

# Jalankan test script (opsional)
./test-alerts.sh
```

---

## 🎯 Cara Kerja Hybrid

1. Aplikasi akan mencoba menghubungi **Groq API** terlebih dahulu untuk kualitas terbaik.
2. Jika internet mati atau Groq down, sistem otomatis pindah ke **Local Ollama**.
3. Jika Ollama belum di-setup, sistem akan menggunakan **Rule-Based Engine** (Data Fact Extraction) untuk memberikan jawaban akurat berdasarkan saldo dan pengeluaran riil anda.

---

## 💡 Benefits of Hybrid AI

✅ **Privacy First** - Data keuangan sensitif diproses secara lokal saat mode offline.  
✅ **Always Online** - Tidak pernah kehilangan layanan advisor.  
✅ **Fast & Light** - Gemma 4 E2B sangat cepat bahkan di laptop spesifikasi rendah.  
✅ **Smart** - Menggunakan model 70B saat tersedia untuk analisis mendalam.  

---

## 📊 Model Info: Llama 3.1 8B

- **Parameters**: 8 Billion (8B)
- **Developer**: Meta AI
- **Size**: ~4.7GB
- **RAM Usage**: ~6GB total
- **Features**: Highly stable, excellent Indonesian support, world-class reasoning
- **Speed**: Very Smart & Reliable

---

**Selesai! AI Advisor DuitFam anda sekarang super tangguh!** 🚀🎉
