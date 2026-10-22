/* Yozish mexanizmi: mashq va poyga sahifalari shu klassdan foydalanadi */
class TypingEngine {
  constructor(text, { display, input, onChange, onFinish }) {
    this.display = display;
    this.input = input;
    this.onChange = onChange;
    this.onFinish = onFinish;

    input.addEventListener("input", () => this._handleInput());
    input.addEventListener("paste", (event) => event.preventDefault());
    input.addEventListener("drop", (event) => event.preventDefault());

    this.reset(text);
  }

  reset(text) {
    this.text = text;
    this.prev = "";
    this.errors = 0;
    this.startedAt = null;
    this.done = false;
    this.input.value = "";
    this.input.maxLength = text.length;
    this.input.disabled = false;
    this.render();
  }

  get correct() {
    const value = this.input.value;
    let count = 0;
    while (count < value.length && count < this.text.length && value[count] === this.text[count]) {
      count += 1;
    }
    return count;
  }

  get typedLength() {
    return this.input.value.length;
  }

  elapsedSeconds() {
    return this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
  }

  setEnabled(enabled) {
    this.input.disabled = !enabled || this.done;
  }

  focus() {
    if (!this.input.disabled) this.input.focus();
  }

  _handleInput() {
    if (this.done) {
      this.input.value = this.prev;
      return;
    }
    const value = this.input.value;
    if (value.length > this.prev.length) {
      for (let i = this.prev.length; i < value.length; i += 1) {
        if (value[i] !== this.text[i]) this.errors += 1;
      }
    }
    if (this.startedAt === null && value.length > 0) {
      this.startedAt = Date.now();
    }
    this.prev = value;
    this.render();
    if (this.onChange) this.onChange(this);
    if (value === this.text) this._finish();
  }

  _finish() {
    this.done = true;
    this.input.disabled = true;
    if (this.onFinish) this.onFinish(this);
  }

  render() {
    const value = this.input.value;
    const parts = [];
    for (let i = 0; i < this.text.length; i += 1) {
      let cls = "";
      if (i < value.length) {
        cls = value[i] === this.text[i] ? "ok" : "bad";
      } else if (i === value.length) {
        cls = "cur";
      }
      parts.push('<span class="' + cls + '">' + TZ.escapeHtml(this.text[i]) + "</span>");
    }
    this.display.innerHTML = parts.join("");
  }
}

/* Mashq va poyga uchun bir xil hisoblash (serverdagi formulaga mos) */
function liveMetrics(correct, errors, seconds) {
  const minutes = seconds / 60;
  const wpm = seconds > 0 ? (correct / 5) / minutes : 0;
  const presses = correct + errors;
  const accuracy = presses ? (correct / presses) * 100 : 0;
  return { wpm: Math.round(wpm * 10) / 10, accuracy: Math.round(accuracy * 10) / 10 };
}
