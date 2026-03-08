from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import json, re, os, requests
from bs4 import BeautifulSoup
from fpdf import FPDF
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# ── LLM Provider ───────────────────────────────────────────────
# Set LLM_PROVIDER in your .env file: ollama | gemini | claude | openai
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_HOST  = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-haiku-20241022")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

def llm_chat(system, user):
    """
    Single entry point for ALL LLM calls.
    Switch provider by changing LLM_PROVIDER in your .env — no code changes needed.
    """

    # ── Gemini (Google) ────────────────────────────────────────
    if LLM_PROVIDER == "gemini":
        import google.generativeai as genai
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        model = genai.GenerativeModel(
            model_name=GEMINI_MODEL,
            system_instruction=system if system else None,
        )
        resp = model.generate_content(user)
        return resp.text

    # ── Claude (Anthropic) ─────────────────────────────────────
    elif LLM_PROVIDER == "claude":
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text

    # ── OpenAI ─────────────────────────────────────────────────
    elif LLM_PROVIDER == "openai":
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
        )
        return resp.choices[0].message.content

    # ── Ollama (local, default) ────────────────────────────────
    else:
        import ollama as _ollama
        client = _ollama.Client(host=OLLAMA_HOST)
        resp = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
        )
        return resp["message"]["content"]


# ── Paths ──────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CV_FOLDER  = os.path.join(BASE_DIR, "cvs")
CAND_FILE  = os.path.join(BASE_DIR, "candidate.json")

CANDIDATE_DEFAULTS = {
    "name": "", "email": "", "phone": "",
    "location": "", "linkedin": "", "github": "", "permit": "",
}

def load_candidate():
    if os.path.exists(CAND_FILE):
        with open(CAND_FILE, encoding="utf-8") as f:
            return json.load(f)
    return CANDIDATE_DEFAULTS.copy()

