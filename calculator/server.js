// Calculator backend
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// Evaluate a math expression string.
// Doing this manually instead of eval() because eval on user input is bad.
function calculate(expression) {
  if (!expression || expression.trim() === '') {
    throw new Error('Empty expression');
  }

  // Only allow safe characters
  for (let i = 0; i < expression.length; i++) {
    const c = expression[i];
    const ok = (c >= '0' && c <= '9') || c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')' || c === '.' || c === ' ';
    if (!ok) {
      throw new Error('Invalid character: ' + c);
    }
  }

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < expression.length) {
    const c = expression[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if ((c >= '0' && c <= '9') || c === '.') {
      let num = '';
      while (i < expression.length && ((expression[i] >= '0' && expression[i] <= '9') || expression[i] === '.')) {
        num += expression[i];
        i++;
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
    } else {
      // handle unary minus by inserting a 0 before it
      if (c === '-') {
        const last = tokens[tokens.length - 1];
        if (!last || last.type === 'op' || (last.type === 'paren' && last.value === '(')) {
          tokens.push({ type: 'num', value: 0 });
        }
      }
      if (c === '(' || c === ')') {
        tokens.push({ type: 'paren', value: c });
      } else {
        tokens.push({ type: 'op', value: c });
      }
      i++;
    }
  }

  // Convert to RPN using shunting-yard
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const output = [];
  const opStack = [];
  for (let j = 0; j < tokens.length; j++) {
    const t = tokens[j];
    if (t.type === 'num') {
      output.push(t);
    } else if (t.type === 'op') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type === 'op' && precedence[opStack[opStack.length - 1].value] >= precedence[t.value]) {
        output.push(opStack.pop());
      }
      opStack.push(t);
    } else if (t.value === '(') {
      opStack.push(t);
    } else if (t.value === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1].value !== '(') {
        output.push(opStack.pop());
      }
      if (opStack.length === 0) {
        throw new Error('Mismatched parentheses');
      }
      opStack.pop();
    }
  }
  while (opStack.length > 0) {
    const top = opStack.pop();
    if (top.type === 'paren') {
      throw new Error('Mismatched parentheses');
    }
    output.push(top);
  }

  // Evaluate RPN
  const stack = [];
  for (let k = 0; k < output.length; k++) {
    const t = output[k];
    if (t.type === 'num') {
      stack.push(t.value);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) {
        throw new Error('Invalid expression');
      }
      if (t.value === '+') {
        stack.push(a + b);
      } else if (t.value === '-') {
        stack.push(a - b);
      } else if (t.value === '*') {
        stack.push(a * b);
      } else if (t.value === '/') {
        if (b === 0) {
          throw new Error('Division by zero');
        }
        stack.push(a / b);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid expression');
  }
  return stack[0];
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/calculate') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const result = calculate(data.expression);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: result }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Serve static files
  let filePath;
  if (req.url === '/') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else {
    filePath = path.join(__dirname, 'public', req.url);
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    let contentType = 'text/plain';
    if (filePath.endsWith('.html')) contentType = 'text/html';
    if (filePath.endsWith('.css')) contentType = 'text/css';
    if (filePath.endsWith('.js')) contentType = 'text/javascript';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('Calculator running at http://localhost:' + PORT);
});
