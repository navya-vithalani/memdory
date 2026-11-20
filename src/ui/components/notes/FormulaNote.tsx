import { RichText } from '../RichText';

type FormulaNoteProps = {
  title?: string | null;
  body: string;
};

export function FormulaNote({ title, body }: FormulaNoteProps) {
  // Ensure formula has display math $$ if not already formatted with $
  const formattedBody = body.includes('$') ? body : `$$${body}$$`;

  return (
    <div className="note-formula-card">
      <div className="note-formula-body">
        <RichText text={formattedBody} />
      </div>
      {title && <span className="note-formula-caption">{title}</span>}
    </div>
  );
}
