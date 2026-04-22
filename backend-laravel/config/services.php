<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Local LLM Service Configuration (Gemma 4 via Ollama)
    |--------------------------------------------------------------------------
    */
    "groq" => [
        "api_url" => env(
            "OLLAMA_API_URL",
            "http://localhost:11434/v1/chat/completions",
        ),
        "model" => env("OLLAMA_MODEL", "qwen2.5:0.5b"),
    ],
];
