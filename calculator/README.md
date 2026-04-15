# Calculator

Calculator web app with a Node.js backend and JS frontend.

## Running

type "node server.js" in terminal

Then open http://localhost:3000.

## What's implemented

- Calculator UI with display, buttons, and a history panel on the side.
- Backend `POST /api/calculate` endpoint that takes `{ expression }` and returns `{ result }` or `{ error }`.
- Operations: `+`, `-`, `*`, `/`, parentheses, decimals, unary minus.
- Evaluation: tokenizer to shunting-yard to RPN evaluator on the backend (avoided `eval()` since input comes over HTTP).
- Click a history entry to load that result back into the display.
- Keyboard support.

## Things I didn't get to

- Tests: Didn't write any. The `calculate()` function is the obvious thing to test, but I didn't do anything else besdies that.
- Persisting history: It's in-memory only as a refresh wipes it.
- Percent and +/- buttons: Skipped
- Scientific functions: No `sin`, `cos`, `tan`, `log`, `ln`, `sqrt`, `x^y`, or constants like `π` and `e`. Adding these would mean extending the tokenizer to recognize multi-character identifiers and adding a "function call" token type to the shunting-yard logic.
- Memory functions: No `M+`, `M-`, `MR`, `MC`
- Floating-point display: `0.1 + 0.2` shows `0.30000000000000004` right now. Would need either rounding on display or a decimal library on the backend.
- Mobile usage: Not sure how it would look on a mobile device
- Refactoring the backend: `calculate()` is one long function doing tokenize + parse + evaluate. Would be better to split them up.
- Theming: Just dark mode right now. I wanted to add a day/night option.

## My Thought Process and Using AI

I started by making decisions before writing code, then built a barebones working version (just the four operations with no UI polish, no history, no keyboard support), then layered on UI through AI, error handling, history, and keyboard support. Below are my prompts roughly in order, with what I hoped for, what actually happened, and what I changed.

1.
- Me: "I have 50 minutes to build a calculator web app with a frontend and backend. Before any code, help me think through the decisions What stack, how the frontend communicates to the backend, how to actually do the math correctly. Give me options and that their tradeoffs are, but don't pick for me"
- Claude: Laid out Flask vs Express vs plain Node, vanilla JS vs React, and the big one: sending a raw expression string vs sending structured `{a, b, op}`. Flagged that `eval()` on a user string is the same class of issue as the SQL injection from the code review (untrusted input hitting an execution context which I found to be super interesting). Suggested either structured operands (safe but no precedence) or write a small parser if I wanted real expressions.
- What I hoped for: A clear set of choices to make.
- What actually happened: Exactly that, plus the security framing
- Takeaway: Picked Node with the built-in `http` module (no install step, one less thing to go wrong) and decided to write a small parser so I could support `2 + 3 * 4` properly.

2.
- Me: "I'm going with Node with http module, JS frontend, and I want to support full expressions like 2+3*4 with parentheses. Give me a skeleton with folder layout and empty functions. Don't fill in the parser logic yet, I want to write that myself"
- Claude: Gave me a flat structure with `server.js` + a `public/` folder for the static files, an empty `calculate()` function with comments outlining tokenize to shunting-yard to RPN evaluate, and the http server skeleton with the route handler.
- What I hoped for: A blank structute I could fill in.
- What actually happened: Gave me the structure but I noticed the `calculate()` said "shunting yard" and I had to ask what that was because I never heard ot it.
- Takeaway: Asking for blank functions instead of full code was a good choice because I could fill that in with what I knew.

3.
- Me: "what is shunting-yard? Why can't I just go left to right through the expression?"
- Claude: Explained that going left-to-right gives you `2 + 3 * 4 = 20` instead of `14` because you'd do the `+` before the `*`. Shunting-yard is kind of like Dijkstra's algorithm for converting infix (`2 + 3 * 4`) to postfix / RPN (`2 3 4 * +`) which is not that important to evaluate with a stack because you don't have to think about precedence at evaluation time as the order is baked into the postfix form. Walked through one example by hand.
- What I hoped for: To actually understand it before I wrote it.
- What actually happened: I understood it. The "precedence is baked into the order" framing is what made it stick. It's almost like a saying in a way.
- Takeaway: Asking made me actually learn the algorithm.

