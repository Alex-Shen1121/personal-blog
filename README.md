# Alex Shen Personal Site

A lightweight static personal homepage built for GitHub Pages deployment.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- GitHub Actions for validation + deployment

## Local usage

```bash
npm run validate
npm run build
npm run preview
```

Then open `http://127.0.0.1:4173`.

## What to customize

Edit `index.html` and replace the placeholder content in these sections:

- Hero introduction
- About me
- Experience highlights
- Selected work / project links
- Contact links and email

## Deployment

Push to `main` to trigger the GitHub Actions workflow. The workflow validates the site, builds the static `dist/` output, and deploys it to GitHub Pages.
