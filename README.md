# PersonalQA: AI-Augmented Personal Question Answering

## Overview

PersonalQA is a system that helps users answer personal health and lifestyle questions by analyzing their own logged data (meals, check-ins, etc.). This project augments the original manual concept with an LLM (Google Gemini) to provide more insightful, context-aware answers, especially when the data is ambiguous or incomplete.

**AI Augmentation:**
The LLM is used to synthesize answers from user facts, handle ambiguous cases, and provide general knowledge when personal data is insufficient. This makes the system more powerful and user-friendly, as it can always provide a helpful response.

---

## 1. Concept Specifications

- **[Original and AI-Augmented Specs in personalqa-spec.md](./personalqa-spec.md)**

---

## 2. User Interaction Design

### Annotated UX Sketches

1. **Ask Screen**
   - ![Ask Screen](UX%20Journey%20Sketch3.jpg)
   - *Annotation:* User enters a question and clicks "Ask". The user's question and recent facts are sent to the LLM.

2. **Answer with Citations**
   - ![Answer with Citations](UX%20Journey%20Sketch4.jpg)
   - *Annotation:* LLM returns a short answer, confidence, and cited facts. Each claim is linked to a fact ID.

3. **Inconclusive + Web Background / Error**
   - ![Error](UX%20Journey%20Sketch5.jpg)
   - *Annotation:* If the LLM shows an error, an error and retry button is shown. If inconclusive, a web note is shown, clearly labeled and separate from the personal answer.

4. **Meals**
   - ![Insert Meals](UX%20Journey%20Sketch.jpg)
   - *Annotation:* User can add meals so the AI can analyze.

5. **Health Checkin**
   - ![Checkin](UX%20Journey%20Sketch2.jpg)
   - *Annotation:* User inserts the way they feel so the AI can analyze.


### User Journey (with UX Sketches)

Maya opens PersonalQA and lands on the **Ask Screen**, where she enters “Do late fried dinners hurt my next-day energy?” and taps **Ask**. The system selects her recent facts (late fried dinners, next-day energy check-ins) and calls Gemini. On the **Answer with Citations** screen, Maya sees a concise, cited answer with confidence (e.g., 0.78), and each claim is linked to a fact ID. If the LLM is inconclusive or an error occurs, Maya is shown the **Inconclusive + Web Background** or **Error** screen, where a clearly labeled web note or error message and retry button appear. Maya can also add new meals on the **Meals** screen and log how she feels on the **Health Checkin** screen, enriching her data for future questions. All Q&As and web notes are stored in history, so Maya can review them with her nutritionist. The interface always surfaces confidence, citations, and any fallback or web-based notes, so Maya knows the basis for each answer and can decide whether to trust or seek more data.

---

## 3. Implementation & Running

- **Backend only:** All logic is in TypeScript, no front-end.
- **Key files:**
  - `personalqa.ts`: Core logic and LLM integration
  - `gemini-llm.ts`: Gemini API wrapper
  - `personalqa-tests.ts`: Test cases and scenarios
  - `config.json.template`: API key template (never commit your real key)
- **Run with:**
  ```bash
  npm install
  cp config.json.template config.json # Add your API key
  npm start
  ```

---

## Quick Setup & Implementation Steps

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd intro-gemini-schedule
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure your Gemini API key:**
   - Copy the template and add your API key:
     ```bash
     cp config.json.template config.json
     # Edit config.json and paste your Gemini API key
     ```
4. **Run the backend:**
   ```bash
   npm start
   ```
5. **Run tests (optional):**
   ```bash
   npm test
   ```
6. **Review output:**
   - Answers, confidence, and citations will print to the console.
   - See the `personalqa-tests.ts` file for scenario examples.

*Node.js 18+ recommended. No front-end required; all logic is backend TypeScript.*

---

## 4. Test Scenarios: Full Sequences and Prompt Experiments