4.
- Me: "okay here's my first attempt  at the calculate function [pasted code from file]. Does it work?"
- Claude: Pointed out two things: I wasn't handling multi-digit numbers in the tokenizer (it was treating `12` as `1` then `2`), and my precedence comparison needed to be `>=` not `>` to handle left-associativity for same-precedence operations like `5 - 3 - 1`.
- What I hoped for: A check.
- What actually happened: Caught two bugs I would have otherwise left untreated. The `5 - 3 - 1` one would have given me `3` instead of `1` and I probably wouldn't have noticed until much later.
- Takeaway: Always have it review before moving on, even when you think it works.

5.
- Me: "now I want to add parentheses and decimals. Show me what changes in the tokenizer and the shunting yard part, but explain why each change is needed, don't just give me the difference"
- Claude: For decimals: extend the number-reading loop to also accept `.`. For parentheses: in shunting-yard, `(` always goes on the operator stack and never gets popped by precedence; `)` pops everything until it finds the matching `(`. Mismatched parentheses throw.
- What I hoped for: Targeted changes I specified.
- What actually happened: Got targeted changes with reasoning. Then implemented them myself.
- Takeaway: "Explain why each change" is a good phras to keep using.

6.
- Me: "the API isn't working. I'm sending a POST from the frontend and getting nothing back. here's my server code [pasted code] and here's my fetch [pasted code]. what's wrong?"
- Claude: Asked what I was actually seeing. Was it 404, network error, hanging, wrong response? I said the request was hanging. It then pointed out that I was reading `req.on('data')` but never sending a response inside `req.on('end')`. I'd put the `res.end` outside the end handler so it was going before the body had been read.
- What I hoped for: A quick fix.
- What actually happened: Made me describe the what was going on first, which forced me to actually look at the network tab.
- Takeaway: Don't paste code and say broken. Say what's broken.

7.
- Me: "okay it works for `2+3` but `2 + 3` (make sure it has spaces) gives 'Invalid character: '. What do I do here?"
- Claude: Add space to the allowed characters whitelist and skip it in the tokenizer.
- What I hoped for: One-line fix.
- What actually happened: One-line fix.
- Takeaway: N/A.

8.
- Me: "negative numbers don't work. `-5` and `5 + -3` don't work. How do calculators normally handle unary minus?"
- Claude: Explained that unary minus is a real pain in expression parsers and there are two common approaches: treat it as a separate operator with its own precedence, or do the trick of inserting a `0` before any `-` that appears at the start or right after another operator or `(`. So `-5` becomes `0 - 5`. Said the  trick is fine for a calculator.
- What I hoped for: Understanding what was going and how to fix the issue.
- What actually happened: Gave me two options and a recommendation with reasoning.
- Takeaway: I went with the trick. It's kinda tacky but it works and I can explain it.

9.
- Me: "right now the frontend is just a text area and a submit button, so it's really boring. I want it to look like an actual calculator with a dark theme, button grid, that sort of thing. give me HTML and CSS for that"
- Claude: Gave me a 4-column grid of buttons with data attributes for value/action, a display with two lines (current expression on top, result big underneath), and a dark color scheme with an orange accent for operators and green for equals. CSS used CSS grid for the button layout and `grid-column: span 4` to make the equals button full-width.
- What I hoped for: Something that looks like a calculator without me spending 20 minutes on CSS.
- What actually happened: Got something clean. The data-attribute pattern (`data-value="7"`, `data-action="clear"`) was a nice touch I wouldn't have thought of, so that's really neat.
- Takeaway: For UI styling specifically I was happy to lean on the AI more than for logic. I wanted to spend more tiem on leanring and implementing the logic than working on the theme

10.
- Me: "the buttons all do the same thing visually but I want the operator buttons to be a different color from numbers, and equals should stand out more so people know where it is. also AC and backspace should look like function buttons not numbers"
- Claude: Suggested classes `.num`, `.op`, `.func`, `.equals` and gave me the color values. Operator orange, function gray-purple, equals green, numbers a neutral dark.
- Takeaway: N/A.

