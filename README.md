# 🚢 Ladice

> **"A legendary artifact from the pre-AI era."**

**Ladice** is a 2D arcade survival game where you navigate a boat through treacherous waters, dodging obstacles and enemies while trying to keep your score high.

This project holds a special place in history: it was **my very first game**, hand-coded in C++ during my high school years at **Vegova** (Electrotechnical-Computer Vocational School and Gymnasium Ljubljana).

Back then, there were no LLMs, no Copilot, just raw determination, `std::cout`, and a bunch of headbanging. Today, it has been dusted off, polished, and "imped" with the power of modern AI to run smoothly on Linux.

---

## 🎨 Gallery

Meet the cast of characters and obstacles from the high seas:

| **The Enemy** | **The Friendly Pingo** | **The Hero** |
| :---: | :---: | :---: |
| <img src="assets/enemyboat.png" width="150" alt="Enemy Boat"> | <img src="assets/pingo.png" width="150" alt="Pingo"> | <img src="assets/playerboat.png" width="150" alt="Player Boat"> |

> *Watch out for the Icebergs and Lilipads!*

---

## 🕹️ Gameplay

*   **Navigate:** Click and hold on your boat to guide it.
*   **Attack:** Ram into **enemy pirate ships** to gain points! 🏴‍☠️
*   **Survive:** **AVOID** obstacles like **Icebergs** and **Lilipads**, or it's game over! ❄️🌿
*   **Mercy:** Do not hit friendly animals (Pingo, Zabika) or you lose points. 🐧
*   **Levels:** Progress through 3 increasingly difficult levels.

---

## 🛠️ How to Build & Run

Originally built for Windows with Code::Blocks, the project has been modernized for Linux environments.

### Prerequisites (Ubuntu/Debian)
```bash
sudo apt-get install libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev build-essential
```

### Installation
1.  **Clone the repo** (or navigate to the folder).
2.  **Build** using Make:
    ```bash
    make
    ```
3.  **Run**:
    ```bash
    ./bin/Ladice
    ```
    *(Or simply `make run`)*

---

## 📜 History & Tech Stack

*   **Origin:** Vegova High School Project.
*   **Language:** C++ (Standard 17).
*   **Library:** SDL2 (Simple DirectMedia Layer) for graphics and audio.
*   **Refactoring:** In 2026, the codebase was modernized by **Antigravity** (an AI Agent). We fixed memory management, replaced the build system with `Make`, resolved renderer conflicts, and ensured Linux compatibility.

---
*Made with ❤️, C++, and a touch of AI magic.*