### Scenario 1: Clear Pattern
**Sequence:**
1. User logs: "Dinner: fried chicken bowl at 21:00" (meal)
2. User logs: "Next-day energy: 4/10 at 13:30" (check_in)
3. User logs: "Dinner: grilled bowl at 19:15" (meal)
4. User logs: "Next-day energy: 6/10 at 13:30" (check_in)
5. User logs: "Insight: fried + late dinner linked to lower next-day energy (conf 0.78)" (insight)
6. User asks: "Do fried late dinners hurt my next-day energy?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted with a strict template requiring it to answer only using the user's provided facts, cite each claim, and provide a confidence score. The facts included both a clear pattern (fried late dinner → low energy) and a supporting insight. The prompt emphasized strict citation and discouraged any unsupported claims.
*What worked:* The LLM consistently produced a concise answer, cited the correct facts, and gave a high confidence score. The answer was easy to trace back to the user's data, and the LLM did not hallucinate or overgeneralize.
*What went wrong:* Occasionally, the LLM would include slightly redundant information or repeat the same fact in different words. In rare cases, it would cite more facts than necessary, making the answer less focused.
*Issues remaining:* The LLM sometimes struggles to summarize when multiple facts are very similar, leading to minor verbosity.

---

### Scenario 2: Conflicting Evidence
**Sequence:**
1. User logs: "Dinner: grilled bowl at 21:30" (meal)
2. User logs: "Next-day energy: 7/10 at 13:00" (check_in)
3. User logs: "Dinner: fried bowl at 21:30" (meal)
4. User logs: "Next-day energy: 6/10 at 13:00" (check_in)
5. User logs: "Dinner: fried bowl at 21:30" (meal)
6. User logs: "Next-day energy: 4/10 at 13:00" (check_in)
7. User asks: "Is lateness or frying affecting my next-day energy more?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted to explicitly mention uncertainty if the evidence was inconclusive, lower its confidence score, and suggest what additional data would help. The facts were intentionally ambiguous, with both fried and grilled late dinners and mixed energy results. The prompt required the LLM to cite all relevant facts and avoid making unsupported claims.
*What worked:* The LLM acknowledged the ambiguity, cited all relevant facts, and produced a low-confidence answer. The web support fallback was triggered as intended, providing a general knowledge note.
*What went wrong:* The LLM sometimes hedged too much, using vague language like "it is unclear" or "more data is needed" without offering concrete suggestions. In some runs, it failed to clearly distinguish between the effects of lateness and frying, or it would cite all facts without prioritizing the most relevant ones.
*Issues remaining:* The LLM's ability to weigh conflicting evidence and provide actionable next steps is still limited by prompt clarity and model reasoning. More prompt engineering or post-processing may be needed for sharper answers.

---

### Scenario 3: Out-of-Scope/Edge Case
**Sequence:**
1. User logs: "Logged breakfast: oatmeal + berries" (meal)
2. User asks: "Are seed oils toxic?" (LLM action)

**Experiment Paragraph:**
*Approach:* The LLM was prompted to provide a concise general knowledge answer if no relevant facts were found, and to clearly separate personal data from web-based information. The system also required the LLM to return a low confidence score and to avoid citing unrelated facts.
*What worked:* The LLM returned a short, helpful web note and a low-confidence answer, always providing a user-facing response. The web note was clearly labeled and did not mix with the personal answer.
*What went wrong:* Occasionally, the LLM attempted to cite the only available fact (the breakfast log) even though it was unrelated, or it would provide a generic answer that was not specific to the user's question. In some cases, the web note was too broad or lacked actionable information.
*Issues remaining:* Ensuring the LLM never hallucinates citations and always clearly separates personal and web-based answers remains a challenge, especially for truly out-of-scope questions.

---

## 5. Prompt Variants: Motivation and Results


#### Prompt 1: Baseline