11.
- Me: "at this point I have a working calculator. It does math, it looks decent, that's the core requirement. What else could I add?"
- Claude: Ranked them roughly: (1) better error handling and edge cases, (2) keyboard support, small effort, real UX win, (3) calculation history: moderate effort, shows you can manage state, (4) tests for the parser. Said skip animations and themes; those are not necessary for this.
- What I hoped for: Help prioritizing.
- What actually happened: The ranking was useful. I did keyboard + history because I had time for both, skipped tests (I probably should've done it).
- Takeaway: N/A.

12.
- Me: "add keyboard support: digits, operators, enter for equals, escape for clear, backspace for backspace. Just show me the event listener"
- Claude: Single `keydown` listener with a chain of conditions. Reused the existing `appendValue`, `evaluate`, `clearAll`, `backspace` functions so the keyboard path and the click path go through the same code.
- Takeaway: The "reuse the existing functions" framing was the important part. I didn't want duplicate code.

13.
- Me: "for history, I want a panel on the right that shows past calculations and lets you click one to bring the result back. Should this be backend or frontend state?"
- Claude: Said frontend. The backend is stateless (just receives an expression, returns a result) and adding history to it would mean either per-session state, which needs sessions, or global state, which leaks across users. Keeping it frontend-only also means a refresh wipes it which is fine for a calculator and is a known tradeoff.
- What I hoped for: A reasoning-based answer.
- What actually happened: Got the reasoning, plus a clear tradeoff.
- Takeaway: Decision-making prompts ("X or Y, why") are valuable.

14.
- Me: "I tested `0.1 + 0.2` and got `0.30000000000000004`. I know this is the floating point thing but is there a quick fix or do I need a decimal library?"
- Claude: Explained briefly that this is IEEE 754 binary float representation — `0.1` and `0.2` aren't exactly representable in binary, same way `1/3` isn't exactly representable in decimal. Quick fix is to round the display to ~12 significant digits which hides the noise without changing the math. Real fix is a decimal library like decimal.js.
- What I hoped for: To know if this was a 2-minute fix or something that would take a lot of time.
- What actually happened: Confirmed it was going to take some time.
- Takeaway: Listed it under "didn't get to" with the explanation.

15.
- Me: "review my whole codebase. I want you to nickpick everything, like devils advocate. What would a senior engineer flag in a PR? Nickpicks along with real concerns"
- Claude: Said the parser/tokenizer/evaluator should be split into separate functions (right now `calculate()` does all three and is hard to test), there are no tests at all and the parser is exactly the kind of code that should have them, the frontend `appendValue` "did the user just press equals" logic is messy and would benefit from a state machine, and the static file serving in `server.js` doesn't guard against path traversal (someone could request `/../../etc/passwd`). Said the path traversal one is the only actual security issue, the rest are quality.
- What I hoped for: What was wrong with my code.
- What actually happened: Got it. Fixed the path traversal, the others I documented under "didn't get to" because of time.
- Takeaway: Same lesson as the webhook review. I asked it to be devil's advocate is one of the most valuable prompt patterns.

## What the AI did well
- Explaining algorithms at the level I needed instead of giving me the code.
- Catching real bugs in code review
- Pushing back when I asked leading questions, like the floating-point one.
- UI scaffolding where the data-attribute button pattern was cleaner than what I would have written.

## What the AI did poorly
- First pass at the API debugging gave me a generic answer until I described the actual problem. This told me that it gives me information as good as the prompt I give it
- Sometimes over-xplained when I just wanted a simple, one-liner answer.
- Initial CSS was generic-looking until I pushed for specific color choices and per-button-type styling. Again, vague visual prompts get vague visual results.

## How I changed my approach
The biggest change was moving from "write me X" prompts to "should I do X or Y, and why" prompts.

I also learned to describe what was happening before asking for fixes like how pasting broken code with "this doesn't work" gets a worse answer than pasting it with "this X after the Y never does Z."
