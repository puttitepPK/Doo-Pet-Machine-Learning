# 🐾 Pet Health AI

Web-based screening application for preliminary detection and assessment of canine skin lesions from images, powered by Deep Learning (Computer Vision) and a CLIP Guardrail screening mechanism.
---
## 🚀 How to Run

Run both the Backend and Frontend servers concurrently in **two separate terminals**

### 1. Backend Server (Python FastAPI)
1. Open Terminal 1 and navigate to the `model` directory:
   ```bash
   cd backend/model
   ```
2. Install Python dependencies (first-time only):
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server:
   ```bash
   python main.py
   ```
   *The API will start at `http://127.0.0.1:8000` (Interactive API docs: `http://127.0.0.1:8000/docs`)*

### 2. Frontend Application (React + Vite)
1. Open Terminal 2 and navigate to the frontend directory:
   ```bash
   cd frontend
   npm ci
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open your browser and visit:
   ```text
   http://localhost:5173
   ```
---

## 📌 Model Architecture Overview
The system operates via a **Two-stage AI Pipeline**
1. **Stage 1: Dog Guardrail (Input Screening)**
   - Powered by **`CLIP` (`openai/clip-vit-base-patch32`)** via Hugging Face.
   - Verifies whether the uploaded image contains a **"dog or canine skin lesion"**.
   - If a non-canine subject (e.g., cat, bird, human, everyday object) is detected, the request is rejected with a user-friendly alert asking for a valid image.
2. **Stage 2: Canine Skin Disease Classifier**
   - Supports both **`MobileNetV3-Small`** and **`EfficientNet-B0`** (PyTorch).
   - Classifies canine dermatological conditions into **6 target classes**:
     1. `bacterial_dermatosis` — Bacterial skin infection / Pyoderma
     2. `demodicosis` — Demodectic mange / Follicular mite infection
     3. `dermatitis` — Generalized dermatitis / Allergic skin reaction
     4. `fungal_infection` — Ringworm / Dermatophytosis
     5. `healthy` — Normal, healthy skin
     6. `hypersensitivity` — Flea allergy dermatitis / Hypersensitivity reaction

---

## 📁 Project Structure

```text
frontend/          React + Vite: app, features, shared, public assets
backend/
  model/           FastAPI, inference, training, weights
    llm/           LLM advice: prompts, Gemini client, services, API router
  database/        SQL and database documentation (unchanged)
docs/
  frontend-structure.md
  backend-restructure-plan.md
```

See [Frontend setup](frontend/README.md), [Frontend structure](docs/frontend-structure.md),
and [Backend plan](docs/backend-restructure-plan.md).

For LLM work, see [LLM development guide](backend/model/llm/README.md).

---

## Thongsuk Test Git
