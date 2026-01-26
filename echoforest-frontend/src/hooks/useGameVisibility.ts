import { useState, useEffect } from 'react';

export function useGameVisibility() {
    const [isHidden, setIsHidden] = useState(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsHidden(document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isHidden;
}
