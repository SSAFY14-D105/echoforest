import styles from './LoginPage.module.css';
import LoginForm from '../../../components/LoginForm/LoginForm';

interface Props {
  onLoginSuccess: (nickname: string) => void;
  onBack: () => void;
}

export default function LoginPage({ onLoginSuccess, onBack }: Props) {
  return (
    <div className={styles.container}>
      {/* 배경 이미지 */}
      <img
        className={styles.bgImage}
        src="/assets/backgrounds/login_page.png"
        alt="Login Background"
      />

      {/* 로그인 폼 영역 */}
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>로그인</h1>
        <LoginForm onLoginSuccess={onLoginSuccess} onSwitchMode={onBack} />
      </div>
    </div>
  );
}