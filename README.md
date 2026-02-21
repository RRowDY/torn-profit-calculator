# Torn Profit Calculator

Lightweight browser app for calculating profit from Torn City bazaar purchases.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve the `dist` folder with any static file server, or open `dist/index.html` directly.

## Usage

1. Paste Torn purchase text (e.g. from your bazaar activity log) into the text area
2. Each line should match: `You bought Nx Item Name at $X each for a total of $Y from ...`
3. The app aggregates all unique items and their totals
4. Enter a sell price per unit for each item
5. Profit is calculated and shown per item and in total
