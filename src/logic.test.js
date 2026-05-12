import assert from 'node:assert/strict';
import {
  buildTruthTable,
  canMinimizeVariables,
  collectVariables,
  deriveExpressionFromTruthTable,
  evaluateAst,
  minimizeAst,
  minimizeTruthTable,
  normalizeForGates,
  parseExpression,
  parseLogicInput,
  toBooleanAlgebra,
  toPlainStatement,
} from './logic.js';

function assertEquivalent(left, right) {
  const variables = [...new Set([...collectVariables(left), ...collectVariables(right)])]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const rowCount = Math.max(1, 2 ** variables.length);

  for (let mask = 0; mask < rowCount; mask += 1) {
    const assignment = {};
    variables.forEach((name, index) => {
      assignment[name] = Boolean((mask >> (variables.length - index - 1)) & 1);
    });
    assert.equal(evaluateAst(left, assignment), evaluateAst(right, assignment));
  }
}

const conditional = parseExpression('if A and not B, then C', 'statement');
assert.equal(toBooleanAlgebra(conditional), 'A · ¬B → C');
assert.equal(toPlainStatement(conditional), 'if A and not B then C');
assert.equal(evaluateAst(conditional, { A: true, B: false, C: false }), false);
assert.equal(evaluateAst(conditional, { A: true, B: true, C: false }), true);

const algebra = parseExpression('(A · ¬B) → C', 'boolean');
assert.equal(toBooleanAlgebra(algebra), 'A · ¬B → C');
assert.equal(buildTruthTable(algebra).rows.length, 8);

const xor = parseExpression('A xor B', 'statement');
assert.equal(toBooleanAlgebra(xor), 'A ⊕ B');
assert.equal(evaluateAst(xor, { A: true, B: false }), true);

const gates = normalizeForGates(algebra);
assert.equal(gates.type, 'or');
assert.equal(gates.left.type, 'not');

const assignedOr = parseLogicInput('X=A+B', 'boolean');
assert.equal(assignedOr.outputName, 'X');
assert.equal(toBooleanAlgebra(assignedOr.ast), 'A + B');

const assignedConditional = parseLogicInput('OUT = (A · ¬B) → C', 'boolean');
assert.equal(assignedConditional.outputName, 'OUT');
assert.equal(toBooleanAlgebra(assignedConditional.ast), 'A · ¬B → C');

const unassigned = parseLogicInput('A+B', 'boolean');
assert.equal(unassigned.outputName, 'Result');
assert.equal(toBooleanAlgebra(unassigned.ast), 'A + B');

assert.throws(
  () => parseLogicInput('1X=A+B', 'boolean'),
  /Invalid output name/,
);
assert.throws(
  () => parseLogicInput('X=', 'boolean'),
  /Expected expression after "="/,
);
assert.throws(
  () => parseLogicInput('X=A=B', 'boolean'),
  /Only one top-level "=" output assignment is allowed/,
);

const derivedOr = deriveExpressionFromTruthTable(['A', 'B'], [0, 1, 1, 1]);
assert.equal(toBooleanAlgebra(derivedOr), 'A + B');

const derivedAnd = deriveExpressionFromTruthTable(['A', 'B'], [0, 0, 0, 1]);
assert.equal(toBooleanAlgebra(derivedAnd), 'A · B');

const derivedXorSop = deriveExpressionFromTruthTable(['A', 'B'], [0, 1, 1, 0]);
assert.equal(toBooleanAlgebra(derivedXorSop), '¬A · B + A · ¬B');

const allFalse = deriveExpressionFromTruthTable(['A'], [0, 0]);
assert.equal(toBooleanAlgebra(allFalse), '0');

const allTrue = deriveExpressionFromTruthTable(['A'], [1, 1]);
assert.equal(toBooleanAlgebra(allTrue), '1');

const singleVariable = deriveExpressionFromTruthTable(['A'], [0, 1]);
assert.equal(toBooleanAlgebra(singleVariable), 'A');

assert.throws(
  () => deriveExpressionFromTruthTable(['A', 'A'], [0, 1, 1, 0]),
  /Duplicate variable name/,
);
assert.throws(
  () => deriveExpressionFromTruthTable(['A', 'B', 'C', 'D', 'E', 'F', 'G'], new Array(128).fill(0)),
  /up to 6 variables/,
);
assert.throws(
  () => deriveExpressionFromTruthTable(['A', 'B'], [0, 1, 1]),
  /Expected 4 output values/,
);
assert.throws(
  () => deriveExpressionFromTruthTable(['A'], [0, 'X']),
  /outputs must be 0 or 1/,
);

const absorbed = parseExpression('A + A · B', 'boolean');
const minimizedAbsorbed = minimizeAst(absorbed);
assert.equal(toBooleanAlgebra(minimizedAbsorbed), 'A');
assertEquivalent(absorbed, minimizedAbsorbed);
assert.equal(toBooleanAlgebra(minimizeTruthTable(buildTruthTable(absorbed))), 'A');

const implication = parseExpression('A -> B', 'boolean');
const minimizedImplication = minimizeAst(implication);
assert.equal(toBooleanAlgebra(minimizedImplication), '¬A + B');
assertEquivalent(implication, minimizedImplication);

assert.equal(canMinimizeVariables(['A', 'B', 'C', 'D', 'E', 'F']), true);
assert.equal(canMinimizeVariables(['A', 'B', 'C', 'D', 'E', 'F', 'G']), false);

console.log('logic tests passed');
