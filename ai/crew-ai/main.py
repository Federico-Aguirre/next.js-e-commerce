import os
from crewai import LLM, Agent, Crew, Process, Task
from crewai_tools import FileWriterTool

# Cargar ai/agents.md para darle contexto del proyecto a los agentes
def load_agents_md():
    """Busca y carga el contenido del archivo ai/agents.md para darle contexto al Crew."""
    possible_paths = [
        os.path.join(os.path.dirname(__file__), "..", "ai", "agents.md"),
        os.path.join(os.path.dirname(__file__), "ai", "agents.md"),
        "ai/agents.md",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    return "No se encontró ai/agents.md, aplicar reglas generales de Next.js y TypeScript."

agents_context = load_agents_md()

# Detectar el modo de cuota desde el entorno (por defecto 'daily')
CREW_MODE = os.getenv("CREW_MODE", "daily").lower()

if CREW_MODE == "monthly":
    print("🚀 Ejecutando con CUOTAS MENSUALES (monthly-main)")
    model_arq = "openai/monthly-main"
    model_prog = "openai/monthly-main"
    model_test = "openai/monthly-main"
else:
    print("⚡ Ejecutando con CUOTAS DIARIAS (Gemini / Groq / OpenRouter)")
    model_arq = "openai/daily-gemini"
    model_prog = "openai/daily-groq"
    model_test = "openai/daily-openrouter"

# 1. Configuración de modelos según el modo seleccionado (Sin modificar)
llm_arquitecto = LLM(
    model=model_arq,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
    max_tokens=4096,
)

llm_programador = LLM(
    model=model_prog,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
    max_tokens=4096,
)

llm_tester = LLM(
    model=model_test,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
    max_tokens=4096,
)

# Herramienta para escribir archivos
file_writer_tool = FileWriterTool()

# 2. Definición de Agentes (Orientados a Next.js / TypeScript + contexto de agents.md)
arquitecto = Agent(
    role="Arquitecto Frontend Senior",
    goal="Diseñar la estructura modular de componentes Next.js, Server/Client Components y tipos TypeScript",
    backstory=(
        "Eres un arquitecto senior experto en React y Next.js.\n\n"
        f"--- REGLAS Y CONTEXTO DEL PROYECTO (ai/agents.md) ---\n{agents_context}"
    ),
    llm=llm_arquitecto,
    verbose=True,
)

programador = Agent(
    role="Desarrollador Next.js & TypeScript Senior",
    goal="Escribir código TypeScript (.tsx/.ts) para Next.js limpio, funcional y bien documentado",
    backstory=(
        "Eres un programador pragmático experto en Next.js, React y TypeScript. "
        "Tienes estrictamente prohibido generar código en Python; todo debe ser TypeScript.\n\n"
        f"--- REGLAS Y CONTEXTO DEL PROYECTO (ai/agents.md) ---\n{agents_context}"
    ),
    llm=llm_programador,
    verbose=True,
)

qa_engineer = Agent(
    role="Ingeniero de Calidad Frontend (QA)",
    goal="Auditar el código TypeScript escrito y generar pruebas unitarias",
    backstory=(
        "Eres un auditor exigente que busca errores sintácticos, de tipos en TypeScript e inconsistencias en componentes React.\n\n"
        f"--- REGLAS Y CONTEXTO DEL PROYECTO (ai/agents.md) ---\n{agents_context}"
    ),
    llm=llm_tester,
    tools=[file_writer_tool],
    verbose=True,
)

# 3. Entrada de Usuario con salida limpia
try:
    prompt_usuario = input(
        "\n¿Qué módulo o componente de Next.js deseas desarrollar de forma autónoma?: "
    )
except KeyboardInterrupt:
    print("\n\n⏹️ Cancelado por el usuario.")
    exit(0)

tarea_diseño = Task(
    description=f"Diseña la arquitectura en Next.js/TypeScript para el siguiente requerimiento: '{prompt_usuario}'. Define componentes, props y estructuras necesarias.",
    expected_output="Un documento técnico detallado con la especificación de componentes y tipos TypeScript.",
    agent=arquitecto,
)

tarea_codigo = Task(
    description="Toma el diseño generado por el Arquitecto y escribe el código TypeScript/React completo (.tsx) para la solución. No generes Python.",
    expected_output="El código fuente completo escrito en TypeScript sin omitir implementación.",
    agent=programador,
)

tarea_testing = Task(
    description="Revisa el código generado, genera pruebas unitarias y guarda todo el resultado en un archivo llamado 'output_modulo.tsx'.",
    expected_output="Archivo 'output_modulo.tsx' creado con el código final y sus pruebas.",
    agent=qa_engineer,
)

# 4. Orquestación
equipo_desarrollo = Crew(
    agents=[arquitecto, programador, qa_engineer],
    tasks=[tarea_diseño, tarea_codigo, tarea_testing],
    process=Process.sequential,
)

# 5. Ejecución
if __name__ == "__main__":
    try:
        print("\n--- INICIANDO EQUIPO MULTI-AGENTE AUTÓNOMO ---")
        resultado = equipo_desarrollo.kickoff()
        print("\n--- TRABAJO FINALIZADO ---")
        print(resultado)
    except KeyboardInterrupt:
        print("\n\n⏹️ Ejecución cancelada.")