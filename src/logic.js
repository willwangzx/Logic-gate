const PRECEDENCE = {
  iff: 1,
  implies: 2,
  or: 3,
  xor: 3,
  and: 4,
  not: 5,
  var: 6,
  const: 6,
};

const VARIABLE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
export const MAX_TRUTH_TABLE_VARIABLES = 6;

export const EXAMPLES = [
  {
    label: 'Conditional',
    mode: 'statement',
    input: 'if A and not B, then C',
  },
  {
    label: 'Either-or',
    mode: 'statement',
    input: 'either A or B, and not C',
  },
  {
    label: 'Algebra',
    mode: 'boolean',
    input: '(A · ¬B) → C',
  },
  {
    label: 'Equivalence',
    mode: 'boolean',
    input: '(A ↔ B) · (¬C + A)',
  },
];

export function parseExpression(input, mode = 'boolean') {
  const normalized = mode === 'statement' ? normalizeStatement(input) : input;
  const tokens = tokenize(normalized);
  if (!tokens.length) {
    throw new Error('Enter a logic statement or Boolean expression.');
  }

  const parser = new Parser(tokens);
  const ast = parser.parseIff();

  if (!parser.isAtEnd()) {
    const token = parser.peek();
    throw new Error(`Unexpected token "${token.value}".`);
  }

  return simplifyAst(ast);
}

export function parseLogicInput(input, mode = 'boolean') {
  const assignment = splitOutputAssignment(input);

  if (!assignment) {
    return {
      ast: parseExpression(input, mode),
      outputName: 'Result',
    };
  }

  const outputName = assignment.left.trim();
  const expression = assignment.right.trim();

  if (!VARIABLE_RE.test(outputName)) {
    throw new Error(`Invalid output name "${outputName || assignment.left}".`);
  }

  if (!expression) {
    throw new Error('Expected expression after "=".');
  }

  return {
    ast: parseExpression(expression, mode),
    outputName,
  };
}

function splitOutputAssignment(input) {
  let depth = 0;
  let assignmentIndex = -1;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === '=' && depth === 0) {
      if (assignmentIndex !== -1) {
        throw new Error('Only one top-level "=" output assignment is allowed.');
      }
      assignmentIndex = i;
    }
  }

  if (assignmentIndex === -1) return null;

  return {
    left: input.slice(0, assignmentIndex),
    right: input.slice(assignmentIndex + 1),
  };
}

export function normalizeStatement(input) {
  let text = input
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\bTRUE\b/gi, 'true')
    .replace(/\bFALSE\b/gi, 'false')
    .replace(/[.;]/g, ' ')
    .replace(/\s+/g, ' ');

  text = text.replace(/^if\s+(.+?),?\s+then\s+(.+)$/i, '($1) -> ($2)');
  text = text.replace(/^(.+?)\s+only\s+if\s+(.+)$/i, '($1) -> ($2)');
  text = text.replace(/^(.+?)\s+if\s+(.+)$/i, '($2) -> ($1)');
  text = text.replace(/\bneither\s+(.+?)\s+nor\s+(.+)/gi, 'not ($1 or $2)');
  text = text.replace(/\beither\s+/gi, '');
  text = text.replace(/\bboth\s+/gi, '');
  text = text.replace(/\bis\s+not\s+the\s+case\s+that\s+/gi, 'not ');
  text = text.replace(/\bnot\s+the\s+case\s+that\s+/gi, 'not ');
  text = text.replace(/\bwhenever\b/gi, 'if');
  text = text.replace(/\bthen\b/gi, '->');
  text = text.replace(/\bimplies\b/gi, '->');
  text = text.replace(/\bimply\b/gi, '->');
  text = text.replace(/\bif\s+and\s+only\s+if\b/gi, '<->');
  text = text.replace(/\biff\b/gi, '<->');
  text = text.replace(/\bequals\b/gi, '<->');
  text = text.replace(/\bequivalent\s+to\b/gi, '<->');

  return text;
}

