# AndrewBot

[**AndrewBot**](https://29miaoet.github.io/Andrew_WebPage/andrew_bot.html) is an intents-based chatbot and assistant for Andrew's Website.

## Overview

The chatbot works by:
1. Receiving a user message
2. Classifying the message into an intent (e.g., `greeting`, `weather`, `question`)
3. Mapping the intent to a predefined response or action
4. Returning a relevant reply to the user

This approach ensures predictable and structured conversational behavior.

## Quickstart
Navigate to [AndrewBot](https://29miaoet.github.io/Andrew_WebPage/andrew_bot.html), wait for the page to load.

## Installation and Usage

### Online
You can chat with AndrewBot [here](https://29miaoet.github.io/Andrew_WebPage/andrew_bot.html), feel free to play around with the bot and report any parts that may need improvement to the [form](https://29miaoet.github.io/Andrew_WebPage/form.html).

### Locally
You can run AndrewBot locally, by first cloning the repository, then running a local server:

```bash
git clone https://github.com/29miaoet/Andrew_WebPage.git
cd Andrew_WebPage
python -m http.server
```

Navigate to http://localhost:8000/andrew_bot.html in your browser.


## Capabilities and Limits

- ✅ Simple rule-based prompt responses
- ✅ Can run browser actions through JavaScript
- ✅ Look up search terms, articles, and videos
- ✅ Runs entirely in your browser, no download needed
- ✅ Functional completely client-side, backend logging is optional
- ✅ Completely free and open-source
- ❌ No real reasoning or problem solving
- ❌ Cannot communicate with external APIs

## Requirements

- Modern browser: Chrome, Edge, Firefox, etc
- Modern operating system: Windows 10+, iOS 16+, etc
- JavaScript

## How It Works

### 1. Regex Normalization
User input is first passed through a regex function that strips it of special characters and transform uppercase letters into lowercase for easier matching.

Examples:
- `Hi there! How's it going?` → `hi there hows it going`
- `ARGHH! $^%@!^@` → `arghh`


### 2. Semantic Transformation
Intents are then fed through a lightweight ML model for semantic transformation, allowing for matching based on meaning rather than just characters. This project uses [transformers.js](https://github.com/huggingface/transformers.js) from Xenovo.

Examples:
- `i wonder what the weather will be like` → `what will the weather be like`
- `i fancy some food to eat` → `i want to eat`

### 3. Matching
AndrewBot uses several different fuzzy-matching methods to better match text from the user. It starts from a high demand of similarity, and if nothing matches, it gradually lowers the threshold, this ensures something matches rather than the bot just throwing "I don't know what you mean."

- Cosine Similarity
- Levenshtein Distance
- JavaScript Threshold Lowering

Examples: 
- `hey whats your name`+`whats your name` → Cosine Similarity → 0.866
- `i want some lobster`+`i want some food` → Levenshtein Distance → 6

### 4. Tag Identification
AndrewBot identifies the tag the prompt is closest to and selects it, then, it will perform one of its capabilities.
- Chat Responses
- Client-side JavaScript execution
- Regex based keyword identification

Examples:
- prompt:`what is your name` → match tag `name` → response:`I am you AI assistant, AndrewBot!`
- prompt:`send me to the home page` → match tag `send home` → JavaScript execution `window.open("https://29miaoet.github.io/Andrew_WebPage/")`
- prompt:`google andrew stanish` → match tag `google` → regex splitting `andrew stanish` → url construction `https://www.google.com/search?q=andrew+stanish` → JavaScript execution `window.open(url)`

### 5. Message Logging
After completing the previous steps, AndrewBot logs the entire process to Supabase, to be manually examined later, this aids maintainers in identifying issues earlier and faster, and helps improve the intents system. If you do not wish to have your messages logged, you can turn it off at any time by simply toggling the "training" button.

## License
This project is published under the MIT License, see the [license](https://github.com/29miaoet/Andrew_WebPage/blob/main/LICENSE) for more details.