def save_candidate(data):
    with open(CAND_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def load_cvs():
    cvs = {}
    if not os.path.exists(CV_FOLDER):
        os.makedirs(CV_FOLDER)
    for fname in sorted(os.listdir(CV_FOLDER)):
        if fname.endswith(".txt"):
            key   = fname.replace(".txt", "")
            label = key.replace("_", " ").title()
            path  = os.path.join(CV_FOLDER, fname)
            with open(path, encoding="utf-8") as f:
                content = f.read()
            cvs[key] = {"label": label, "content": content}
    return cvs


# ── Scrapers ───────────────────────────────────────────────────

def scrape_linkedin(url):
    job_id = None
    m = re.search(r'currentJobId=(\d+)', url)
    if m:
        job_id = m.group(1)
    if not job_id:
        m = re.search(r'/jobs/view/(\d+)', url)
        if m:
            job_id = m.group(1)
    if not job_id:
        return None

    api_url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        r = requests.get(api_url, headers=headers, timeout=10)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        title    = soup.select_one(".top-card-layout__title, h1")
        company  = soup.select_one(".topcard__org-name-link, .top-card-layout__company")
        location = soup.select_one(".topcard__flavor--bullet, .top-card-layout__second-subline")
        desc     = soup.select_one(".description__text, .show-more-less-html__markup")
        parts = []
        if title:    parts.append(f"Role: {title.get_text(strip=True)}")
        if company:  parts.append(f"Company: {company.get_text(strip=True)}")
        if location: parts.append(f"Location: {location.get_text(strip=True)}")
        if desc:
            parts.append("")
            parts.append("--- Job Description ---")
            parts.append(desc.get_text(separator="\n", strip=True)[:3000])
        result = "\n".join(parts)
        if company and len(result) > 200:
            return result
    except Exception:
        pass
    return None


def scrape_generic(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept-Language": "en-US,en;q=0.9,de;q=0.8",
        }
        r = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        desc_selectors = [
            "#jobDescriptionText",
            ".jobsearch-jobDescriptionText",
            '[data-testid="jobDescriptionText"]',
            '[data-test="jobDescriptionContent"]',
            ".JobDetails_jobDescription__uW_fK",
            '[data-at="jobad-responsibilities-text"]',
            ".job-ad-display-8y3rn",
            ".job-ad-description",
            '[data-xds="RteContent"]',
            "article",
            "main",
        ]
        for sel in desc_selectors:
            el = soup.select_one(sel)
            if el and len(el.get_text(strip=True)) > 200:
                lines = [l.strip() for l in el.get_text("\n").splitlines() if l.strip()]
                return "\n".join(lines)[:3500]
        lines = [l.strip() for l in soup.get_text("\n").splitlines() if l.strip()]
        return "\n".join(lines)[:3000]
    except Exception as e:
        return f"Error: {e}"


def scrape_url(url):
    host = url.split("/")[2] if "/" in url else ""
    if "linkedin.com" in host:
        result = scrape_linkedin(url)
        if result:
            return result, None
        return None, (
            "LinkedIn job pages require login to scrape. "
            "Please use the browser extension or paste the job description directly."
        )
    text = scrape_generic(url)
    if text and not text.startswith("Error"):
        return text, None
    return None, "Could not extract job description. Please paste the text directly."


# ── CV Selection ───────────────────────────────────────────────

def pick_cv(job_text, cvs):
    keys = list(cvs.keys())
    if len(keys) == 1:
        return keys[0]
    labels = {k: cvs[k]["label"] for k in keys}
    prompt = f"""Job description:
{job_text[:800]}

Which CV profile fits this role best? Options: {labels}
Reply with ONLY the key name, nothing else."""
    chosen = llm_chat("", prompt).strip().lower()
    for k in keys:
        if k in chosen:
            return k
    return keys[0]


# ── Cover Letter Generation ────────────────────────────────────

def make_cover_letter(cv_content, job_text, candidate):
    # Step 1: analyse job vs CV
    analysis_prompt = f"""Analyze this job posting and CV carefully.

JOB POSTING:
{job_text[:2000]}

CV:
{cv_content}

List exactly 3 specific requirements from the job posting, and for each one, identify the most relevant concrete evidence from the CV (specific project, role, or skill). Be specific — mention actual project names, technologies, and outcomes.

Format:
REQUIREMENT 1: [exact requirement from job]
CV EVIDENCE: [specific matching experience/project from CV]

REQUIREMENT 2: [exact requirement from job]
CV EVIDENCE: [specific matching experience/project from CV]

REQUIREMENT 3: [exact requirement from job]
CV EVIDENCE: [specific matching experience/project from CV]

COMPANY NAME: [extract the company name from the job posting]
ROLE: [extract the exact role title]"""

    analysis = llm_chat("", analysis_prompt)

    # Step 2: write the letter
    system = f"""You are writing a cover letter for {candidate['name']}.

CANDIDATE DETAILS (use these exactly, never use placeholders):
- Name: {candidate['name']}
- Email: {candidate['email']}
- Phone: {candidate['phone']}
- Location: {candidate['location']}
- LinkedIn: {candidate['linkedin']}
- {candidate['permit']}

STRICT RULES:
1. Write ONLY in English
2. Never use placeholders like [Your Name], [Your Email], [Company] — use the real values above
3. Output ONLY the cover letter body (no subject line, no meta-commentary)
4. Start directly with Dear [Hiring Manager / actual name if known],
5. 3-4 paragraphs only
6. Each paragraph must reference a SPECIFIC project or experience from the CV evidence below
7. Connect each skill directly to what the job needs — do not just list skills
8. End with contact details: {candidate['email']} | {candidate['phone']}
9. NO German text unless the job is explicitly in German"""

    letter_prompt = f"""Using this job-CV match analysis:
{analysis}

And this full CV:
{cv_content}

Write a tailored cover letter that directly connects the candidate's specific experiences to the job requirements identified above. Each body paragraph should reference at least one concrete project or achievement by name."""

    return llm_chat(system, letter_prompt)


def make_filename(job_text):
    prompt = f"""Generate a filename for this job (underscores only, no spaces, no .pdf extension):
Format: CompanyName_Role_CoverLetter
Job: {job_text[:400]}
Reply with ONLY the filename, nothing else."""
    name = re.sub(r'[^\w_]', '_', llm_chat("", prompt).strip())
    return name[:60] or "Cover_Letter"


# ── PDF Generation ─────────────────────────────────────────────

def save_pdf(text, filename, candidate):
    output_dir = os.path.join(BASE_DIR, "generated")
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, f"{filename}.pdf")

    UNICODE_MAP = {
        "\u2018": "'",  "\u2019": "'",
        "\u201c": '"',  "\u201d": '"',
        "\u2013": "-",  "\u2014": "--",
        "\u2022": "*",  "\u2023": "*",
        "\u2026": "...",
        "\u00b7": "-",
        "\u2192": "->", "\u2190": "<-",
        "\u00e9": "e",  "\u00e8": "e",
        "\u00fc": "ue", "\u00f6": "oe",
        "\u00e4": "ae", "\u00df": "ss",
        "\u00c4": "Ae", "\u00d6": "Oe",
        "\u00dc": "Ue",
        "\u00a9": "(c)", "\u00ae": "(R)",
        "\u2122": "(TM)",
    }

    def safe(s):
        s = str(s)
        for uni, rep in UNICODE_MAP.items():
            s = s.replace(uni, rep)
        return s.encode("latin-1", "ignore").decode("latin-1")

    pdf = FPDF()
    pdf.set_margins(20, 20, 20)
    pdf.set_auto_page_break(True, 20)
    pdf.add_page()
    W = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(20, 20, 20)
    pdf.set_x(pdf.l_margin)
    pdf.cell(W, 9, safe(candidate["name"]), ln=True)

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(80, 80, 80)
    for field in [
        safe(candidate["email"]),
        safe(candidate["phone"]) + "   |   " + safe(candidate["location"]),
        safe(candidate["linkedin"]) + "   |   " + safe(candidate["github"]),
        safe(candidate["permit"]),
    ]:
        pdf.set_x(pdf.l_margin)
        pdf.cell(W, 5, field, ln=True)

    pdf.ln(3)
    pdf.set_draw_color(160, 160, 160)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + W, pdf.get_y())
    pdf.ln(8)

    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(20, 20, 20)
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped == "":
            pdf.ln(4)
        else:
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(W, 6, safe(stripped))

    pdf.output(path)
    return path, filename


