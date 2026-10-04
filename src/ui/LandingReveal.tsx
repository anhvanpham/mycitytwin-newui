/** Keep the heading readable as one phrase for assistive technology. */
export function RevealWords({ text }: { text: string }) {
  return (
    <span className="reveal-words" aria-label={text}>
      {text.split(' ').map((word, index) => (
        <span key={index} aria-hidden="true">
          <span className="reveal-word">{word}</span>
          {' '}
        </span>
      ))}
    </span>
  );
}
