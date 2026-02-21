<script>
  import { onMount, onDestroy } from 'svelte';
  import { tick } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { parseTextGrouped } from './lib/parser.js';

  const STORAGE_KEY = 'torn-calculator-state-v1';

  let inputText = '';
  let sellPricesNum = {};
  let debugMode = false;
  let iconAttemptIndex = {};
  let themePreset = 'dark';
  let hydratedFromStorage = false;
  let prevProfitByItem = {};
  let recentlyProfitable = {};
  let saveTimer = null;

  const PLUSHIE_NAMES = new Set([
    'Jaguar Plushie',
    'Lion Plushie',
    'Panda Plushie',
    'Monkey Plushie',
    'Chamois Plushie',
    'Wolverine Plushie',
    'Nessie Plushie',
    'Red Fox Plushie',
    'Camel Plushie',
    'Teddy Bear Plushie',
  ]);

  const FLOWER_NAMES = new Set([
    'Dahlia',
    'Crocus',
    'Orchid',
    'Heather',
    'Ceibo Flower',
    'Edelweiss',
    'Peony',
    'Cherry Blossom',
    'Tribulus Omanense',
  ]);

  const THEME_PRESETS = [
    { id: 'dark', label: 'Dark' },
    { id: 'slate', label: 'Slate' },
    { id: 'midnight', label: 'Midnight' },
  ];

  $: items = parseTextGrouped(inputText);
  $: itemRows = items.map((item) => {
    const sellEach = sellPricesNum[item.itemName];
    const children = item.groups.map((group) => {
      const revenue = sellEach == null ? null : sellEach * group.quantity;
      const profit = revenue == null ? null : revenue - group.totalCost;
      return { ...group, revenue, profit };
    });
    const revenue = sellEach == null ? null : children.reduce((sum, child) => sum + (child.revenue ?? 0), 0);
    const profit = sellEach == null ? null : children.reduce((sum, child) => sum + (child.profit ?? 0), 0);
    return {
      itemName: item.itemName,
      quantity: item.totalQuantity,
      total: item.totalCost,
      groups: children,
      sellEach,
      revenue,
      profit,
    };
  });

  $: totalCost = itemRows.reduce((sum, r) => sum + r.total, 0);
  $: totalRevenue = itemRows.reduce((sum, r) => sum + (r.revenue ?? 0), 0);
  $: totalProfit = itemRows.reduce((sum, r) => sum + (r.profit ?? 0), 0);

  const counterTween = { duration: 520, easing: cubicOut };
  const totalCostDisplay = tweened(0, counterTween);
  const totalRevenueDisplay = tweened(0, counterTween);
  const totalProfitDisplay = tweened(0, counterTween);

  $: totalCostDisplay.set(totalCost);
  $: totalRevenueDisplay.set(totalRevenue);
  $: totalProfitDisplay.set(totalProfit);

  function sanitizeSellPriceMap(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const cleaned = {};
    for (const [key, value] of Object.entries(raw)) {
      if (typeof key !== 'string') continue;
      const n = typeof value === 'number' ? value : parseDigitsToNumber(value);
      cleaned[key] = n == null ? null : n;
    }
    return cleaned;
  }

  onMount(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        hydratedFromStorage = true;
        return;
      }
      const parsed = JSON.parse(stored);
      if (typeof parsed?.inputText === 'string') inputText = parsed.inputText;
      if (typeof parsed?.themePreset === 'string') themePreset = parsed.themePreset;
      sellPricesNum = sanitizeSellPriceMap(parsed?.sellPricesNum);
    } catch (_) {
      // Ignore malformed storage values.
    } finally {
      hydratedFromStorage = true;
    }
  });

  function persistState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          inputText,
          sellPricesNum,
          themePreset,
        }),
      );
    } catch (_) {
      // Ignore storage write errors.
    }
  }

  $: if (hydratedFromStorage) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      persistState();
      saveTimer = null;
    }, 180);
  }

  onDestroy(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  });

  $: {
    const nextPrev = {};
    for (const row of itemRows) {
      const prev = prevProfitByItem[row.itemName];
      const now = row.profit;
      if ((prev == null || prev <= 0) && now != null && now > 0) {
        recentlyProfitable = { ...recentlyProfitable, [row.itemName]: true };
        setTimeout(() => {
          recentlyProfitable = { ...recentlyProfitable, [row.itemName]: false };
        }, 700);
      }
      nextPrev[row.itemName] = now;
    }
    prevProfitByItem = nextPrev;
  }

  function formatMoney(n) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }

  function parseDigitsToNumber(value) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return null;
    const num = parseInt(digits, 10);
    return isNaN(num) ? null : num;
  }

  function setSellPrice(itemName, value) {
    sellPricesNum = { ...sellPricesNum, [itemName]: parseDigitsToNumber(value) };
  }

  function focusSellInputByIndex(index) {
    const inputs = Array.from(document.querySelectorAll('.sell-price-input'));
    if (inputs.length === 0) return;
    const clamped = Math.max(0, Math.min(inputs.length - 1, index));
    const target = inputs[clamped];
    if (!target) return;
    target.focus();
    target.select();
  }

  function handleSellPriceKeydown(e, index) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = e.shiftKey ? index - 1 : index + 1;
      focusSellInputByIndex(nextIndex);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusSellInputByIndex(index + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusSellInputByIndex(index - 1);
    }
  }

  function getSellInputDisplay(itemName) {
    const value = sellPricesNum[itemName];
    return value == null ? '' : formatMoney(value);
  }

  function getProfitClass(profit) {
    if (profit > 0) return 'positive';
    if (profit < 0) return 'negative';
    return 'neutral';
  }

  function getRowProfitThresholdClass(row) {
    if (row.profit == null) return 'profit-unpriced';
    const roi = row.total > 0 ? row.profit / row.total : 0;

    if (row.profit <= -200000 || roi <= -0.4) return 'profit-loss-high';
    if (row.profit < 0) return 'profit-loss-low';
    if (row.profit >= 200000 || roi >= 0.25) return 'profit-gain-high';
    if (row.profit > 0) return 'profit-gain-low';
    return 'profit-neutral';
  }

  function slugifyItemName(name) {
    return String(name)
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function getIconEmoji(itemName) {
    if (/plushie/i.test(itemName)) return '🧸';
    if (FLOWER_NAMES.has(itemName) || /flower|orchid|dahlia|crocus|heather|edelweiss|peony|blossom|ceibo|tribulus/i.test(itemName)) return '🌸';
    return '📦';
  }

  function getItemCategory(itemName) {
    if (PLUSHIE_NAMES.has(itemName) || /plushie/i.test(itemName)) return 'plushies';
    if (FLOWER_NAMES.has(itemName) || /flower|orchid|dahlia|crocus|heather|edelweiss|peony|blossom|ceibo|tribulus/i.test(itemName)) return 'flowers';
    return 'others';
  }

  function getIconCandidates(itemName) {
    const category = getItemCategory(itemName);
    const slug = slugifyItemName(itemName);
    return [`/item-icons/${category}/${slug}.webp`];
  }

  function getActiveIconPath(itemName) {
    const candidates = getIconCandidates(itemName);
    const idx = iconAttemptIndex[itemName] ?? 0;
    return candidates[idx] ?? null;
  }

  function markIconFailed(itemName) {
    const next = (iconAttemptIndex[itemName] ?? 0) + 1;
    iconAttemptIndex = { ...iconAttemptIndex, [itemName]: next };
  }

  function shouldUseImageIcon(itemName) {
    return getActiveIconPath(itemName) != null;
  }

  function getSparklineWidth(row) {
    if (row.revenue == null || row.total <= 0) return 0;
    const ratio = row.revenue / row.total;
    return Math.max(0, Math.min(160, ratio * 100));
  }

  function resetCalculator() {
    inputText = '';
    sellPricesNum = {};
    iconAttemptIndex = {};
    prevProfitByItem = {};
    recentlyProfitable = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // Ignore storage errors.
    }
  }

  const COUNTRY_NAMES = 'Mexico|Japan|UAE|Argentina|Cayman Islands|Canada|Hawaii|United Kingdom|Switzerland|China|South Africa';
  const COUNTRY_TO_NEXT_LINE_REGEX = new RegExp(`(${COUNTRY_NAMES})\\s*(?=You bought\\b)`, 'gi');
  const COUNTRY_AT_END_REGEX = new RegExp(`(${COUNTRY_NAMES})\\s*$`, 'i');
  const CONCAT_BUY_REGEX = /(from\s+(?:Mexico|Japan|UAE|Argentina|Cayman Islands|Canada|Hawaii|United Kingdom|Switzerland|China|South Africa))\s*(?=You bought\b)/gi;

  const JUNK_LINE_REGEX = /^\s*(\d{1,2}:\d{2}(:\d{2})?\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*$|^\s*\d+\s+(HOURS?|MINUTES?|DAYS?|SECONDS?)\s+AGO\s*$)/i;

  function normalizePurchaseText(text) {
    if (!text) return text;
    let out = text.replace(COUNTRY_TO_NEXT_LINE_REGEX, '$1\n');
    out = out.replace(CONCAT_BUY_REGEX, '$1\n');

    out = out.split(/\r?\n/).filter((line) => !JUNK_LINE_REGEX.test(line)).join('\n');

    if (COUNTRY_AT_END_REGEX.test(out) && !out.endsWith('\n')) {
      out += '\n';
    }
    return out;
  }

  function handlePaste(e) {
    const pasted = e.clipboardData?.getData('text') ?? '';
    const processed = normalizePurchaseText(pasted);
    if (processed === pasted) return;

    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = inputText.slice(0, start);
    const after = inputText.slice(end);
    inputText = before + processed + after;

    tick().then(() => {
      textarea.focus();
      textarea.setSelectionRange(start + processed.length, start + processed.length);
    });
  }

  function handleTextInput(e) {
    const normalized = normalizePurchaseText(e.target.value);
    if (normalized === e.target.value) {
      inputText = e.target.value;
      return;
    }
    const cursor = e.target.selectionStart ?? normalized.length;
    inputText = normalized;
    tick().then(() => {
      const nextCursor = Math.min(normalized.length, cursor);
      e.target.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function getTEListingUrl(itemName) {
    const encoded = encodeURIComponent(itemName).replace(/%20/g, '+');
    return `https://tornexchange.com/listings?model_name_contains=${encoded}&order_by=-traders_price&status=Online`;
  }

</script>

<main class={"app theme-" + themePreset}>
  <header class="header">
    <h1>Torn Profit Calculator</h1>
    <p class="subtitle">Paste purchase logs, set sell prices, see profit</p>
  </header>

  <section class="input-section">
    <label for="paste">Paste Torn purchase text</label>
    <textarea
      id="paste"
      value={inputText}
      on:input={handleTextInput}
      on:paste={handlePaste}
      placeholder="You bought 27x Jaguar Plushie at $10,000 each for a total of $270,000 from Mexico&#13;You bought 5x Camel Plushie at $14,000 each for a total of $2,500 from UAE"
      rows="6"
    ></textarea>
  </section>

  {#if itemRows.length > 0}
    <section class="items-section">
      <div class="section-header">
        <h2>Items ({itemRows.length})</h2>
        <div class="toolbar">
          <div class="theme-switcher" role="tablist" aria-label="Theme presets">
            {#each THEME_PRESETS as preset}
              <button
                type="button"
                class={"theme-btn " + (themePreset === preset.id ? 'active' : '')}
                on:click={() => (themePreset = preset.id)}
              >
                {preset.label}
              </button>
            {/each}
          </div>
          <button type="button" class="reset-btn" on:click={resetCalculator}>Reset</button>
        </div>
        <div class="totals">
          <div class="total-card cost">
            <span class="total-label">Total Cost</span>
            <span class="total-value">{formatMoney(Math.round($totalCostDisplay))}</span>
          </div>
          <div class="total-card revenue">
            <span class="total-label">Total Revenue</span>
            <span class="total-value">{formatMoney(Math.round($totalRevenueDisplay))}</span>
          </div>
          <div class={"total-card profit " + getProfitClass(totalProfit)}>
            <span class="total-label">Total Profit</span>
            <span class="total-value">{formatMoney(Math.round($totalProfitDisplay))}</span>
          </div>
        </div>
      </div>

      <div class="debug-controls">
        <label>
          <input type="checkbox" bind:checked={debugMode} />
          Debug mode
        </label>
      </div>

      <ul class="item-list">
        {#each itemRows as row, i (row.itemName)}
          <li class={"item-row " + getRowProfitThresholdClass(row)}>
            <div class="item-info">
              <span class="item-name">
                <span class={"item-icon " + (recentlyProfitable[row.itemName] ? 'pulse-profit' : '')}>
                  {#if shouldUseImageIcon(row.itemName)}
                    <img
                      src={getActiveIconPath(row.itemName)}
                      alt={row.itemName}
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                      on:error={() => markIconFailed(row.itemName)}
                    />
                  {:else}
                    <span>{getIconEmoji(row.itemName)}</span>
                  {/if}
                </span>
                {row.itemName}
              </span>
              <span class="item-meta">{row.quantity} × {formatMoney(row.total / row.quantity)} = {formatMoney(row.total)}</span>
              <div class="sparkline-row">
                <span class="sparkline-label">Revenue vs Cost</span>
                <div class="sparkline-track">
                  <span class="sparkline-base"></span>
                  <span
                    class={"sparkline-fill " + getProfitClass(row.profit ?? 0)}
                    style={`width:${getSparklineWidth(row)}%;`}
                  ></span>
                </div>
              </div>
              {#if row.groups.length > 1}
                <div class="child-cards">
                  {#each row.groups as child}
                    <div class={"child-card " + getProfitClass(child.profit ?? 0)}>
                      <div class="child-title">Buy @ {formatMoney(child.pricePer)} each</div>
                      <div class="child-stats">
                        <span>Qty: {child.quantity}</span>
                        <span>Cost: {formatMoney(child.totalCost)}</span>
                        <span>Revenue: {child.revenue == null ? '--' : formatMoney(child.revenue)}</span>
                        <span>Profit: {child.profit == null ? '--' : `${child.profit >= 0 ? '+' : ''}${formatMoney(child.profit)}`}</span>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="item-actions">
              <label for={"sell-" + i}>
                <span class="label-text">Sell price each</span>
                <input
                  id={"sell-" + i}
                  class="sell-price-input"
                  type="text"
                  inputmode="numeric"
                  placeholder="$0"
                  value={getSellInputDisplay(row.itemName)}
                  on:input={(e) => setSellPrice(row.itemName, e.target.value)}
                  on:keydown={(e) => handleSellPriceKeydown(e, i)}
                />
              </label>
              <a
                class="te-link"
                href={getTEListingUrl(row.itemName)}
                target="_blank"
                rel="noopener noreferrer"
                title={"View online listings for " + row.itemName + " on Torn Exchange"}
              >View on TE</a>

              <div class="item-metrics">
                {#key row.total}
                  <span class="metric cost metric-pop">Cost: {formatMoney(row.total)}</span>
                {/key}
                {#key row.revenue}
                  <span class="metric revenue metric-pop">Revenue: {row.revenue == null ? '--' : formatMoney(row.revenue)}</span>
                {/key}
                {#key row.profit}
                  <span class={"metric profit metric-pop " + getProfitClass(row.profit ?? 0)}>
                    Profit: {row.profit == null ? '--' : `${row.profit >= 0 ? '+' : ''}${formatMoney(row.profit)}`}
                  </span>
                {/key}
              </div>
            </div>

            {#if debugMode}
              <pre class="debug-block">{JSON.stringify({
                item: row.itemName,
                iconPath: getActiveIconPath(row.itemName),
                iconAttemptIndex: iconAttemptIndex[row.itemName] ?? 0,
                quantity: row.quantity,
                buyTotal: row.total,
                sellEach: row.sellEach ?? null,
                revenue: row.revenue,
                profit: row.profit,
                groups: row.groups
              }, null, 2)}</pre>
            {/if}
          </li>
        {/each}
      </ul>

      {#if debugMode}
        <pre class="debug-block debug-summary">{JSON.stringify({
          totalCost,
          totalRevenue,
          totalProfit,
          sellPricesNum
        }, null, 2)}</pre>
      {/if}
    </section>
  {:else if inputText.trim()}
    <p class="hint">No valid purchase lines found. Use format: "You bought Nx Item Name at $X each for a total of $Y from ..."</p>
  {/if}
</main>

<style>
  .app {
    max-width: 760px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .header {
    margin-bottom: 2rem;
  }

  .app.theme-slate {
    --bg: #0f141b;
    --surface: #171d26;
    --surface-elevated: #202836;
    --border: #2b3748;
    --text: #f1f5fb;
    --text-muted: #a8b3c5;
    --accent: #5bbf8b;
    --danger: #e97070;
  }

  .app.theme-midnight {
    --bg: #0b1018;
    --surface: #121927;
    --surface-elevated: #1a2333;
    --border: #27344a;
    --text: #edf2ff;
    --text-muted: #9eaac1;
    --accent: #63c3a8;
    --danger: #f07373;
  }

  .header h1 {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 0.25rem 0;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
  }

  .input-section {
    margin-bottom: 2rem;
  }

  .input-section label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--text-muted);
  }

  .input-section textarea {
    width: 100%;
    padding: 1rem 1.25rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.9rem;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .input-section textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-dim);
  }

  .items-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    animation: fade-in 260ms ease-out;
    position: relative;
  }

  .section-header {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .theme-switcher {
    display: inline-flex;
    gap: 0.4rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.25rem;
  }

  .theme-btn {
    position: relative;
    overflow: hidden;
    border: none;
    background: transparent;
    color: var(--text-muted);
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 160ms ease;
  }

  .theme-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.06), transparent 100%);
    transform: translate(-100%, -100%);
    transition: transform 280ms ease-out;
    pointer-events: none;
  }

  .theme-btn:hover::before {
    transform: translate(0, 0);
  }

  .theme-btn:hover {
    color: var(--text);
  }

  .theme-btn.active {
    background: var(--surface);
    color: var(--text);
  }

  .reset-btn {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border);
    background: var(--surface-elevated);
    color: var(--text-muted);
    font-size: 0.78rem;
    border-radius: 999px;
    padding: 0.35rem 0.75rem;
    cursor: pointer;
    transition: color 160ms ease, border-color 160ms ease;
  }

  .reset-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08), transparent 60%);
    transform: translate(-100%, -100%);
    transition: transform 280ms ease-out;
    pointer-events: none;
  }

  .reset-btn:hover::before {
    transform: translate(0, 0);
  }

  .reset-btn:hover {
    color: var(--text);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .section-header h2 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .totals {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .total-card {
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    transition: transform 160ms ease, border-color 200ms ease, background 200ms ease;
  }

  .total-card:hover {
    transform: translateY(-1px);
  }

  .total-label {
    display: block;
    color: var(--text-muted);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.2rem;
  }

  .total-value {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .total-card.profit.positive {
    border-color: rgba(34, 197, 94, 0.2);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0.045) 25%, rgba(34, 197, 94, 0.03) 50%, rgba(34, 197, 94, 0.02) 150%);
    color: var(--accent);
  }

  .total-card.profit.negative {
    border-color: rgba(239, 68, 68, 0.2);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.045) 25%, rgba(239, 68, 68, 0.03) 50%, rgba(239, 68, 68, 0.02) 150%);
    color: var(--danger);
  }

  .debug-controls {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .debug-controls label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .item-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    animation: slide-in 220ms ease-out;
    content-visibility: auto;
    contain-intrinsic-size: 120px;
  }

  .item-row.profit-gain-high {
    border-left: 2px solid rgba(34, 197, 94, 0.4);
    background: linear-gradient(to bottom right, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0) 150%), var(--surface);
  }

  .item-row.profit-gain-low {
    border-left: 2px solid rgba(34, 197, 94, 0.2);
    background: linear-gradient(to bottom right, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0) 150%), var(--surface);
  }

  .item-row.profit-loss-high {
    border-left: 2px solid rgba(239, 68, 68, 0.4);
    background: linear-gradient(to bottom right, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0) 150%), var(--surface);
  }

  .item-row.profit-loss-low {
    border-left: 2px solid rgba(239, 68, 68, 0.2);
    background: linear-gradient(to bottom right, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0) 150%), var(--surface);
  }

  .item-row:last-child {
    border-bottom: none;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .item-name {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .item-icon {
    width: 2.6rem;
    height: 2.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    overflow: hidden;
    flex-shrink: 0;
  }

  .item-icon img {
    width: 96%;
    height: 96%;
    object-fit: contain;
    border-radius: 50%;
  }

  .item-icon.pulse-profit {
    animation: pulse-profit 700ms ease-out;
  }

  .item-meta {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .sparkline-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.15rem;
  }

  .sparkline-label {
    font-size: 0.68rem;
    color: var(--text-muted);
    letter-spacing: 0.03em;
    text-transform: uppercase;
    min-width: 82px;
  }

  .sparkline-track {
    position: relative;
    width: 130px;
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    overflow: hidden;
  }

  .sparkline-base {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.06);
  }

  .sparkline-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    border-radius: 999px;
    transition: width 260ms cubic-bezier(0.2, 0.8, 0.2, 1), background 200ms ease;
  }

  .sparkline-fill.positive {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.5) 0%, rgba(34, 197, 94, 0.38) 33%, rgba(34, 197, 94, 0.25) 150%);
  }

  .sparkline-fill.negative {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.38) 33%, rgba(239, 68, 68, 0.25) 150%);
  }

  .sparkline-fill.neutral {
    background: rgba(255, 255, 255, 0.22);
  }

  .child-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.45rem;
  }

  .child-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    padding: 0.45rem 0.6rem;
  }

  .child-card.positive {
    border-color: rgba(34, 197, 94, 0.2);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.035) 33%, rgba(34, 197, 94, 0.015) 150%);
  }

  .child-card.negative {
    border-color: rgba(239, 68, 68, 0.2);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.035) 33%, rgba(239, 68, 68, 0.015) 150%);
  }

  .child-title {
    font-size: 0.72rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.28rem;
  }

  .child-stats {
    display: grid;
    gap: 0.18rem;
    font-size: 0.78rem;
  }

  .item-actions {
    display: flex;
    align-items: flex-end;
    flex-direction: column;
    gap: 0.7rem;
    max-width: 100%;
  }

  .item-actions label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label-text {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .item-actions input {
    width: 160px;
    padding: 0.5rem 0.75rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.9rem;
  }

  .item-actions input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .item-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .metric {
    font-size: 0.8rem;
    border: 1px solid var(--border);
    background: var(--surface-elevated);
    border-radius: 999px;
    padding: 0.25rem 0.55rem;
    color: var(--text-muted);
    transition: border-color 200ms ease, background 200ms ease;
  }

  .metric-pop {
    animation: metric-pop 260ms ease-out;
  }

  .metric.revenue {
    color: var(--text);
  }

  .metric.profit.positive {
    border-color: rgba(34, 197, 94, 0.2);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0.045) 25%, rgba(34, 197, 94, 0.03) 50%, rgba(34, 197, 94, 0.02) 150%);
    color: var(--accent);
  }

  .metric.profit.negative {
    border-color: rgba(239, 68, 68, 0.2);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.045) 25%, rgba(239, 68, 68, 0.03) 50%, rgba(239, 68, 68, 0.02) 150%);
    color: var(--danger);
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 1rem;
    background: var(--surface);
    border-radius: var(--radius);
    border: 1px dashed var(--border);
  }

  .debug-block {
    margin: 0.5rem 1.25rem 0;
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: #0f1115;
    color: #b7f0d1;
    font-size: 0.75rem;
    line-height: 1.35;
    white-space: pre-wrap;
    overflow-x: auto;
  }

  .debug-summary {
    margin: 0.75rem 1.25rem 1.25rem;
    color: #c4d7ff;
  }

  @media (max-width: 780px) {
    .totals {
      grid-template-columns: 1fr;
    }

    .item-row {
      grid-template-columns: 1fr;
    }

    .item-actions {
      align-items: stretch;
    }

    .item-actions input {
      width: 100%;
    }

    .item-metrics {
      justify-content: flex-start;
    }

    .sparkline-row {
      flex-wrap: wrap;
    }

    .child-cards {
      grid-template-columns: 1fr;
    }
  }

  .te-link {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    border: 1px solid rgba(34, 197, 94, 0.25);
    background: rgba(34, 197, 94, 0.06);
    color: var(--accent);
    font-size: 0.72rem;
    font-family: var(--font);
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    text-decoration: none;
    white-space: nowrap;
    transition: border-color 160ms ease;
  }

  .te-link::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), transparent 100%);
    transform: translate(-100%, -100%);
    transition: transform 280ms ease-out;
    pointer-events: none;
  }

  .te-link:hover::before {
    transform: translate(0, 0);
  }

  .te-link:hover {
    border-color: rgba(34, 197, 94, 0.45);
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slide-in {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes metric-pop {
    0% { transform: translateY(2px) scale(0.98); opacity: 0.8; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  @keyframes pulse-profit {
    0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
    100% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
  }
</style>
