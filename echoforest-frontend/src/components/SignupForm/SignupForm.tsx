import { useState, useEffect } from 'react';
import { signup, checkLoginId, checkNickname } from '../../apis/authApi';
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
    const [nicknameCheckStatus, setNicknameCheckStatus] = useState<'unchecked' | 'checking' | 'available' | 'duplicate'>('unchecked');

    // 아이디 중복 확인 (debounce)
    useEffect(() => {
        if (!id || id.length < 4) {
            setIdCheckStatus('unchecked');
            return;
        }
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
        }, 500);

        return () => clearTimeout(timer);
    }, [id]);

    // 닉네임 중복 확인 (debounce)
    useEffect(() => {
        if (!nickname || nickname.length < 2) {
            setNicknameCheckStatus('unchecked');
            return;
        }

        setNicknameCheckStatus('checking');
        const timer = setTimeout(async () => {
            try {
                const res = await checkNickname(nickname);
                setNicknameCheckStatus(res.isDuplicate ? 'duplicate' : 'available');
            } catch {
                setNicknameCheckStatus('unchecked');
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [nickname]);

    // 입력값 검증
    const validate = (): boolean => {
        if (!id.trim()) {
            setError('아이디를 입력해주세요.');
            return false;
        }
        if (!/^[a-zA-Z0-9]+$/.test(id)) {
            setError('아이디는 영문과 숫자만 사용 가능합니다.');
            return false;
        }
        // (ID validation continued) ...
        if (id.length < 4 || id.length > 20) {
            setError('아이디는 4~20자 사이여야 합니다.');
            return false;
        }
        if (idCheckStatus !== 'available') {
            setError('아이디 중복 확인이 필요합니다.');
            return false;
        }

        // Nickname validation moved second
        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            return false;
        }
        if (nickname.length < 2) {
            setError('닉네임은 최소 2자 이상이어야 합니다.');
            return false;
        }
        if (nicknameCheckStatus !== 'available') {
            setError('닉네임 중복 확인이 필요합니다.');
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
        if (!email.trim()) {
            setError('이메일을 입력해주세요.');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('올바른 이메일 형식이 아닙니다.');
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
        <form className={styles.form} onSubmit={handleSubmit}>
            {/* 아이디 */}
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
            {/* 한글 입력 경고 */}
            {id && /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(id) && (
                <p className={styles.checkStatus} style={{ color: '#ff6b6b' }}>
                    ⚠️ 영문과 숫자만 사용 가능합니다
                </p>
            )}
            {/* 중복 확인 상태 (한글이 없을 때만 표시) */}
            {id.length >= 4 && !/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(id) && (
                <p className={`${styles.checkStatus} ${idCheckStatus === 'checking' ? styles.checking :
                    idCheckStatus === 'available' ? styles.available :
                        idCheckStatus === 'duplicate' ? styles.duplicate : ''
                    }`}>
                    {idCheckStatus === 'checking' && '⏳ 확인 중...'}
                    {idCheckStatus === 'available' && '✅ 사용 가능'}
                    {idCheckStatus === 'duplicate' && '❌ 이미 사용 중'}
                </p>
            )}

            {/* 닉네임 */}
            <div className={styles.inputGroup}>
                <label className={styles.label}>닉네임</label>
                <input
                    className={styles.input}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={loading}
                />
            </div>
            {nickname.length >= 2 && (
                <p className={`${styles.checkStatus} ${nicknameCheckStatus === 'checking' ? styles.checking :
                    nicknameCheckStatus === 'available' ? styles.available :
                        nicknameCheckStatus === 'duplicate' ? styles.duplicate : ''
                    }`}>
                    {nicknameCheckStatus === 'checking' && '⏳ 확인 중...'}
                    {nicknameCheckStatus === 'available' && '✅ 사용 가능'}
                    {nicknameCheckStatus === 'duplicate' && '❌ 이미 사용 중'}
                </p>
            )}

            {/* 비밀번호 */}
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

            {/* 비밀번호 확인 */}
            <div className={styles.inputGroup}>
                <label className={styles.label}>비밀번호 확인</label>
                <input
                    className={styles.input}
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    disabled={loading}
                />
            </div>

            {/* 이메일 */}
            <div className={styles.inputGroup}>
                <label className={styles.label}>이메일</label>
                <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                />
            </div>

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
                ← 뒤로가기
            </button>
        </form>
    );
}
