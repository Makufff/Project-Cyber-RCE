# LAB-RCE-DEFENSE

## Next.js RSC Flight Protocol RCE — Defense Challenge

This lab provides a **vulnerable Next.js 15.0.4** application running in development mode.  
Your mission is to **patch the RCE vulnerability** by upgrading Next.js to a secure version.

---

## 🎯 Challenge Objective

The Next.js app inside this container is vulnerable to **Remote Code Execution (RCE)** via the **React Server Components (RSC) Flight Protocol**. An attacker can execute arbitrary JavaScript on the server by sending a crafted POST request with a malicious RSC payload.

**Your goal:** Upgrade Next.js so the RCE exploit no longer works, then verify with `submit`.

---

## 🚀 Quick Start

### 1. Build & Run the container

```bash
docker build -t lab-rce-defense .
docker run -d --name rce-defense -p 2222:22 -p 3000:3000 lab-rce-defense
```

### 2. SSH into the container

```bash
ssh secspace@localhost -p 2222
# Password: secspace
```

### 3. Check current status (should FAIL — vulnerable)

```bash
submit
```

---

## 🛡️ How to Fix

### Option 1: Upgrade Next.js via npm

```bash
cd ~/app
npm install next@latest
```

### Option 2: Use Next.js upgrade codemod

```bash
cd ~/app
npx @next/codemod@latest upgrade
```

### After upgrading — restart the dev server

```bash
# Use the helper script:
restart-app

# Or manually:
tmux kill-session -t nextjs
cd ~/app
export RNG_SECRET=$(cat .rng_secret)
tmux new-session -d -s nextjs "export RNG_SECRET=$(cat /home/secspace/app/.rng_secret) && npm run dev"
```

### Verify the fix

```bash
submit
```

---

## ✅ Verification / Submission

The `submit` command performs an automated check:

| Step | Description |
|------|-------------|
| **[1/3]** | Detects installed Next.js version |
| **[2/3]** | Checks if the dev server is running on port 3000 (with retries) |
| **[3/3]** | Sends a RSC Flight Protocol RCE payload attempting to leak `RNG_SECRET` |

### Results

- 🔴 **VERIFICATION FAILED** — The RCE attack succeeded, the secret was leaked. Next.js is still vulnerable.
- 🟢 **VERIFICATION PASSED** — The RCE attack was blocked, the secret is safe. Next.js has been patched.

---

## 🔍 Technical Details

### The Vulnerability

The RSC (React Server Components) Flight Protocol in vulnerable versions of Next.js has a deserialization flaw that allows:

1. **Prototype Pollution** — via crafted Flight Protocol references (`$1:__proto__:then`)
2. **Code Execution** — via `constructor.constructor` chain (accessing the `Function` constructor)
3. **Data Exfiltration** — executed code reads env vars and returns them via error digest

### The Attack Payload

A `POST` request with `Next-Action: x` header and malicious `multipart/form-data`:

```json
{
  "then": "$1:__proto__:then",
  "status": "resolved_model",
  "reason": -1,
  "value": "{\"then\":\"$B1337\"}",
  "_response": {
    "_prefix": "var res=process.env.RNG_SECRET; throw Object.assign(new Error('x'), {digest: res});",
    "_chunks": "$Q2",
    "_formData": { "get": "$1:constructor:constructor" }
  }
}
```

This payload pollutes the prototype chain, gains access to `Function`, and executes arbitrary code that reads the `RNG_SECRET` environment variable.

### Why Upgrading Fixes It

Patched versions of Next.js added proper validation and sanitization of RSC Flight Protocol references, preventing prototype pollution and arbitrary code execution through the deserialization path.

---

## 📋 Container Info

| Item | Value |
|------|-------|
| **User** | `secspace` / `secspace` |
| **Root** | `root` / `supersecret_password` |
| **SSH Port** | 22 (mapped to host) |
| **App Port** | 3000 |
| **App Path** | `/home/secspace/app` |
| **Next.js** | 15.0.4 (vulnerable) |
| **Node.js** | 20.18.0 |
| **Flag** | `cve{nextjs-flight-protocol-issue-defended}` |

