# Voxa

A Chrome extension that reads web pages aloud. Hover over a paragraph and press play, or select text and click the tab on the right edge. Voxa detects the language automatically and picks a matching voice, so German text is read in German and English text in English.

## Features

- **Hover to read:** a play button appears beside any paragraph, list item, quote or heading. The paragraph is highlighted while it plays, and reading continues to the next one (optional).
- **Select to read:** highlight text and a small tab slides in on the right edge of the page. Click it to hear the selection.
- **Shortcut and context menu:** `Alt+Shift+R` or right-click, then "Read aloud with Voxa".
- **Automatic language detection:** uses Chrome's built-in detector (`chrome.i18n.detectLanguage`), and falls back to the page's `lang` attribute when the text is too short to be sure.
- **Player:** pause/resume, stop, speed (0.75x to 2x) and a language badge. Press `Esc` to stop.
- **Per-language voices:** choose a preferred voice for each language on the settings page.
- **Local and private:** no accounts, no servers, no analytics. Nothing is sent anywhere by the extension itself.

## Install (developer mode)

1. Download or clone this folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `voxa` folder.
5. Refresh any tabs that were already open.

Click the Voxa icon to open the settings page.

## Usage

| Action | How |
| --- | --- |
| Read a paragraph | Hover over it and click the round play button on its left |
| Read selected text | Select text, then click the Voxa tab on the right edge |
| Read selection via keyboard | `Alt+Shift+R` (change at `chrome://extensions/shortcuts`) |
| Read selection via menu | Right-click, then "Read aloud with Voxa" |
| Pause / resume | Button in the player at the bottom right |
| Stop | Stop button in the player, or `Esc` |

## Settings

- **Speed:** 0.5x to 2x.
- **Hover button:** turn the paragraph play button on or off.
- **Continue to next paragraph:** keep reading after a paragraph ends.
- **Voice per language:** pick a specific voice for each language found on your system. "Automatic" prefers voices installed on your computer.

## How it works

```
content.js      Injects the UI (in a Shadow DOM), handles hover/selection,
                chunks text into sentences, and speaks with the Web Speech API
background.js   Service worker: language detection, context menu, keyboard shortcut
options.html/js Settings page (speed, toggles, per-language voices)
manifest.json   Manifest V3 config
```

1. Text comes from the hovered block or the selection.
2. The background worker detects the language.
3. A voice is chosen for that language: your saved choice, otherwise the best available (local voices first).
4. Text is split into short chunks and spoken one by one. This avoids Chrome cutting off long utterances.
5. If a voice fails or stays silent for 5 seconds, Voxa retries with a local voice. If nothing works, the player shows `ERR` and the reason is logged to the page console as `[Voxa] ...`.

## Linux notes

Chrome on Linux needs a system speech engine for the Web Speech API. Without one, `speechSynthesis.getVoices()` returns an empty list.

```bash
# Debian / Ubuntu / Mint
sudo apt install speech-dispatcher espeak-ng

# Fedora
sudo dnf install speech-dispatcher espeak-ng

# Arch
sudo pacman -S speech-dispatcher espeak-ng
```

Restart Chrome fully afterwards. eSpeak voices are clear but robotic. Chrome's online "Google" voices sound better but are unreliable on Linux, which is why Voxa prefers local voices by default.

## Troubleshooting

In the page console (`F12`):

```js
// How many voices does Chrome see?
speechSynthesis.getVoices().length

// List them
speechSynthesis.getVoices().map(v => v.name + " | " + v.lang + " | " + (v.localService ? "local" : "online"))

// Does plain speech work at all?
speechSynthesis.speak(new SpeechSynthesisUtterance("Hello, this is a test"))
```

- If the plain test is silent, the problem is your system's audio or speech setup, not Voxa. On Linux try `spd-say "test"`.
- If the test works but Voxa doesn't, look for `[Voxa]` lines in the console.
- After updating the extension, reload it on `chrome://extensions` and refresh the page you are testing.

## Limitations

- Does not work on Chrome's built-in PDF viewer, the Chrome Web Store, or `chrome://` pages.
- The hover button ignores short text (under 40 characters), so menus and buttons stay clean.
- Voice quality depends on the voices installed on your system.
- Language detection is less reliable on very short selections.
- Mixed-language paragraphs are read with a single detected language.

## Permissions

- `storage`: save your settings.
- `contextMenus`: the right-click "Read aloud" entry.
- Content script on all sites: needed to add the hover button and selection tab.

## Roadmap

- Pluggable voice engines for more natural voices: Piper (free, offline), Azure Neural TTS, ElevenLabs, OpenAI TTS.
- Per-sentence language detection for mixed-language text.
- Word-by-word highlighting.
- "Read from here to end of page."
- Site allow/deny list.

## License

MIT. See [LICENSE](LICENSE).
