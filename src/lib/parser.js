/**
 * Parses Torn City purchase text lines.
 * Format: "You bought 27x Jaguar Plushie at $10,000 each for a total of $270,000 from Mexico"
 */
const PURCHASE_REGEX = /You bought (\d+)x (.+?) at \$?([\d,]+) each for a total of \$?([\d,]+)/i;

function parseNumber(str) {
  return parseInt(String(str).replace(/,/g, ''), 10) || 0;
}

export function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(PURCHASE_REGEX);
  if (!match) return null;

  const [, qtyStr, itemName, pricePerStr, totalStr] = match;
  const quantity = parseNumber(qtyStr);
  const pricePer = parseNumber(pricePerStr);
  const total = parseNumber(totalStr);

  return {
    itemName: itemName.trim(),
    quantity,
    pricePer,
    total,
  };
}

export function parseText(text) {
  const lines = text.split(/\r?\n/);
  const parsed = [];

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry) parsed.push(entry);
  }

  return parsed;
}

export function parseTextGrouped(text) {
  const lines = text.split(/\r?\n/);
  const itemMap = new Map();

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;

    const parentKey = parsed.itemName;
    let parent = itemMap.get(parentKey);
    if (!parent) {
      parent = {
        itemName: parsed.itemName,
        totalQuantity: 0,
        totalCost: 0,
        groups: new Map(),
      };
      itemMap.set(parentKey, parent);
    }

    parent.totalQuantity += parsed.quantity;
    parent.totalCost += parsed.total;

    const childKey = String(parsed.pricePer);
    const existingGroup = parent.groups.get(childKey);
    if (existingGroup) {
      existingGroup.quantity += parsed.quantity;
      existingGroup.totalCost += parsed.total;
    } else {
      parent.groups.set(childKey, {
        pricePer: parsed.pricePer,
        quantity: parsed.quantity,
        totalCost: parsed.total,
      });
    }
  }

  return Array.from(itemMap.values()).map((parent) => ({
    itemName: parent.itemName,
    totalQuantity: parent.totalQuantity,
    totalCost: parent.totalCost,
    groups: Array.from(parent.groups.values()).sort((a, b) => a.pricePer - b.pricePer),
  }));
}
