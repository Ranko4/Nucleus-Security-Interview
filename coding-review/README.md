# Code Review: Webhook Handler

This repository contains my code review for the Nucleus Security interview exercise.

## Findings (Based on the Python Code):

### Big issues:
Lines 42 and 47 use f-strings to build queries with user-controlled data. F-strings to make SQL queries are insufficient to defend against attacks because they allow for direct string interpolation, which in turn allows attackers to alter the database. An attacker could send `{"email": "x', 'y'); DROP TABLE users;--"}`, which would cause an arbitrary SQL command to run and thus could compromise the database. The fix is to use parameterized queries, where the database driver handles the input safely instead of pasting it directly into the query string.

Line 20 compares the expected signature to the submitted one using `==`. This is vulnerable to a timing attack because `==` stops comparing as soon as it finds a difference, which means the comparison is slightly faster when the signature is wrong early and slightly slower when it's wrong late. An attacker measuring response times over many requests can figure out the correct signature one character at a time. The fix is to use `hmac.compare_digest()`, which takes the same amount of time no matter where the strings differ.

Lines 17 through 20 compute the signature as `SHA256(secret + body)`. This is vulnerable to a length extension attack, where an attacker who has seen one valid signature can append data to the message and compute a valid signature for the new, longer message without ever knowing the secret. This is  the problem HMAC was designed to solve, and it's why real vendors like Stripe and GitHub use HMAC-SHA256. The vendor's documented scheme is itself insecure and should be flagged.

### Medium issues:
Line 10 falls back to a default secret of `"dev-secret"` if the environment variable is missing. If someone deploys to production and forgets to set `WEBHOOK_SECRET`, the app silently runs with a publicly known secret and anyone who has seen the source code can create webhook requests. The fix is to fail loudly when the secret isn't set instead of defaulting to something not secure.

The example payload in the task description is `{"email":"a@b.com","role":"admin","metadata":{"source":"vendor"}}`, and the code blindly trusts whatever `role` the payload claims. This is a privilege escalation risk because an external vendor should not be able to assign admin role to users in the system. Even though the request is authenticated (due to the signature), that doesn't mean it's authorized to do what it's asking.

Line 30 calls `json.loads` without a try/except, so a badly created JSON will crash the handler and return a 500 error to the caller instead of a proper 400. There's also no validation that `email` is actually an email or that `role` is a known value. The fix is to wrap the parse in try/except and validate the fields before using them.

Line 47 is labeled as an "upsert" but it's actually a plain INSERT, so repeated emails will either create duplicates or fail on a UNIQUE constraint.

### Smaller issues:
The signature is verified over the decoded-then-re-encoded body instead of the raw bytes. Any transformation of the bytes risks rejecting legitimate requests or, worse, accepting forged ones. Signatures should always be verified over the exact raw bytes received.

`get_db()` opens a new connection on every request and never closes it, which leaks resources over time. The code also references `webhook_audit` and `users` tables but never creates them, so the first request will crash with a "no such table" error.

There's no replay protection. A captured valid request can be replayed forever because nothing in the signed payload includes a timestamp. A well-designed webhook rejects signatures older than a short window like five minutes.

