# Mobile App E2E Test Runbook

> **Executor:** Claude Code via Mobile MCP
> **App:** Magpie (Capacitor 6+ / React / Android)
> **Approach:** Goal-oriented with relaxed Gherkin scenarios
> **MCP Server:** `@mobilenext/mobile-mcp`

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Phase](#setup-phase)
4. [Execution Guidelines](#execution-guidelines)
5. [Test Scenarios](#test-scenarios)
   - [Feature: App Build & Deploy](#feature-app-build--deploy)
   - [Feature: API Key Management](#feature-api-key-management)
   - [Feature: Summarization - Happy Paths](#feature-summarization---happy-paths)
   - [Feature: Summarization - Error Handling](#feature-summarization---error-handling)
   - [Feature: Summarization - User Controls](#feature-summarization---user-controls)
   - [Feature: Share & Copy Summary](#feature-share--copy-summary)
   - [Feature: Manage Prompts](#feature-manage-prompts)
   - [Feature: Manage Favorite Models](#feature-manage-favorite-models)
6. [Failure Handling](#failure-handling)
7. [Test Report Format](#test-report-format)

---

## Overview

This runbook defines end-to-end test scenarios for the Magpie mobile app. Claude Code executes these tests using the Mobile MCP server, which provides direct control over an Android emulator — taking screenshots, reading the accessibility tree, tapping elements, typing text, and managing app lifecycle.

Tests use **real APIs** (OpenRouter for summarization, YouTube InnerTube for transcripts). No mocking. Claude dynamically searches for suitable YouTube videos at runtime.

Tests run **sequentially with shared state** — the first scenario sets up the API key, and subsequent scenarios reuse it. This mirrors real user behavior and avoids the overhead of re-entering credentials for every test.

---

## Prerequisites

Before starting the test run, Claude must collect the following from the user:

| Input | Description | Example |
|-------|-------------|---------|
| **OpenRouter API key** | Valid `sk-or-*` key for real API calls | `sk-or-v1-abc123...` |

**Never hardcode API keys into this runbook, test reports, or any file.**

### Environment Requirements

- Android SDK with platform tools (`adb`, `emulator`, `avdmanager`, `sdkmanager`)
- Java JDK 17+ (for Gradle)
- Node.js 18+ and npm
- Mobile MCP server installed: `claude mcp add mobile-mcp -- npx -y @mobilenext/mobile-mcp@latest`
- Project source code at the working directory root

---

## Setup Phase

### 1. Emulator Provisioning

Check for existing AVDs. If none are available, create one:

- **Device profile:** Pixel 7
- **System image:** API 34 (Android 14), Google APIs, x86_64
- **RAM:** 2048 MB
- **Internal storage:** 4096 MB

Boot the emulator and wait for it to be fully ready (device online via `adb devices`, boot animation complete).

### 2. Build & Deploy

Execute the full build pipeline from the `mobile/` directory:

```
npm install
npm run build          # TypeScript check + Vite build → dist/
npx cap sync android   # Sync web assets to Android project
cd android && ./gradlew assembleDebug   # Build APK
```

Install the APK on the emulator:

```
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. YouTube Video Discovery

Before running test scenarios, Claude searches the web for **3 YouTube videos** that meet these criteria:

| Video | Purpose | Requirements |
|-------|---------|-------------|
| **Short video** | Fast tests, iteration | 2-5 minutes, English captions, educational/explainer topic |
| **Medium video** | Main happy path | 8-15 minutes, English captions, tech/science topic suitable for summarization |
| **No-captions video** | Error path testing | Any length, must NOT have English captions (e.g., raw music video, foreign language without CC) |

Claude verifies each video URL is valid using `isValidYouTubeUrl` logic (standard youtube.com/watch?v= or youtu.be/ format).

---

## Execution Guidelines

### Assertions: Combined Approach

Every test step uses **two assertion mechanisms**:

1. **Accessibility tree (primary):** After each action, read the accessibility tree via `mobile_list_elements_on_screen` to verify elements exist, text content matches, and state transitions occurred. This is the source of truth for pass/fail.

2. **Screenshots (secondary):** Take screenshots at key visual checkpoints — not after every step. Screenshots verify layout, styling, and visual states that the accessibility tree cannot capture.

### Streaming Wait Strategy

When summarization is streaming (10-60+ seconds):

1. Poll the accessibility tree every **5-8 seconds**
2. Track summary text node length — it should be growing
3. Take **one screenshot mid-stream** (when content > 100 chars and stop button is visible)
4. Take **one screenshot at completion** (when FAB appears)
5. Timeout after **120 seconds** — if streaming hasn't completed, log as failure

### Interaction Patterns

- **Text input:** Tap the input field first (to focus), then use `mobile_type_keys`
- **Select elements:** The app uses native `<select>` dropdowns rendered in WebView — these may appear as spinners in the accessibility tree
- **Scrolling:** Use `mobile_swipe_on_screen` for vertical scroll when content extends beyond viewport
- **Navigation:** Back buttons have `aria-label="Back"`, settings button has `aria-label="Settings"`
- **Waiting for transitions:** After navigation, wait 500ms then read the accessibility tree to confirm the new screen loaded

### Progress Reporting

Before each scenario, Claude must output a progress line to the user:

```
[X/30] Running T-XX: <scenario name> (Y passed, Z failed, W remaining)
```

Example:
```
[6/30] Running T-06: Summarize a video with default prompt (5 passed, 0 failed, 25 remaining)
```

After each scenario completes, Claude outputs the result:

```
[6/30] T-06: PASS (32s)
```
or
```
[6/30] T-06: FAIL — <brief reason> (12s)
```

### State Management

Tests run in the order defined below. State carries forward:

- **T-01 through T-05** (Build & API Key Management) set up the emulator, app, and API key
- **T-06+** assumes the API key is configured
- If a test needs a specific prompt or setting, it configures it and can leave it for subsequent tests
- The app is **not reinstalled** between scenarios — only restarted if needed

---

## Test Scenarios

### Feature: App Build & Deploy

```gherkin
Scenario T-01: Build app from source and install on emulator
  Given the Android emulator is booted and online
  When Claude runs the full build pipeline (npm install → build → cap sync → gradle assembleDebug)
  Then the build completes without errors
    And the APK is generated at the expected output path
  When Claude installs the APK on the emulator
    And launches the app via mobile_launch_app
  Then the app opens to the main screen
    And the header shows "Magpie" with a settings gear icon
    # Screenshot: initial app state after first launch
```

---

### Feature: API Key Management

```gherkin
Scenario T-02: Reject invalid API key format
  Given the app is on the main screen after fresh install
  When the user navigates to Settings
    # Tap the gear icon (aria-label="Settings")
    And enters "invalid-key-without-prefix" in the API key field
    And taps the Test button
  Then an error message indicates the key format is invalid
    # Key must start with "sk-or-"
    And the Save button remains disabled

Scenario T-03: Reject invalid API key on server validation
  Given the user is on the Settings screen
  When the user enters a properly formatted but invalid key (e.g., "sk-or-fake-invalid-key-12345")
    And taps the Test button
  Then the app shows a testing/validating state briefly
    And an error message indicates the key is invalid
    And the Save button remains disabled

Scenario T-04: Save valid API key
  Given the user is on the Settings screen
  When the user clears the API key field
    And enters the real OpenRouter API key provided by the user
    And taps the Test button
  Then the app shows a testing/validating state
    And a success indicator appears (test passed)
    And the Save button becomes enabled
  When the user taps Save
  Then a "Saved" confirmation appears briefly
    # Screenshot: Settings screen with saved key confirmation

Scenario T-05: API key persists across app restart
  Given the API key was saved in the previous scenario
  When Claude force-stops the app
    And relaunches it
    And navigates to Settings
  Then the API key field shows a masked value (sk-or-****)
    And the key is not empty
```

---

### Feature: Summarization - Happy Paths

```gherkin
Scenario T-06: Summarize a video with default prompt (Quick Summary)
  Given the app is on the main screen with API key configured
    And the default prompt "Quick Summary" is selected
  When Claude pastes the medium-length YouTube video URL into the URL field
    And taps the Summarize button
  Then the loading indicator appears with "Fetching transcript..."
    # Accessibility tree: text node containing "Fetching transcript"
  Then the loading text changes to "Generating summary..."
    And the streaming phase begins — summary text starts appearing
    # Poll accessibility tree every 5-8s: summary text length should increase
    # Screenshot mid-stream: verify blinking cursor, stop bar at bottom
  Then streaming completes — the stop bar disappears
    And the summary contains meaningful markdown content (headings, paragraphs, or lists)
    And the SpeedDialFAB appears in the bottom-right corner
    # Screenshot: completed summary with FAB visible

Scenario T-07: Summarize with TLDR prompt
  Given the app is on the main screen with a completed summary visible
  When the user changes the prompt selector to "TLDR"
    # Note: prompt selector is a <select> element
    And pastes the short YouTube video URL
    And taps Summarize
  Then the summarization flow completes successfully
    And the summary is noticeably shorter than the Quick Summary result
    # TLDR responses are typically 2-5 sentences
    And the SpeedDialFAB appears

Scenario T-08: Summarize with Study Notes prompt
  Given the app is on the main screen
  When the user changes the prompt selector to "Study Notes"
    And pastes the medium-length YouTube video URL
    And taps Summarize
  Then the summarization flow completes successfully
    And the summary contains structured content (bullet points, numbered lists, or headings)
    # Study Notes prompt produces organized, structured output
    And the SpeedDialFAB appears
    # Screenshot: study notes style summary for visual verification
```

---

### Feature: Summarization - Error Handling

```gherkin
Scenario T-09: Invalid YouTube URL shows error
  Given the app is on the main screen with API key configured
  When the user clears the URL field
    And types "https://www.example.com/not-a-video"
    And taps Summarize
  Then an error banner appears with a message about invalid YouTube URL
    # Expected: "Please enter a valid YouTube video URL"
    And the app remains on the main screen (no crash, no loading state)

Scenario T-10: Video without captions shows error
  Given the app is on the main screen
  When the user pastes the no-captions YouTube video URL
    And taps Summarize
  Then the loading indicator appears with "Fetching transcript..."
    And after the transcript fetch fails, an error banner appears
    # Expected: "No transcript available for this video"
    And a Retry button is visible in the error banner

Scenario T-11: Empty URL field shows error
  Given the app is on the main screen
    And the URL field is empty
  When the user taps Summarize
  Then an error message appears about invalid or empty URL
    And no loading indicator is shown

Scenario T-12: Summarization without API key configured
  Given the app has been force-stopped
    And app data is cleared (adb shell pm clear com.magpie.app)
    And the app is relaunched
  When the user pastes a valid YouTube URL
    And taps Summarize
  Then an error banner appears indicating the API key is not configured
    And a "Go to Settings" link is visible
  When the user taps "Go to Settings"
  Then the app navigates to the Settings screen
    # After this scenario, re-enter and save the API key to restore state for subsequent tests
```

---

### Feature: Summarization - User Controls

```gherkin
Scenario T-13: User stops summarization mid-stream
  Given the app is on the main screen with API key configured
  When the user pastes the medium-length YouTube video URL
    And taps Summarize
    And waits for the streaming phase to begin with visible content
    # Poll accessibility tree: wait until summary text > 100 chars AND stop button visible
  When the user taps the Stop button
    # Note: Stop bar is fixed to the bottom of the screen during streaming
  Then streaming stops immediately
    And the partial summary is displayed
    And the summary ends with "Summary stopped by user" text
    And the SpeedDialFAB becomes available (state transitions to done)
    # Screenshot: stopped summary with footer text visible

Scenario T-14: Start new summarization after completed one
  Given a summary has been completed or stopped on the main screen
  When the user clears the URL field
    And pastes a different YouTube video URL (the short video)
    And taps Summarize
  Then the previous summary is cleared
    And the new summarization begins fresh
    And the new summary completes successfully
```

---

### Feature: Share & Copy Summary

```gherkin
Scenario T-15: Copy summary to clipboard via FAB
  Given a summarization has completed successfully
    And the SpeedDialFAB is visible in the bottom-right
  When the user taps the main FAB button
    # Note: FAB expands to show Share and Copy options with a backdrop
  Then two action buttons appear (Share and Copy)
    And a semi-transparent backdrop covers the screen
  When the user taps the Copy button
    # aria-label="Copy summary"
  Then a checkmark icon appears on the Copy button (green, briefly)
    And the summary text is copied to the device clipboard
    # Verify via: adb shell am broadcast -a clipdog.copy and check content,
    # or read clipboard via accessibility tools
    # Screenshot: FAB open with copy confirmation

Scenario T-16: Share summary opens system share sheet
  Given a summarization has completed successfully
    And the SpeedDialFAB is visible
  When the user taps the main FAB button
    And taps the Share button
    # aria-label="Share summary"
  Then the Android system share sheet appears
    # The share sheet is a system UI overlay — detectable via screenshot or
    # accessibility tree showing share sheet elements outside the app's WebView
    # Screenshot: system share sheet visible
  When the user dismisses the share sheet
    # Tap outside or press back
  Then the app returns to the main screen with the summary intact

Scenario T-17: Dismiss FAB by tapping backdrop
  Given a summarization has completed and the FAB is visible
  When the user taps the main FAB button
    And the FAB menu is expanded with backdrop visible
  When the user taps the backdrop area
  Then the FAB menu closes
    And the backdrop disappears
    And the summary remains visible
```

---

### Feature: Manage Prompts

```gherkin
Scenario T-18: Navigate to Manage Prompts screen
  Given the app is on the main screen
  When the user navigates to Settings
    And taps the "Manage Prompts" section
  Then the Manage Prompts screen loads
    And a list of prompts is visible (at minimum the built-in prompts)
    And an "Add" button is visible in the header
    # Screenshot: Manage Prompts screen with prompt list

Scenario T-19: Create a custom prompt
  Given the user is on the Manage Prompts screen
  When the user taps the Add button
  Then a new prompt entry appears in expanded/editing state
    And the name field is focused and empty
  When the user types "Test E2E Prompt" in the name field
    And enters "Summarize this in exactly 3 bullet points: {{transcript}}" in the text field
  Then the Save button becomes enabled
  When the user taps Save
  Then the prompt is saved and visible in the list with name "Test E2E Prompt"

Scenario T-20: Edit a custom prompt
  Given the "Test E2E Prompt" exists in the prompt list
  When the user taps on "Test E2E Prompt" to expand it
    And changes the name to "Test E2E Prompt (Edited)"
    And taps Save
  Then the prompt name updates in the list to "Test E2E Prompt (Edited)"

Scenario T-21: Duplicate a prompt
  Given the "Test E2E Prompt (Edited)" exists in the prompt list
  When the user expands the prompt
    And taps the Duplicate button
  Then a new prompt appears named "Copy of Test E2E Prompt (Edited)"
    And it has the same prompt text as the original

Scenario T-22: Set a prompt as default
  Given the "Test E2E Prompt (Edited)" exists in the prompt list
  When the user expands the prompt
    And taps "Set Default"
  Then the prompt shows a "Default" badge
    And the previously default prompt no longer has the "Default" badge

Scenario T-23: Validate prompt text requires {{transcript}} placeholder
  Given the user is on the Manage Prompts screen
  When the user creates or edits a prompt
    And enters text that does NOT contain "{{transcript}}"
  Then a validation error appears indicating the placeholder is required
    And the Save button is disabled

Scenario T-24: Delete a custom prompt with confirmation
  Given the "Copy of Test E2E Prompt (Edited)" exists
  When the user expands it and taps Delete
  Then a confirmation dialog appears asking "Delete Prompt?"
    # Note: ConfirmDialog with destructive red confirm button
  When the user taps Confirm
  Then the prompt is removed from the list
    And it no longer appears in the prompt selector on the main screen

Scenario T-25: System prompt cannot be deleted
  Given the user is on the Manage Prompts screen
  When the user expands the "Quick Summary" system prompt
  Then no Delete button is visible for this prompt
    And the name and text fields are disabled/read-only
    # System prompts (isSystem=true) cannot be edited or deleted

Scenario T-26: Restore default prompt after test
  Given the "Test E2E Prompt (Edited)" was set as default during testing
  When the user expands "Quick Summary"
    And taps "Set Default"
  Then "Quick Summary" regains the "Default" badge
    # Restores state for subsequent tests
```

---

### Feature: Manage Favorite Models

```gherkin
Scenario T-27: Navigate to Manage Favorite Models screen
  Given the user is on the Settings screen
  When the user taps the "Manage Favorite Models" section
  Then the Manage Favorite Models screen loads
    And a search input is visible at the top
    And a model list is displayed with names and pricing info
    And some models are pinned at the top as favorites (filled star icon)
    # Screenshot: Favorite Models screen with model list loaded

Scenario T-28: Search filters the model list
  Given the user is on the Manage Favorite Models screen
    And the full model list is visible
  When the user types a model name fragment (e.g., "gpt") in the search field
  Then the list filters to show only models matching the search query
    And non-matching models are hidden
  When the user clears the search field
  Then the full model list is restored

Scenario T-29: Toggle favorite status on a model
  Given the user is on the Manage Favorite Models screen
  When the user scrolls to find a non-favorited model
    And taps the star icon to add it as a favorite
    # aria-label="Add {model} to favorites"
  Then the star icon becomes filled (favorited)
    And the model appears in the pinned favorites section at the top
  When the user taps the filled star icon to remove it from favorites
    # aria-label="Remove {model} from favorites"
  Then the star icon becomes unfilled
    And the model is removed from the pinned favorites section

Scenario T-30: Free model filter
  Given the user is on the Manage Favorite Models screen
  When the user taps the Free filter toggle
  Then the toggle highlights (green)
    And only models with "Free" pricing are shown
    And all visible models show "Free" in their pricing display
  When the user taps the Free filter again
  Then the filter is deactivated
    And all models (free and paid) are visible again
```

---

## Failure Handling

When a test scenario fails:

1. **Capture evidence:**
   - Take a screenshot of the current screen state
   - Read the full accessibility tree via `mobile_list_elements_on_screen`
   - Note the specific assertion that failed

2. **Log the failure** in the test report with:
   - Scenario name
   - Step that failed
   - Expected vs actual result
   - Screenshot file path
   - Accessibility tree excerpt (relevant elements only)

3. **Continue to the next scenario.** Do not halt the entire test run.

4. **State recovery:** If the failure leaves the app in a broken state (crashed, stuck on wrong screen):
   - Force-stop and relaunch the app: `adb shell am force-stop com.magpie.app` then `mobile_launch_app`
   - If the test that failed was in the API key setup group, re-enter the API key before continuing

---

## Test Report Format

After all scenarios have been executed, Claude generates a Markdown report saved to `docs/e2e-report-YYYY-MM-DD.md`:

```markdown
# E2E Test Report — YYYY-MM-DD HH:MM

## Summary
- **Total scenarios:** X
- **Passed:** X
- **Failed:** X
- **Duration:** X minutes

## Environment
- Emulator: [device name, API level]
- App version: [git commit hash]
- Build type: debug

## YouTube Videos Used
| Label | URL | Length | Captions |
|-------|-----|--------|----------|
| Short | ... | ~Xm | Yes |
| Medium | ... | ~Xm | Yes |
| No captions | ... | ~Xm | No |

## Results

| # | Scenario | Status | Duration | Notes |
|---|----------|--------|----------|-------|
| T-01 | Build app from source | PASS | 45s | |
| T-02 | Reject invalid API key format | PASS | 8s | |
| T-03 | ... | FAIL | 12s | See details below |

## Failures

### T-03: [Scenario Name]
- **Failed at step:** [Which Given/When/Then step]
- **Expected:** [What should have happened]
- **Actual:** [What actually happened]
- **Screenshot:** [relative path to screenshot file]
- **Accessibility tree excerpt:**
  ```
  [relevant elements]
  ```

## Screenshots
All screenshots are saved to `docs/e2e-screenshots/` with naming convention:
`T-{number}-{description}.png` (e.g., `T-01-initial-launch.png`, `T-06-summary-complete.png`)
```

---

## Notes for Claude

- **Timing:** WebView content may take 200-500ms to update after interactions. Always pause briefly and re-read the accessibility tree rather than assuming instant state changes.
- **WebView accessibility:** The app runs in a Capacitor WebView. Accessibility tree elements may be nested under a WebView container. Look for text content and aria-labels within the WebView subtree.
- **Select dropdowns:** The prompt and model selectors are `<select>` HTML elements. In the Android WebView, tapping them opens a native Android spinner/picker. Interact with the picker options through the accessibility tree.
- **Keyboard dismissal:** After typing in text fields, the soft keyboard may cover lower UI elements. Tap outside the input or press back to dismiss the keyboard before interacting with buttons below.
- **Dynamic content:** Model lists and YouTube search results are dynamic. Assertions should check for the presence of elements and general patterns, not exact text matches (except for known values like prompt names).
- **Token budget:** Be economical with screenshots. The runbook specifies approximately 8-10 screenshots across all scenarios. Use the accessibility tree for all other assertions.