export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s|,/.test(char)) {
      i += 1;
      continue;
    }

    const pair = input.slice(i, i + 3);
    const double = input.slice(i, i + 2);

    if (pair === '<->' || pair === '<=>') {
      tokens.push({ type: 'op', value: 'iff' });
      i += 3;
      continue;
    }

    if (double === '->' || double === '=>') {
      tokens.push({ type: 'op', value: 'implies' });
      i += 2;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: char, value: char });
      i += 1;
      continue;
    }

    if ('¬!~'.includes(char)) {
      tokens.push({ type: 'op', value: 'not' });
      i += 1;
      continue;
    }

    if ('·*&∧'.includes(char)) {
      tokens.push({ type: 'op', value: 'and' });
      i += 1;
      continue;
    }

    if ('+|∨'.includes(char)) {
      tokens.push({ type: 'op', value: 'or' });
      i += 1;
      continue;
    }

    if ('⊕^'.includes(char)) {
      tokens.push({ type: 'op', value: 'xor' });
      i += 1;
      continue;
    }

    if (char === '→') {
      tokens.push({ type: 'op', value: 'implies' });
      i += 1;
      continue;
    }

    if (char === '↔' || char === '≡') {
      tokens.push({ type: 'op', value: 'iff' });
      i += 1;
      continue;
    }

    const wordMatch = input.slice(i).match(/^[A-Za-z][A-Za-z0-9_]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const lower = word.toLowerCase();
      const keyword = {
        and: 'and',
        or: 'or',
        not: 'not',
        no: 'not',
        without: 'not',
        xor: 'xor',
        implies: 'implies',
        imply: 'implies',
        iff: 'iff',
      }[lower];

      if (keyword) {
        tokens.push({ type: 'op', value: keyword });
      } else if (lower === 'true') {
        tokens.push({ type: 'const', value: true });
      } else if (lower === 'false') {
        tokens.push({ type: 'const', value: false });
      } else {
        tokens.push({ type: 'var', value: word });
      }
      i += word.length;
      continue;
    }

    if (char === '1' || char === '0') {
      tokens.push({ type: 'const', value: char === '1' });
      i += 1;
      continue;
    }

    throw new Error(`Cannot read "${char}" at position ${i + 1}.`);
  }

  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  parseIff() {
    let expr = this.parseImplies();
    while (this.match('op', 'iff')) {
      expr = binary('iff', expr, this.parseImplies());
    }
    return expr;
  }

  parseImplies() {
    let expr = this.parseOr();
    if (this.match('op', 'implies')) {
      expr = binary('implies', expr, this.parseImplies());
    }
    return expr;
  }

  parseOr() {
    let expr = this.parseAnd();
    while (this.match('op', 'or') || this.match('op', 'xor')) {
      const operator = this.previous().value;
      expr = binary(operator, expr, this.parseAnd());
    }
    return expr;
  }

  parseAnd() {
    let expr = this.parseUnary();
    while (this.match('op', 'and')) {
      expr = binary('and', expr, this.parseUnary());
    }
    return expr;
  }

  parseUnary() {
    if (this.match('op', 'not')) {
      return unary('not', this.parseUnary());
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match('var')) {
      const name = this.previous().value;
      if (!VARIABLE_RE.test(name)) {
        throw new Error(`Invalid variable name "${name}".`);
      }
      return { type: 'var', name };
    }

    if (this.match('const')) {
      return { type: 'const', value: this.previous().value };
    }

    if (this.match('(')) {
      const expr = this.parseIff();
      this.consume(')', 'Expected ")" after expression.');
      return expr;
    }

    const token = this.peek();
    throw new Error(token ? `Expected expression before "${token.value}".` : 'Expected expression.');
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw new Error(message);
  }

  match(type, value) {
    if (!this.check(type, value)) return false;
    this.advance();
    return true;
  }

  check(type, value) {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    return token.type === type && (value === undefined || token.value === value);
  }

  advance() {
    if (!this.isAtEnd()) this.current += 1;
    return this.previous();
  }

  isAtEnd() {
    return this.current >= this.tokens.length;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }
}

export function binary(type, left, right) {
  return { type, left, right };
}

export function unary(type, child) {
  return { type, child };
}

export function simplifyAst(ast) {
  if (!ast) return ast;

  if (ast.type === 'not') {
    const child = simplifyAst(ast.child);
    if (child.type === 'not') return child.child;
    if (child.type === 'const') return { type: 'const', value: !child.value };
    return { type: 'not', child };
  }

  if (['and', 'or', 'xor', 'implies', 'iff'].includes(ast.type)) {
    const left = simplifyAst(ast.left);
    const right = simplifyAst(ast.right);

    if (left.type === 'const' && right.type === 'const') {
      return { type: 'const', value: evaluateAst({ ...ast, left, right }, {}) };
    }

    if (ast.type === 'and') {
      if (isConst(left, false) || isConst(right, false)) return { type: 'const', value: false };
      if (isConst(left, true)) return right;
      if (isConst(right, true)) return left;
    }

    if (ast.type === 'or') {
      if (isConst(left, true) || isConst(right, true)) return { type: 'const', value: true };
      if (isConst(left, false)) return right;
      if (isConst(right, false)) return left;
    }

    return { ...ast, left, right };
  }

  return ast;
}

