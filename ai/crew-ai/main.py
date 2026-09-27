import os
from crewai import LLM, Agent, Crew, Process, Task
from crewai_tools import FileWriterTool

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

# 1. Configuración de modelos según el modo seleccionado
llm_arquitecto = LLM(
    model=model_arq,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
)

llm_programador = LLM(
    model=model_prog,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
)

llm_tester = LLM(
    model=model_test,
    api_base="http://localhost:4000/v1",
    api_key="dummy",
)

# Herramienta para escribir archivos
file_writer_tool = FileWriterTool()

# 2. Definición de Agentes
arquitecto = Agent(
    role="Arquitecto de Software",
    goal="Diseñar la estructura modular y especificar la lógica del sistema",
    backstory="Eres un arquitecto senior obsesionado con patrones de diseño limpios.",
    llm=llm_arquitecto,
    verbose=True,
)

programador = Agent(
    role="Desarrollador Python Senior",
    goal="Escribir código Python funcional, eficiente y bien documentado",
    backstory="Eres un programador pragmático y rápido experto en Python.",
    llm=llm_programador,
    verbose=True,
)

qa_engineer = Agent(
    role="Ingeniero de Calidad (QA)",
    goal="Auditar el código escrito y generar pruebas unitarias con pytest",
    backstory="Eres un auditor exigente que busca errores sintácticos y de lógica.",
    llm=llm_tester,
    tools=[file_writer_tool],
    verbose=True,
)

# 3. Entrada de Usuario con salida limpia
try:
    prompt_usuario = input(
        "\n¿Qué módulo o software deseas desarrollar de forma autónoma?: "
    )
except KeyboardInterrupt:
    print("\n\n⏹️ Cancelado por el usuario.")
    exit(0)

tarea_diseño = Task(
    description=f"Diseña la arquitectura para el siguiente requerimiento: '{prompt_usuario}'. Define la estructura de funciones y clases requeridas.",
    expected_output="Un documento técnico detallado con la especificación de clases y funciones.",
    agent=arquitecto,
)

tarea_codigo = Task(
    description="Toma el diseño generado por el Arquitecto y escribe el código Python completo para la solución.",
    expected_output="El código fuente completo escrito en Python sin omitir implementación.",
    agent=programador,
)

tarea_testing = Task(
    description="Revisa el código generado, genera pruebas unitarias exhaustivas con pytest y guarda todo el resultado en un archivo llamado 'output_modulo.py'.",
    expected_output="Archivo 'output_modulo.py' creado con el código final y sus pruebas.",
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