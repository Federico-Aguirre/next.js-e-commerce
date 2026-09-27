# Variables de entorno
export GEMINI_API_KEY="tu_gemini_key"
export GROQ_API_KEY="tu_groq_key"
export OPENROUTER_API_KEY="tu_openrouter_key"
export MISTRAL_API_KEY="tu_mistral_key"
export COHERE_API_KEY="tu_cohere_key"
export LITELLM_PROXY="http://localhost:4000/v1"

# Verificador de LiteLLM
_check_and_run_litellm() {
    if ! pgrep -f "litellm" > /dev/null; then
        echo "⚡ LiteLLM Proxy no está activo. Iniciándolo en segundo plano..."
        nohup litellm --config aider-config.yml > /tmp/litellm.log 2>&1 &
        sleep 3
        echo "✅ Proxy LiteLLM iniciado correctamente."
    fi
}

# Funciones Aider
aider-arch() {
    _check_and_run_litellm
    aider --openai-api-base $LITELLM_PROXY --openai-api-key dummy --model openai/daily-gemini "$@"
}

aider-fast() {
    _check_and_run_litellm
    aider --openai-api-base $LITELLM_PROXY --openai-api-key dummy --model openai/daily-groq "$@"
}

aider-doc() {
    _check_and_run_litellm
    aider --openai-api-base $LITELLM_PROXY --openai-api-key dummy --model openai/daily-openrouter "$@"
}

aider-monthly() {
    _check_and_run_litellm
    aider --openai-api-base $LITELLM_PROXY --openai-api-key dummy --model openai/monthly-main "$@"
}