function isConst(ast, value) {
  return ast.type === 'const' && ast.value === value;
}

export function minimizeAst(ast) {
  return minimizeTruthTable(buildTruthTable(ast));
}

export function minimizeTruthTable(table) {
  if (!table.variables.length) {
    return { type: 'const', value: table.rows[0]?.result ?? false };
  }

  return deriveExpressionFromTruthTable(
    table.variables,
    table.rows.map((row) => row.result),
  );
}

export function canMinimizeVariables(variables) {
  return variables.length <= MAX_TRUTH_TABLE_VARIABLES;
}

export function deriveExpressionFromTruthTable(variables, outputs) {
  validateTruthTableInput(variables, outputs);

  const normalizedOutputs = outputs.map(normalizeOutputValue);
  const minterms = normalizedOutputs
    .map((value, index) => (value ? index : -1))
    .filter((index) => index !== -1);

  if (!minterms.length) return { type: 'const', value: false };
  if (minterms.length === normalizedOutputs.length) return { type: 'const', value: true };

  const primeImplicants = findPrimeImplicants(minterms, variables.length);
  const selected = selectMinimalImplicants(primeImplicants, minterms);

  return implicantsToAst(selected, variables);
}

export function validateTruthTableInput(variables, outputs) {
  if (!Array.isArray(variables) || !variables.length) {
    throw new Error('Enter at least one variable.');
  }

  if (variables.length > MAX_TRUTH_TABLE_VARIABLES) {
    throw new Error(`Truth table derivation supports up to ${MAX_TRUTH_TABLE_VARIABLES} variables.`);
  }

  const seen = new Set();
  variables.forEach((name) => {
    if (!VARIABLE_RE.test(name)) {
      throw new Error(`Invalid variable name "${name}".`);
    }
    if (seen.has(name)) {
      throw new Error(`Duplicate variable name "${name}".`);
    }
    seen.add(name);
  });

  const expectedRows = 2 ** variables.length;
  if (!Array.isArray(outputs) || outputs.length !== expectedRows) {
    throw new Error(`Expected ${expectedRows} output values for ${variables.length} variables.`);
  }

  outputs.forEach(normalizeOutputValue);
}

function normalizeOutputValue(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  throw new Error('Truth table outputs must be 0 or 1.');
}

function findPrimeImplicants(minterms, variableCount) {
  let current = minterms.map((minterm) => ({
    bits: numberToBits(minterm, variableCount),
    covers: new Set([minterm]),
  }));
  const primes = [];

  while (current.length) {
    const next = new Map();
    const used = new Set();
    const groups = groupImplicantsByOnes(current);
    const groupCounts = [...groups.keys()].sort((a, b) => a - b);

    groupCounts.forEach((count) => {
      const leftGroup = groups.get(count);
      const rightGroup = groups.get(count + 1) ?? [];

      leftGroup.forEach((left) => {
        rightGroup.forEach((right) => {
          const combinedBits = combineBits(left.implicant.bits, right.implicant.bits);

          if (!combinedBits) return;

          used.add(left.index);
          used.add(right.index);
          const key = bitsToKey(combinedBits);
          const covers = new Set([...left.implicant.covers, ...right.implicant.covers]);

          if (next.has(key)) {
            covers.forEach((minterm) => next.get(key).covers.add(minterm));
          } else {
            next.set(key, { bits: combinedBits, covers });
          }
        });
      });
    });

    current.forEach((implicant, index) => {
      if (!used.has(index)) primes.push(implicant);
    });

    current = [...next.values()];
  }

  return dedupeImplicants(primes);
}

function groupImplicantsByOnes(implicants) {
  const groups = new Map();
  implicants.forEach((implicant, index) => {
    const count = countOnes(implicant.bits);
    if (!groups.has(count)) groups.set(count, []);
    groups.get(count).push({ implicant, index });
  });
  return groups;
}

function countOnes(bits) {
  return bits.reduce((total, bit) => total + (bit === 1 ? 1 : 0), 0);
}

function numberToBits(value, width) {
  return Array.from({ length: width }, (_, index) => (value >> (width - index - 1)) & 1);
}

function combineBits(left, right) {
  let diffIndex = -1;

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] === right[i]) continue;
    if (left[i] === null || right[i] === null) return null;
    if (diffIndex !== -1) return null;
    diffIndex = i;
  }

  if (diffIndex === -1) return null;

  const combined = [...left];
  combined[diffIndex] = null;
  return combined;
}

