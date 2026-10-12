# Fixtures

Markdown files used by the round-trip tests in `tests/markdown/roundtrip.test.ts`.
Every `.md` file here (except this README) is checked automatically for:

1. **Unedited save** — writing it back produces the exact same bytes (BOM, CRLF, final newline).
2. **One-line edit** — editing the first paragraph changes only that line in the saved file.
3. **Normalization snapshot** — how the editor would serialize it from scratch is recorded in
   `tests/markdown/__snapshots__/<name>`. If a Milkdown upgrade changes that, the test fails;
   review the diff and run `npx vitest run -u` to accept it.

Add your own real notes here — they are the best test of the editor. Files in this folder are
byte-exact in git (see `.gitattributes`) and excluded from Prettier.
