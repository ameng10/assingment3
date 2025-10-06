
// Edge case: all facts are ambiguous or unrelated to the question
async function scenarioA() {
  await runScenario({
    tag: "Scenario A — clear pattern",
    facts: [
      { at: "2025-10-01T21:00Z", content: "Dinner: fried chicken bowl at 21:00", source: "meal" },
      { at: "2025-10-02T13:30Z", content: "Next-day energy: 4/10 at 13:30", source: "check_in" },
      { at: "2025-10-03T19:15Z", content: "Dinner: grilled bowl at 19:15", source: "meal" },
      { at: "2025-10-04T13:30Z", content: "Next-day energy: 6/10 at 13:30", source: "check_in" },
      { at: "2025-10-05T10:00Z", content: "Insight: fried + late dinner linked to lower next-day energy (conf 0.78)", source: "insight" },
    ],
    question: "Do fried late dinners hurt my next-day energy?"
  });
}

async function scenarioB() {
  await runScenario({
    tag: "Scenario B — conflicting evidence",
    facts: [
      { at: "2025-10-06T21:30Z", content: "Dinner: grilled bowl at 21:30", source: "meal" },
      { at: "2025-10-07T13:00Z", content: "Next-day energy: 7/10 at 13:00", source: "check_in" },
      { at: "2025-10-08T21:30Z", content: "Dinner: fried bowl at 21:30", source: "meal" },
      { at: "2025-10-09T13:00Z", content: "Next-day energy: 6/10 at 13:00", source: "check_in" },
      { at: "2025-10-10T21:30Z", content: "Dinner: fried bowl at 21:30", source: "meal" },
      { at: "2025-10-11T13:00Z", content: "Next-day energy: 4/10 at 13:00", source: "check_in" },
    ],
    question: "Is lateness or frying affecting my next-day energy more?",
    forceWebSupportIfLowConfidence: true
  });
}

async function scenarioC() {
  await runScenario({
    tag: "Scenario C — out-of-scope",
    facts: [
      { at: "2025-10-12T10:00Z", content: "Logged breakfast: oatmeal + berries", source: "meal" },
    ],
    question: "Are seed oils toxic?"
  });
}

type ScenarioInput = {
  tag: string;
  facts: { at: string; content: string; source: string }[];
  question: string;
  webSupport?: boolean;
  forceWebSupportIfLowConfidence?: boolean;
};

async function runScenario({ tag, facts, question, webSupport = true, forceWebSupportIfLowConfidence = false }: ScenarioInput) {
  const qa = new PersonalQAStore();
  const u = "maya";
  for (const fact of facts) {
    qa.ingestFact({ owner: u, ...fact });
  }
  const res = await qa.askLLM({ requester: u, question });
  printQA(tag, res);
  if (webSupport) {
    if (forceWebSupportIfLowConfidence) {
      if (!res.confidence || res.confidence <= 0.6) {
        await maybeDoWebSupport(question, res);
      }
    } else {
      await maybeDoWebSupport(question, res);
    }
  }
}

/**
 * PersonalQA test scenarios — with web support on inconclusive answers.
 * Requires Node 18+ (global fetch).
 */
import { PersonalQAStore, GeminiLLM } from "./personalqa";
import * as path from "path";

function printQA(tag: string, qa: { answer: string; citedFacts: string[]; confidence?: number }) {
  console.log(`\n=== ${tag} ===`);
  const confVal = typeof qa.confidence === "number" ? qa.confidence : 0;
  const conf = `(conf ${confVal.toFixed(2)})`;
  console.log(`Answer ${conf}: ${qa.answer}`);
  console.log(`Citations: ${qa.citedFacts.join(", ") || "(none)"}`);
}

function isInconclusive(qa: { answer: string; confidence: number }) {
  const txt = qa.answer.toLowerCase();
  return qa.confidence <= 0.60 || txt.includes("insufficient evidence") || txt.includes("inconclusive data");
}

function extractTopic(question: string): string | null {
  const q = question.toLowerCase();
  if (q.includes("seed oil")) return "Seed oil";
  if (q.includes("seed oils")) return "Seed oil";
  if (q.includes("vegetable oil")) return "Vegetable oil";
  if (q.includes("fiber")) return "Dietary fiber";
  if (q.includes("frying") || q.includes("fried")) return "Fried food";
  if (q.includes("lateness") || q.includes("late dinner") || q.includes("meal timing")) return "Meal timing";
  return null;
}

async function fetchWikipediaSummary(topic: string): Promise<string | null> {
  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/\s+/g, "_"))}`;
  try {
    const res = await fetch(endpoint, { headers: { "accept": "application/json" } });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data && typeof data === "object" && typeof data.extract === "string" && data.extract.length) {
      // first sentence or two
      return data.extract.split("\n")[0];
    }
    return null;
  } catch {
    return null;
  }
}

async function maybeDoWebSupport(question: string, qa: { answer: string; confidence?: number }) {
  if (!isInconclusive({ answer: qa.answer, confidence: typeof qa.confidence === "number" ? qa.confidence : 0 })) return;

  // Use the LLM to generate a general, non-data-based conclusion or general knowledge
  const configPath = path.resolve(__dirname, '../config.json');
  const config = require(configPath);
  const llm = new GeminiLLM(config);
  const prompt = `The user asked: "${question}". There is insufficient personal data to answer directly. Please provide a concise, general knowledge answer (no more than 2-3 sentences) based on what is generally known, not the user's data. Do not leave the answer blank. If you do not know, provide a plausible, helpful, and informative response in 2-3 sentences.`;
  try {
    const llmResponse = await llm.executeLLM(prompt);
    if (llmResponse && llmResponse.trim().length > 0) {
      // Only print if there is a non-empty answer
      console.log(`Web note (LLM general knowledge): ${llmResponse.trim()}`);
    }
    // If empty, do not print anything
  } catch (e) {
    console.log("Web note: unable to get general knowledge from LLM.");
  }
}



export async function runAll() {
  await scenarioA();
  await scenarioB();
  await scenarioC();
}

// For convenience
export async function runA() { await scenarioA(); }
export async function runB() { await scenarioB(); }
export async function runC() { await scenarioC(); }

if (require.main === module) {
  runAll().catch(e => {
    // Only show user-facing error
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  });
}
