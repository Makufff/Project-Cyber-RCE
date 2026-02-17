# LAB-RCE-DEFENSE

This lab is focused on defending against Remote Code Execution (RCE) vulnerabilities in Next.js applications using the React Flight Protocol.

## Challenge Objective

Your goal is to secure this application so that the RCE exploit discovered in the `LAB-RCE-ATTACK` stage no longer works.

## Verification / Submission

We have implemented an automated checker to help you verify your defense.

### How to use:

1.  **Start the environment**: Run your Docker container.
2.  **Submit for verification**: Run the `submit` command in your container terminal:
    ```bash
    submit
    ```

### Results:

- **Incorrect** (Red): The application is still vulnerable to RCE. The checker successfully executed a command and retrieved the `RNG_SECRET`.
- **Correct** (Green): The application is secure. The checker failed to execute the command or the exploit was successfully blocked.

## Technical Details

The `submit` utility performs a self-attack by sending a malformed RSC payload to the application's `/adfa` endpoint. If the server is still vulnerable, the payload will leak the `RNG_SECRET` environment variable, which the tool then verifies to determine the result.
