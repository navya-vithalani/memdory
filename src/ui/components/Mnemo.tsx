import sideHappy from '../../assets/mascot/mnemo-side-happy.svg?raw';
import sideExcited from '../../assets/mascot/mnemo-side-excited.svg?raw';
import sideSleepy from '../../assets/mascot/mnemo-side-sleepy.svg?raw';
import frontNeutral from '../../assets/mascot/mnemo-front-neutral.svg?raw';

const artwork = {
  happy: sideHappy,
  excited: sideExcited,
  sleepy: sideSleepy,
  front: frontNeutral
};

type MnemoProps = {
  mood?: keyof typeof artwork;
  className?: string;
};

export function Mnemo({ mood = 'happy', className = '' }: MnemoProps) {
  return (
    <span className={`mnemo ${className}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: artwork[mood] }} />
  );
}
