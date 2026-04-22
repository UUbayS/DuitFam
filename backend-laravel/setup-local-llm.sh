#!/bin/bash

echo "🤖 DuitFam Local LLM Setup (Gemma 4 via Ollama)"
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
ollama serve &
sleep 3

echo ""
echo "📥 Downloading Gemma 4 model (this may take a while)..."
echo "   Model size: ~4B parameters"
echo ""
ollama pull gemma:4b

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Gemma 4 downloaded successfully!"
else
    echo "❌ Failed to download Gemma 4"
    exit 1
fi

echo ""
echo "🧪 Testing local LLM..."
echo "   Sending a test message to verify setup..."
echo ""

RESPONSE=$(curl -s http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma:4b",
    "messages": [{"role": "user", "content": "Halo, apa kabar?"}],
    "max_tokens": 50
  }')

if echo "$RESPONSE" | grep -q "content"; then
    echo "✅ Local LLM is working!"
    echo ""
    echo "📊 Test response: $(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['choices'][0]['message']['content'][:100])" 2>/dev/null)"
else
    echo "⚠️ Test failed, but model may still work"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "================================================"
echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart your Laravel server:"
echo "      cd /home/max/Gawe/DuitFam/backend-laravel"
echo "      php artisan serve"
echo ""
echo "   2. Open the AI chatbox in your app"
echo "   3. All requests now use local Gemma 4!"
echo ""
echo "💡 Ollama runs in the background automatically"
echo "================================================"
