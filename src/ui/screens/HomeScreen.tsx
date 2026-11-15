import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mascotHappy from '../../assets/mascot/mnemo-side-happy.svg';
import type { TreeNode } from '../../types';
import { listNodes } from '../../data/repositories/treeRepository';
import { TreeManager } from '../components/TreeManager';

export function HomeScreen() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void listNodes().then((items) => {
      if (active) setNodes(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the study tree.');
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="screen home-screen">
      <header className="home-header">
        <div>
          <p className="eyebrow">Remembery</p>
          <h1>Ready when you are</h1>
        </div>
        <button className="primary-button" onClick={() => navigate('/cards')} disabled={nodes.length === 0}>
          Start session
        </button>
      </header>

      <section className="hero-panel">
        <div>
          <p className="eyebrow">Your study space</p>
          <h2>{nodes.length === 0 ? 'Start with an area' : `${nodes.length} topics`}</h2>
          <p className="muted">Your notes and cards stay on this device.</p>
        </div>
        <img className="home-mascot" src={mascotHappy} alt="" />
      </section>

      {error && <p className="error-message" role="alert">{error}</p>}
      <TreeManager nodes={nodes} onChange={setNodes} />
    </main>
  );
}
