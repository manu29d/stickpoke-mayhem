# Stick-Poke Mayhem

**Stick-Poke Mayhem** is an 80-second ragdoll rumble where goofy avatars poke each other into oblivion. Manage your sticks, utilize momentum for maximum damage, and try not to trip over your own feet!

<img width="1717" height="853" alt="image" src="https://github.com/user-attachments/assets/0e1a8c45-b51e-427c-93cb-a61048aae94d" />

## 🎮 How to Play

### Objective
Reduce your opponent's HP to zero before the 80-second timer runs out. If time runs out, the player with the most HP wins.

### Controls

| Action | Player 1 | Player 2 |
| :--- | :--- | :--- |
| **Move** | `W` `A` `S` `D` | `Arrow Keys` |
| **Jump** | `W` | `Up Arrow` |
| **Duck** | `S` | `Down Arrow` |
| **Poke** | `Space` | `Enter` |
| **Special** | `F` | `Right Shift` |

### Mechanics
*   **Momentum:** Running before hitting deals significantly more damage.
*   **Sticks:** Your stick has durability. If it breaks, run to your stick pile to grab a new one.
*   **Hazards:** Watch out for falling anvils and gusty winds!

---

## 🚀 Local Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Start the dev server:**
    ```bash
    npm run dev
    ```

3.  **Open in browser:**
    Navigate to `http://localhost:5173`

---

## 🌍 Deployment to GitHub Pages

This repository is configured to automatically deploy to GitHub Pages using GitHub Actions.

### Setup Instructions

1.  **Push code to GitHub:**
    Ensure this code is pushed to a repository on GitHub.

2.  **Enable GitHub Pages:**
    *   Go to your repository **Settings**.
    *   Click on **Pages** in the sidebar.
    *   Under **Build and deployment**, select **GitHub Actions** as the source.

3.  **Trigger Deployment:**
    *   Pushing to the `main` branch will automatically trigger the `Deploy static content to Pages` workflow.
    *   You can monitor the progress in the **Actions** tab.

4.  **Play:**
    Once the action completes, your game will be live at `https://<your-username>.github.io/<repo-name>/`.
