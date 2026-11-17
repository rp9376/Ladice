type Kid = Node | string | number | null | false | undefined;
type Props = Record<string, unknown> & { class?: string; text?: string; html?: string; onclick?: (e: MouseEvent) => void };

/** Tiny hyperscript helper: h('div', { class: 'x', onclick }, child, 'text'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...kids: (Kid | Kid[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(typeof kid === 'object' ? kid : String(kid));
  }
  return el;
}

export function icon(svg: string, cls = ''): HTMLSpanElement {
  return h('span', { class: 'icon ' + cls, html: svg });
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
