// Calculator frontend

let expression = '';
let lastResult = null;
let history = [];

const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');
const historyListEl = document.getElementById('history-list');

function updateDisplay() {
  expressionEl.textContent = expression;
  if (expression === '') {
    resultEl.textContent = lastResult !== null ? lastResult : '0';
  }
}

function appendValue(value) {
  // if the user just got a result and types a number, start over
  // if they type an operator, keep going from the result
  if (lastResult !== null && expression === '') {
    if (value === '0' || value === '1' || value === '2' || value === '3' || value === '4' || value === '5' || value === '6' || value === '7' || value === '8' || value === '9' || value === '.') {
      lastResult = null;
      resultEl.textContent = '0';
    } else {
      expression = String(lastResult);
      lastResult = null;
    }
  }
  expression = expression + value;
  updateDisplay();
}

function backspace() {
  if (expression.length > 0) {
    expression = expression.substring(0, expression.length - 1);
    updateDisplay();
  }
}

function clearAll() {
  expression = '';
  lastResult = null;
  resultEl.textContent = '0';
  resultEl.classList.remove('error');
  expressionEl.textContent = '';
}

function evaluate() {
  if (expression === '') return;

  const exprToSend = expression;

  fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression: exprToSend })
  })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    })
    .then(function (response) {
      if (!response.ok) {
        resultEl.textContent = response.data.error || 'Error';
        resultEl.classList.add('error');
        return;
      }
      const result = response.data.result;
      expressionEl.textContent = exprToSend + ' =';
      resultEl.textContent = result;
      resultEl.classList.remove('error');
      lastResult = result;
      expression = '';
      addToHistory(exprToSend, result);
    })
    .catch(function (err) {
      resultEl.textContent = 'Network error';
      resultEl.classList.add('error');
    });
}

function addToHistory(expr, result) {
  history.unshift({ expression: expr, result: result });
  renderHistory();
}

function renderHistory() {
  historyListEl.innerHTML = '';
  if (history.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No calculations yet';
    historyListEl.appendChild(li);
    return;
  }
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const li = document.createElement('li');
    li.innerHTML = '<div class="h-expr">' + item.expression + ' =</div><div class="h-result">' + item.result + '</div>';
    li.addEventListener('click', function () {
      expression = String(item.result);
      lastResult = null;
      updateDisplay();
    });
    historyListEl.appendChild(li);
  }
}

// Wire up buttons
const buttons = document.querySelectorAll('.btn');
for (let i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', function () {
    const action = this.dataset.action;
    const value = this.dataset.value;
    if (action === 'clear') {
      clearAll();
    } else if (action === 'backspace') {
      backspace();
    } else if (action === 'equals') {
      evaluate();
    } else if (value) {
      appendValue(value);
    }
  });
}

document.getElementById('clear-history').addEventListener('click', function () {
  history = [];
  renderHistory();
});

// Keyboard support
document.addEventListener('keydown', function (e) {
  const key = e.key;
  if ((key >= '0' && key <= '9') || key === '.' || key === '+' || key === '-' || key === '*' || key === '/' || key === '(' || key === ')') {
    appendValue(key);
  } else if (key === 'Enter' || key === '=') {
    e.preventDefault();
    evaluate();
  } else if (key === 'Backspace') {
    backspace();
  } else if (key === 'Escape') {
    clearAll();
  }
});

renderHistory();