function dedupeImplicants(implicants) {
  const byKey = new Map();
  implicants.forEach((implicant) => {
    const key = bitsToKey(implicant.bits);
    if (byKey.has(key)) {
      implicant.covers.forEach((minterm) => byKey.get(key).covers.add(minterm));
    } else {
      byKey.set(key, { bits: implicant.bits, covers: new Set(implicant.covers) });
    }
  });
  return [...byKey.values()].sort(compareImplicants);
}

function selectMinimalImplicants(primeImplicants, minterms) {
  const mintermSet = new Set(minterms);
  const selected = new Map();
  const covered = new Set();

  minterms.forEach((minterm) => {
    const covers = primeImplicants.filter((implicant) => implicant.covers.has(minterm));
    if (covers.length === 1) {
      const essential = covers[0];
      selected.set(bitsToKey(essential.bits), essential);
      essential.covers.forEach((coveredMinterm) => {
        if (mintermSet.has(coveredMinterm)) covered.add(coveredMinterm);
      });
    }
  });

  const remainingMinterms = minterms.filter((minterm) => !covered.has(minterm));
  if (!remainingMinterms.length) {
    return [...selected.values()].sort(compareImplicants);
  }

  const essentialKeys = new Set(selected.keys());
  const candidates = primeImplicants
    .filter((implicant) => !essentialKeys.has(bitsToKey(implicant.bits)))
    .filter((implicant) => remainingMinterms.some((minterm) => implicant.covers.has(minterm)))
    .sort(compareImplicants);

  const required = new Set(remainingMinterms);
  let best = null;

  function search(startIndex, chosen, chosenCovered) {
    if (isCovered(required, chosenCovered)) {
      if (!best || compareImplicantSets(chosen, best) < 0) {
        best = [...chosen];
      }
      return;
    }

    if (startIndex >= candidates.length) return;
    if (best && chosen.length >= best.length) return;

    for (let i = startIndex; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const additions = [...candidate.covers].filter((minterm) => required.has(minterm) && !chosenCovered.has(minterm));
      if (!additions.length) continue;

      additions.forEach((minterm) => chosenCovered.add(minterm));
      chosen.push(candidate);
      search(i + 1, chosen, chosenCovered);
      chosen.pop();
      additions.forEach((minterm) => chosenCovered.delete(minterm));
    }
  }

  search(0, [], new Set());

  return [...selected.values(), ...(best ?? [])].sort(compareImplicants);
}

function isCovered(required, covered) {
  for (const minterm of required) {
    if (!covered.has(minterm)) return false;
  }
  return true;
}

function compareImplicantSets(left, right) {
  const termDiff = left.length - right.length;
  if (termDiff !== 0) return termDiff;

  const literalDiff = countImplicantLiterals(left) - countImplicantLiterals(right);
  if (literalDiff !== 0) return literalDiff;

  return left.map((implicant) => bitsToSortKey(implicant.bits)).join('|')
    .localeCompare(right.map((implicant) => bitsToSortKey(implicant.bits)).join('|'));
}

function countImplicantLiterals(implicants) {
  return implicants.reduce((total, implicant) => total + implicant.bits.filter((bit) => bit !== null).length, 0);
}

function compareImplicants(left, right) {
  const literalDiff = left.bits.filter((bit) => bit !== null).length - right.bits.filter((bit) => bit !== null).length;
  if (literalDiff !== 0) return literalDiff;
  return bitsToSortKey(left.bits).localeCompare(bitsToSortKey(right.bits));
}

function bitsToKey(bits) {
  return bits.map((bit) => (bit === null ? '-' : String(bit))).join('');
}

function bitsToSortKey(bits) {
  return bits.map((bit) => (bit === null ? '2' : String(bit))).join('');
}

function implicantsToAst(implicants, variables) {
  const terms = implicants.map((implicant) => implicantToAst(implicant, variables));
  return terms.reduce((expr, term) => (expr ? binary('or', expr, term) : term), null);
}

function implicantToAst(implicant, variables) {
  const literals = implicant.bits.flatMap((bit, index) => {
    if (bit === null) return [];
    const variable = { type: 'var', name: variables[index] };
    return [bit === 1 ? variable : unary('not', variable)];
  });

  if (!literals.length) return { type: 'const', value: true };
  return literals.reduce((expr, literal) => (expr ? binary('and', expr, literal) : literal), null);
}

