import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

interface Entry {
  id: string;
  title: string;
  depth: number;
  children: Entry[];
}
export function ArticleOutline({
  article,
  contentKey,
}: {
  article: RefObject<HTMLElement | null>;
  contentKey: string;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState('');
  const panel = useRef<HTMLDetailsElement>(null);
  const mountPanel = useCallback((element: HTMLDetailsElement | null) => {
    panel.current = element;
    if (element) element.open = matchMedia('(min-width: 1100px)').matches;
  }, []);
  useEffect(() => {
    const headings = Array.from(
      article.current?.querySelectorAll<HTMLElement>('[data-outline-title]') || [],
    );
    const roots: Entry[] = [],
      stack: Entry[] = [];
    for (const heading of headings) {
      const entry: Entry = {
        id: heading.id,
        title: heading.dataset.outlineTitle || '',
        depth: Number(heading.tagName.slice(1)),
        children: [],
      };
      while (stack.length && stack.at(-1)!.depth >= entry.depth) stack.pop();
      (stack.at(-1)?.children || roots).push(entry);
      stack.push(entry);
    }
    setEntries(roots);
    let frame = 0;
    const update = () => {
      frame = 0;
      // The compact mobile disclosure stays above the current heading.
      const threshold = matchMedia('(min-width: 1100px)').matches ? 90 : 110;
      let current = headings[0]?.id || '';
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= threshold) current = heading.id;
        else break;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = headings.at(-1)?.id || current;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    if (article.current) observer.observe(article.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [article, contentKey]);
  if (!entries.length) return null;
  const list = (items: Entry[]) => (
    <ol>
      {items.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${encodeURIComponent(entry.id)}`}
            aria-current={active === entry.id ? 'location' : undefined}
            onClick={(event) => {
              // Preserve native modified-click behavior for copying/opening an anchor.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              const compact = !matchMedia('(min-width: 1100px)').matches;
              if (compact && panel.current) panel.current.open = false;
              // Also reposition repeated clicks on the current fragment after disclosure changes.
              requestAnimationFrame(() => {
                document.getElementById(entry.id)?.scrollIntoView();
                if (compact)
                  panel.current?.querySelector('summary')?.focus({ preventScroll: true });
              });
            }}
          >
            {entry.title}
          </a>
          {entry.children.length > 0 && list(entry.children)}
        </li>
      ))}
    </ol>
  );
  return (
    <details className="article-outline" ref={mountPanel}>
      <summary>章节导航</summary>
      <nav aria-label="侧栏目录">{list(entries)}</nav>
    </details>
  );
}
