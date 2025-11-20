import ollama
import re
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel

# --- FASTAPI SETUP ---
app = FastAPI(
    title="The Synthesis Engine API",
    description="Hosts the multi-agent debate workflow using Ollama."
)

# CORS middleware is essential. It allows the React app (usually on port 3000) 
# to talk to the FastAPI server (on port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration for Ollama
OLLAMA_MODEL = 'llama3:8b'
OLLAMA_HOST = 'http://localhost:11434' # Local Ollama instance
# Initialize the client globally
try:
    client = ollama.Client(host=OLLAMA_HOST)
    print(f"Ollama client initialized for model: {OLLAMA_MODEL}")
except Exception as e:
    print(f"ERROR: Could not initialize Ollama client. Ensure Ollama is running on {OLLAMA_HOST}. Error: {e}")

# Pydantic model for input data
class ProblemInput(BaseModel):
    problem: str

# --- AGENT PROMPTS ---
PROMPTS = {
    'optimist': "You are a visionary and an optimist. Your goal is to generate 3 bold, ambitious, and highly creative ideas to solve the given problem. Do not worry about feasibility, budget, or risks. Focus on innovation. Format your output as a numbered list.",
    'critic': "You are a sharp, skeptical, and analytical critic. Your goal is to identify potential flaws, risks, and market challenges for the given idea. Provide a 3-point bulleted list of your top concerns. Be tough but fair.",
    'realist': "You are a practical, hands-on realist and project manager. Your job is to synthesize the ambitious 'Idea' and the harsh 'Critique' to form a single, balanced, and actionable plan. How can we get the *best* of the idea while *avoiding* the risks? Propose a single refined concept. Start your response with 'Refined Plan:' and use clear, professional language."
}

# --- AGENT FUNCTIONS (Core Logic) ---

def call_ollama_agent(system_prompt: str, user_content: str):
    """Calls the local Ollama client with the specified system prompt and content."""
    # Temperature logic for persona distinction
    if 'optimist' in system_prompt.lower(): temp = 0.9
    elif 'critic' in system_prompt.lower(): temp = 0.6
    else: temp = 0.4
    
    try:
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_content},
            ],
            options={"temperature": temp, "top_p": 0.9}
        )
        return response['message']['content'].strip()
    except Exception as e:
        print(f"Ollama Call Error: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama Agent Error: {e}. Check if {OLLAMA_MODEL} is pulled and running.")

def parse_first_idea(text: str) -> str:
    """Helper to extract the first numbered item."""
    match = re.search(r"1\.[\s\r\n]+(.*?)(?:\n\d\.|$)", text, re.DOTALL)
    if match:
        return match[1].strip()
    
    lines = text.split('\n')
    for line in lines:
        if line.strip():
            return line.strip().lstrip('1. ')
    return text.strip()

# --- MAIN API ENDPOINT ---

@app.post("/run_synthesis")
async def run_synthesis(input_data: ProblemInput):
    """Triggers the full sequential multi-agent debate."""
    problem = input_data.problem
    
    # --- 1. Phase 1: Optimist ---
    optimist_output = call_ollama_agent(PROMPTS['optimist'], problem)
    idea_to_refine = parse_first_idea(optimist_output)
    
    # --- 2. Phase 2: Critic ---
    critic_prompt = f"Original Problem: {problem}\n\nIdea to Critique:\n{idea_to_refine}"
    critic_output = call_ollama_agent(PROMPTS['critic'], critic_prompt)

    # --- 3. Phase 3: Realist ---
    realist_prompt = (
        f"Original Problem: {problem}\n\n"
        f"Original Idea:\n{idea_to_refine}\n\n"
        f"Critic's Concerns:\n{critic_output}"
    )
    realist_output = call_ollama_agent(PROMPTS['realist'], realist_prompt)

    # --- 4. Return Final Results ---
    return {
        "status": "success",
        "optimist": optimist_output,
        "critic": critic_output,
        "realist": realist_output,
        "ideaToRefine": idea_to_refine,
        "model": OLLAMA_MODEL
    }