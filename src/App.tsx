import { useMemo, useState } from "react";
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

  const [errorsV, setErrorsV] = useState<Record<string, string>>({});
  const [errorsI, setErrorsI] = useState<Record<string, string>>({});
  const [errorReq, setErrorReq] = useState<string>("");

  const [result, setResult] = useState<ReturnType<typeof validateAnswers> | null>(null);
  const [shareMsg, setShareMsg] = useState<string>("");

  const sol = useMemo(() => solveCircuitMNA(state.circuit), [state.circuit]);
  const svg = useMemo(() => renderCircuitSvg(state.circuit), [state.circuit]);

  function applyNewState(next: AppState) {
    setState(next);
    setResult(null);
    setAnswersV({});
    setAnswersI({});
    setAnswerReq("");
    setErrorsV({});
    setErrorsI({});
    setErrorReq("");
    setShareMsg("");
  }

  function onValidate() {
    const nextErrorsV: Record<string, string> = {};
    const nextErrorsI: Record<string, string> = {};
    let nextErrorReq = "";

    const volts: Record<string, number> = {};
    for (const q of state.targets.voltages) {
      const raw = answersV[q.id] ?? "";
      const v = parseNumber(raw);
      if (v === null) nextErrorsV[q.id] = "Introduce un número válido (V).";
      else volts[q.id] = v;
    }

    const currents: Record<string, number> = {};
    for (const q of state.targets.currents) {
      const raw = answersI[q.elementId] ?? "";
      const v = parseNumber(raw);
      if (v === null) nextErrorsI[q.elementId] = "Introduce un número válido (A).";
      else currents[q.elementId] = v;
    }

    const reqNum = parseNumber(answerReq);
    if (reqNum === null) nextErrorReq = "Introduce un número válido (Ω).";

    setErrorsV(nextErrorsV);
    setErrorsI(nextErrorsI);
    setErrorReq(nextErrorReq);

    const hasErrors = Object.keys(nextErrorsV).length > 0 || Object.keys(nextErrorsI).length > 0 || !!nextErrorReq;
    if (hasErrors) {
      setResult(null);
      return;
    }

    const r = validateAnswers(state.circuit, sol, state.targets, { voltages: volts, currents, req: reqNum! });
    setResult(r);
  }

  function onShare() {
    const s = encodeState(state);
    window.location.hash = `#s=${s}`;
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setShareMsg("Link actualizado en la URL. Si el navegador lo permite, se copió al portapapeles.");
    window.setTimeout(() => setShareMsg(""), 4000);
  }

  function onNewDemo() {
    const next = demoCircuit();
    applyNewState(next);
    window.location.hash = "";
  }

  const allOk = result
    ? Object.values(result.voltages).every((x) => x.ok) && Object.values(result.currents).every((x) => x.ok) && (result.req?.ok ?? false)
    : false;

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Simulador de Circuitos</h1>
          <div className="sub">DC resistivo · Voltajes · Corrientes · R_eq(A,B)</div>
        </div>
        <div className="actions">
          <button onClick={onNewDemo}>Nuevo (demo)</button>
          <button onClick={onShare}>Compartir</button>
          <button className="primary" onClick={onValidate}>
            Validar
          </button>
        </div>
      </header>

      {shareMsg && <div className="toast">{shareMsg}</div>}

      <main className="grid">
        <section className="card">
          <h2>Circuito</h2>
          <div className="svg" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="hint">Convención: I(R) positiva en el sentido indicado (a → b).</div>
        </section>

        <section className="card">
          <h2>Resuelve</h2>

          <h3>Voltajes (V)</h3>
          <div className="table">
            {state.targets.voltages.map((q) => {
              const ok = result?.voltages[q.id]?.ok;
              const err = errorsV[q.id];
              return (
                <div className={`row ${ok === true ? "ok" : ok === false ? "bad" : err ? "bad" : ""}`} key={q.id}>
                  <div className="label">{q.label ?? q.id}</div>
                  <div className="field">
                    <input
                      inputMode="decimal"
                      value={answersV[q.id] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAnswersV((p) => ({ ...p, [q.id]: v }));
                        if (errorsV[q.id]) setErrorsV((p) => {
                          const n = { ...p };
                          delete n[q.id];
                          return n;
                        });
                      }}
                      placeholder="p. ej. 3.3"
                      aria-invalid={!!err}
                    />
                    {err && <div className="error">{err}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <h3>Corrientes en resistores (A)</h3>
          <div className="table">
            {state.targets.currents.map((q) => {
              const ok = result?.currents[q.elementId]?.ok;
              const err = errorsI[q.elementId];
              return (
                <div className={`row ${ok === true ? "ok" : ok === false ? "bad" : err ? "bad" : ""}`} key={q.elementId}>
                  <div className="label">{q.label ?? q.elementId}</div>
                  <div className="field">
                    <input
                      inputMode="decimal"
                      value={answersI[q.elementId] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAnswersI((p) => ({ ...p, [q.elementId]: v }));
                        if (errorsI[q.elementId])
                          setErrorsI((p) => {
                            const n = { ...p };
                            delete n[q.elementId];
                            return n;
                          });
                      }}
                      placeholder="p. ej. 0.012"
                      aria-invalid={!!err}
                    />
                    {err && <div className="error">{err}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <h3>Resistencia equivalente (Ω)</h3>
          <div className={`row ${result?.req?.ok ? "ok" : result ? "bad" : errorReq ? "bad" : ""}`}>
            <div className="label">R_eq(A,B)</div>
            <div className="field">
              <input
                inputMode="decimal"
                value={answerReq}
                onChange={(e) => {
                  const v = e.target.value;
                  setAnswerReq(v);
                  if (errorReq) setErrorReq("");
                }}
                placeholder="p. ej. 560"
                aria-invalid={!!errorReq}
              />
              {errorReq && <div className="error">{errorReq}</div>}
            </div>
          </div>

          {result && <div className={`status ${allOk ? "ok" : "bad"}`}>{allOk ? "Todo correcto" : "Hay errores"}</div>}
        </section>
      </main>
    </div>
  );
}

export default App;
