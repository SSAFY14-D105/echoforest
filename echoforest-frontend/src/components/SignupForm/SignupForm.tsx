import { useState, useEffect } from 'react';
import { signup, checkLoginId } from '../../apis/authApi';
import styles from './SignupForm.module.css';

interface SignupFormProps {
    onSignupSuccess: () => void;
    onSwitchMode: () => void;
}

export default function SignupForm({ onSignupSuccess, onSwitchMode }: SignupFormProps) {
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
    }, [id]);

    // 입력값 검증
    const validate = (): boolean => {
        if (!id.trim()) {
            setError('아이디를 입력해주세요.');
            return false;
        }
        // 회원가입 시 loginId 형식 검증
        if (!/^[a-zA-Z0-9]+$/.test(id)) {
            setError('아이디는 영문과 숫자만 사용 가능합니다.');
            return false;
        }
        if (id.length < 4 || id.length > 20) {
            setError('아이디는 4~20자 사이여야 합니다.');
            return false;
        }

        if (!pw.trim()) {
            setError('비밀번호를 입력해주세요.');
            return false;
        }
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

        return true;
    };

    // 회원가입 처리
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
                onSignupSuccess();
            }
        } catch (err: any) {
            console.error('회원가입 에러:', err);
            setError(err?.message || '회원가입에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h1 className={styles.title}>회원가입</h1>

            <input
                className={styles.input}
                placeholder="아이디"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={loading}
            />

            {id.length >= 4 && (
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

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? '가입 중...' : '회원가입'}
            </button>

            <button
                type="button"
                className={styles.linkBtn}
                onClick={onSwitchMode}
                disabled={loading}
            >
                이미 계정이 있으신가요? 로그인
            </button>
        </form>
    );
}
