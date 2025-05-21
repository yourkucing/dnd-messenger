const msg = [
"SYSTEM INITIALIZED...",
"ESTABLISHING LINK TO RHODES ISLAND HQ...",
"AWAITING OPERATOR AUTHENTICATION..."
];

const terminal = document.getElementById("terminal-msg");
let line = 0;
let char = 0;

function typeLine() {
if (line < msg.length) {
    if (char < msg[line].length) {
    terminal.textContent += msg[line][char];
    char++;
    setTimeout(typeLine, 30); // typing speed per character
    } else {
    terminal.textContent += "\n";
    line++;
    char = 0;
    setTimeout(typeLine, 300); // delay between lines
    }
}
}

typeLine();

const deployBtn = document.querySelector("button");
const popup = document.getElementById("terminal-popup");
const loginMsg = document.getElementById("login-msg")
const messages = [
"INITIALIZING SECURE CONNECTION...",
"AUTHENTICATING OPERATOR...",
"CREDENTIALS VERIFIED.",
"ACCESS GRANTED.\nWELCOME, SKYLA HUNTER."
];

deployBtn.addEventListener("click", () => {
popup.classList.remove("hidden");
overlay.classList.remove("hidden");

loginMsg.textContent = "";
let line = 0, char = 0;

function typeLine() {
    if (line < messages.length) {
    if (char < messages[line].length) {
        loginMsg.textContent += messages[line][char];
        char++;
        setTimeout(typeLine, 10);
    } else {
        loginMsg.textContent += "\n";
        line++;
        char = 0;
        setTimeout(typeLine, 300);
    }
    } else {
        setTimeout(() => {
            window.location.replace("index.html");
        }, 1000);
    }
}

typeLine();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    popup.classList.add("hidden");
    overlay.classList.add("hidden");
}
});

const inputs = document.querySelectorAll('input');

inputs.forEach(input => {
  input.addEventListener("focus", () => input.classList.add("typing-caret"));
  input.addEventListener("blur", () => input.classList.remove("typing-caret"));
});