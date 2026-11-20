import { useEffect, useState } from 'react';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || Reflect.get(navigator, 'standalone') === true;
}

function getInstallInstructions(): string {
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return 'Install requires a secure HTTPS website. Open the published HTTPS address on your phone, then use your browser menu to install or add it to your Home Screen.';
  }
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return 'In Safari, tap Share, then Add to Home Screen.';
  }
  return 'In Chrome, open the ⋮ menu and tap Install app or Add to Home screen. In other browsers, use the browser menu’s install option.';
}

export function PwaInstall() {
  const [standalone, setStandalone] = useState(isStandalone);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      setShowInstructions(false);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowInstructions((visible) => !visible);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setStandalone(true);
      else setShowInstructions(true);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The browser could not start installation.');
    }
  }

  if (standalone) return null;

  return (
    <aside className="pwa-install" aria-label="Install app">
      <button className="install-button" onClick={() => void install()}>
        {installPrompt ? 'Install memdory' : 'Add to Home Screen'}
      </button>
      {showInstructions && <p className="install-instructions">{getInstallInstructions()}</p>}
      {error && <p className="error-message" role="alert">{error}</p>}
    </aside>
  );
}
