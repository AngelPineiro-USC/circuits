import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { demoCircuit } from "./core/demo/circuits";
import { solveCircuitMNA } from "./core/solver/mna";
import { renderCircuitSvg } from "./core/render/svg";
import { parseNumber, validateAnswers } from "./core/validate";
import { decodeState, encodeState, type AppState } from "./core/share/state";

function loadStateFromHash(): AppState | null {
  const h = window.location.hash;
  const m = h.match(/^#s=(.+)$/);
  if (!m) return null;
  try {
    return decodeState(m[1]);
  } catch {
    return null;
  }
}

function App() {
  const [state, setState] = useState<AppState>(() => loadStateFromHash() ?? demoCircuit());
  const [answersV, setAnswersV] = useState<Record<string, string>>({});
  const [answersI, setAnswersI] = useState<Record<string, string>>({});
  const [answerReq, setAnswerReq] = useState<string>("");
  const [result, setResult] = useState<ReturnType<typeof validateAnswers> | null>(null);

  const sol = useMemo(() => solveCircuitMNA(state.circuit), [state.circuit]);
  const svg = useMemo(() => renderCircuitSvg(state.circuit), [state.circuit]);

  useEffect(() => {
    // Reset result when circuit changes
    setResult(null);
    setAnswersV({});
    setAnswersI({});
    setAnswerReq("");
  }, [state.circuit]);

  function onValidate() {
    const volts: Record<string, number> = {};
    for (const q of state.targets.voltages) {
      const v = parseNumber(answersV[q.id] ?? "");
      if (v === null) return alert(`Falta o es inválido: ${q.label ?? q.id}`);
      volts[q.id] = v;
    }
    const currents: Record<string, number> = {};
    for (const q of state.targets.currents) {
      const v = parseNumber(answersI[q.elementId] ?? "");
      if (v === null) return alert(`Falta o es inválido: ${q.label ?? q.elementId}`);
      currents[q.elementId] = v;
    }
    const reqNum = parseNumber(answerReq);
    if (reqNum === null) return alert("Falta o es inválido: R_eq(A,B)");

    const r = validateAnswers(state.circuit, sol, state.targets, { voltages: volts, currents, req: reqNum });
    setResult(r);
  }

  function onShare() {
    const s = encodeState(state);
    window.location.hash = `#s=${s}`;
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    alert("Link copiado (si el navegador lo permite) y actualizado en la URL");
  }

  function onNewDemo() {
    const next = demoCircuit();
    setState(next);
    window.location.hash = "";
  }

  const allOk = result
    ? Object.values(result.voltages).every((x) => x.ok) && Object.values(result.currents).every((x) => x.ok) && (result.req?.ok ?? false)
    : false;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Simulador de Circuitos (MVP)</h1>
          <div className="sub">DC resistivo · Vab · Corrientes · R_eq(A,B)</div>
        </div>
        <div className="actions">
          <button onClick={onNewDemo}>Nuevo (demo)</button>
          <button onClick={onShare}>Compartir</button>
          <button className="primary" onClick={onValidate}>Validar</button>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Circuito</h2>
          <div className="svg" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="hint">Convención: I(R) positiva en el sentido indicado (nodo a → b).</div>
        </section>

        <section className="card">
          <h2>Resuelve</h2>

          <h3>Voltajes</h3>
          <div className="table">
            {state.targets.voltages.map((q) => {
              const ok = result?.voltages[q.id]?.ok;
              return (
                <div className={`row ${ok === true ? "ok" : ok === false ? "bad" : ""}`} key={q.id}>
                  <div className="label">{q.label ?? q.id}</div>
                  <input value={answersV[q.id] ?? ""} onChange={(e) => setAnswersV((p) => ({ ...p, [q.id]: e.target.value }))} placeholder="" />
                </div>
              );
            })}
          </div>

          <h3>Corrientes en resistores</h3>
          <div className="table">
            {state.targets.currents.map((q) => {
              const ok = result?.currents[q.elementId]?.ok;
              return (
                <div className={`row ${ok === true ? "ok" : ok === false ? "bad" : ""}`} key={q.elementId}>
                  <div className="label">{q.label ?? q.elementId}</div>
                  <input value={answersI[q.elementId] ?? ""} onChange={(e) => setAnswersI((p) => ({ ...p, [q.elementId]: e.target.value }))} placeholder="" />
                </div>
              );
            })}
          </div>

          <h3>R_eq(A,B)</h3>
          <div className={`row ${result?.req?.ok ? "ok" : result ? "bad" : ""}`}>
            <div className="label">R_eq(A,B)</div>
            <input value={answerReq} onChange={(e) => setAnswerReq(e.target.value)} placeholder="" />
          </div>

          {result && (
            <div className={`status ${allOk ? "ok" : "bad"}`}>{allOk ? "✅ Todo correcto" : "❌ Hay errores"}</div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