```
You are a careful coach answering ONLY with the user's provided facts.
Return STRICT JSON of the shape:
{"answer": "...", "citations": ["factId1","factId2"], "confidence": 0.0}
Rules:
- Keep the answer ≤ 100 words and avoid repeating information.
- Every claim MUST be supported by the most relevant provided facts; cite by fact ids. Limit citations to those facts that directly support your answer (max 3).
- You MUST ONLY use fact IDs exactly as shown below in your citations. Do NOT invent, change, or guess any IDs. If you cite a fact, copy its ID exactly as given.
- If facts conflict, clearly describe the nature of the conflict, mention uncertainty, and lower confidence. Suggest what additional data would help resolve the ambiguity.
- If evidence is weak or inconclusive, make a clear, reasoned conclusion based on the closest facts, but lower the confidence accordingly. Never refuse to answer. If the data is inconclusive, suggest what a web search might reveal or what further information would be needed, and include this in your answer.
- For every answer, you must always cite at least one fact from the provided list, even if it is only tangentially related to the question.
- When reasoning about meal timing, interpret times after 20:00 as 'late' and before 18:00 as 'early'. Use this in your answer if relevant.
- If possible, include one concrete numeric example from the facts to support your answer.
- If the question is out of scope for the provided facts, state this clearly, cite the closest fact, and suggest exactly what kind of data would be needed to answer the question in the future. In this case, also provide a clearly labeled "Web note" with a single, practical tip or summary from general knowledge, separated from the personal answer.
Question: {{question}}
Facts (id: text):
{{facts}}
```


**Prompt 1: Baseline**
- *What remains broken:* The LLM sometimes failed to explicitly mention uncertainty in ambiguous cases and did not always suggest what data would help resolve ambiguity. Out-of-scope answers were terse and not constructive.


#### Prompt 2: Improvement of Prompt 1

```
You are a careful coach answering ONLY with the user's provided facts.
Return STRICT JSON of the shape:
{"answer": "...", "citations": ["factId1","factId2"], "confidence": 0.0}
Rules:
- Keep the answer ≤ 120 words.
- Every claim MUST be supported by provided facts; cite by fact ids.
- You MUST ONLY use fact IDs exactly as shown below in your citations. Do NOT invent, change, or guess any IDs. If you cite a fact, copy its ID exactly as given.
- If facts conflict, clearly describe the nature of the conflict, mention uncertainty, and lower confidence. Suggest what additional data would help resolve the ambiguity.
- If evidence is weak or inconclusive, make a clear, reasoned conclusion based on the closest facts, but lower the confidence accordingly. Never refuse to answer. If the data is inconclusive, suggest what a web search might reveal or what further information would be needed, and include this in your answer.
- For every answer, you must always cite at least one fact from the provided list, even if it is only tangentially related to the question.
- When reasoning about meal timing, interpret times after 20:00 as 'late' and before 18:00 as 'early'. Use this in your answer if relevant.
- If possible, include one concrete numeric example from the facts to support your answer.
- If the question is out of scope for the provided facts, state this clearly, cite the closest fact, and suggest a web search or further data.
Question: {{question}}
Facts (id: text):
{{facts}}
```

**Prompt 2: Improvement of Prompt 1**
- *What changed:* Added explicit instructions for the LLM to mention uncertainty, lower confidence in ambiguous/conflicting cases, and suggest what additional data would help clarify the answer.
- *What improved:* The LLM became more transparent about ambiguity and provided more actionable suggestions for the user. Confidence scores better reflected uncertainty.
- *What remains broken:* Answers could still be verbose or cite too many tangential facts. Web notes were sometimes generic, and out-of-scope suggestions could be more specific.


#### Prompt 3: Final Improvement of Prompt 2

