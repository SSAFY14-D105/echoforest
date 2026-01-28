import styles from './SignupPage.module.css';
import SignupForm from '../../../components/SignupForm/SignupForm';

interface Props {
    onSignupSuccess: () => void;
    onBack: () => void;
}

export default function SignupPage({ onSignupSuccess, onBack }: Props) {
    return (
        <div className={styles.container}>
            {/* 배경 이미지 */}
            <img
                className={styles.bgImage}
                src="/assets/backgrounds/login_page.png"
                alt="Signup Background"
            />

            {/* 회원가입 폼 영역 */}
            <div className={styles.formWrapper}>
                <h1 className={styles.title}>회원가입</h1>
                <SignupForm onSignupSuccess={onSignupSuccess} onSwitchMode={onBack} />
            </div>
        </div>
    );
}
