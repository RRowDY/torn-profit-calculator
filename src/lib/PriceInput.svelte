<script>
  export let value = '';
  export let onchange;
  export let id = '';

  function formatPrice(val) {
    const digits = String(val).replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10);
    return isNaN(num) ? '' : new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  }

  function handleInput(e) {
    const formatted = formatPrice(e.target.value);
    onchange(formatted);
  }
</script>

<input
  type="text"
  class="price-input"
  {value}
  {id}
  oninput={handleInput}
  placeholder="$0"
  inputmode="numeric"
/>

<style>
  .price-input {
    width: 120px;
    padding: 0.5rem 0.75rem;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font);
    font-size: 0.9rem;
  }
  .price-input:focus {
    outline: none;
    border-color: var(--accent);
  }
</style>
