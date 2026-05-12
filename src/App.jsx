import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Braces,
  CircuitBoard,
  Download,
  Eraser,
  FunctionSquare,
  Sparkles,
  Table2,
} from 'lucide-react';
import {
  EXAMPLES,
  MAX_TRUTH_TABLE_VARIABLES,
  buildTruthTable,
  canMinimizeVariables,
  deriveExpressionFromTruthTable,
  minimizeTruthTable,
  parseLogicInput,
  toBooleanAlgebra,
  toPlainStatement,
} from './logic.js';

const DEFAULT_INPUT = EXAMPLES[0].input;
const DEFAULT_TABLE_VARIABLES = 'A, B, C';
const DEFAULT_TABLE_OUTPUTS = [false, true, true, true, true, true, true, true];
const SYMBOL_KEYS = ['A', 'B', 'C', 'X', 'Y', 'Z', '0', '1', '¬', '·', '+', '⊕', '→', '↔', '=', '(', ')'];

function App() {
  const [source, setSource] = useState('expression');
  const [mode, setMode] = useState('statement');
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [variableText, setVariableText] = useState(DEFAULT_TABLE_VARIABLES);
  const [tableOutputs, setTableOutputs] = useState(DEFAULT_TABLE_OUTPUTS);
  const inputRef = useRef(null);

  const parsed = useMemo(() => {
    try {
      if (source === 'truthTable') {
        const variables = parseVariableNames(variableText);
        const rowCount = variables.length > 0 && variables.length <= MAX_TRUTH_TABLE_VARIABLES
          ? 2 ** variables.length
          : tableOutputs.length;
        const outputs = resizeOutputs(tableOutputs, rowCount);
        const ast = deriveExpressionFromTruthTable(variables, outputs);

        return {
          ast,
          canSimplify: true,
          error: null,
          outputName: 'Result',
          algebra: toBooleanAlgebra(ast),
          simplifiedAlgebra: toBooleanAlgebra(ast),
          statement: toPlainStatement(ast),
          table: buildEditableTruthTable(variables, outputs),
          variables,
        };
      }

      const { ast, outputName } = parseLogicInput(input, mode);
      const table = buildTruthTable(ast);
      const canSimplify = canMinimizeVariables(table.variables);
      const simplifiedAst = canSimplify ? minimizeTruthTable(table) : null;
      return {
        ast,
        canSimplify,
        error: null,
        outputName,
        algebra: toBooleanAlgebra(ast),
        simplifiedAlgebra: simplifiedAst
          ? toBooleanAlgebra(simplifiedAst)
          : `Only expressions with ${MAX_TRUTH_TABLE_VARIABLES} or fewer variables can be simplified.`,
        statement: toPlainStatement(ast),
        table,
        variables: table.variables,
      };
    } catch (error) {
      return { error: error.message };
    }
  }, [input, mode, source, tableOutputs, variableText]);

  const handleExample = (example) => {
    setMode(example.mode);
    setInput(example.input);
  };

  const handleFlip = () => {
    if (parsed.error || source !== 'expression') return;
    const nextMode = mode === 'statement' ? 'boolean' : 'statement';
    setMode(nextMode);
    setInput(nextMode === 'statement' ? parsed.statement : parsed.algebra);
  };

  const handleSimplify = () => {
    if (parsed.error || source !== 'expression' || !parsed.canSimplify) return;
    setMode('boolean');
    setInput(parsed.outputName === 'Result' ? parsed.simplifiedAlgebra : `${parsed.outputName}=${parsed.simplifiedAlgebra}`);
  };

  const handleClear = () => {
    if (source === 'truthTable') {
      setTableOutputs((currentOutputs) => currentOutputs.map(() => false));
      return;
    }
    setInput('');
  };

  const handleVariableTextChange = (value) => {
    setVariableText(value);

    const variables = parseVariableNames(value);
    if (canResizeOutputs(variables)) {
      setTableOutputs((currentOutputs) => resizeOutputs(currentOutputs, 2 ** variables.length));
    }
  };

  const handleToggleTableResult = (rowIndex) => {
    setTableOutputs((currentOutputs) => {
      const variables = parseVariableNames(variableText);
      const next = resizeOutputs(currentOutputs, variables.length ? 2 ** variables.length : currentOutputs.length);
      next[rowIndex] = !next[rowIndex];
      return next;
    });
  };

  const handleKeyboardInsert = (symbol) => {
    const target = inputRef.current;
    const start = target?.selectionStart ?? input.length;
    const end = target?.selectionEnd ?? input.length;
    const nextCursor = start + symbol.length;

    setMode('boolean');
    setInput((currentInput) => `${currentInput.slice(0, start)}${symbol}${currentInput.slice(end)}`);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleExport = () => {
    if (parsed.error) return;
    const payload = [
      'Logic Lab export',
      `Input mode: ${mode}`,
      `Output: ${parsed.outputName}`,
      `Statement: ${parsed.statement}`,
      `Boolean algebra: ${parsed.algebra}`,
      '',
      ['Row', ...parsed.table.variables, parsed.outputName].join(','),
      ...parsed.table.rows.map((row, index) => [
        index + 1,
        ...parsed.table.variables.map((variable) => Number(row.assignment[variable])),
        Number(row.result),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([payload], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'logic-lab-export.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><CircuitBoard size={22} /></span>
          <div>
            <h1>Logic Lab</h1>
            <p>{parsed.error ? 'Waiting for a readable expression' : `${parsed.variables.length || 0} variables detected`}</p>
          </div>
        </div>
        <div className="toolbar" aria-label="Expression controls">
          <button type="button" onClick={handleFlip} disabled={Boolean(parsed.error) || source !== 'expression'} title="Switch representation">
            <ArrowRightLeft size={16} />
            Convert
          </button>
          <button
            type="button"
            onClick={handleSimplify}
            disabled={Boolean(parsed.error) || source !== 'expression' || !parsed.canSimplify}
            title="Simplify expression"
          >
            <Sparkles size={16} />
            Simplify
          </button>
          <button type="button" onClick={handleClear} title="Clear input">
            <Eraser size={16} />
            Clear
          </button>
          <button type="button" onClick={handleExport} disabled={Boolean(parsed.error)} title="Export truth table">
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="left-panel">
          <section className="panel input-panel">
            <div className="panel-heading">
              <div>
                <h2>Expression</h2>
                <p>{source === 'expression' ? 'Type logic words or algebraic symbols.' : 'Edit variables and output rows.'}</p>
              </div>
              <Braces size={18} />
            </div>
            <div className="segmented" role="tablist" aria-label="Input source">
              <button
                type="button"
                className={source === 'expression' ? 'active' : ''}
                onClick={() => setSource('expression')}
              >
                Expression
              </button>
              <button
                type="button"
                className={source === 'truthTable' ? 'active' : ''}
                onClick={() => setSource('truthTable')}
              >
                Truth table
              </button>
            </div>
            {source === 'expression' ? (
              <>
                <div className="segmented" role="tablist" aria-label="Input mode">
                  <button
                    type="button"
                    className={mode === 'statement' ? 'active' : ''}
                    onClick={() => setMode('statement')}
                  >
                    Logic statement
                  </button>
                  <button
                    type="button"
                    className={mode === 'boolean' ? 'active' : ''}
                    onClick={() => setMode('boolean')}
                  >
                    Boolean algebra
                  </button>
                </div>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  spellCheck="false"
                  placeholder={mode === 'statement' ? 'if A and not B, then C' : '(A · ¬B) → C'}
                />
                <SymbolKeyboard onInsert={handleKeyboardInsert} />
                <div className="examples">
                  {EXAMPLES.map((example) => (
                    <button type="button" key={example.label} onClick={() => handleExample(example)}>
                      {example.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="truth-input">
                <label htmlFor="truth-variables">Variables</label>
                <input
                  id="truth-variables"
                  value={variableText}
                  onChange={(event) => handleVariableTextChange(event.target.value)}
                  spellCheck="false"
                  placeholder="A, B, C"
                />
                <span>Up to {MAX_TRUTH_TABLE_VARIABLES} variables</span>
              </div>
            )}
            {parsed.error ? <p className="error-line">{parsed.error}</p> : null}
          </section>

          <section className="panel output-panel">
            <div className="panel-heading">
              <div>
                <h2>Representations</h2>
                <p>Both views are generated from one parsed expression.</p>
              </div>
              <FunctionSquare size={18} />
            </div>
            <ResultBlock label="Output" value={parsed.error ? '—' : parsed.outputName} />
            <ResultBlock label="Logic statement" value={parsed.error ? '—' : parsed.statement} />
            <ResultBlock label="Boolean algebra" value={parsed.error ? '—' : parsed.algebra} strong />
            <ResultBlock
              label="Simplified algebra"
              value={parsed.error ? '—' : parsed.simplifiedAlgebra}
              strong={!parsed.error && parsed.canSimplify !== false}
            />
          </section>
        </aside>

        <section className="diagram-panel panel">
          <div className="panel-heading">
            <div>
              <h2>Logic gate diagram</h2>
              <p>{parsed.error ? 'Diagram will render after parsing succeeds.' : 'The diagram follows the parsed expression tree.'}</p>
            </div>
            <Sparkles size={18} />
          </div>
          {parsed.error ? <EmptyCanvas /> : <GateDiagram ast={parsed.ast} outputName={parsed.outputName} />}
        </section>

        <aside className="right-panel panel">
          <div className="panel-heading">
            <div>
              <h2>Truth table</h2>
              <p>{parsed.error ? 'No table yet' : `${parsed.table.rows.length} rows`}</p>
            </div>
            <Table2 size={18} />
          </div>
          {parsed.error ? (
            <TruthTableEmpty />
          ) : (
            <TruthTable
              table={parsed.table}
              outputName={parsed.outputName}
              editable={source === 'truthTable'}
              onToggleResult={handleToggleTableResult}
            />
          )}
        </aside>
      </section>
    </main>
  );
}

function parseVariableNames(value) {
  return value
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function canResizeOutputs(variables) {
  const validName = /^[A-Za-z][A-Za-z0-9_]*$/;
  return variables.length > 0
    && variables.length <= MAX_TRUTH_TABLE_VARIABLES
    && variables.every((variable) => validName.test(variable))
    && new Set(variables).size === variables.length;
}

function resizeOutputs(outputs, rowCount) {
  return Array.from({ length: rowCount }, (_, index) => Boolean(outputs[index]));
}

function buildEditableTruthTable(variables, outputs) {
  const rows = outputs.map((result, mask) => {
    const assignment = {};
    variables.forEach((name, index) => {
      assignment[name] = Boolean((mask >> (variables.length - index - 1)) & 1);
    });
    return { assignment, result };
  });

  return { variables, rows };
}

function SymbolKeyboard({ onInsert }) {
  return (
    <div className="symbol-keyboard" aria-label="Logic symbol keyboard">
      {SYMBOL_KEYS.map((symbol) => (
        <button
          type="button"
          key={symbol}
          onClick={() => onInsert(symbol)}
          title={`Insert ${symbol}`}
          aria-label={`Insert ${symbol}`}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}

function ResultBlock({ label, value, strong = false }) {
  return (
    <div className="result-block">
      <span>{label}</span>
      <code className={strong ? 'strong' : ''}>{value}</code>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="empty-canvas">
      <CircuitBoard size={42} />
    </div>
  );
}

function TruthTableEmpty() {
  return (
    <div className="truth-empty">
      <Table2 size={36} />
    </div>
  );
}

function TruthTable({ table, outputName, editable = false, onToggleResult }) {
  return (
    <div className="truth-table-wrap">
      <table className="truth-table">
        <thead>
          <tr>
            {table.variables.map((variable) => <th key={variable}>{variable}</th>)}
            <th>{outputName}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {table.variables.map((variable) => (
                <td key={variable} className={row.assignment[variable] ? 'true' : 'false'}>
                  {row.assignment[variable] ? '1' : '0'}
                </td>
              ))}
              <td className={row.result ? 'result true' : 'result false'}>
                {editable ? (
                  <button
                    type="button"
                    className="truth-toggle"
                    onClick={() => onToggleResult(index)}
                    aria-label={`Toggle row ${index + 1} result`}
                  >
                    {row.result ? '1' : '0'}
                  </button>
                ) : (
                  row.result ? '1' : '0'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GateDiagram({ ast, outputName }) {
  const layout = useMemo(() => layoutGateTree(ast, outputName), [ast, outputName]);
  const { nodes, edges, width, height } = layout;

  return (
    <div className="gate-canvas">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Logic gate diagram">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
          </marker>
        </defs>
        <g className="wires">
          {edges.map((edge) => (
            <path key={edge.id} d={edge.path} markerEnd="url(#arrow)" />
          ))}
        </g>
        {nodes.map((node) => <GateNode key={node.id} node={node} />)}
      </svg>
    </div>
  );
}

function layoutGateTree(ast, outputName = 'Result') {
  let id = 0;
  let leafIndex = 0;
  const nodes = [];
  const edges = [];
  const rowGap = 76;
  const colGap = 128;
  const leftPad = 32;
  const topPad = 44;

  function place(node, depth = 0) {
    const nodeId = `n${id++}`;

    if (node.type === 'var' || node.type === 'const') {
      const placed = {
        id: nodeId,
        type: 'input',
        label: node.type === 'const' ? (node.value ? '1' : '0') : node.name,
        x: leftPad,
        y: topPad + leafIndex * rowGap,
      };
      leafIndex += 1;
      nodes.push(placed);
      return { ...placed, outX: placed.x + 78, outY: placed.y };
    }

    if (node.type === 'not') {
      const child = place(node.child, depth + 1);
      const placed = {
        id: nodeId,
        type: 'not',
        label: 'NOT',
        x: child.x + colGap,
        y: child.y,
      };
      nodes.push(placed);
      edges.push(makeEdge(child.outX, child.outY, placed.x, placed.y, `${child.id}-${placed.id}`));
      return { ...placed, outX: placed.x + 82, outY: placed.y };
    }

    const left = place(node.left, depth + 1);
    const right = place(node.right, depth + 1);
    const placed = {
      id: nodeId,
      type: node.type,
      label: node.type.toUpperCase(),
      x: Math.max(left.x, right.x) + colGap,
      y: (left.y + right.y) / 2,
    };
    nodes.push(placed);
    edges.push(makeEdge(left.outX, left.outY, placed.x, placed.y - 16, `${left.id}-${placed.id}`));
    edges.push(makeEdge(right.outX, right.outY, placed.x, placed.y + 16, `${right.id}-${placed.id}`));
    return { ...placed, outX: placed.x + getGateWidth(node.type), outY: placed.y };
  }

  const root = place(ast);
  const output = {
    id: `n${id++}`,
    type: 'output',
    label: outputName,
    x: root.outX + 54,
    y: root.outY,
  };
  nodes.push(output);
  edges.push(makeEdge(root.outX, root.outY, output.x, output.y, `${root.id}-${output.id}`));

  const maxX = Math.max(...nodes.map((node) => node.x)) + 140;
  const maxY = Math.max(...nodes.map((node) => node.y)) + 64;

  return {
    nodes,
    edges,
    width: Math.max(560, maxX),
    height: Math.max(360, maxY),
  };
}

function makeEdge(x1, y1, x2, y2, id) {
  const mid = Math.max(32, (x2 - x1) / 2);
  return {
    id,
    path: `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`,
  };
}

function GateNode({ node }) {
  if (node.type === 'input') {
    return (
      <g className="gate-node input-node" transform={`translate(${node.x}, ${node.y})`}>
        <rect x="0" y="-20" width="78" height="40" rx="7" />
        <text x="39" y="5">{node.label}</text>
      </g>
    );
  }

  if (node.type === 'output') {
    return (
      <g className="gate-node output-node" transform={`translate(${node.x}, ${node.y})`}>
        <rect x="0" y="-20" width="86" height="40" rx="7" />
        <text x="43" y="5">{node.label}</text>
      </g>
    );
  }

  if (node.type === 'not') {
    return (
      <g className="gate-node gate-not" transform={`translate(${node.x}, ${node.y})`}>
        <path d="M 0 -28 L 0 28 L 58 0 Z" />
        <circle cx="68" cy="0" r="7" />
        <text x="24" y="5">NOT</text>
      </g>
    );
  }

  const path = getGatePath(node.type);

  return (
    <g className={`gate-node gate-${node.type}`} transform={`translate(${node.x}, ${node.y})`}>
      {node.type === 'xor' ? <path className="xor-offset" d="M -12 -30 C 7 -14 7 14 -12 30" /> : null}
      <path d={path} />
      <text x={getGateWidth(node.type) / 2} y="5">{node.label}</text>
    </g>
  );
}

function getGateWidth(type) {
  if (type === 'implies' || type === 'iff') return 116;
  return 96;
}

function getGatePath(type) {
  if (type === 'and') {
    return 'M 0 -34 L 42 -34 C 95 -34 95 34 42 34 L 0 34 Z';
  }

  if (type === 'or' || type === 'xor') {
    return 'M 0 -34 C 24 -26 31 26 0 34 C 36 34 74 22 96 0 C 74 -22 36 -34 0 -34 Z';
  }

  if (type === 'implies') {
    return 'M 0 -34 L 82 -34 L 116 0 L 82 34 L 0 34 Z';
  }

  if (type === 'iff') {
    return 'M 0 -34 L 116 -34 L 116 34 L 0 34 Z';
  }

  return 'M 0 -34 L 78 -34 L 78 34 L 0 34 Z';
}

export default App;
