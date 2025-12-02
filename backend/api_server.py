import ollama
import requests
import io
import math
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware 
from pydantic import BaseModel
from pypdf import PdfReader
from bs4 import BeautifulSoup

app = FastAPI(title="The Academic Analysis Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_MODEL = 'llama3:8b'
OLLAMA_HOST = 'http://localhost:11434'
client = ollama.Client(host=OLLAMA_HOST)

# --- 1. INTELLIGENT CHUNKING & SUMMARIZATION ---

def chunk_text(text, chunk_size=8000):
    """Splits huge text into manageble chunks for the AI."""
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]

def summarize_chunk(chunk_text):
    """Compresses a section of text while keeping key technical details."""
    prompt = (
        "Summarize the following text efficiently. "
        "Keep specific algorithms, mathematical formulas, results, and technical terminology. "
        "Remove fluff and repetitive introductions."
    )
    try:
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {'role': 'system', 'content': prompt},
                {'role': 'user', 'content': chunk_text},
            ],
            options={"temperature": 0.3} # Low temp for factual summary
        )
        return response['message']['content'].strip()
    except Exception:
        return chunk_text[:500] + "..." # Fallback

def process_large_document(full_text):
    """
    If text is < 12k chars, returns it as is.
    If text is huge, it chunks it, summarizes chunks, and returns a condensed version.
    """
    if len(full_text) < 12000:
        return full_text
    
    print(f"Document is large ({len(full_text)} chars). Running Map-Reduce summarization...")
    chunks = chunk_text(full_text)
    summaries = []
    
    # Process chunks (In a real production app, do this in parallel)
    for i, chunk in enumerate(chunks):
        print(f"Summarizing chunk {i+1}/{len(chunks)}...")
        summary = summarize_chunk(chunk)
        summaries.append(summary)
    
    combined_summary = "\n\n".join(summaries)
    print("Summarization complete.")
    return combined_summary

# --- 2. EXISTING HELPER FUNCTIONS ---

def extract_text_from_pdf(pdf_stream):
    try:
        reader = PdfReader(pdf_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

def fetch_text_from_url(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', '').lower()
        if 'application/pdf' in content_type or url.endswith('.pdf'):
            return extract_text_from_pdf(io.BytesIO(response.content))
        else:
            soup = BeautifulSoup(response.content, 'html.parser')
            for script in soup(["script", "style", "nav", "footer"]):
                script.extract()
            return soup.get_text(separator='\n').strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

# --- 3. AGENT PROMPTS (Unchanged) ---
PROMPTS = {
    'explicator': "You are 'The Explicator'. Analyze this paper. 1. Summarize problem/solution. 2. Explain methodology. 3. Define jargon.",
    'visionary': "You are 'The Visionary'. Based on this paper: 1. Propose 3 novel research directions. 2. Suggest real-world applications. 3. Hypothesize cross-disciplinary connections.",
    'practitioner': "You are 'The Practitioner'. Generate high-level Python pseudo-code implementing the core logic described in this paper."
}

def call_ollama_agent(system_prompt, user_content):
    try:
        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': user_content}],
            options={"temperature": 0.7}
        )
        return response['message']['content'].strip()
    except Exception as e:
        return f"Agent Error: {str(e)}"

# --- MAIN ENDPOINTS ---

async def run_agents(text):
    # This is where the magic happens: Reduce the text size BEFORE sending to agents
    processed_text = process_large_document(text)
    
    return {
        "status": "success",
        "explicator": call_ollama_agent(PROMPTS['explicator'], processed_text),
        "visionary": call_ollama_agent(PROMPTS['visionary'], processed_text),
        "practitioner": call_ollama_agent(PROMPTS['practitioner'], processed_text),
        "model": OLLAMA_MODEL
    }

@app.post("/analyze_url")
async def analyze_url(url: str = Form(...)):
    print(f"Processing URL: {url}")
    paper_text = fetch_text_from_url(url)
    return await run_agents(paper_text)

@app.post("/analyze_file")
async def analyze_file(file: UploadFile = File(...)):
    print(f"Processing File: {file.filename}")
    contents = await file.read()
    paper_text = extract_text_from_pdf(io.BytesIO(contents))
    return await run_agents(paper_text)