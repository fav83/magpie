# Mobile App E2E Test Runbook — Android

> **Platform:** Android only (emulator via ADB)
> **Executor:** Claude Code with direct ADB commands
> **App:** Magpie (Capacitor 6+ / React / Android)
> **Approach:** Goal-oriented with relaxed Gherkin scenarios

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Phase](#setup-phase)
4. [ADB Toolkit](#adb-toolkit)
5. [Execution Guidelines](#execution-guidelines)
6. [Test Scenarios](#test-scenarios)
   - [Feature: App Build & Deploy](#feature-app-build--deploy)
   - [Feature: API Key Management](#feature-api-key-management)
   - [Feature: Settings - Font Size](#feature-settings---font-size)
   - [Feature: Summarization - Happy Paths](#feature-summarization---happy-paths)
   - [Feature: Summarization - Error Handling](#feature-summarization---error-handling)
   - [Feature: Summarization - User Controls](#feature-summarization---user-controls)
   - [Feature: Summarization - Model Override](#feature-summarization---model-override)
   - [Feature: Share Menu](#feature-share-menu)
   - [Feature: Chat with Video](#feature-chat-with-video)
   - [Feature: Manage Prompts](#feature-manage-prompts)
   - [Feature: Manage Favorite Models](#feature-manage-favorite-models)
7. [Failure Handling](#failure-handling)
8. [Test Report Format](#test-report-format)

---

## Overview

This runbook defines end-to-end test scenarios for the Magpie mobile app on Android. Claude Code executes these tests using direct ADB commands against an Android emulator — taking screenshots, dumping the UI tree, tapping elements, typing text, and managing app lifecycle.

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
- Python 3 (for UI tree parsing helper)
- Project source code at the working directory root

### Environment Paths (from successful run)

```
ADB:        $HOME/Library/Android/sdk/platform-tools/adb
JAVA_HOME:  /Applications/Android Studio.app/Contents/jbr/Contents/Home
Emulator:   emulator-5554 (API 36, Medium_Phone AVD)
Package:    com.magpie.app
Activity:   com.magpie.app/.MainActivity
```

---

## Setup Phase

### 1. Emulator Provisioning

Check for existing AVDs. If none are available, create one:

- **Device profile:** Pixel 7
- **System image:** API 34 (Android 14), Google APIs, x86_64
- **RAM:** 2048 MB
- **Internal storage:** 4096 MB

Boot the emulator and wait for it to be fully ready (device online via `adb devices`, boot animation complete).

Mute all audio streams so ADB interactions don't produce sound:

```bash
# Streams: 1=system, 2=ring, 3=music, 4=alarm, 5=notification
for stream in 1 2 3 5; do
  adb shell cmd media_session volume --set 0 --stream $stream
done
adb shell cmd media_session volume --set 1 --stream 4  # alarm min is 1
```

### 2. Build & Deploy

**The app MUST be built from source on every test run.** Claude must never skip the build or fall back to a previously built APK. The build is the first gate — if the code doesn't compile, tests cannot run.

Execute the full build pipeline from the `mobile/` directory:

```
npm install
npm run build          # TypeScript check + Vite build → dist/
npx cap sync android   # Sync web assets to Android project
cd android && ./gradlew assembleDebug   # Build APK
```

**If any step in the build pipeline fails, Claude must STOP the entire test run immediately.** Do not attempt to:
- Use an existing APK from a previous build
- Skip the failing step and continue
- Fix the build error and retry

Instead, Claude must:
1. Report the build failure to the user with the full error output
2. Generate an abbreviated test report marking T-01 as FAIL (build error) and all remaining scenarios as SKIPPED
3. End the test run

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

### 4. Pre-run Checklist

Before starting the test run:

- [ ] Emulator is booted and responsive (`adb devices` shows it)
- [ ] Java and Android SDK paths are verified
- [ ] API key is ready (not hardcoded in runbook)
- [ ] `npm install` in both root and `mobile/` directories
- [ ] No stale app data (consider `pm clear` before T-01)
- [ ] Emulator audio muted (all streams set to 0)
- [ ] 3 YouTube test videos found and verified (captions confirmed)

---

## ADB Toolkit

All interaction with the emulator uses direct ADB commands. Define the ADB path variable at the start of the session:

```bash
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
```

### Core Commands

```bash
# UI tree dump + Python parse
$ADB shell "uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml" | parse_ui

# Tap element at coordinates
$ADB shell input tap X Y

# Type text (use %s for spaces, avoid parentheses and braces)
$ADB shell input text "word1%sword2"

# Dismiss keyboard
$ADB shell input keyevent 4

# Screenshot
$ADB exec-out screencap -p > /tmp/screenshot.png

# Scroll (swipe up to scroll down)
$ADB shell input swipe 540 1500 540 500 300

# Force stop + relaunch
$ADB shell am force-stop com.magpie.app
$ADB shell am start -n com.magpie.app/.MainActivity

# Clear app data
$ADB shell pm clear com.magpie.app
```

### Reusable UI Parser Helper

Define a `parse_ui` shell function at the start of the session. It should:

1. Pipe output from `$ADB shell "uiautomator dump /sdcard/ui.xml && cat /sdcard/ui.xml"` into a Python script
2. Find the XML start (`<?xml` or `<hierarchy`), parse it with `xml.etree.ElementTree`
3. For each node with `text`, `content-desc`, or `hint`: print the class name, bounds, and those attributes. Mark disabled elements.
4. Handle errors gracefully — if no XML is found or parsing fails, print a clear error message instead of silently returning nothing

### Reusable Streaming Wait Loop

Define a `wait_for_done` shell function that polls the UI tree every 3 seconds to detect when summarization streaming has completed:

- **Done signal:** The "Summarize" button reappears in the UI tree
- **Still streaming:** A "Stop" or "Stop generating" button is present
- **Timeout:** 120 seconds (40 polls) — log as failure
- **Error recovery:** Track consecutive empty or failed poll results. After 5 in a row, take a diagnostic screenshot and fail immediately instead of spinning for the full timeout

### Field Clearing Patterns

Triple-tap select-all is unreliable. `keyevent 29` (Ctrl+A) doesn't work in WebView. Use one of these:

**Pattern A (preferred): Triple-tap + delete**
```bash
$ADB shell input tap X Y && sleep 0.05
$ADB shell input tap X Y && sleep 0.05
$ADB shell input tap X Y && sleep 0.3
$ADB shell input keyevent 67
```

**Pattern B (brute force, always works): Move to end + 120 backspaces**
```bash
$ADB shell input keyevent 123  # Move to end
for i in $(seq 1 120); do $ADB shell input keyevent 67; done
```

### Known ADB Text Input Limitations

- **Spaces:** Use `%s` (e.g., `input text "hello%sworld"`)
- **Parentheses:** `()` cause shell syntax errors — avoid in test data or use single-quoted wrapper: `$ADB shell 'input text "word1%s\(word2\)"'` (but backslashes get included in text)
- **Curly braces:** `{{transcript}}` doesn't pass through cleanly — when testing prompt text validation, type text WITHOUT braces and verify the error, then restore via simpler text
- **Auto-capitalize:** WebView input fields auto-capitalize the first character. HTTP scheme is case-insensitive so this doesn't break URLs, but note it for assertions
- **Always dismiss keyboard** with `keyevent 4` (BACK) before tapping buttons below the input area

### UI Automator WebView Limitations

What `uiautomator dump` can and cannot see:

**Works well:**
- Text content in WebView elements (buttons, text, inputs)
- Input field values and hints
- Element bounds (for tap targeting)
- Enabled/disabled states

**Does NOT work:**
- CSS modal overlays (ConfirmDialog) — invisible to UI dump, visible only in screenshots
- Elements scrolled above the WebView viewport report at `y=63` with zero height
- Checkmark/tick feedback animations (too brief to capture)

**Implication:** For ConfirmDialog assertions (T-33, T-42), use screenshots to verify the dialog appeared, then tap at known coordinates for the confirm/cancel buttons. From our run, dialog buttons are typically around:
- Cancel: `~(666, 1332)`
- Confirm/Delete: `~(882, 1332)`

### Known Tap Coordinates

These are approximate and depend on font size being 100%:

| Element | Coordinates |
|---------|------------|
| Settings gear | `(1004, 132)` |
| Back button | `(70, 133)` |
| URL field | `(542, 292)` |
| Summarize button | `(542, 547)` |
| Prompt selector | `(287, 420)` |
| Model selector | `(795, 420)` |
| Share options | `(900, 128)` |

---

## Execution Guidelines

### Assertions: Combined Approach

Every test step uses **two assertion mechanisms**:

1. **UI tree dump (primary):** After each action, dump and parse the UI tree via `$ADB shell "uiautomator dump ..."  | parse_ui` to verify elements exist, text content matches, and state transitions occurred. This is the source of truth for pass/fail.

2. **Screenshots (secondary):** Take screenshots at key visual checkpoints — not after every step. Screenshots verify layout, styling, and visual states that the UI tree cannot capture (including ConfirmDialog overlays).

### Streaming Wait Strategy

When summarization or chat is streaming (10-60+ seconds):

1. Use the `wait_for_done` helper (polls UI tree every **3 seconds**) or poll manually
2. Track text content length — it should be growing
3. Take **one screenshot mid-stream** (when content > 100 chars and stop button is visible)
4. Take **one screenshot at completion** (when the share menu icon appears in the header)
5. Timeout after **120 seconds** — if streaming hasn't completed, log as failure

> **Note on T-31 (stop chat mid-stream):** Fast models like GPT-4o-mini complete in <500ms, too fast to test stop functionality. Use Study Notes prompt (generates 3-5x more content), override to a slower model (e.g., Claude 3.5 Haiku), or mark as **best-effort** since chat stop is architecturally identical to summary stop (verified in T-16).

### Interaction Patterns

- **Text input:** Tap the input field first (to focus), then use `$ADB shell input text "..."`
- **Select elements:** The app uses native `<select>` dropdowns rendered in WebView — these may appear as spinners in the UI tree
- **Scrolling:** Use `$ADB shell input swipe 540 1500 540 500 300` for vertical scroll when content extends beyond viewport
- **Navigation:** Back buttons have `aria-label="Back"`, settings button has `aria-label="Settings"`
- **Waiting for transitions:** After navigation, wait 500ms then dump the UI tree to confirm the new screen loaded
- **Chat testing:** Keep chat questions short and specific (e.g., "Main topic?" or "What is time?"). Avoid asking for long-form content like essays, as the responses can push the chat header Copy all/Clear buttons beyond scrollable reach.

### Never Pause or Wait for User Input

**Claude must never stop and wait for user acknowledgement during the test run.** After taking a screenshot, dumping the UI tree, or completing any assertion, Claude must immediately continue to the next step. Specifically:

- After reading/viewing a screenshot: **continue immediately** — do not pause to "show" or "present" the screenshot to the user
- After completing a test scenario: **continue immediately** to the next scenario
- After any tool call returns: **continue immediately** with the next action
- After outputting a progress line: **continue immediately** — do not wait for user response

The only valid reasons to stop are:
1. The build fails (per the Build & Deploy rules above)
2. All 48 scenarios have been completed
3. A critical failure makes the emulator/app completely unusable (crash loop, emulator offline)

If Claude finds itself about to pause and wait, it should instead proceed with the next step.

### No Bug Fixing During Test Runs

**Claude must NEVER fix bugs found during a test run.** If a test fails because of a bug in the app code (e.g., a disabled handler, broken component, missing implementation), Claude must:

1. Mark the test as **FAIL** with diagnostic details (what was expected, what was found)
2. Capture a screenshot and UI tree dump as evidence
3. Continue to the next scenario

Claude must NOT:
- Edit source code to fix the bug
- Rebuild or redeploy the app mid-run
- Work around broken functionality to force a pass
- Restore gutted/disabled implementations

The purpose of E2E testing is to **detect** bugs, not fix them. Bugs found during a test run should be documented in the test report's Failures section so they can be addressed separately after the run completes.

### Progress Reporting

Before each scenario, Claude must output a progress line to the user:

```
[X/48] Running T-XX: <scenario name> (Y passed, Z failed, W remaining)
```

Example:
```
[8/48] Running T-06: Summarize a video with default prompt (5 passed, 0 failed, 25 remaining)
```

After each scenario completes, Claude outputs the result:

```
[8/48] T-06: PASS (32s)
```
or
```
[8/48] T-06: FAIL — <brief reason> (12s)
```

### State Management

Tests run in the order defined below. State carries forward:

- **T-01 through T-05** (Build & API Key Management) set up the emulator, app, and API key
- **T-06 through T-08** (Font Size) test settings — these run while already on the Settings screen
- **T-09+** assumes the API key is configured
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
    And launches the app via `$ADB shell am start -n com.magpie.app/.MainActivity`
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

### Feature: Settings - Font Size

```gherkin
Scenario T-06: Adjust font size via slider
  Given the user is on the Settings screen
  When the user locates the "Font Size" section
    # Contains a range slider (50%-200%), current percentage label, and conditional Reset link
  Then the current font size displays as "100%"
  When the user drags the slider to increase the font size (e.g., to 150%)
  Then the percentage label updates to reflect the new value
    And the app text visibly grows larger
    # Screenshot: Settings screen with enlarged font size

Scenario T-07: Font size persists across app restart
  Given the font size was changed to a non-default value in the previous scenario
  When Claude force-stops the app
    And relaunches it
    And navigates to Settings
  Then the font size slider shows the previously set value (not 100%)
    And the app text is still at the adjusted size

Scenario T-08: Reset font size to default
  Given the font size is set to a non-default value
    And a "Reset" link is visible next to the font size section
  When the user taps the "Reset" link
  Then the font size returns to 100%
    And the "Reset" link disappears
    And the app text returns to normal size
```

---

### Feature: Summarization - Happy Paths

```gherkin
Scenario T-09: Summarize a video with default prompt (Quick Summary)
  Given the app is on the main screen with API key configured
    And the default prompt "Quick Summary" is selected
  When Claude pastes the medium-length YouTube video URL into the URL field
    And taps the Summarize button
  Then the loading indicator appears with "Fetching transcript..."
    # Accessibility tree: text node containing "Fetching transcript"
  Then the loading text changes to "Generating summary..."
    And the streaming phase begins — summary text starts appearing
    # Poll UI tree every 3s (use wait_for_done helper): summary text length should increase
    # Screenshot mid-stream: verify blinking cursor, stop bar at bottom
  Then streaming completes — the stop bar disappears
    And the summary contains meaningful markdown content (headings, paragraphs, or lists)
    And the share menu icon appears in the header
    And the "Chat about this video" section appears below the summary
    # Screenshot: completed summary with share menu and chat section visible

Scenario T-10: Summarize with TLDR prompt
  Given the app is on the main screen with a completed summary visible
  When the user changes the prompt selector to "TLDR"
    # Note: prompt selector is a <select> element
    And pastes the short YouTube video URL
    And taps Summarize
  Then the summarization flow completes successfully
    And the summary is noticeably shorter than the Quick Summary result
    # TLDR responses are typically 2-5 sentences
    And the share menu icon appears in the header

Scenario T-11: Summarize with Study Notes prompt
  Given the app is on the main screen
  When the user changes the prompt selector to "Study Notes"
    And pastes the medium-length YouTube video URL
    And taps Summarize
  Then the summarization flow completes successfully
    And the summary contains structured content (bullet points, numbered lists, or headings)
    # Study Notes prompt produces organized, structured output
    And the share menu icon appears in the header
    # Screenshot: study notes style summary for visual verification
```

---

### Feature: Summarization - Error Handling

```gherkin
Scenario T-12: Invalid YouTube URL shows error
  Given the app is on the main screen with API key configured
  When the user clears the URL field
    And types "https://www.example.com/not-a-video"
    And taps Summarize
  Then an error banner appears with a message about invalid YouTube URL
    # Expected: "Please enter a valid YouTube video URL"
    And the app remains on the main screen (no crash, no loading state)

Scenario T-13: Video without captions shows error
  Given the app is on the main screen
  When the user pastes the no-captions YouTube video URL
    And taps Summarize
  Then the loading indicator appears with "Fetching transcript..."
    And after the transcript fetch fails, an error banner appears
    # Expected: "No transcript available for this video"
    And a Retry button is visible in the error banner

Scenario T-14: Empty URL field shows error
  Given the app is on the main screen
    And the URL field is empty
  When the user taps Summarize
  Then an error message appears about invalid or empty URL
    And no loading indicator is shown

Scenario T-15: Summarization without API key configured
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
Scenario T-16: User stops summarization mid-stream
  Given the app is on the main screen with API key configured
  When the user pastes the medium-length YouTube video URL
    And taps Summarize
    And waits for the streaming phase to begin with visible content
    # Poll UI tree: wait until summary text > 100 chars AND stop button visible
  When the user taps the Stop button
    # Note: Stop bar is fixed to the bottom of the screen during streaming
  Then streaming stops immediately
    And the partial summary is displayed
    And the summary ends with "Summary stopped by user" text
    And the share menu icon becomes available in the header (state transitions to done)
    # Screenshot: stopped summary with footer text visible

Scenario T-17: Start new summarization after completed one
  Given a summary has been completed or stopped on the main screen
  When the user clears the URL field
    And pastes a different YouTube video URL (the short video)
    And taps Summarize
  Then the previous summary is cleared
    And the new summarization begins fresh
    And the new summary completes successfully

Scenario T-18: App resume does not re-trigger summarization for same URL
  Given a summary has been completed for a YouTube video
  When Claude simulates an app resume cycle
    # Force-stop and relaunch the app, or use adb to send a resume lifecycle event
  Then the app does not automatically restart summarization
    And the previous summary remains displayed (or the app returns to idle)
    # The share intent deduplication tracks the last processed URL
    # and ignores duplicate intents on resume
```

---

### Feature: Summarization - Model Override

```gherkin
Scenario T-19: Model selector shows only favorite models
  Given the app is on the main screen with API key configured
  When the user taps the model selector dropdown
    # Note: model selector is a <select> element rendered in WebView
  Then only favorite models are listed as options
    # The full list of 100+ OpenRouter models should NOT appear
    # Only models marked as favorites (via Manage Favorite Models) are shown
    And the currently effective model is included even if not a favorite

Scenario T-20: Override model independently from prompt
  Given the app is on the main screen with API key configured
    And a prompt is selected (e.g., "Quick Summary")
  When the user changes the model selector to a different model than the prompt's default
    # Note: model selector is a <select> showing only favorite models
  Then the model selector shows the newly selected model
  When the user pastes a YouTube URL and taps Summarize
  Then the summarization uses the overridden model (visible in the summary result)

Scenario T-21: Model override resets when prompt changes
  Given the user has overridden the model in the model selector
  When the user changes the prompt selector to a different prompt
  Then the model selector resets to the new prompt's default model
    And the override is cleared
```

---

### Feature: Share Menu

```gherkin
Scenario T-22: Copy summary via share menu
  Given a summarization has completed successfully
    And the share menu icon is visible in the header (next to the settings gear)
  When the user taps the share menu icon
  Then a dropdown menu appears with options: "Copy", "Share"
    # Note: "Share with Chat" only appears when chat messages exist
  When the user taps "Copy"
  Then the share icon briefly changes to a green checkmark
    And the summary text is copied to the device clipboard
    # Screenshot: share menu open or copy confirmation

Scenario T-23: Share summary opens system share sheet
  Given a summarization has completed successfully
  When the user taps the share menu icon
    And taps "Share"
  Then the Android system share sheet appears
    # Detectable via screenshot or UI tree showing share sheet overlay
    # Screenshot: system share sheet visible
  When the user dismisses the share sheet
    # Tap back or outside
  Then the app returns to the main screen with the summary intact

Scenario T-24: Dismiss share menu by tapping outside
  Given a summarization has completed and the share menu icon is visible
  When the user taps the share menu icon
    And the dropdown menu is open
  When the user taps outside the dropdown menu
  Then the menu closes
    And the summary remains visible

Scenario T-25: Share with chat includes conversation
  Given a summarization has completed
    And the user has sent at least one chat message and received a response
  When the user taps the share menu icon
  Then a "Share with Chat" option is visible in the dropdown
    # This option only appears when chat messages exist
  When the user taps "Share with Chat"
  Then the Android system share sheet appears
    And the shared content includes both the summary and the chat conversation
  When the user dismisses the share sheet
  Then the app returns to the main screen
```

---

### Feature: Chat with Video

```gherkin
Scenario T-26: Chat section not visible before summary completes
  Given the app is on the main screen in idle state (no summary generated)
  Then no "Chat about this video" section is visible
  When the user pastes a YouTube URL and taps Summarize
    And the loading indicator is showing ("Fetching transcript..." or "Generating summary...")
  Then no "Chat about this video" section is visible during loading/streaming
    # Chat section only appears when state === 'done' && summaryResult exists

Scenario T-27: Chat section appears after summary completes
  Given a summarization has completed successfully on the main screen
  Then a collapsible "Chat about this video" section is visible below the summary
    And a chevron icon indicates it can be expanded
    And no message count badge is shown (no messages yet)

Scenario T-28: Send a message and receive streaming response
  Given the "Chat about this video" section is visible
  When the user taps "Chat about this video" to expand the chat section
  Then a text input with placeholder "Ask about this video..." appears
    And a send button is visible
  When the user types "What are the main points discussed in this video?" in the chat input
    And taps the send button (or presses Enter)
  Then the user message appears as a blue bubble on the right side
    And an assistant response begins streaming with a blinking cursor
    # Poll UI tree: assistant message text should be growing
    # Use same streaming wait strategy as summarization
  Then the assistant response completes
    And the response is rendered as markdown in a gray bubble on the left side
    And the message count badge updates on the chat header
    # Screenshot: chat with one exchange (user question + assistant answer)

Scenario T-29: Chat input disabled during streaming
  Given the chat section is expanded
  When the user sends a message and the assistant is streaming a response
  Then the chat text input is disabled (cannot type new text)
    And the send button is disabled
    # Prevents sending overlapping messages while assistant is responding
  When the assistant response completes
  Then the chat text input becomes enabled again
    And the send button becomes enabled

Scenario T-30: Multi-turn conversation
  Given one chat exchange has already completed (from T-28)
  When the user types a follow-up question (e.g., "Can you explain the second point in more detail?")
    And taps the send button
  Then the follow-up appears as a new blue bubble
    And a new assistant response streams in
    And the conversation history is visible (all previous messages remain)
    And the message count badge updates to reflect the new count

Scenario T-31: Stop chat response mid-stream
  Given a chat response is currently streaming (blinking cursor visible)
    # Initiate a new question to trigger streaming, then stop it
  When the user taps the "Stop generating" button
    # Note: shared floating pill-shaped bar at the bottom, same as summary stop
  Then streaming stops immediately
    And the partial response is preserved with an "(incomplete)" indicator
    And the chat input becomes enabled again

Scenario T-32: Copy all chat messages
  Given the chat section has at least one complete exchange
  When the user locates the "Copy all" button in the chat header
    And taps "Copy all"
  Then the entire conversation is copied to the clipboard
    # Format: "You: .../Assistant: ..." for each exchange

Scenario T-33: Clear chat with confirmation
  Given the chat section has messages
  When the user taps the "Clear" button in the chat header
  Then a confirmation dialog appears
    # ConfirmDialog with destructive red confirm button
  When the user taps Confirm
  Then all chat messages are removed
    And the chat section shows the empty input state
    And the message count badge disappears

Scenario T-34: Tap to copy individual chat message
  Given the chat section has at least one assistant response
  When the user taps on an assistant message bubble
  Then a "Copied!" tooltip appears briefly
    And the individual message content is copied to the clipboard

Scenario T-35: Chat resets when new summarization starts
  Given a summary has been completed and the chat has messages
  When the user clears the URL field
    And pastes a different YouTube video URL
    And taps Summarize
  Then the chat section disappears during the new summarization
    And all previous chat messages are cleared
  When the new summary completes
  Then the chat section reappears with no messages
    And the message count badge is not shown
```

---

### Feature: Manage Prompts

```gherkin
Scenario T-36: Navigate to Manage Prompts screen
  Given the app is on the main screen
  When the user navigates to Settings
    And taps the "Manage Prompts" section
  Then the Manage Prompts screen loads
    And a list of prompts is visible (at minimum the built-in prompts)
    And an "Add" button is visible in the header
    # Screenshot: Manage Prompts screen with prompt list

Scenario T-37: Create a custom prompt
  Given the user is on the Manage Prompts screen
  When the user taps the Add button
  Then a new prompt entry appears in expanded/editing state
    And the name field is focused and empty
  When the user types "Test E2E Prompt" in the name field
    And enters "Summarize this in exactly 3 bullet points: {{transcript}}" in the text field
  Then the Save button becomes enabled
  When the user taps Save
  Then the prompt is saved and visible in the list with name "Test E2E Prompt"

Scenario T-38: Edit a custom prompt
  Given the "Test E2E Prompt" exists in the prompt list
  When the user taps on "Test E2E Prompt" to expand it
    And changes the name to "Test E2E Prompt (Edited)"
    And taps Save
  Then the prompt name updates in the list to "Test E2E Prompt (Edited)"

Scenario T-39: Duplicate a prompt
  Given the "Test E2E Prompt (Edited)" exists in the prompt list
  When the user expands the prompt
    And taps the Duplicate button
  Then a new prompt appears named "Copy of Test E2E Prompt (Edited)"
    And it has the same prompt text as the original

Scenario T-40: Set a prompt as default
  Given the "Test E2E Prompt (Edited)" exists in the prompt list
  When the user expands the prompt
    And taps "Set Default"
  Then the prompt shows a "Default" badge
    And the previously default prompt no longer has the "Default" badge

Scenario T-41: Validate prompt text requires {{transcript}} placeholder
  Given the user is on the Manage Prompts screen
  When the user creates or edits a prompt
    And enters text that does NOT contain "{{transcript}}"
  Then a validation error appears indicating the placeholder is required
    And the Save button is disabled

Scenario T-42: Delete a custom prompt with confirmation
  Given the "Copy of Test E2E Prompt (Edited)" exists
  When the user expands it and taps Delete
  Then a confirmation dialog appears asking "Delete Prompt?"
    # Note: ConfirmDialog with destructive red confirm button
  When the user taps Confirm
  Then the prompt is removed from the list
    And it no longer appears in the prompt selector on the main screen

Scenario T-43: System prompt cannot be deleted
  Given the user is on the Manage Prompts screen
  When the user expands the "Quick Summary" system prompt
  Then no Delete button is visible for this prompt
    And the name and text fields are disabled/read-only
    # System prompts (isSystem=true) cannot be edited or deleted

Scenario T-44: Restore default prompt after test
  Given the "Test E2E Prompt (Edited)" was set as default during testing
  When the user expands "Quick Summary"
    And taps "Set Default"
  Then "Quick Summary" regains the "Default" badge
    # Restores state for subsequent tests
```

---

### Feature: Manage Favorite Models

```gherkin
Scenario T-45: Navigate to Manage Favorite Models screen
  Given the user is on the Settings screen
  When the user taps the "Manage Favorite Models" section
  Then the Manage Favorite Models screen loads
    And a search input is visible at the top
    And a model list is displayed with names and pricing info
    And some models are pinned at the top as favorites (filled star icon)
    # Screenshot: Favorite Models screen with model list loaded

Scenario T-46: Search filters the model list
  Given the user is on the Manage Favorite Models screen
    And the full model list is visible
  When the user types a model name fragment (e.g., "gpt") in the search field
  Then the list filters to show only models matching the search query
    And non-matching models are hidden
  When the user clears the search field
  Then the full model list is restored

Scenario T-47: Toggle favorite status on a model
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

Scenario T-48: Free model filter
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

**Important: Never fix bugs during a test run.** See [No Bug Fixing During Test Runs](#no-bug-fixing-during-test-runs) in Execution Guidelines.

When a test scenario fails:

1. **Capture evidence:**
   - Take a screenshot of the current screen state
   - Dump the UI tree via `$ADB shell "uiautomator dump ..." | parse_ui`
   - Note the specific assertion that failed
   - If the failure is due to a code bug (e.g., broken handler, disabled feature), note the root cause

2. **Log the failure** in the test report with:
   - Scenario name
   - Step that failed
   - Expected vs actual result
   - Screenshot file path
   - Accessibility tree excerpt (relevant elements only)
   - Root cause if identifiable (e.g., "handleSend function was gutted in ChatInput.tsx")

3. **Continue to the next scenario.** Do not halt the entire test run. Do not fix the bug.

4. **State recovery:** If the failure leaves the app in a broken state (crashed, stuck on wrong screen):
   - Force-stop and relaunch the app: `$ADB shell am force-stop com.magpie.app && $ADB shell am start -n com.magpie.app/.MainActivity`
   - If the test that failed was in the API key setup group, re-enter the API key before continuing
   - If a bug makes multiple subsequent scenarios impossible (e.g., chat send is broken), mark all affected scenarios as FAIL with a note referencing the original failure, then skip to the next unaffected feature group

---

## Test Report Format

After all scenarios have been executed, Claude generates a **new** Markdown report saved to `docs/e2e-report-YYYY-MM-DD-HHMMSS.md` (with timestamp to avoid overwriting previous reports). Never update or overwrite an existing report — each run produces its own file:

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
- **UI tree excerpt:**
  ```
  [relevant elements]
  ```

## Screenshots
All screenshots are saved to `docs/e2e-screenshots/` with naming convention:
`T-{number}-{description}.png` (e.g., `T-01-initial-launch.png`, `T-06-summary-complete.png`)
```

---

## Notes for Claude

- **Timing:** WebView content may take 200-500ms to update after interactions. Always pause briefly and re-dump the UI tree rather than assuming instant state changes.
- **WebView UI tree:** The app runs in a Capacitor WebView. UI tree elements may be nested under a WebView container. Look for text content and aria-labels within the WebView subtree.
- **Select dropdowns:** The prompt and model selectors are `<select>` HTML elements. In the Android WebView, tapping them opens a native Android spinner/picker. Interact with the picker options through the UI tree.
- **Keyboard dismissal:** After typing in text fields, the soft keyboard may cover lower UI elements. Use `keyevent 4` (BACK) to dismiss the keyboard before interacting with buttons below.
- **Dynamic content:** Model lists and YouTube search results are dynamic. Assertions should check for the presence of elements and general patterns, not exact text matches (except for known values like prompt names).
- **Token budget:** Be economical with screenshots. The runbook specifies approximately 12-15 screenshots across all 48 scenarios. Use the UI tree dump for all other assertions.
- **Inline Python:** Never use `python3 -c "..."` — always use heredoc (`python3 << 'PYEOF'`). Double-quoted inline Python causes shell escaping bugs where operators like `!=` get mangled into `\!=`, producing silent `SyntaxError` on every poll iteration.
- **Polling robustness:** All polling loops must fail fast on repeated errors. If 5 consecutive polls return empty or error results, take a diagnostic screenshot and abort — never spin the full loop on broken output.
- **Chat streaming:** See [Chat Response Polling](#chat-response-polling) below for the correct polling strategy. Do NOT reuse `wait_for_done` directly — chat completion signals differ from summarization.

### Chat Response Polling

The chat feature uses the same SSE streaming infrastructure as summarization, but the **completion signal is different**. The `wait_for_done` helper looks for the "Summarize" button to reappear, which doesn't apply to chat.

**Do NOT** check whether the Send button is enabled as a completion signal. The Send button is disabled whenever the text input is empty, regardless of whether streaming is in progress. This causes false negatives (polling sees "disabled" and keeps waiting even though the response is already complete).

**Correct approach:** Poll the UI tree every 3 seconds and check for these signals:

- **Streaming in progress:** "Stop" or "Stop generating" button is present in the UI tree
- **Response complete:** Stop button is gone AND new substantial text content (>50 chars) is present in the chat area
- **Timeout:** 120 seconds — log as failure
- **ConfirmDialogs:** CSS modal overlays are invisible to `uiautomator dump`. Use screenshots to verify they appeared, then tap at known coordinates (Cancel: ~666,1332 / Confirm: ~882,1332).

Chat polling must apply the same error recovery as `wait_for_done` — fail fast after 5 consecutive empty/error polls with a diagnostic screenshot.
