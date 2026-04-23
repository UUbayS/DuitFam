<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Hybrid AI Service Configuration (Groq & Ollama)
    |--------------------------------------------------------------------------
    */
    "ai" => [
        "provider" => env("AI_PROVIDER", "cloud"),
        "fallback_to_local" => env("AI_FALLBACK_TO_LOCAL", true),
        "fallback_to_rule" => env("AI_FALLBACK_TO_RULE", true),
        "cloud" => [
            "api_key" => env("GROQ_API_KEY"),
            "api_url" => "https://api.groq.com/openai/v1/chat/completions",
            "model"   => env("GROQ_MODEL", "llama-3.3-70b-versatile"),
        ],
        "local" => [
            "api_url" => env("OLLAMA_API_URL", "http://localhost:11434/v1/chat/completions"),
            "model"   => env("OLLAMA_MODEL", "qwen2.5:0.5b"),
        ],
    ],
];
