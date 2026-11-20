import { RichText } from '../RichText';

type NormalNoteProps = {
  title?: string | null;
  body: string;
};

export function NormalNote({ title, body }: NormalNoteProps) {
  return (
    <div className="note-normal-block">
      {title && <h3 className="note-card-title" style={{ marginBottom: '8px' }}>{title}</h3>}
      <div className="note-normal-body">
        <RichText text={body} />
      </div>
    </div>
  );
}