export function toBooleanAlgebra(ast, parentPrecedence = 0) {
  if (ast.type === 'var') return ast.name;
  if (ast.type === 'const') return ast.value ? '1' : '0';

  if (ast.type === 'not') {
    const inner = toBooleanAlgebra(ast.child, PRECEDENCE.not);
    const rendered = ast.child.type === 'var' || ast.child.type === 'const' ? `¬${inner}` : `¬(${toBooleanAlgebra(ast.child)})`;
    return PRECEDENCE.not < parentPrecedence ? `(${rendered})` : rendered;
  }

  const operator = {
    and: ' · ',
    or: ' + ',
    xor: ' ⊕ ',
    implies: ' → ',
    iff: ' ↔ ',
  }[ast.type];

  const left = toBooleanAlgebra(ast.left, PRECEDENCE[ast.type]);
  const right = toBooleanAlgebra(ast.right, PRECEDENCE[ast.type] + (ast.type === 'implies' ? -1 : 0));
  const rendered = `${left}${operator}${right}`;

  return PRECEDENCE[ast.type] < parentPrecedence ? `(${rendered})` : rendered;
}

export function toPlainStatement(ast, parentPrecedence = 0) {
  if (ast.type === 'var') return ast.name;
  if (ast.type === 'const') return ast.value ? 'true' : 'false';

  if (ast.type === 'not') {
    const child = ast.child.type === 'var' || ast.child.type === 'const'
      ? toPlainStatement(ast.child)
      : `(${toPlainStatement(ast.child)})`;
    return `not ${child}`;
  }

  if (ast.type === 'implies') {
    return `if ${toPlainStatement(ast.left)} then ${toPlainStatement(ast.right)}`;
  }

  if (ast.type === 'iff') {
    return `${toPlainStatement(ast.left, PRECEDENCE.iff)} if and only if ${toPlainStatement(ast.right, PRECEDENCE.iff)}`;
  }

  const operator = {
    and: ' and ',
    or: ' or ',
    xor: ' xor ',
  }[ast.type];

  const rendered = `${toPlainStatement(ast.left, PRECEDENCE[ast.type])}${operator}${toPlainStatement(ast.right, PRECEDENCE[ast.type])}`;
  return PRECEDENCE[ast.type] < parentPrecedence ? `(${rendered})` : rendered;
}

export function collectVariables(ast) {
  const variables = new Set();
  walkAst(ast, (node) => {
    if (node.type === 'var') variables.add(node.name);
  });
  return [...variables].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function walkAst(ast, visit) {
  visit(ast);
  if (ast.child) walkAst(ast.child, visit);
  if (ast.left) walkAst(ast.left, visit);
  if (ast.right) walkAst(ast.right, visit);
}

export function evaluateAst(ast, assignment) {
  switch (ast.type) {
    case 'var':
      return Boolean(assignment[ast.name]);
    case 'const':
      return ast.value;
    case 'not':
      return !evaluateAst(ast.child, assignment);
    case 'and':
      return evaluateAst(ast.left, assignment) && evaluateAst(ast.right, assignment);
    case 'or':
      return evaluateAst(ast.left, assignment) || evaluateAst(ast.right, assignment);
    case 'xor':
      return evaluateAst(ast.left, assignment) !== evaluateAst(ast.right, assignment);
    case 'implies':
      return !evaluateAst(ast.left, assignment) || evaluateAst(ast.right, assignment);
    case 'iff':
      return evaluateAst(ast.left, assignment) === evaluateAst(ast.right, assignment);
    default:
      throw new Error(`Unknown AST node "${ast.type}".`);
  }
}

export function buildTruthTable(ast) {
  const variables = collectVariables(ast);
  const rowCount = Math.max(1, 2 ** variables.length);
  const rows = [];

  for (let mask = 0; mask < rowCount; mask += 1) {
    const assignment = {};
    variables.forEach((name, index) => {
      const bit = (mask >> (variables.length - index - 1)) & 1;
      assignment[name] = Boolean(bit);
    });
    rows.push({
      assignment,
      result: evaluateAst(ast, assignment),
    });
  }

  return { variables, rows };
}

export function normalizeForGates(ast) {
  if (ast.type === 'implies') {
    return binary('or', unary('not', normalizeForGates(ast.left)), normalizeForGates(ast.right));
  }

  if (ast.type === 'iff') {
    return unary('not', binary('xor', normalizeForGates(ast.left), normalizeForGates(ast.right)));
  }

  if (ast.type === 'not') {
    return unary('not', normalizeForGates(ast.child));
  }

  if (['and', 'or', 'xor'].includes(ast.type)) {
    return binary(ast.type, normalizeForGates(ast.left), normalizeForGates(ast.right));
  }

  return ast;
}