## My Thought Process and Using AI:
How I handled the code review was that I first looked through the code myself and wanted to see if I could see anything wrong before using AI. After going through it, I utilized AI (specifically Claude's Sonnet 4.6) to help me. Below are some of my prompts, the responses I got, as well as anything else I ask Claude:

1:
- Me: "you are a senior security engineer reviewing this Python webhook handler. Go through the code line by line and list problems by on how severe they are. Dont just say 'this is bad', but instead explain why its bad and what an attacker could actually do with it ['Screenshot of code']"
- Claude: Gave me a list of 11 issues grouped by severity, with short explanations and code fixes for each. Covered SQL injection, timing attacks, SHA256 vs HMAC, hardcoded default secret, missing table creation, fake upsert, and a few smaller things.
- What I hoped for: A full checklist I could work through one by one.
- What actually happened: I got the checklist, but half the terms were new to me. "Length extension attack" and "timing attack" sounded like things I couldn't explain even if I copied the fix correctly.
- Takeaway: Asking for "everything" works but it was too much at once. I needed to slow down and actually understand each point.

2:
- Me: "you talked about a timing attack on line 20, but I dont really get it. The code just compares two strings with ==. How is that a security problem? Explain it like ive never heard of it before and give me a good example of what an attacker would actually do"
- Claude: Explained that == stops comparing as soon as it hits a different character, so the comparison returns faster when the signature is wrong at the start and slower when it's wrong at the end. Walked me through an attacker sending "aaaa...", then "baaa...", then "caaa..." and measuring response times to figure out each character one at a time.
- What I hoped for: A simple explanation.
- What actually happened: The explanation was clear but I had trouble really understanding the problem behind it. Nanosecond differences over the internet sounded like that was impossible due nuiance associated with the internet.
- Takeaway: Understanding the concept isn't the same as believing it was exploitable. I needed to understand it more.

3:
- Me: "to be honest, that sounds impossible, especially with microsecond differences over the internet with all the network lag and nuiance and stuff. Is this actually exploitable in the real world or is it one of those things security things people worry about but never really happens? Be honest, dont try to cover it up."
- Claude: Didn't back down. Said yes, it's been demonstrated in real research, attackers average over many requests to defeat network noise, and even if the risk is low, hmac.compare_digest() is a one-line fix with no downside. Also said of all the issues, this one is less urgent than the SQL injection.
- What I hoped for: Validation that I could skip it.
- What actually happened: Claude pushed back with reasoning and I actually respected that it didn't fold. I decided to include it but mark it as lower priority.
- Takeaway: Telling the AI "be honest" and "don't cover it up" is useful. AI is meant to disagree in order to learn.

4:
- Me: "okay I jumped ahead so let me restart. Take just the SQL injection issue and walk me through: (1) what the vulnerable line is, (2) exactly what an attacker would send as input to exploit it, (3) what the fixed version looks like"
- Claude: Honed in on the f-string line, constructed the malicious email payload "x', 'y'); DROP TABLE users;--", traced through what SQL actually gets executed, showed the parameterized version, and explained that manual escaping is not easy because you'll miss edge cases and different quote styles while parameterized queries let the driver separate code from data.
- What I hoped for: Deep understanding of this one issue.
- What actually happened: Exactly that.
- Takeaway: "One issue at a time, with anticipated follow-up questions" really helped deepend my understanding.

5:
- Me: "for the HMAC thing, the vendor docs actually say to use SHA256(secret + body). So technically the code matches the spec that was listed. That means its not really a bug right? The vendor is the one responsible, no?"
- Claude: Disagreed. Said yes the code matches the spec but the spec itself is insecure. Length extension attacks are a known weakness of SHA256(secret + message) and that's literally why HMAC was invented. In a code review, flagging "the vendor's scheme is insecure, we should request HMAC" is more valuable than implementing a bad spec. Pointed out that Stripe, GitHub, and Slack all use HMAC-SHA256.
- What I hoped for: An easy out. Basically saying "You're right, skip this one."
- What actually happened: Claude held firm with reasoning. Helped change my mindset from "does the code match the requirements" to one of "are the requirements themselves good"
- Takeaway: The AI not telling me what I want to hear saved me from missing one of the best points in the whole review.

6:
- Me: "going back through the task description, the example payload is {"email":"a@b.com","role":"admin","metadata":{"source":"vendor"}}. Something feels off about it but I cant put it into words. What do you think it could be?"
- Claude: Named it for me. Said the payload is a vendor-sourced event assigning admin role to a user, which is a privilege escalation vector. An external vendor shouldn't be able to dictate internal role assignments. Suggested that role should either be ignored for vendor events or constrained to a safe allowlist. Framed it as an authorization issue (separate from authentication) where the request is authentic but not necessarily authorized to do what it's asking.
- What I hoped for: Help putting words something I couldn't.
- What actually happened: Claude handed me the vocabulary: authentication vs authorization, privilege escalation via external input. I realized this was a design issue and not a coding issue.
- Takeaway: Sometimes the best prompt is having the AI name something you can't put your finger on.

7:
- Me: "go through my review and image you are trying to nickpick the smallest details, basically devils advocate. What issues might I be overstating or flagging incorrectly? I want to know if Im missing anything ['my readme file']"
- Claude: Went through my list. Said the "default secret" is only exploitable if someone forgets to set the env var in production, so framing it as critical is aggressive. "Tables never created" is a bug, not really a security issue. The 0.0.0.0 bind depends entirely on deployment context and is fine behind a reverse proxy. Suggested I be precise about what's definitely exploitable today versus risky patterns that depend on context.
- What I hoped for: Reassurance that everything on my list was solid.
- What actually happened: Claude gently pushed back on my confidence, which was good.
- Takeaway: Asking the AI to argue against my own work was one of the most valuable prompts.

8:
- Me: "if you were interviewing me on this code review, whats the one question you wouldd ask to figure out whether I actually understood the issues vs just what an AI told me?"
- Claude: Suggested something like: "You flagged the signature comparison as a timing attack. Walk me through, if you were the attacker, what would your exploit script actually look like? How many requests would you need and how would you handle network jitter?" The point being that if I can't describe the exploit mechanics, I don't really understand the vulnerability. I'm just reciting a category name.
- What I hoped for: A curveball to prep against.
- What actually happened: I realized I couldn't fully answer that question yet. I had memorized "timing attack leads to using compare_digest" without understanding the attacker's actual workflow. Went back and had Claude walk me through the attacker side in detail.
- Takeaway: The best prompts aren't about getting answers. They're about finding what I don't actually know yet.

 