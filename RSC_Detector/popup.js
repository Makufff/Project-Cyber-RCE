document.addEventListener('DOMContentLoaded', () => {
    const el = {
        passiveBadge: document.getElementById('passive-badge'),
        passiveList: document.getElementById('passive-list'),
        btnFinger: document.getElementById('btnFingerprint'),
        fingerResult: document.getElementById('fingerprint-result'),
        activeList: document.getElementById('active-list'),
        btnExploit: document.getElementById('btnExploit'),
        cmdInput: document.getElementById('cmdInput'),
        exploitStatus: document.getElementById('exploit-status'),
        exploitResult: document.getElementById('exploit-result'),
        rceOutput: document.getElementById('rce-output')
    };

    // 1. Get current Tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        // --- Initialization: Passive Scan ---
        chrome.tabs.sendMessage(tabId, { action: "get_passive" }, (res) => {
            if (chrome.runtime.lastError || !res) {
                el.passiveBadge.innerText = "ERROR";
                el.passiveList.innerHTML = "<li>Please refresh page</li>";
                return;
            }
            if (res.isRSC) {
                el.passiveBadge.innerText = "DETECTED";
                el.passiveBadge.className = "badge red";
            } else {
                el.passiveBadge.innerText = "SAFE";
                el.passiveBadge.className = "badge green";
            }

            el.passiveList.innerHTML = "";
            if (res.details.length === 0) el.passiveList.innerHTML = "<li>No patterns found</li>";
            res.details.forEach(d => {
                const li = document.createElement('li');
                li.innerText = d;
                li.style.color = "#c0392b";
                el.passiveList.appendChild(li);
            });
        });

        // --- Interaction: Active Fingerprint ---
        el.btnFinger.addEventListener('click', () => {
            el.btnFinger.disabled = true;
            el.btnFinger.innerText = "Probing...";
            el.fingerResult.style.display = 'none';

            chrome.tabs.sendMessage(tabId, { action: "run_fingerprint" }, (res) => {
                el.btnFinger.disabled = false;
                el.btnFinger.innerText = "Start Fingerprint Probe";
                el.fingerResult.style.display = 'block';
                el.activeList.innerHTML = "";

                if (res && res.detected) {
                    res.details.forEach(d => {
                        const li = document.createElement('li');
                        li.innerText = d;
                        li.style.color = "#d35400";
                        li.style.fontWeight = "bold";
                        el.activeList.appendChild(li);
                    });
                } else {
                    el.activeList.innerHTML = "<li style='color:#27ae60'>No Active RSC Response</li>";
                }
            });
        });

        // --- Interaction: RCE Exploit ---
        el.btnExploit.addEventListener('click', () => {
            const cmd = el.cmdInput.value || "whoami";
            el.btnExploit.disabled = true;
            el.exploitStatus.style.display = 'block';
            el.exploitResult.style.display = 'none';
            el.rceOutput.className = 'console-out'; // Reset style

            chrome.tabs.sendMessage(tabId, { action: "run_exploit", cmd: cmd }, (res) => {
                el.btnExploit.disabled = false;
                el.exploitStatus.style.display = 'none';
                el.exploitResult.style.display = 'block';

                if (res && res.success) {
                    el.rceOutput.style.color = "#00cec9"; // Cyan success color
                    el.rceOutput.innerText = `[+] Command: ${cmd}\n[+] Output:\n${res.output}`;
                    // Force icon alert after success
                    chrome.runtime.sendMessage({ action: "update_badge" });
                } else {
                    el.rceOutput.style.color = "#e74c3c"; // Red failure color
                    el.rceOutput.innerText = `[-] ${res ? res.msg : "Unknown Error"}`;
                }
            });
        });
    });
});