```
You are a careful coach answering ONLY with the user's provided facts.
Return STRICT JSON of the shape:
{"answer": "...", "citations": ["factId1","factId2"], "confidence": 0.0}
Rules:
- Keep the answer ≤ 120 words.
- Every claim MUST be supported by provided facts; cite by fact ids.
- You MUST ONLY use fact IDs exactly as shown below in your citations. Do NOT invent, change, or guess any IDs. If you cite a fact, copy its ID exactly as given.
- If facts conflict, clearly describe the nature of the conflict, mention uncertainty, and lower confidence. Suggest what additional data would help resolve the ambiguity.
- If evidence is weak or inconclusive, make a clear, reasoned conclusion based on the closest facts, but lower the confidence accordingly. Never refuse to answer. If the data is inconclusive, suggest what a web search might reveal or what further information would be needed, and include this in your answer.
- For every answer, you must always cite at least one fact from the provided list, even if it is only tangentially related to the question.
- When reasoning about meal timing, interpret times after 20:00 as 'late' and before 18:00 as 'early'. Use this in your answer if relevant.
- If possible, include one concrete numeric example from the facts to support your answer.
- If the question is out of scope for the provided facts, state this clearly, cite the closest fact, and suggest a web search or further data. In this case, also provide a clearly labeled "Web note" with a general knowledge answer, separated from the personal answer.
Question: {{question}}
Facts (id: text):
{{facts}}
```
**Prompt 3: Final Improvement of Prompt 2**
- *What changed:* Required actionable suggestions, prioritized the most relevant citations, and made web notes more practical and specific. Out-of-scope handling became more constructive.
- *What improved:* Answers were more concise, focused, and actionable. Web notes provided practical tips, and the LLM clearly stated what data would be needed for future questions.
- *What remains broken:* Occasional verbosity or repetition, and the LLM may still struggle with nuanced trade-offs in highly ambiguous scenarios. Some web notes could still be more tailored to the user's context.


---

## 6. Validators & Guardrails

**Validator 1: Bad/missing citations**
*Explanation:* Each citation must be a selected Fact ID. If the answer is non-empty but citations are empty, the system falls back to a conservative response. This prevents the LLM from hallucinating or omitting evidence.

**Validator 2: Confidence bounds**
*Explanation:* The confidence score must be between 0 and 1. If the LLM returns a value outside this range, the system rejects the answer and falls back. This ensures that confidence is always meaningful and comparable.

**Validator 3: Over-long answer**
*Explanation:* If the answer exceeds 800 characters, it is rejected and a fallback is used. This keeps responses concise and user-friendly, and prevents runaway LLM output.

**Validator 4: Non-JSON output**
*Explanation:* The system attempts to parse the LLM output as JSON. If parsing fails, it extracts the first `{...}` block or falls back. This ensures robust handling of LLM formatting errors.

---

## 7. Reproducibility & Submission Hygiene

- **Runs with:** `npm start` (build → tests)
- **No secrets committed:** `config.json` is git-ignored
- **Readable output:** Answers show confidence and citations; web notes show a source link
- **Costs controlled:** `gemini-1.5-flash`, `maxOutputTokens: 220`, compact prompts
- **Node:** 18+ recommended

---

## 8. Known limitations / future work

- **Selection policy:** simple recency-based top-K; could be upgraded to embeddings or rule-based tagging without changing the concept surface.
- **Source variety for web note:** currently Wikipedia; could add MedlinePlus or guidelines for better health context (still separate from personal answers).
- **UI:** sketches only; the backend prints to console. A thin web UI could mirror the same JSON contract.

---

## 9. Example output (abbreviated)

```
=== Scenario C — out-of-scope ===
Answer (conf 0.20): Inconclusive data from your logs.
Citations: (none)
Web search conclusion (Wikipedia • Seed oil): <one-paragraph summary...>
Source: https://en.wikipedia.org/wiki/Seed_oil
```

---

## Troubleshooting

**"Could not load config.json"**
- Ensure `config.json` exists with your API key
- Check JSON format is correct

**"Error calling Gemini API"**
- Verify API key is correct
- Check internet connection
- Ensure API access is enabled in Google AI Studio

**Build Issues**
- Use `npm run build` to compile TypeScript
- Check that all dependencies are installed with `npm install`
