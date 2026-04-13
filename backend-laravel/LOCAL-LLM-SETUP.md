# 🤖 Local LLM Setup Guide (Gemma 4)

## 📋 Prerequisites

- Linux/Mac (Windows via WSL2)
- 8GB+ RAM (Gemma 4B needs ~6GB)
- 10GB disk space for model

---

## 🚀 Quick Setup

### Option 1: Automatic Setup

```bash
cd /home/max/Gawe/DuitFam/backend-laravel
./setup-local-llm.sh
```

This will:
1. Install Ollama (if not installed)
2. Download Gemma 4 model
3. Start Ollama service
4. Test the connection

---

### Option 2: Manual Setup

#### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Or download from: https://ollama.com/download

#### 2. Download Gemma 4

```bash
ollama pull gemma:4b
```

#### 3. Start Ollama Service

```bash
ollama serve
```

#### 4. Test It Works

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma:4b",
    "messages": [{"role": "user", "content": "Halo, apa kabar?"}],
    "max_tokens": 50
  }'
```

---

## 🔧 Configuration

Already configured in `.env`:

```env
OLLAMA_API_URL=http://localhost:11434/v1/chat/completions
OLLAMA_MODEL=gemma:4b
```

---

## 🧪 Verify Setup

```bash
# Check Ollama is running
ollama list

# Check model is downloaded
ollama list | grep gemma

# Test endpoint
curl http://localhost:11434/api/tags
```

---

## 🎯 Usage

Once Ollama is running, **everything works automatically**:

1. Laravel backend calls `http://localhost:11434/v1/chat/completions`
2. Ollama processes with local Gemma 4
3. No internet required after setup
4. 100% private - no data leaves your machine

---

## 🐛 Troubleshooting

### Ollama not starting?
```bash
# Check if port is free
lsof -i :11434

# Restart Ollama
systemctl restart ollama
# OR
ollama serve
```

### Model not found?
```bash
# Re-download
ollama pull gemma:4b
```

### Laravel still using Groq?
```bash
# Clear cache
php artisan config:clear
php artisan cache:clear
```

---

## 💡 Benefits of Local LLM

✅ **100% Private** - All data stays on your machine  
✅ **No API Keys** - No rate limits or costs  
✅ **Always Available** - Works offline  
✅ **Fast** - No network latency  
✅ **Unlimited** - Query as much as you want  

---

## 📊 Model Info

**Gemma 4 (4B parameters)**
- Developed by Google
- Optimized for local deployment
- Good balance of speed vs quality
- ~6GB RAM usage
- Works on CPU (GPU optional but faster)

---

**That's it! Your AI financial assistant now runs 100% locally!** 🎉
