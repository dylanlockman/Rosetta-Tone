# Process Tab URL — Claude Code Instructions

This prompt tells Claude Code how to scrape a guitar tab from a website and load it into the RosettaTone library. It replaces a traditional scraper with a human-in-the-loop workflow.

## Trigger

When the user asks something like:
- "process this tab URL: <url>"
- "scrape this tab: <url>"
- "import this tab into gearboard: <url>"

…follow these steps.

## Steps

### 1. Fetch the page

Use the `WebFetch` tool with the URL the user provided. Use a prompt like:
> "Extract the song title, artist, any capo directive (e.g. 'CAPO 7', 'capo on 1st fret'), and the raw ASCII guitar tablature (the 6-line tab content with fret numbers and dashes). Preserve the exact tab formatting including measure bars, dashes, and fret numbers. Ignore ads, navigation, comments, chord boxes above the tab, and lyrics between tab sections."

**Capo is required metadata.** Many tabs are written relative to a capo — dropping the directive silently changes every sounding pitch. If the page mentions a capo anywhere, include a line `CAPO <n>` at the very top of `raw_content`. The parser (`tabToScore`) detects it (regex `capo\D{0,12}?(\d{1,2})`), stores it as `score.meta.capo`, and the app shifts sounding pitch, draws the capo bar on the fretboard, and keeps tab numerals capo-relative. If a tab says the capo applies to only part of the song (e.g. "(NO CAPO)" after the intro), note that to the user — per-section capo is not yet supported; ingest the capo'd portion.

### 2. Validate the tab content

The tab should look like 6 lines per stave, one per string, with the standard pattern:
```
e|---0---2---3---|
B|---1---3---0---|
G|---0---2---0---|
D|---2---0---0---|
A|---3---0---2---|
E|---0---2---3---|
```

If the page contains multiple tab sections, include them all separated by blank lines. Preserve the exact characters — the tab parser depends on the column alignment of fret digits and dashes.

If you can't find a clean 6-line tab on the page (e.g. the page has chord-only content, or the tab is rendered as an image), tell the user and stop. Do not invent tab content.

### 3. Insert via API

The RosettaTone backend must be running on `http://localhost:4000`. POST the extracted data using the `Bash` tool:

```bash
curl -X POST http://localhost:4000/api/songs \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "title": "<extracted title>",
  "artist": "<extracted artist>",
  "source_type": "url",
  "source_url": "<the original URL>",
  "raw_content": "<the extracted ASCII tab text — escape newlines as \\n in JSON>"
}
JSON
```

The API responds with `{"id": <number>}` on success.

### 4. Confirm

Tell the user the song was added (mention the title, artist, and assigned id) and that they can refresh the RosettaTone library panel to see it.

## Notes for Claude

- The tab parser is strict about column alignment. If the source page mangles whitespace, prefer to leave it as-is rather than reformatting — better to surface a parse failure than silently corrupt the data.
- For Ultimate Guitar pages specifically, the tab is usually inside a `<pre>` block with class `js-tab-content`. WebFetch's text extraction should pull this out cleanly.
- If the user provides multiple URLs, process them one at a time and report each result.
