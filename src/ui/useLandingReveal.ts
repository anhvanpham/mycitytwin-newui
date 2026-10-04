import { useLayoutEffect, type RefObject } from 'react';

/** Start the entrances as a section reaches the middle of the viewport. */
export function useLandingReveal(
  root: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
) {
  useLayoutEffect(() => {
    const page = root.current;
    if (!page || reducedMotion) return;
    const sections = Array.from(page.querySelectorAll<HTMLElement>(
      '.more > section, .more > footer',
    ));
    const groups = new Map<HTMLElement, Animation[]>();
    const active = new Set<Element>();
    sections.forEach(section => {
      const elements = Array.from(section.querySelectorAll<HTMLElement>([
        'h2', 'h3',
        '.more__lead', '.more__pill', '.more__kicker', '.more__country-words',
        '.more__figures > article', '.more__cards > li', '.more__cta-button',
        '.curiosity__choices > button', '.curiosity__answer',
        '.more__brand', '.more__motto',
      ].join(', '))).filter(element =>
        element.matches('h3') || !element.parentElement?.closest('.more__cards > li, .more__figures > article'),
      );
      const animations: Animation[] = [];
      elements.forEach((element, index) => {
        const words = element.matches('h1, h2, h3')
          ? Array.from(element.querySelectorAll<HTMLElement>('.reveal-word')) : [];
        const targets = words.length ? words : [element];
        targets.forEach((target, wordIndex) => {
          const isTitle = element.matches('h1, h2, h3');
          const flightX = element.matches('h3') ? 95 : -140;
          const effect = element.dataset.reveal ?? (isTitle ? 'rise' : 'fade');
          const isCard = element.matches('.more__cards > li');
          let frames: Keyframe[];
          if (isTitle && effect === 'dissolve') {
            frames = [
              { opacity: 0, filter: 'blur(12px)', transform: 'scale(1.04)' },
              { opacity: 0.7, filter: 'blur(3px)', transform: 'scale(1.01)', offset: 0.55 },
              { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
            ];
          } else if (isTitle && effect === 'fly') {
            frames = [
              { opacity: 0, transform: `translate(${flightX}px, 28px) rotate(${flightX < 0 ? -6 : 6}deg)` },
              { opacity: 1, transform: `translate(${flightX < 0 ? 7 : -7}px, -2px) rotate(0deg)`, offset: 0.8 },
              { opacity: 1, transform: 'translate(0, 0) rotate(0deg)' },
            ];
          } else if (isCard) {
            frames = [
              { opacity: 0, transform: 'perspective(900px) translateY(32px) rotateX(-10deg) scale(0.96)' },
              { opacity: 1, transform: 'perspective(900px) translateY(0) rotateX(0deg) scale(1)' },
            ];
          } else {
            frames = [
              { opacity: 0, transform: `translateY(${isTitle ? 42 : 20}px)` },
              { opacity: 1, transform: 'translateY(-2px)', offset: 0.8 },
              { opacity: 1, transform: 'translateY(0)' },
            ];
          }
          const cardIndex = element.closest('.more__cards > li')
            ? Array.from(section.querySelectorAll('.more__cards > li')).indexOf(element.closest('.more__cards > li')!) : 0;
          const animation = target.animate(frames, {
            duration: isTitle && effect === 'dissolve' ? 1800 : isTitle ? 1400 : 1200,
            delay: words.length ? 220 + wordIndex * 140 + cardIndex * 180 : isCard ? 300 + cardIndex * 180 : 380 + (index % 5) * 140,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'both',
          });
          animation.pause();
          animation.currentTime = 0;
          animations.push(animation);
        });
      });
      groups.set(section, animations);
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const animations = groups.get(entry.target as HTMLElement);
        if (entry.isIntersecting && !active.has(entry.target)) {
          active.add(entry.target);
          animations?.forEach(animation => {
            animation.currentTime = 0;
            animation.play();
          });
        } else if (!entry.isIntersecting) {
          active.delete(entry.target);
          animations?.forEach(animation => {
            animation.pause();
            animation.currentTime = 0;
          });
        }
      });
    }, { root: page, rootMargin: '-20% 0px -20% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section));
    return () => {
      observer.disconnect();
      groups.forEach(animations => animations.forEach(animation => animation.cancel()));
    };
  }, [root, reducedMotion]);
}
