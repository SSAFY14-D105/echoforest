import { useState } from 'react';
import { login } from '../../apis/authApi';
import styles from './LoginForm.module.css';

interface LoginFormProps {
    onLoginSuccess: (nickname: string) => void;
    onSwitchMode: () => void;
}

export default function LoginForm({ onLoginSuccess, onSwitchMode }: LoginFormProps) {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
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
        return true;
    };

    // 로그인 처리
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        setError('');

        try {
            const res = await login({ username: id, password: pw });
            if (res.token) {
                localStorage.setItem('token', res.token);
                localStorage.setItem('loginId', id);
                localStorage.setItem('nickname', res.nickname);
                localStorage.setItem('userId', String(res.userId)); // userId 저장
                onLoginSuccess(res.nickname);
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

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            {/* 라벨 + 인풋 그룹 */}
            <div className={styles.inputGroup}>
                <label className={styles.label}>아이디</label>
                <input
                    className={styles.input}
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    disabled={loading}
                    autoFocus
                />
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.label}>비밀번호</label>
                <input
                    className={styles.input}
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    disabled={loading}
                />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
            </button>

            <button
                type="button"
                className={styles.linkBtn}
                onClick={onSwitchMode}
                disabled={loading}
            >
                ← 뒤로가기
            </button>
        </form>
    );
}
