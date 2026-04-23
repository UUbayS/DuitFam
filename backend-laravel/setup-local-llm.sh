#!/bin/bash

echo "🤖 DuitFam Local LLM Setup (Llama 3.1 8b via Ollama)"
echo "================================================"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo ""
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh

    if [ $? -eq 0 ]; then
        echo "✅ Ollama installed successfully!"
    else
        echo "❌ Failed to install Ollama"
        echo "Please install manually: https://ollama.com/download"
        exit 1
    fi
else
    echo "✅ Ollama is already installed"
fi

echo ""
echo "🚀 Starting Ollama service..."
# Check if ollama is already running
if ! pgrep -x "ollama" > /dev/null; then
    ollama serve &
    sleep 3
else
    echo "✅ Ollama service is already running"
fi

# Model configuration
MODEL="llama3.1:8b"

echo "📥 Downloading Llama 3.1 8b model (4.7GB)..."
echo ""
ollama pull $MODEL

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Llama 3.1 8b downloaded successfully!"
else
    echo "❌ Failed to download Llama 3.1 8b"
    exit 1
fi

echo ""
echo "🧪 Testing local LLM..."
echo "   Sending a test message to verify setup..."
echo ""

RESPONSE=$(curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Halo, siapa kamu?"}],
    "max_tokens": 50
  }')

if echo "$RESPONSE" | grep -q "content"; then
    echo "✅ Local LLM is working!"
    echo ""
    echo "📊 Test response: $(echo "$RESPONSE" | grep -o '"content":"[^"]*"' | head -1 | cut -d'"' -f4)"
else
    echo "⚠️ Test failed, but model may still work"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "================================================"
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure your .env has:"
echo "      AI_PROVIDER=local (atau cloud untuk hybrid)"
echo "      OLLAMA_MODEL=llama3.1:8b"
echo ""
echo "   2. Restart your Laravel server"
echo ""
echo "   3. Open the AI chatbox in your app"
echo ""
echo "💡 DuitFam sekarang menggunakan sistem Hybrid AI!"
echo "================================================"
