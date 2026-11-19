import { Link } from 'react-router-dom';
import { Mnemo } from '../components/Mnemo';

export function BrowseScreen() {
  return (
    <main className="screen placeholder-screen">
      <Mnemo mood="sleepy" />
      <h1>Browse cards</h1>
      <p className="muted">Soon you’ll be able to look through every card here. Check back after the next update.</p>
      <Link to="/cards" className="secondary-button">Back to Cards</Link>
    </main>
  );
}
