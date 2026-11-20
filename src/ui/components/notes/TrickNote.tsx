import { RichText } from '../RichText';

type TrickNoteProps = {
  title?: string | null;
  body: string;
};

export function TrickNote({ title, body }: TrickNoteProps) {
  return (
    <div className="note-trick-card">
      <div className="note-trick-badge">
        <span aria-hidden="true">⚡</span>
        <span>{title || 'Quick Trick'}</span>
      </div>
      <div className="note-trick-body">
        <RichText text={body} />
      </div>
    </div>
  );
}