# ── Routes ─────────────────────────────────────────────────────

@app.route("/api/provider")
def get_provider():
    models = {
        "ollama": OLLAMA_MODEL,
        "gemini": GEMINI_MODEL,
        "claude": CLAUDE_MODEL,
        "openai": OPENAI_MODEL,
    }
    return jsonify({"provider": LLM_PROVIDER, "model": models.get(LLM_PROVIDER, "unknown")})

@app.route("/api/cvs")
def get_cvs():
    cvs = load_cvs()
    return jsonify({k: v["label"] for k, v in cvs.items()})

@app.route("/api/generate", methods=["POST"])
def generate():
    data     = request.json
    mode     = data.get("mode", "paste")
    job_input = data.get("job_input", "")
    cv_choice = data.get("cv_choice", "auto")

    def stream():
        try:
            cvs = load_cvs()

            if mode == "url":
                yield f"data: {json.dumps({'step': 'Scraping job posting...', 'progress': 10})}\n\n"
                job_text, warn = scrape_url(job_input)
                if not job_text:
                    yield f"data: {json.dumps({'error': warn or 'Could not read job description. Try pasting instead.'})}\n\n"
                    return
                if warn:
                    yield f"data: {json.dumps({'step': 'Warning: ' + warn, 'progress': 15})}\n\n"
            else:
                job_text = job_input
                yield f"data: {json.dumps({'step': 'Job description received', 'progress': 15})}\n\n"

            if not job_text or len(job_text.strip()) < 50:
                yield f"data: {json.dumps({'error': 'Job description too short. Please paste more details.'})}\n\n"
                return

            yield f"data: {json.dumps({'step': 'Selecting best CV...', 'progress': 25})}\n\n"
            cv_key   = pick_cv(job_text, cvs) if cv_choice == "auto" else cv_choice
            cv_label = cvs[cv_key]["label"]
            yield f"data: {json.dumps({'step': 'Using CV: ' + cv_label, 'progress': 35, 'cv_used': cv_key})}\n\n"

            yield f"data: {json.dumps({'step': 'Matching your experience to the job requirements...', 'progress': 50})}\n\n"

            yield f"data: {json.dumps({'step': 'Writing tailored cover letter...', 'progress': 65})}\n\n"
            letter = make_cover_letter(cvs[cv_key]["content"], job_text, load_candidate())
            yield f"data: {json.dumps({'step': 'Cover letter ready!', 'progress': 85, 'letter': letter})}\n\n"

            yield f"data: {json.dumps({'step': 'Generating PDF...', 'progress': 92})}\n\n"
            filename = make_filename(job_text)
            pdf_path, fname = save_pdf(letter, filename, load_candidate())
            yield f"data: {json.dumps({'step': 'Done! Saved as ' + fname + '.pdf', 'progress': 100, 'filename': fname, 'pdf_ready': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/api/download/<filename>")
def download(filename):
    output_dir = os.path.join(BASE_DIR, "generated")
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, f"{filename}.pdf")
    if os.path.exists(path):
        return send_file(path, as_attachment=True, download_name=f"{filename}.pdf")
    return jsonify({"error": "File not found"}), 404

@app.route("/api/upload_cv", methods=["POST"])
def upload_cv():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    fname = secure_filename(file.filename)
    ext   = os.path.splitext(fname)[1].lower()

    if ext not in [".txt", ".pdf"]:
        return jsonify({"error": "Only .txt or .pdf files allowed"}), 400

    os.makedirs(CV_FOLDER, exist_ok=True)

    if ext == ".txt":
        save_name = fname
        file.save(os.path.join(CV_FOLDER, save_name))
    else:
        try:
            import pdfplumber, io
            file_bytes = io.BytesIO(file.read())
            with pdfplumber.open(file_bytes) as pdf_file:
                text = "\n".join(page.extract_text() or "" for page in pdf_file.pages)
            save_name = fname.replace(".pdf", ".txt")
            with open(os.path.join(CV_FOLDER, save_name), "w", encoding="utf-8") as f:
                f.write(text)
        except Exception as e:
            return jsonify({"error": f"Could not extract PDF text: {e}"}), 500

    key   = save_name.replace(".txt", "")
    label = key.replace("_", " ").title()
    return jsonify({"success": True, "key": key, "label": label})

@app.route("/api/delete_cv/<key>", methods=["DELETE"])
def delete_cv(key):
    safe_key = secure_filename(key + ".txt")
    path = os.path.join(CV_FOLDER, safe_key)
    if os.path.exists(path):
        os.remove(path)
        return jsonify({"success": True})
    return jsonify({"error": "CV not found"}), 404

@app.route("/api/candidate", methods=["GET"])
def get_candidate():
    return jsonify(load_candidate())

@app.route("/api/candidate", methods=["POST"])
def update_candidate():
    data     = request.json
    allowed  = {"name", "email", "phone", "location", "linkedin", "github", "permit"}
    filtered = {k: v for k, v in data.items() if k in allowed}
    save_candidate(filtered)
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)