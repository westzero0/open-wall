// 첫 방문 넛지: 시간 슬라이더 손잡이가 한 번 움직이고 "좌우로 밀어 보세요" 한 줄이 보인다. 한 번 만지면 사라진다.
// DOM만 알고 저장은 모른다: 본 적이 있는지는 hinted로 받고, 처음 만졌을 때 onSeen()을 한 번 부른다.
const TOUCH = ['pointerdown', 'keydown', 'input']; // not 'focus': the tour moves focus itself, which would use the hint up before it was seen

/**
 * mountScrubHint({ range, host, watch, hinted, reduced, onSeen }) → { stop() }
 * range: the slider (gets the `nudge` class, which style.css animates); host: where the line goes; watch: every control whose touch means "seen" (the slider, ±1시간).
 * reduced: prefers-reduced-motion — the words stay, the movement does not. The line has no role: the headline is the page's one live region.
 */
export function mountScrubHint({ range, host, watch = [range], hinted, reduced, onSeen }) {
  if (hinted) return { stop() {} };
  const line = document.createElement('p');
  line.className = 'scrub-hint';
  line.textContent = '좌우로 밀어 보세요';
  host.append(line);
  if (!reduced) range.classList.add('nudge');
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    line.remove();
    range.classList.remove('nudge');
    for (const c of watch) for (const t of TOUCH) c.removeEventListener(t, stop);
    onSeen();
  };
  for (const c of watch) for (const t of TOUCH) c.addEventListener(t, stop);
  return { stop };
}
