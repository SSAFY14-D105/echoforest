import { useState } from 'react';
import styles from './LoginPage.module.css';
import { login, signup } from '../../apis/authApi';

interface Props {
  onLogin: (nickname: string) => void;
}

type Mode = 'login' | 'signup';

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 입력값 검증
  const validate = (): boolean => {
    if (!id.trim()) {
      setError('아이디를 입력해주세요.');
      return false;
    }
    if (!pw.trim()) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }
    if (mode === 'signup') {
      if (pw !== pwConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return false;
      }
      if (!nickname.trim()) {
        setError('닉네임을 입력해주세요.');
        return false;
      }
    }
    return true;
  };

  // 로그인 처리
  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');

    try {
      const res = await login({ id, password: pw });
      if (res.success && res.data) {
        onLogin(res.data.nickname || id);
      } else {
        setError(res.message || '로그인에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 처리
  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');

    try {
      const res = await signup({ id, password: pw, nickname });
      if (res.success) {
        alert('회원가입이 완료되었습니다! 로그인해주세요.');
        setMode('login');
        setPwConfirm('');
        setNickname('');
      } else {
        setError(res.message || '회원가입에 실패했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPwConfirm('');
    setNickname('');
  };

  return (
    <div className={styles.container}>
      <form className={`${styles.box} pixel-box`} onSubmit={handleSubmit}>
        <h1 className={styles.title}>뽀뽀뽀(가제)</h1>

        <input
          className={styles.input}
          placeholder="아이디"
          value={id}
          onChange={(e) => setId(e.target.value)}
          disabled={loading}
        />

        <input
          className={styles.input}
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          disabled={loading}
        />

        {mode === 'signup' && (
          <>
            <input
              className={styles.input}
              type="password"
              placeholder="비밀번호 확인"
              value={pwConfirm}
              onChange={(e) => setPwConfirm(e.target.value)}
              disabled={loading}
            />
            <input
              className={styles.input}
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
            />
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.btn} disabled={loading}>
          {loading ? '처리중...' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        <button
          type="button"
          className={styles.linkBtn}
          onClick={toggleMode}
          disabled={loading}
        >
          {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </form>
    </div>
  );
}