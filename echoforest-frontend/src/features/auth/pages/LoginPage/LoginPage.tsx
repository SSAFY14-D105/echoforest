import { useState } from 'react';
import styles from './LoginPage.module.css';
import LoginForm from '../../components/LoginForm';
import SignupForm from '../../components/SignupForm';

interface Props {
  onLogin: (nickname: string) => void;
}

type Mode = 'login' | 'signup';

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('login');

  const handleSignupSuccess = () => {
    setMode('login');
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.box} pixel-box`}>
        {mode === 'login' ? (
          <LoginForm
            onLoginSuccess={onLogin}
            onSwitchMode={() => setMode('signup')}
          />
        ) : (
          <SignupForm
            onSignupSuccess={handleSignupSuccess}
            onSwitchMode={() => setMode('login')}
          />
        )}
      </div>
    </div>
  );
}