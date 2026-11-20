import { useId, useMemo } from 'react';
import sideHappy from '../../assets/mascot/mnemo-side-happy.svg?raw';
import sideExcited from '../../assets/mascot/mnemo-side-excited.svg?raw';
import sideSleepy from '../../assets/mascot/mnemo-side-sleepy.svg?raw';
import sideSad from '../../assets/mascot/mnemo-side-sad.svg?raw';
import sideRotten from '../../assets/mascot/mnemo-side-rotten.svg?raw';
import frontNeutral from '../../assets/mascot/mnemo-front-neutral.svg?raw';
import frontHappy from '../../assets/mascot/mnemo-front-happy.svg?raw';
import frontSad from '../../assets/mascot/mnemo-front-sad.svg?raw';
import frontShocked from '../../assets/mascot/mnemo-front-shocked.svg?raw';

const artwork = {
  happy: sideHappy,
  excited: sideExcited,
  sleepy: sideSleepy,
  sad: sideSad,
  rotten: sideRotten,
  front: frontNeutral,
  'front-happy': frontHappy,
  'front-sad': frontSad,
  'front-shocked': frontShocked
};

export type MnemoMood = keyof typeof artwork;

type MnemoProps = {
  mood?: MnemoMood;
  className?: string;
};

export function Mnemo({ mood = 'happy', className = '' }: MnemoProps) {
  const uniqueId = useId().replaceAll(':', '');
  const rawSvg = artwork[mood] ?? artwork.happy;

  const svgHtml = useMemo(() => {
    return rawSvg
      .replace(/id="bd"/g, `id="bd-${mood}-${uniqueId}"`)
      .replace(/clip-path="url\(#bd\)"/g, `clip-path="url(#bd-${mood}-${uniqueId})"`);
  }, [rawSvg, mood, uniqueId]);

  return (
    <span
      className={`mnemo ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}
