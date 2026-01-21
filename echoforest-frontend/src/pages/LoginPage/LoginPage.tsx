import { useState, useEffect } from 'react';
import styles from './LoginPage.module.css';
import { login, signup, checkLoginId } from '../../apis/authApi';

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
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [idCheckStatus, setIdCheckStatus] = useState<'unchecked' | 'checking' | 'available' | 'duplicate'>('unchecked');

  // 아이디 중복 확인 (debounce)
  useEffect(() => {
    if (mode !== 'signup') {
      setIdCheckStatus('unchecked');
      return;
    }

    // 아이디가 비어있거나 4자 미만이면 확인 안함
    if (!id || id.length < 4) {
      setIdCheckStatus('unchecked');
      return;
    }

    // 영문/숫자 검증
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
      setIdCheckStatus('unchecked');
      return;
    }

    setIdCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkLoginId(id);
        setIdCheckStatus(res.isDuplicate ? 'duplicate' : 'available');
      } catch {
        setIdCheckStatus('unchecked');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [id, mode]);

  // 입력값 검증
  const validate = (): boolean => {
    if (!id.trim()) {
      setError('아이디를 입력해주세요.');
      return false;
    }

    if (mode === 'signup') {
      // 회원가입 시 loginId 형식 검증
      if (!/^[a-zA-Z0-9]+$/.test(id)) {
        setError('아이디는 영문과 숫자만 사용 가능합니다.');
        return false;
      }
      if (id.length < 4 || id.length > 20) {
        setError('아이디는 4~20자 사이여야 합니다.');
        return false;
      }
    }

    if (!pw.trim()) {
      setError('비밀번호를 입력해주세요.');
      return false;
    }

    if (mode === 'signup') {
      if (pw.length < 8) {
        setError('비밀번호는 최소 8자 이상이어야 합니다.');
        return false;
      }
      if (pw !== pwConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return false;
      }
      if (!nickname.trim()) {
        setError('닉네임을 입력해주세요.');
        return false;
      }
      if (!email.trim()) {
        setError('이메일을 입력해주세요.');
        return false;
      }
      // 이메일 형식 검증
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('올바른 이메일 형식이 아닙니다.');
        return false;
      }
      // 아이디 중복 확인
      if (idCheckStatus !== 'available') {
        setError('아이디 중복 확인이 필요합니다.');
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
      const res = await login({ username: id, password: pw });
      // 백엔드 명세서: { token: "...", nickname: "..." }
      if (res.token) {
        // JWT 토큰과 닉네임을 localStorage에 저장
        localStorage.setItem('token', res.token);
        localStorage.setItem('loginId', id);
        localStorage.setItem('nickname', res.nickname);
        onLogin(res.nickname);  // ✅ 닉네임으로 로그인 처리
      } else {
        setError('로그인에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('로그인 에러:', err);
      setError(err?.message || '서버에 연결할 수 없습니다.');
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
      const res = await signup({
        username: id,
        password: pw,
        nickname,
        email
      });
      // 백엔드 명세서: { message: "회원가입 성공" }
      if (res.message) {
        alert(res.message + ' 로그인해주세요.');
        setMode('login');
        setPwConfirm('');
        setNickname('');
        setEmail('');
      }
    } catch (err: any) {
      console.error('회원가입 에러:', err);
      setError(err?.message || '서버에 연결할 수 없습니다.');
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
    setEmail('');
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

        {mode === 'signup' && id.length >= 4 && (
          <p className={`${styles.idCheck} ${idCheckStatus === 'checking' ? styles.checking :
            idCheckStatus === 'available' ? styles.available :
              idCheckStatus === 'duplicate' ? styles.duplicate : ''
            }`}>
            {idCheckStatus === 'checking' && '⏳ 확인 중...'}
            {idCheckStatus === 'available' && '✅ 사용 가능한 아이디입니다'}
            {idCheckStatus === 'duplicate' && '❌ 이미 사용 중인 아이디입니다'}
          </p>
        )}

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
            <input
              className={styles.input}
              type="email"
              placeholder="이메일 (예: ssafy@ssafy.com)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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