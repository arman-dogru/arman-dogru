# Leaderboard moderation setup

The public repository contains only the normalization and validation algorithms. The moderation vocabulary stays in a GitHub Actions secret.

## Secret

Create a local UTF-8 file named `blocklist.txt` with one blocked term per line. Do **not** add this file to the repository. Blank lines and lines beginning with `#` are ignored.

Encode it locally:

```bash
python -c "import base64,gzip,pathlib; print(base64.b64encode(gzip.compress(pathlib.Path('blocklist.txt').read_bytes())).decode())"
```

In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and create:

```text
PROFANITY_BLOCKLIST_GZ_B64
```

Paste the encoded output as the secret value.

The `race-leaderboard` workflow injects this secret only into the validation step. The validator normalizes both the submitted display name and the private entries using NFKC, confusable folding, diacritic removal, leetspeak folding, and alphanumeric skeletonization. It fails closed if the secret is missing, invalid, or empty.

Never print the decoded blocklist, enable shell tracing around the validation step, or copy the secret into browser JavaScript.
