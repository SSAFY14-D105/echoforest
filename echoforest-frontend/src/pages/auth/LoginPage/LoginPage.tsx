import { useState } from 'react';
import styles from './LoginPage.module.css';
import LoginForm from '../../../components/LoginForm/LoginForm';
import SignupForm from '../../../components/SignupForm/SignupForm';

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
      <img
        className={styles.bgImage}
        src="/assets/backgrounds/login_bg.gif"
        alt="Login Background"
      />
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